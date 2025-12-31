from __future__ import annotations
import hashlib
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any

def _rolling_hash(shingle: List[str]) -> int:
    # Stable hash -> int
    s = " ".join(shingle).encode("utf-8", errors="ignore")
    return int(hashlib.sha1(s).hexdigest()[:16], 16)

def shingles(tokens: List[str], k: int) -> List[Tuple[int, List[str]]]:
    out: List[Tuple[int, List[str]]] = []
    if k <= 0 or len(tokens) < k:
        return out
    for i in range(0, len(tokens) - k + 1):
        out.append((i, tokens[i:i+k]))
    return out

def winnow(tokens: List[str], k: int = 25, window: int = 4) -> List[Tuple[int,int]]:
    """Return selected fingerprints as list of (pos, hash)."""
    sh = shingles(tokens, k)
    hashes = [(pos, _rolling_hash(tok)) for pos, tok in sh]
    if not hashes:
        return []
    w = max(1, window)
    selected: List[Tuple[int,int]] = []

    min_hash = None
    min_pos = None
    for i in range(0, len(hashes) - w + 1):
        window_slice = hashes[i:i+w]
        # choose rightmost minimum (standard winnowing)
        mpos, mh = min(window_slice, key=lambda x: (x[1], -x[0]))
        if min_hash != mh or min_pos != mpos:
            selected.append((mpos, mh))
            min_hash, min_pos = mh, mpos
    return selected

def jaccard(set_a: set[int], set_b: set[int]) -> float:
    if not set_a and not set_b:
        return 0.0
    inter = len(set_a & set_b)
    union = len(set_a | set_b)
    return inter / union if union else 0.0

def cosine_bow(a: Dict[str,int], b: Dict[str,int]) -> float:
    # simple cosine on counts
    import math
    if not a or not b:
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for k,v in a.items():
        na += v*v
        if k in b:
            dot += v*b[k]
    for v in b.values():
        nb += v*v
    denom = (math.sqrt(na)*math.sqrt(nb))
    return float(dot/denom) if denom else 0.0
