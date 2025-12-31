from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

import orjson

from ..config import get_settings
from ..db import ensure_schema, make_engine, make_sessionmaker
from ..kafka import make_consumer, make_envelope, make_producer, stable_sha256_hex
from ..logging_utils import configure_logging
from ..minio_client import MinioConfig, get_bytes, make_client
from ..redis_cache import make_redis, norm_key, tokens_key
from ..repository import append_scan_log
from ..repository import update_scan_status_progress
from ..similarity import normalize_code, tokenize
from .common import handle_fatal

logger = logging.getLogger("plagcode.normalizer")


async def process_event(*, event: Dict[str, Any], settings, producer, minio_client, redis_client, session) -> None:
    scan_id = event["scan_id"]
    correlation_id = event.get("correlation_id") or event.get("payload", {}).get("correlation_id") or ""
    payload = event.get("payload") or {}

    files = payload.get("files") or []
    bucket = payload.get("object_bucket") or settings.minio_bucket

    await update_scan_status_progress(session, scan_id=scan_id, status="NORMALIZING", progress=1, params_patch={})
    await append_scan_log(session, scan_id=scan_id, message=f"Normalizer: received {len(files)} file(s)")

    for f in files:
        file_id = int(f["file_id"])
        object_key = f["object_key"]
        checksum = f["checksum"]
        language = f.get("language")

        nkey = norm_key(checksum)
        tkey = tokens_key(checksum)

        cache_hit = await redis_client.exists(nkey) and await redis_client.exists(tkey)
        if not cache_hit:
            raw = get_bytes(client=minio_client, bucket=bucket, object_key=object_key)
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                text = raw.decode("latin-1", errors="replace")

            norm = normalize_code(text)
            toks = tokenize(norm)

            # Store bytes to keep redis small-ish and fast.
            await redis_client.set(nkey, norm.encode("utf-8"))
            await redis_client.set(tkey, orjson.dumps(toks))

        idempotency_key = stable_sha256_hex("code.normalized", scan_id, str(file_id), checksum)
        out = make_envelope(
            event_type="code.normalized",
            scan_id=scan_id,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
            payload={
                "scan_id": scan_id,
                "file_id": file_id,
                "object_bucket": bucket,
                "object_key": object_key,
                "checksum": checksum,
                "language": language,
                "cache_hit": bool(cache_hit),
                "normalized_ref": {"redis_norm_key": nkey, "redis_tokens_key": tkey},
            },
        )
        await producer.send_and_wait(settings.topic_normalized, key=idempotency_key, value=out)

    await append_scan_log(session, scan_id=scan_id, message="Normalizer: emitted code.normalized")


async def main() -> None:
    settings = get_settings()
    configure_logging(settings.plagcode_log_level)

    engine = make_engine(settings.postgres_dsn)
    await ensure_schema(engine)
    SessionLocal = make_sessionmaker(engine)

    producer = await make_producer(settings.kafka_bootstrap_servers, settings.kafka_client_id)
    consumer = await make_consumer(
        topic=settings.topic_submitted,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.worker_group_id,
        client_id=settings.kafka_client_id,
    )

    redis_client = make_redis(settings.redis_url)

    minio_cfg = MinioConfig(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        bucket=settings.minio_bucket,
    )
    minio_client = make_client(minio_cfg)

    logger.info("Normalizer worker started")

    try:
        async for msg in consumer:
            event = msg.value
            scan_id = event.get("scan_id")
            correlation_id = event.get("correlation_id") or ""
            async with SessionLocal() as session:
                try:
                    await process_event(
                        event=event,
                        settings=settings,
                        producer=producer,
                        minio_client=minio_client,
                        redis_client=redis_client,
                        session=session,
                    )
                    await session.commit()
                    await consumer.commit()
                except Exception as e:
                    await session.rollback()
                    # DLQ + alert then commit offset to avoid poison pill loops.
                    async with SessionLocal() as s2:
                        await handle_fatal(
                            service="normalizer-worker",
                            scan_id=scan_id,
                            correlation_id=correlation_id,
                            topic_deadletter=settings.topic_deadletter,
                            producer=producer,
                            session=s2,
                            err=e,
                            original_topic=settings.topic_submitted,
                            original_event=event,
                            record=msg,
                            error_code="NORMALIZE_FAILED",
                        )
                        await s2.commit()
                    await consumer.commit()
    finally:
        await consumer.stop()
        await producer.stop()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
