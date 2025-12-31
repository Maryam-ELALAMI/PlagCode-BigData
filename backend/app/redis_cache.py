from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import redis.asyncio as redis


@dataclass
class RedisCache:
    client: redis.Redis


def make_redis(url: str) -> redis.Redis:
    return redis.from_url(url, decode_responses=False)


def norm_key(checksum: str) -> str:
    return f"norm:{checksum}"


def tokens_key(checksum: str) -> str:
    return f"tokens:{checksum}"
