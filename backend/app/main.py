from __future__ import annotations

import hashlib
import logging
import mimetypes
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import get_settings
from .db import ensure_schema, make_engine, make_sessionmaker
from .kafka import make_envelope, make_producer, new_correlation_id, stable_sha256_hex
from .logging_utils import configure_logging
from .minio_client import MinioConfig, ensure_bucket, get_bytes, make_client, put_bytes
from .repository import (
    append_scan_log,
    create_scan,
    get_file_by_scan_and_name,
    get_scan,
    insert_alert,
    insert_file,
    list_scans_summary,
    list_alerts,
    list_files_for_scan,
    list_results_pairs_for_scan,
)

logger = logging.getLogger("plagcode.api")

app = FastAPI(title="PlagCode API", version="2.0")

# Enable CORS (keep existing dev origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


def _language_from_filename(filename: str) -> Optional[str]:
    ext = ("." + filename.split(".")[-1]).lower() if "." in filename else ""
    return {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".java": "java",
        ".cpp": "cpp",
        ".c": "c",
        ".cs": "csharp",
        ".go": "go",
        ".rb": "ruby",
        ".php": "php",
        ".rs": "rust",
        ".swift": "swift",
    }.get(ext)


@app.on_event("startup")
async def _startup() -> None:
    s = get_settings()
    configure_logging(s.plagcode_log_level)

    engine = make_engine(s.postgres_dsn)
    await ensure_schema(engine)

    SessionLocal = make_sessionmaker(engine)

    producer = await make_producer(s.kafka_bootstrap_servers, s.kafka_client_id)

    minio_cfg = MinioConfig(
        endpoint=s.minio_endpoint,
        access_key=s.minio_access_key,
        secret_key=s.minio_secret_key,
        secure=s.minio_secure,
        bucket=s.minio_bucket,
    )
    minio_client = make_client(minio_cfg)
    # If MinIO isn't ready, the dedicated minio-init will handle it; but we try anyway.
    try:
        ensure_bucket(minio_client, s.minio_bucket)
    except Exception:
        logger.warning("MinIO bucket ensure failed (will rely on minio-init)")

    app.state.settings = s
    app.state.engine = engine
    app.state.SessionLocal = SessionLocal
    app.state.producer = producer
    app.state.minio = minio_client


@app.on_event("shutdown")
async def _shutdown() -> None:
    producer = getattr(app.state, "producer", None)
    if producer is not None:
        await producer.stop()

    engine = getattr(app.state, "engine", None)
    if engine is not None:
        await engine.dispose()


@app.post("/api/scan")
async def start_scan(files: List[UploadFile] = File(...), options: str = None) -> Dict[str, Any]:
    """Upload endpoint (stateless orchestrator).

    - stores objects in MinIO
    - creates scan/files records in Postgres
    - emits code.submitted to Kafka
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Upload at least 2 files")

    scan_id = str(uuid.uuid4())
    correlation_id = new_correlation_id()
    s = app.state.settings

    params: Dict[str, Any] = {
        "options": options,
        "logs": [],
        "correlation_id": correlation_id,
        "created_at_iso": datetime.utcnow().isoformat() + "Z",
    }

    stored_files: List[Dict[str, Any]] = []

    async with app.state.SessionLocal() as session:
        try:
            await create_scan(session, scan_id=scan_id, status="PENDING", params=params)
            await append_scan_log(session, scan_id=scan_id, message="Scan created (PENDING)")

            # Save uploaded files into MinIO + DB
            for f in files:
                raw = await f.read()
                size = len(raw)
                checksum = hashlib.sha256(raw).hexdigest()

                object_key = f"{scan_id}/{uuid.uuid4()}__{f.filename}"
                content_type = f.content_type or mimetypes.guess_type(f.filename)[0] or "text/plain"

                put_bytes(
                    client=app.state.minio,
                    bucket=s.minio_bucket,
                    object_key=object_key,
                    data=raw,
                    content_type=content_type,
                )

                language = _language_from_filename(f.filename)

                file_id = await insert_file(
                    session,
                    scan_id=scan_id,
                    filename=f.filename,
                    object_key=object_key,
                    checksum=checksum,
                    language=language,
                    size=size,
                )

                stored_files.append(
                    {
                        "file_id": file_id,
                        "filename": f.filename,
                        "object_key": object_key,
                        "checksum": checksum,
                        "language": language,
                        "size": size,
                    }
                )

            await append_scan_log(session, scan_id=scan_id, message=f"Uploaded {len(stored_files)} file(s) to MinIO")
            await session.commit()
        except Exception as e:
            await session.rollback()
            # Best-effort alert
            try:
                await insert_alert(
                    session,
                    scan_id=scan_id,
                    service="api",
                    error_code="UPLOAD_FAILED",
                    message=str(e),
                    payload={"scan_id": scan_id},
                )
                await session.commit()
            except Exception:
                pass
            raise

    # Produce code.submitted
    payload = {
        "scan_id": scan_id,
        "object_bucket": s.minio_bucket,
        "files": stored_files,
        "options": options,
        "submitted_at_ms": int(datetime.utcnow().timestamp() * 1000),
    }

    idempotency_key = stable_sha256_hex("code.submitted", scan_id, correlation_id)
    envelope = make_envelope(
        event_type="code.submitted",
        scan_id=scan_id,
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        payload=payload,
    )

    try:
        await app.state.producer.send_and_wait(s.topic_submitted, key=idempotency_key, value=envelope)
    except Exception as e:
        # Mark failed in DB
        async with app.state.SessionLocal() as session:
            await insert_alert(
                session,
                scan_id=scan_id,
                service="api",
                error_code="KAFKA_PUBLISH_FAILED",
                message=str(e),
                payload={"topic": s.topic_submitted, "scan_id": scan_id},
            )
            await append_scan_log(session, scan_id=scan_id, message=f"Kafka publish failed: {e}")
            await session.execute(text("UPDATE scans SET status='FAILED' WHERE scan_id=:scan_id"), {"scan_id": scan_id})
            await session.commit()
        raise HTTPException(status_code=500, detail="Failed to enqueue scan")

    # Return compat payload expected by existing React UI
    return {"scanId": scan_id, "message": "Scan started"}


def _status_complete(status: str) -> bool:
    return status in {"DONE", "FAILED"}


@app.get("/api/scan/{scan_id}/status")
async def get_scan_status(scan_id: str) -> Dict[str, Any]:
    async with app.state.SessionLocal() as session:
        scan = await get_scan(session, scan_id)
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")

        params = scan.get("params_json") or {}
        logs = params.get("logs") or []

        return {
            "status": scan["status"],
            "progress": scan["progress"],
            "logs": logs,
            "complete": _status_complete(scan["status"]),
        }


@app.get("/api/scan/{scan_id}/results")
async def get_scan_results(scan_id: str) -> Dict[str, Any]:
    async with app.state.SessionLocal() as session:
        scan = await get_scan(session, scan_id)
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")

        if scan["status"] != "DONE":
            return {"status": "processing"}

        files = await list_files_for_scan(session, scan_id=scan_id)
        pairs = await list_results_pairs_for_scan(session, scan_id=scan_id)

        def label_for(score: float) -> str:
            return "high" if score > 70 else "medium" if score > 40 else "low"

        return {
            "meta": {
                "n_files": len(files),
                "n_pairs": len(pairs),
                # runtime_ms is kept for UI; we store approximate in params_json if available
                "runtime_ms": int((scan.get("params_json") or {}).get("runtime_ms", 0) or 0),
            },
            "pairs": [
                {
                    "file_a": p["file_a"],
                    "file_b": p["file_b"],
                    "similarity": round(float(p["score"]), 1),
                    "label": label_for(float(p["score"])),
                    "overlap_spans": (p.get("details_json") or {}).get("overlap_spans", []),
                }
                for p in pairs
            ],
        }


@app.get("/api/files/{scan_id}/{filename}")
async def get_file_content(scan_id: str, filename: str) -> Dict[str, Any]:
    s = app.state.settings
    async with app.state.SessionLocal() as session:
        f = await get_file_by_scan_and_name(session, scan_id=scan_id, filename=filename)
        if not f:
            raise HTTPException(status_code=404, detail="File not found")

    data = get_bytes(client=app.state.minio, bucket=s.minio_bucket, object_key=f["object_key"])

    # Best-effort decode
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError:
        content = data.decode("latin-1", errors="replace")

    return {"content": content}


# New schema-aligned endpoints (aliases over the same DB source of truth)
@app.get("/scans/{scan_id}/status")
async def get_scan_status_v2(scan_id: str) -> Dict[str, Any]:
    return await get_scan_status(scan_id)


@app.get("/scans/{scan_id}/results")
async def get_scan_results_v2(scan_id: str) -> Dict[str, Any]:
    return await get_scan_results(scan_id)


@app.get("/alerts")
async def get_alerts(scan_id: Optional[str] = None, limit: int = 200) -> Dict[str, Any]:
    async with app.state.SessionLocal() as session:
        rows = await list_alerts(session, scan_id=scan_id, limit=limit)
    return {"alerts": rows}


@app.get("/api/alerts")
async def get_alerts_compat(scan_id: Optional[str] = None, limit: int = 200) -> Dict[str, Any]:
    return await get_alerts(scan_id=scan_id, limit=limit)


@app.get("/api/scans")
async def list_scans(limit: int = 50) -> Dict[str, Any]:
    async with app.state.SessionLocal() as session:
        rows = await list_scans_summary(session, limit=limit)
    return {"scans": rows}


@app.get("/scans")
async def list_scans_v2(limit: int = 50) -> Dict[str, Any]:
    return await list_scans(limit=limit)
