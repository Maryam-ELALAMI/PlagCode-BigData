from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict

import orjson

from ..config import get_settings
from ..db import ensure_schema, make_engine, make_sessionmaker
from ..kafka import make_consumer, make_envelope, make_producer, stable_sha256_hex
from ..logging_utils import configure_logging
from ..redis_cache import make_redis, tokens_key
from ..repository import (
    append_scan_log,
    count_results,
    get_total_pairs,
    try_mark_done_emitted,
    update_scan_status_progress,
    upsert_result,
)
from ..similarity import jaccard_percent
from .common import handle_fatal

logger = logging.getLogger("plagcode.scoring")


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.plagcode_log_level)

    engine = make_engine(settings.postgres_dsn)
    await ensure_schema(engine)
    SessionLocal = make_sessionmaker(engine)

    producer = await make_producer(settings.kafka_bootstrap_servers, settings.kafka_client_id)
    consumer = await make_consumer(
        topic=settings.topic_candidates,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.worker_group_id,
        client_id=settings.kafka_client_id,
    )

    redis_client = make_redis(settings.redis_url)

    logger.info("Scoring worker started")

    try:
        async for msg in consumer:
            event = msg.value
            scan_id = event.get("scan_id")
            correlation_id = event.get("correlation_id") or ""
            payload = event.get("payload") or {}

            async with SessionLocal() as session:
                try:
                    a_id = int(payload["file_a_id"])
                    b_id = int(payload["file_b_id"])
                    # Canonical ordering to match DB unique key.
                    if a_id > b_id:
                        a_id, b_id = b_id, a_id

                    checksum_a = payload["checksum_a"]
                    checksum_b = payload["checksum_b"]

                    ta = await redis_client.get(tokens_key(checksum_a))
                    tb = await redis_client.get(tokens_key(checksum_b))
                    if ta is None or tb is None:
                        raise RuntimeError("Missing tokens in Redis (normalizer cache miss).")

                    tokens_a = orjson.loads(ta)
                    tokens_b = orjson.loads(tb)

                    score = float(jaccard_percent(tokens_a, tokens_b))

                    await upsert_result(
                        session,
                        scan_id=scan_id,
                        file_a_id=a_id,
                        file_b_id=b_id,
                        score=score,
                        details={"pair_id": payload.get("pair_id")},
                    )

                    total_pairs = await get_total_pairs(session, scan_id=scan_id)
                    done = False
                    progress = None
                    if total_pairs and total_pairs > 0:
                        processed = await count_results(session, scan_id=scan_id)
                        progress = int(min(99, round((processed / total_pairs) * 100)))
                        done = processed >= total_pairs

                    if progress is not None:
                        await update_scan_status_progress(
                            session,
                            scan_id=scan_id,
                            status=None,
                            progress=progress,
                            params_patch={},
                        )

                    if done:
                        await update_scan_status_progress(
                            session,
                            scan_id=scan_id,
                            status="DONE",
                            progress=100,
                            params_patch={},
                        )
                        await append_scan_log(session, scan_id=scan_id, message="Scoring complete (DONE)")

                        if await try_mark_done_emitted(session, scan_id=scan_id):
                            idem = stable_sha256_hex("code.scored", scan_id)
                            out = make_envelope(
                                event_type="code.scored",
                                scan_id=scan_id,
                                correlation_id=correlation_id,
                                idempotency_key=idem,
                                payload={
                                    "scan_id": scan_id,
                                    "completed_at_ms": int(time.time() * 1000),
                                    "total_pairs": total_pairs,
                                },
                            )
                            await producer.send_and_wait(settings.topic_scored, key=idem, value=out)

                    await session.commit()
                    await consumer.commit()
                except Exception as e:
                    await session.rollback()
                    async with SessionLocal() as s2:
                        await handle_fatal(
                            service="scoring-worker",
                            scan_id=scan_id,
                            correlation_id=correlation_id,
                            topic_deadletter=settings.topic_deadletter,
                            producer=producer,
                            session=s2,
                            err=e,
                            original_topic=settings.topic_candidates,
                            original_event=event,
                            record=msg,
                            error_code="SCORING_FAILED",
                        )
                        await s2.commit()
                    await consumer.commit()
    finally:
        await consumer.stop()
        await producer.stop()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
