from __future__ import annotations
import argparse
import time
import sys
from pathlib import Path

# Allow running as a script: `python tools/poll_alerts.py ...`
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.kafka_io import consumer
from plagcode.config import settings

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--assignment", required=True)
    ap.add_argument("--seconds", type=int, default=10)
    args = ap.parse_args()

    c = consumer(settings.topic_alerts, group_id=f"poll-{int(time.time())}")
    end = time.time() + args.seconds
    print(f"Polling alerts for {args.seconds}s ...")

    # kafka-python's consumer.poll() returns a dict: {TopicPartition: [ConsumerRecord, ...]}
    # where ConsumerRecord.value is already deserialized (here: a dict).
    while time.time() < end:
        batches = c.poll(timeout_ms=1000)
        if not batches:
            continue

        for _tp, records in batches.items():
            for record in records:
                v = record.value
                if isinstance(v, dict) and v.get("assignment_id") == args.assignment:
                    print("ALERT:", {
                        "alert_id": v.get("alert_id"),
                        "score": (v.get("scores") or {}).get("score"),
                        "pair": (v.get("submission_id"), v.get("candidate_id")),
                    })

if __name__ == "__main__":
    main()
