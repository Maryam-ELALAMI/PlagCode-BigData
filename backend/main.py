"""Compatibility shim.

Historically, the repo exposed a demo FastAPI app in this file that kept scan
state in RAM (Python dict). The new architecture is event-driven and stateless:
Postgres is the source of truth and Kafka drives the pipeline.

We keep this file so that any older imports (main:app) still work.
"""

from app.main import app  # noqa: F401
