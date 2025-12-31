from __future__ import annotations

import logging
import traceback
from typing import Any, Dict, Optional

from aiokafka.structs import ConsumerRecord

from ..kafka import make_envelope, stable_sha256_hex
from ..repository import append_scan_log, insert_alert, update_scan_status_progress

logger = logging.getLogger("plagcode.worker")


async def handle_fatal(
    *,
    service: str,
    scan_id: Optional[str],
    correlation_id: str,
    topic_deadletter: str,
    producer,
    session,
    err: Exception,
    original_topic: str,
    original_event: Dict[str, Any],
    record: Optional[ConsumerRecord] = None,
    error_code: str = "UNHANDLED",
) -> None:
    tb = traceback.format_exc(limit=50)
    payload = {
        "original_topic": original_topic,
        "original_event": original_event,
        "error": str(err),
        "traceback": tb,
    }
    if record is not None:
        payload.update({"partition": record.partition, "offset": record.offset})

    await insert_alert(
        session,
        scan_id=scan_id,
        service=service,
        error_code=error_code,
        message=str(err),
        payload=payload,
    )
    if scan_id:
        await append_scan_log(session, scan_id=scan_id, message=f"{service} fatal: {error_code}: {err}")
        # Make failure visible to the UI (Postgres is the source of truth).
        await update_scan_status_progress(session, scan_id=scan_id, status="FAILED", progress=100, params_patch={})

    idempotency_key = stable_sha256_hex("code.deadletter", service, scan_id or "", correlation_id, error_code)
    envelope = make_envelope(
        event_type="code.deadletter",
        scan_id=scan_id or "00000000-0000-0000-0000-000000000000",
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        payload=payload,
    )

    await producer.send_and_wait(topic_deadletter, key=idempotency_key, value=envelope)
