from __future__ import annotations

import re
from typing import Iterable, List, Sequence, Set


_TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|\d+|==|!=|<=|>=|->|\+\+|--|&&|\|\||[{}()\[\];,.:+\-*/%<>=]", re.M)


def normalize_code(text: str) -> str:
    # Pragmatic normalization: strip trailing whitespace + collapse blank lines.
    lines = [ln.rstrip() for ln in text.splitlines()]
    # Drop fully empty leading/trailing lines
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines)


def tokenize(text: str) -> List[str]:
    # Keep a simple lexer-ish tokenization (works across many languages).
    return _TOKEN_RE.findall(text)


def jaccard_percent(tokens_a: Sequence[str], tokens_b: Sequence[str]) -> float:
    if not tokens_a and not tokens_b:
        return 100.0
    if not tokens_a or not tokens_b:
        return 0.0

    set_a: Set[str] = set(tokens_a)
    set_b: Set[str] = set(tokens_b)
    inter = len(set_a.intersection(set_b))
    uni = len(set_a.union(set_b))
    if uni == 0:
        return 0.0
    return (inter / uni) * 100.0
