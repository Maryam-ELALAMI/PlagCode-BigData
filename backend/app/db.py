from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text


def make_engine(postgres_dsn: str) -> AsyncEngine:
    # SQLAlchemy expects async driver
    if postgres_dsn.startswith("postgresql://"):
        postgres_dsn = postgres_dsn.replace("postgresql://", "postgresql+asyncpg://", 1)
    return create_async_engine(postgres_dsn, pool_pre_ping=True)


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS scans (
      scan_id UUID PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      params_json JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS files (
      id BIGSERIAL PRIMARY KEY,
      scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      object_key TEXT NOT NULL,
      checksum TEXT NOT NULL,
      language TEXT,
      size BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      normalized_at TIMESTAMPTZ
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_files_scan_id ON files(scan_id);",
    "CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum);",
    """
    CREATE TABLE IF NOT EXISTS results (
      id BIGSERIAL PRIMARY KEY,
      scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
      file_a_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      file_b_id BIGINT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      score DOUBLE PRECISION NOT NULL,
      details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_results_pair UNIQUE (scan_id, file_a_id, file_b_id)
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_results_scan_id ON results(scan_id);",
    """
    CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY,
      scan_id UUID,
      service TEXT NOT NULL,
      error_code TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """,
    "CREATE INDEX IF NOT EXISTS idx_alerts_scan_id ON alerts(scan_id);",
    "CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);",
]


async def ensure_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        for stmt in DDL_STATEMENTS:
            await conn.execute(text(stmt))
        await conn.execute(
            text(
                "INSERT INTO schema_migrations(version) VALUES (:v) ON CONFLICT (version) DO NOTHING"
            ),
            {"v": "001_init"},
        )
