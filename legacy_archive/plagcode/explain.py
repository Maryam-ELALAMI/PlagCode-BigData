from __future__ import annotations
from typing import Dict, List, Tuple, Any

def explain_overlap(fps_a: List[Tuple[int,int]], fps_b: List[Tuple[int,int]], k: int, token_spans_a: List[Tuple[int,int]], token_spans_b: List[Tuple[int,int]]) -> Dict[str, Any]:
    """Build a lightweight explanation by mapping matching fingerprints to approximate line ranges."""
    map_a = {h:pos for pos,h in fps_a}
    map_b = {h:pos for pos,h in fps_b}
    common = sorted(set(map_a.keys()) & set(map_b.keys()))
    # take first N common hashes for report
    picks = common[:25]
    segments = []
    for h in picks:
        pa = map_a[h]
        pb = map_b[h]
        # approximate line range from token spans
        a_start_line, a_end_line = token_spans_a[pa][0], token_spans_a[min(pa+k-1, len(token_spans_a)-1)][1]
        b_start_line, b_end_line = token_spans_b[pb][0], token_spans_b[min(pb+k-1, len(token_spans_b)-1)][1]
        segments.append({
            "hash": str(h),
            "a_token_pos": pa,
            "b_token_pos": pb,
            "a_lines": [a_start_line, a_end_line],
            "b_lines": [b_start_line, b_end_line],
        })
    return {
        "common_fingerprints": len(common),
        "sample_segments": segments,
    }
