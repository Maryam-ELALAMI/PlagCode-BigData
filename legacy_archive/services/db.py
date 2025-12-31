from __future__ import annotations
import psycopg
from plagcode.config import settings

DDL = '''
CREATE TABLE IF NOT EXISTS submissions (
  submission_id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  language TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  score_fp DOUBLE PRECISION NOT NULL,
  score_ast DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  report_object_key TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_assignment ON alerts(assignment_id, created_at DESC);
'''

def init_db() -> None:
    with psycopg.connect(settings.postgres_dsn) as conn:
        conn.execute(DDL)
        conn.commit()
