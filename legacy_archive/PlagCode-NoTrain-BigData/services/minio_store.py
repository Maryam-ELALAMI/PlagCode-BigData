from __future__ import annotations
from minio import Minio
from minio.error import S3Error
from plagcode.config import settings
import io
import json

def client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=False,
    )

def ensure_bucket() -> None:
    c = client()
    if not c.bucket_exists(settings.minio_bucket):
        c.make_bucket(settings.minio_bucket)

def put_json(object_key: str, payload: dict) -> None:
    ensure_bucket()
    data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    c = client()
    c.put_object(
        settings.minio_bucket,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type="application/json",
    )


def get_json(object_key: str) -> dict:
    """Fetch a JSON object stored in MinIO and parse it.

    Raises minio.error.S3Error if the object or bucket does not exist.
    """
    c = client()
    resp = c.get_object(settings.minio_bucket, object_key)
    try:
        raw = resp.read()
    finally:
        resp.close()
        resp.release_conn()
    return json.loads(raw.decode("utf-8"))
