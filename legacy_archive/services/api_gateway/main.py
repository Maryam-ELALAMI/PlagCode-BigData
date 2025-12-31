from __future__ import annotations
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
import psycopg
from minio.error import S3Error
from plagcode.config import settings
from services.kafka_io import producer
from services.db import init_db
from services.minio_store import get_json

app = FastAPI(title="PlagCode API (No-Train)")


@app.get("/", response_class=HTMLResponse)
def home():
    # Minimal demo UI (no frontend build step) to submit code and view alerts.
    # Everything is still available via /docs for the API-first workflow.
    return """<!doctype html>
<html lang=\"en\">
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>PlagCode Demo UI</title>
        <style>
            :root { color-scheme: light dark; }
            body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
            .wrap { max-width: 980px; margin: 0 auto; }
            .row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
            label { display: inline-flex; gap: 8px; align-items: center; }
            input, select { padding: 8px 10px; }
            textarea { width: 100%; min-height: 240px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 10px; }
            button { padding: 10px 14px; cursor: pointer; }
            .card { border: 1px solid rgba(127,127,127,.35); border-radius: 10px; padding: 14px; margin-top: 14px; }
            pre { white-space: pre-wrap; word-break: break-word; background: rgba(127,127,127,.12); padding: 10px; border-radius: 8px; }
            .muted { opacity: .8; }
            .ok { color: #0b6; }
            .err { color: #c33; }
            a { color: inherit; }
        </style>
    </head>
    <body>
        <div class=\"wrap\">
            <h2>PlagCode — Demo UI</h2>
            <p class=\"muted\">UI simple pour la démo. Pour l’API interactive: <a href=\"/docs\">/docs</a></p>

            <div class=\"card\">
                <h3>1) Submit</h3>
                <div class=\"row\">
                    <label>Assignment
                        <input id=\"assignment\" value=\"A1\" />
                    </label>
                    <label>Student
                        <input id=\"student\" value=\"S1\" />
                    </label>
                    <label>Language
                        <select id=\"language\">
                            <option value=\"python\" selected>python</option>
                        </select>
                    </label>
                    <label>File name
                        <input id=\"path\" value=\"main.py\" />
                    </label>
                </div>
                <p class=\"muted\">Colle le code ci-dessous puis clique <b>Submit</b> (ça part dans Kafka: <code>code.submissions.raw</code>).</p>
                <textarea id=\"code\">def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print([fib(i) for i in range(10)])
</textarea>
                <div class=\"row\" style=\"margin-top: 10px;\">
                    <button onclick=\"submitCode()\">Submit</button>
                    <span id=\"submit_status\" class=\"muted\"></span>
                </div>
                <pre id=\"submit_out\"></pre>
            </div>

            <div class=\"card\">
                <h3>2) Alerts</h3>
                <p class=\"muted\">Après 2 soumissions similaires, clique <b>Refresh</b> (les alertes viennent de Postgres via <code>/alerts</code>).</p>
                <div class=\"row\">
                    <button onclick=\"loadAlerts()\">Refresh</button>
                    <label class=\"muted\">Limit
                      <input id=\"limit\" type=\"number\" value=\"50\" min=\"1\" max=\"500\" style=\"width: 90px;\" />
                    </label>
                    <label class=\"muted\"><input id=\"autorefresh\" type=\"checkbox\" /> Auto-refresh (3s)</label>
                    <span id=\"alerts_status\" class=\"muted\"></span>
                </div>
                <pre id=\"alerts_out\"></pre>
            </div>
        </div>

        <script>
            function $(id) { return document.getElementById(id); }

            async function readBodyPretty(r) {
                const ct = (r.headers.get("content-type") || "").toLowerCase();
                if (ct.includes("application/json")) {
                    const obj = await r.json();
                    return JSON.stringify(obj, null, 2);
                }
                return await r.text();
            }

            function setStatus(id, txt, cls) {
                const el = $(id);
                el.textContent = txt;
                el.className = cls;
            }

            async function submitCode() {
                setStatus("submit_status", "Sending...", "muted");
                $("submit_out").textContent = "";
                const payload = {
                    assignment_id: $("assignment").value.trim(),
                    student_id: $("student").value.trim(),
                    language: $("language").value,
                    files: [{ path: $("path").value.trim(), content: $("code").value }]
                };
                try {
                    const r = await fetch("/submit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload)
                    });
                    $("submit_out").textContent = await readBodyPretty(r);
                    if (!r.ok) {
                        setStatus("submit_status", "Error", "err");
                        return;
                    }
                    setStatus("submit_status", "OK", "ok");
                } catch (e) {
                    setStatus("submit_status", "Network error", "err");
                    $("submit_out").textContent = String(e);
                }
            }

            async function loadAlerts() {
                setStatus("alerts_status", "Loading...", "muted");
                $("alerts_out").textContent = "";
                const assignment = encodeURIComponent($("assignment").value.trim());
                try {
                    const limit = encodeURIComponent($("limit").value || "50");
                    const r = await fetch(`/alerts?assignment_id=${assignment}&limit=${limit}`);
                    let body = await readBodyPretty(r);

                    // If it's JSON, try to add clickable report URLs.
                    try {
                        const data = JSON.parse(body);
                        if (Array.isArray(data)) {
                            const enhanced = data.map(a => ({
                                ...a,
                                report_url: a.alert_id ? `/report/${a.alert_id}` : null,
                            }));
                            body = JSON.stringify(enhanced, null, 2);
                        }
                    } catch (_) {}

                    $("alerts_out").textContent = body;
                    if (!r.ok) {
                        setStatus("alerts_status", "Error", "err");
                        return;
                    }
                    setStatus("alerts_status", "OK", "ok");
                } catch (e) {
                    setStatus("alerts_status", "Network error", "err");
                    $("alerts_out").textContent = String(e);
                }
            }

            let _timer = null;
            function updateAutorefresh() {
                if (_timer) {
                    clearInterval(_timer);
                    _timer = null;
                }
                if ($("autorefresh").checked) {
                    _timer = setInterval(loadAlerts, 3000);
                }
            }
            $("autorefresh").addEventListener("change", updateAutorefresh);
        </script>
    </body>
</html>"""


@app.get("/report/{alert_id}")
def report(alert_id: str):
    """Return the full JSON report stored in MinIO for a given alert_id."""
    with psycopg.connect(settings.postgres_dsn) as conn:
        row = conn.execute(
            "SELECT report_object_key FROM alerts WHERE alert_id=%s",
            (alert_id,),
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    object_key = row[0]
    try:
        return get_json(object_key)
    except S3Error as e:
        raise HTTPException(status_code=404, detail=f"Report not found in MinIO: {e.code}")

class FilePayload(BaseModel):
    path: str
    content: str

class SubmitRequest(BaseModel):
    assignment_id: str = Field(..., examples=["A1"])
    student_id: str = Field(..., examples=["S123"])
    language: str = Field("python", examples=["python"])
    files: list[FilePayload]

class SubmitResponse(BaseModel):
    submission_id: str

@app.on_event("startup")
def _startup():
    init_db()

@app.post("/submit", response_model=SubmitResponse)
def submit(req: SubmitRequest):
    submission_id = str(uuid.uuid4())
    msg = {
        "submission_id": submission_id,
        "assignment_id": req.assignment_id,
        "student_id": req.student_id,
        "language": req.language,
        "files": [f.model_dump() for f in req.files],
    }
    p = producer()
    p.send(settings.topic_raw, key=req.assignment_id, value=msg)
    p.flush(5)
    # store submission metadata
    with psycopg.connect(settings.postgres_dsn) as conn:
        conn.execute(
            "INSERT INTO submissions(submission_id, assignment_id, student_id, language) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
            (submission_id, req.assignment_id, req.student_id, req.language),
        )
        conn.commit()
    return SubmitResponse(submission_id=submission_id)

@app.get("/alerts")
def alerts(assignment_id: str, limit: int = 50):
    with psycopg.connect(settings.postgres_dsn) as conn:
        rows = conn.execute(
            "SELECT alert_id, submission_id, candidate_id, score, created_at, report_object_key FROM alerts WHERE assignment_id=%s ORDER BY created_at DESC LIMIT %s",
            (assignment_id, limit),
        ).fetchall()
    return [
        {
            "alert_id": r[0],
            "submission_id": r[1],
            "candidate_id": r[2],
            "score": r[3],
            "created_at": r[4].isoformat(),
            "report_object_key": r[5],
        }
        for r in rows
    ]
