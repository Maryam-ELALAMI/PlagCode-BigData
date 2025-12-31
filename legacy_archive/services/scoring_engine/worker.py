from __future__ import annotations
import uuid
import traceback
from typing import Dict, Any, List, Tuple
import redis
import psycopg

from plagcode.config import settings
from services.kafka_io import consumer, producer
from plagcode.fingerprinting import jaccard, cosine_bow
from plagcode.explain import explain_overlap
from services.db import init_db
from services.minio_store import put_json

# In this demo, we keep a small cache of normalized payloads in Redis to fetch candidate features.
# Key: norm:{submission_id} -> JSON string (orjson bytes not used here for simplicity)
import json

def store_norm(r, submission_id: str, normalized: dict):
    r.set(f"norm:{submission_id}", json.dumps(normalized), ex=7*24*3600)

def load_norm(r, submission_id: str):
    s = r.get(f"norm:{submission_id}")
    return json.loads(s) if s else None

def score_pair(norm_a: dict, norm_b: dict) -> Dict[str, float]:
    fps_a = set(int(h) for _, h in norm_a["fingerprints"])
    fps_b = set(int(h) for _, h in norm_b["fingerprints"])
    s_fp = jaccard(fps_a, fps_b)
    s_ast = cosine_bow(norm_a.get("ast_bag", {}), norm_b.get("ast_bag", {}))
    # Fixed weights (no training)
    score = 0.65 * s_fp + 0.35 * s_ast
    return {"score": float(score), "score_fp": float(s_fp), "score_ast": float(s_ast)}

def main():
    init_db()
    r = redis.from_url(settings.redis_url, decode_responses=True)
    c = consumer(settings.topic_candidates, group_id="scoring_engine")
    p = producer()

    for msg in c:
        try:
            v = msg.value
            assignment_id = v["assignment_id"]
            sid = v["submission_id"]
            norm_a = v["normalized_ref"]
            store_norm(r, sid, norm_a)

            for cand in v["candidates"]:
                cid = cand["candidate_id"]
                norm_b = load_norm(r, cid)
                if norm_b is None:
                    # candidate may not have been cached yet (first time). skip.
                    continue

                scores = score_pair(norm_a, norm_b)
                if scores["score"] >= settings.threshold:
                    alert_id = str(uuid.uuid4())
                    # build explanation
                    expl = explain_overlap(
                        fps_a=norm_a["fingerprints"],
                        fps_b=norm_b["fingerprints"],
                        k=norm_a.get("fingerprint_k", settings.fingerprint_k),
                        token_spans_a=norm_a.get("token_spans", []),
                        token_spans_b=norm_b.get("token_spans", []),
                    )
                    report = {
                        "alert_id": alert_id,
                        "assignment_id": assignment_id,
                        "submission_id": sid,
                        "candidate_id": cid,
                        "scores": scores,
                        "explain": expl,
                        "notes": "Démo sans entraînement : score = 0.65*Jaccard(fingerprints) + 0.35*cosine(AST bag).",
                    }
                    obj_key = f"{assignment_id}/{alert_id}.json"
                    put_json(obj_key, report)

                    with psycopg.connect(settings.postgres_dsn) as conn:
                        conn.execute(
                            "INSERT INTO alerts(alert_id, assignment_id, submission_id, candidate_id, score, score_fp, score_ast, report_object_key) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                            (alert_id, assignment_id, sid, cid, scores["score"], scores["score_fp"], scores["score_ast"], obj_key),
                        )
                        conn.commit()

                    p.send(settings.topic_alerts, key=assignment_id, value=report)
            p.flush(5)

        except Exception as e:
            dead = {"error": str(e), "trace": traceback.format_exc(), "payload": msg.value}
            p.send(settings.topic_deadletter, key="scoring_engine", value=dead)
            p.flush(5)

if __name__ == "__main__":
    main()
