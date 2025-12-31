from __future__ import annotations
import os
from dataclasses import dataclass

def _env(key: str, default: str) -> str:
    return os.getenv(key, default)

@dataclass(frozen=True)
class Settings:
    kafka_bootstrap_servers: str = _env("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    kafka_client_id: str = _env("KAFKA_CLIENT_ID", "plagcode")

    topic_raw: str = "code.submissions.raw"
    topic_norm: str = "code.submissions.normalized"
    topic_candidates: str = "code.similarity.candidates"
    topic_alerts: str = "code.similarity.alerts"
    topic_deadletter: str = "code.deadletter"

    redis_url: str = _env("REDIS_URL", "redis://localhost:6379/0")
    postgres_dsn: str = _env("POSTGRES_DSN", "postgresql://plag:plag@localhost:5432/plagdb")

    minio_endpoint: str = _env("MINIO_ENDPOINT", "localhost:9000")
    minio_access_key: str = _env("MINIO_ACCESS_KEY", "minio")
    minio_secret_key: str = _env("MINIO_SECRET_KEY", "minio123")
    minio_bucket: str = _env("MINIO_BUCKET", "plagcode-reports")

    topk: int = int(_env("PLAGCODE_TOPK", "20"))
    threshold: float = float(_env("PLAGCODE_THRESHOLD", "0.72"))
    fingerprint_k: int = int(_env("PLAGCODE_FINGERPRINT_K", "25"))
    winnow_window: int = int(_env("PLAGCODE_WINNOW_WINDOW", "4"))

settings = Settings()
