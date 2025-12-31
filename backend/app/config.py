from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    # Core infra
    postgres_dsn: str = "postgresql://plag:plag@postgres:5432/plagdb"
    redis_url: str = "redis://redis:6379/0"
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_client_id: str = "plagcode"

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minio"
    minio_secret_key: str = "minio123"
    minio_bucket: str = "plagcode-uploads"
    minio_secure: bool = False

    # Behavior
    plagcode_log_level: str = "INFO"

    # Worker
    worker_group_id: str = "plagcode-worker"

    # Topics
    topic_submitted: str = "code.submitted"
    topic_normalized: str = "code.normalized"
    topic_candidates: str = "code.candidates"
    topic_scored: str = "code.scored"
    topic_deadletter: str = "code.deadletter"


def get_settings() -> Settings:
    return Settings()
