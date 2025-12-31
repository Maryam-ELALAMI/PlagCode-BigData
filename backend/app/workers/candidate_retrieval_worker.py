from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List

from ..config import get_settings
from ..db import ensure_schema, make_engine, make_sessionmaker
from ..kafka import make_consumer, make_envelope, make_producer, stable_sha256_hex
from ..logging_utils import configure_logging
from ..repository import (
    append_scan_log,
    count_files_normalized,
    list_files_for_scan,
    mark_file_normalized,
    try_mark_pairs_generated,
    update_scan_status_progress,
)
from .common import handle_fatal

logger = logging.getLogger("plagcode.candidate_retrieval")


def _pairwise(file_rows: List[Dict[str, Any]]):
    for i in range(len(file_rows)):
        for j in range(i + 1, len(file_rows)):
            yield file_rows[i], file_rows[j]


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.plagcode_log_level)

    engine = make_engine(settings.postgres_dsn)
    await ensure_schema(engine)
    SessionLocal = make_sessionmaker(engine)

    producer = await make_producer(settings.kafka_bootstrap_servers, settings.kafka_client_id)
    consumer = await make_consumer(
        topic=settings.topic_normalized,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.worker_group_id,
        client_id=settings.kafka_client_id,
    )

    logger.info("Candidate-retrieval worker started")

    try:
        async for msg in consumer:
            event = msg.value
            scan_id = event.get("scan_id")
            correlation_id = event.get("correlation_id") or ""
            payload = event.get("payload") or {}

            async with SessionLocal() as session:
                try:
                    file_id = int(payload["file_id"])
                    await mark_file_normalized(session, file_id=file_id)
                    await append_scan_log(session, scan_id=scan_id, message=f"Candidate retrieval: file {file_id} normalized")

                    total, normalized = await count_files_normalized(session, scan_id=scan_id)

                    # Generate candidates only once, when all files are normalized.
                    if total > 1 and normalized == total:
                        file_rows = await list_files_for_scan(session, scan_id=scan_id)
                        total_pairs = (len(file_rows) * (len(file_rows) - 1)) // 2

                        ok = await try_mark_pairs_generated(session, scan_id=scan_id, total_pairs=total_pairs)
                        if ok:
                            await update_scan_status_progress(
                                session,
                                scan_id=scan_id,
                                status="SCORING",
                                progress=5,
                                params_patch={"normalized_files": normalized, "total_files": total},
                            )
                            await append_scan_log(session, scan_id=scan_id, message=f"Generating {total_pairs} candidate pair(s)")

                            for fa, fb in _pairwise(file_rows):
                                a_id = int(fa["id"])
                                b_id = int(fb["id"])
                                # Canonical ordering for idempotence + DB unique constraint.
                                if a_id > b_id:
                                    a_id, b_id = b_id, a_id
                                    fa, fb = fb, fa

                                pair_id = stable_sha256_hex(scan_id, str(a_id), str(b_id))
                                idem = stable_sha256_hex("code.candidates", pair_id)

                                out = make_envelope(
                                    event_type="code.candidates",
                                    scan_id=scan_id,
                                    correlation_id=correlation_id,
                                    idempotency_key=idem,
                                    payload={
                                        "scan_id": scan_id,
                                        "pair_id": pair_id,
                                        "file_a_id": a_id,
                                        "file_b_id": b_id,
                                        "checksum_a": fa["checksum"],
                                        "checksum_b": fb["checksum"],
                                        "language_a": fa.get("language"),
                                        "language_b": fb.get("language"),
                                    },
                                )
                                await producer.send_and_wait(settings.topic_candidates, key=idem, value=out)

                            await append_scan_log(session, scan_id=scan_id, message="Candidate retrieval: emitted code.candidates")

                    await session.commit()
                    await consumer.commit()
                except Exception as e:
                    await session.rollback()
                    async with SessionLocal() as s2:
                        await handle_fatal(
                            service="candidate-retrieval-worker",
                            scan_id=scan_id,
                            correlation_id=correlation_id,
                            topic_deadletter=settings.topic_deadletter,
                            producer=producer,
                            session=s2,
                            err=e,
                            original_topic=settings.topic_normalized,
                            original_event=event,
                            record=msg,
                            error_code="CANDIDATE_FAILED",
                        )
                        await s2.commit()
                    await consumer.commit()
    finally:
        await consumer.stop()
        await producer.stop()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
