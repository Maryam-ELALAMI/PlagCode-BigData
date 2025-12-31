from __future__ import annotations
import traceback
from plagcode.config import settings
from services.kafka_io import consumer, producer
from plagcode.code_normalize import normalize_python
from plagcode.fingerprinting import winnow

def main():
    c = consumer(settings.topic_raw, group_id="normalizer")
    p = producer()
    for msg in c:
        try:
            v = msg.value
            if v.get("language","python").lower() != "python":
                raise ValueError("Only python supported in this demo.")
            all_files = v["files"]
            # concatenate for baseline; keep per-file too for future
            joined = "\n\n".join(f"# FILE: {f['path']}\n{f['content']}" for f in all_files)
            norm = normalize_python(joined)
            fps = winnow(norm.tokens, k=settings.fingerprint_k, window=settings.winnow_window)
            out = dict(v)
            out["normalized"] = {
                "text": norm.normalized_text,
                "tokens": norm.tokens,
                "token_spans": norm.token_spans,
                "ast_bag": norm.ast_bag,
                "fingerprints": fps,  # list of (pos, hash)
                "fingerprint_k": settings.fingerprint_k,
            }
            p.send(settings.topic_norm, key=v["assignment_id"], value=out)
            p.flush(5)
        except Exception as e:
            dead = {"error": str(e), "trace": traceback.format_exc(), "payload": msg.value}
            p.send(settings.topic_deadletter, key="normalizer", value=dead)
            p.flush(5)

if __name__ == "__main__":
    main()
