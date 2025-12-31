from __future__ import annotations
import traceback
from typing import Dict, Any, List, Tuple
import redis
from plagcode.config import settings
from services.kafka_io import consumer, producer

# Redis keys:
# fp:{hash} -> set(submission_id)
# subfps:{submission_id} -> set(hash)  (for later cleanup or debug)

def main():
    r = redis.from_url(settings.redis_url, decode_responses=True)
    c = consumer(settings.topic_norm, group_id="candidate_retrieval")
    p = producer()

    for msg in c:
        try:
            v = msg.value
            sid = v["submission_id"]
            fps: List[Tuple[int,int]] = v["normalized"]["fingerprints"]
            fp_hashes = [str(h) for _, h in fps]

            # candidate counts based on shared fingerprints
            counts: Dict[str, int] = {}
            for h in fp_hashes:
                key = f"fp:{h}"
                for other in r.smembers(key):
                    if other != sid:
                        counts[other] = counts.get(other, 0) + 1

            # update index with current submission
            pipe = r.pipeline()
            for h in fp_hashes:
                pipe.sadd(f"fp:{h}", sid)
            pipe.sadd(f"subfps:{sid}", *fp_hashes) if fp_hashes else None
            pipe.execute()

            # select top-k
            top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[: settings.topk]
            out = {
                "assignment_id": v["assignment_id"],
                "submission_id": sid,
                "candidates": [{"candidate_id": cid, "shared_fps": cnt} for cid, cnt in top],
                "normalized_ref": v["normalized"],  # for scoring without extra fetch
            }
            p.send(settings.topic_candidates, key=v["assignment_id"], value=out)
            p.flush(5)
        except Exception as e:
            dead = {"error": str(e), "trace": traceback.format_exc(), "payload": msg.value}
            p.send(settings.topic_deadletter, key="candidate_retrieval", value=dead)
            p.flush(5)

if __name__ == "__main__":
    main()
