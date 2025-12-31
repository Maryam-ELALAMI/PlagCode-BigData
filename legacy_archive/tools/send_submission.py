from __future__ import annotations
import argparse
import sys
from pathlib import Path

# Allow running as a script: `python tools/send_submission.py ...`
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from plagcode.config import settings
from services.kafka_io import producer

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--assignment", required=True)
    ap.add_argument("--student", required=True)
    ap.add_argument("--file", required=True)
    args = ap.parse_args()

    code = Path(args.file).read_text(encoding="utf-8")
    msg = {
        "submission_id": f"local-{args.student}-{Path(args.file).stem}",
        "assignment_id": args.assignment,
        "student_id": args.student,
        "language": "python",
        "files": [{"path": Path(args.file).name, "content": code}],
    }
    p = producer()
    p.send(settings.topic_raw, key=args.assignment, value=msg)
    p.flush(5)
    print("Sent:", msg["submission_id"])

if __name__ == "__main__":
    main()
