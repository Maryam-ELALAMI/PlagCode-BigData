"""PlagCode stateless API + workers (Kafka pipeline).

This package is intentionally small and pragmatic:
- FastAPI 'api' service: upload -> MinIO, state/results -> Postgres, events -> Kafka
- Workers: normalizer -> candidate retrieval -> scoring

No in-memory scan state is kept; Postgres is the source of truth.
"""
