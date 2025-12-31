from __future__ import annotations
import orjson
from typing import Any, Dict

def dumps(obj: Any) -> bytes:
    return orjson.dumps(obj, option=orjson.OPT_NON_STR_KEYS)

def loads(data: bytes) -> Dict[str, Any]:
    return orjson.loads(data)
