-- PlagCode event-pipeline schema (minimum viable + a few pragmatic columns)
-- This file is executed by Postgres on first init via docker-entrypoint-initdb.d

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 001: base tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001_init') THEN

    CREATE TABLE IF NOT EXISTS scans (
      scan_id UUID PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      params_json JSONB NOT NULL DEFAULT '{}'::jsonb
    );

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

    CREATE INDEX IF NOT EXISTS idx_files_scan_id ON files(scan_id);
    CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum);

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

    CREATE INDEX IF NOT EXISTS idx_results_scan_id ON results(scan_id);

    CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY,
      scan_id UUID,
      service TEXT NOT NULL,
      error_code TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_scan_id ON alerts(scan_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

    INSERT INTO schema_migrations(version) VALUES ('001_init');
  END IF;
END $$;
