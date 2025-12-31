from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def create_scan(
    session: AsyncSession,
    *,
    scan_id: str,
    status: str,
    params: Dict[str, Any],
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO scans(scan_id, status, progress, params_json)
            VALUES (:scan_id, :status, 0, CAST(:params AS jsonb))
            """
        ),
        {"scan_id": scan_id, "status": status, "params": json.dumps(params)},
    )


async def insert_file(
    session: AsyncSession,
    *,
    scan_id: str,
    filename: str,
    object_key: str,
    checksum: str,
    language: Optional[str],
    size: int,
) -> int:
    res = await session.execute(
        text(
            """
            INSERT INTO files(scan_id, filename, object_key, checksum, language, size)
            VALUES (:scan_id, :filename, :object_key, :checksum, :language, :size)
            RETURNING id
            """
        ),
        {
            "scan_id": scan_id,
            "filename": filename,
            "object_key": object_key,
            "checksum": checksum,
            "language": language,
            "size": size,
        },
    )
    return int(res.scalar_one())


async def get_scan(session: AsyncSession, scan_id: str) -> Optional[Dict[str, Any]]:
    res = await session.execute(
        text("SELECT scan_id, created_at, status, progress, params_json FROM scans WHERE scan_id = :scan_id"),
        {"scan_id": scan_id},
    )
    row = res.mappings().first()
    return dict(row) if row else None


async def update_scan_status_progress(
    session: AsyncSession,
    *,
    scan_id: str,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    params_patch: Optional[Dict[str, Any]] = None,
) -> None:
    # Use jsonb concatenation for patch
    if params_patch is None:
        params_patch = {}

    await session.execute(
        text(
            """
            UPDATE scans
            SET
              status = COALESCE(:status, status),
              progress = COALESCE(:progress, progress),
              params_json = params_json || CAST(:patch AS jsonb)
            WHERE scan_id = :scan_id
            """
        ),
        {
            "scan_id": scan_id,
            "status": status,
            "progress": progress,
            "patch": json.dumps(params_patch),
        },
    )


async def append_scan_log(session: AsyncSession, *, scan_id: str, message: str) -> None:
    # Append into params_json.logs as an array; keep it capped at last ~200 entries.
    await session.execute(
        text(
            """
            UPDATE scans
            SET params_json = jsonb_set(
              params_json,
              '{logs}',
              (
                COALESCE(params_json->'logs', '[]'::jsonb)
                                || jsonb_build_array(jsonb_build_object('time', to_char(NOW(), 'HH24:MI:SS'), 'message', CAST(:msg AS text)))
              )
            )
            WHERE scan_id = :scan_id
            """
        ),
        {"scan_id": scan_id, "msg": message},
    )


async def mark_file_normalized(session: AsyncSession, *, file_id: int) -> None:
    await session.execute(
        text("UPDATE files SET normalized_at = NOW() WHERE id = :id AND normalized_at IS NULL"),
        {"id": file_id},
    )


async def list_files_for_scan(session: AsyncSession, *, scan_id: str) -> List[Dict[str, Any]]:
    res = await session.execute(
        text(
            """
            SELECT id, filename, object_key, checksum, language, size, created_at, normalized_at
            FROM files
            WHERE scan_id = :scan_id
            ORDER BY id ASC
            """
        ),
        {"scan_id": scan_id},
    )
    return [dict(r) for r in res.mappings().all()]


async def count_files_normalized(session: AsyncSession, *, scan_id: str) -> Tuple[int, int]:
    res = await session.execute(
        text(
            """
            SELECT
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE normalized_at IS NOT NULL)::int AS normalized
            FROM files
            WHERE scan_id = :scan_id
            """
        ),
        {"scan_id": scan_id},
    )
    row = res.mappings().one()
    return int(row["total"]), int(row["normalized"])


async def try_mark_pairs_generated(session: AsyncSession, *, scan_id: str, total_pairs: int) -> bool:
    res = await session.execute(
        text(
            """
            UPDATE scans
            SET params_json = params_json
              || jsonb_build_object('pairs_generated', true)
                            || jsonb_build_object('total_pairs', CAST(:total_pairs AS int))
            WHERE scan_id = :scan_id
              AND COALESCE((params_json->>'pairs_generated')::boolean, false) = false
            RETURNING scan_id
            """
        ),
        {"scan_id": scan_id, "total_pairs": total_pairs},
    )
    return res.first() is not None


async def upsert_result(
    session: AsyncSession,
    *,
    scan_id: str,
    file_a_id: int,
    file_b_id: int,
    score: float,
    details: Dict[str, Any],
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO results(scan_id, file_a_id, file_b_id, score, details_json)
            VALUES (:scan_id, :a, :b, :score, CAST(:details AS jsonb))
            ON CONFLICT (scan_id, file_a_id, file_b_id)
            DO UPDATE SET score = EXCLUDED.score, details_json = EXCLUDED.details_json
            """
        ),
        {
            "scan_id": scan_id,
            "a": file_a_id,
            "b": file_b_id,
            "score": score,
            "details": json.dumps(details),
        },
    )


async def count_results(session: AsyncSession, *, scan_id: str) -> int:
    res = await session.execute(
        text("SELECT COUNT(*)::int AS n FROM results WHERE scan_id = :scan_id"),
        {"scan_id": scan_id},
    )
    return int(res.scalar_one())


async def get_total_pairs(session: AsyncSession, *, scan_id: str) -> Optional[int]:
    res = await session.execute(
        text("SELECT NULLIF(params_json->>'total_pairs','')::int AS total_pairs FROM scans WHERE scan_id = :scan_id"),
        {"scan_id": scan_id},
    )
    val = res.scalar_one_or_none()
    return int(val) if val is not None else None


async def try_mark_done_emitted(session: AsyncSession, *, scan_id: str) -> bool:
    res = await session.execute(
        text(
            """
            UPDATE scans
            SET params_json = params_json || jsonb_build_object('done_emitted', true)
            WHERE scan_id = :scan_id
              AND COALESCE((params_json->>'done_emitted')::boolean, false) = false
            RETURNING scan_id
            """
        ),
        {"scan_id": scan_id},
    )
    return res.first() is not None


async def insert_alert(
    session: AsyncSession,
    *,
    scan_id: Optional[str],
    service: str,
    error_code: str,
    message: str,
    payload: Dict[str, Any],
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO alerts(scan_id, service, error_code, message, payload_json)
            VALUES (:scan_id, :service, :error_code, :message, CAST(:payload AS jsonb))
            """
        ),
        {
            "scan_id": scan_id,
            "service": service,
            "error_code": error_code,
            "message": message,
            "payload": json.dumps(payload),
        },
    )


async def list_alerts(session: AsyncSession, *, scan_id: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
    if scan_id:
        res = await session.execute(
            text(
                """
                SELECT id, scan_id, service, error_code, message, payload_json, created_at
                FROM alerts
                WHERE scan_id = :scan_id
                ORDER BY created_at DESC
                LIMIT :lim
                """
            ),
            {"scan_id": scan_id, "lim": limit},
        )
    else:
        res = await session.execute(
            text(
                """
                SELECT id, scan_id, service, error_code, message, payload_json, created_at
                FROM alerts
                ORDER BY created_at DESC
                LIMIT :lim
                """
            ),
            {"lim": limit},
        )

    return [dict(r) for r in res.mappings().all()]


async def get_file_by_scan_and_name(session: AsyncSession, *, scan_id: str, filename: str) -> Optional[Dict[str, Any]]:
    res = await session.execute(
        text(
            """
            SELECT id, filename, object_key, checksum, language, size, created_at
            FROM files
            WHERE scan_id = :scan_id AND filename = :filename
            ORDER BY id DESC
            LIMIT 1
            """
        ),
        {"scan_id": scan_id, "filename": filename},
    )
    row = res.mappings().first()
    return dict(row) if row else None


async def list_results_pairs_for_scan(session: AsyncSession, *, scan_id: str, limit: int = 5000) -> List[Dict[str, Any]]:
    res = await session.execute(
        text(
            """
            SELECT
              r.score,
              r.details_json,
              fa.filename AS file_a,
              fb.filename AS file_b
            FROM results r
            JOIN files fa ON fa.id = r.file_a_id
            JOIN files fb ON fb.id = r.file_b_id
            WHERE r.scan_id = :scan_id
            ORDER BY r.score DESC
            LIMIT :lim
            """
        ),
        {"scan_id": scan_id, "lim": limit},
    )
    return [dict(r) for r in res.mappings().all()]


async def list_scans_summary(session: AsyncSession, *, limit: int = 50) -> List[Dict[str, Any]]:
        # Summary computed on read (keeps schema minimal).
        res = await session.execute(
                text(
                        """
                        SELECT
                            s.scan_id,
                            s.created_at,
                            s.status,
                            s.progress,
                            COALESCE(NULLIF(s.params_json->>'runtime_ms','')::int, 0) AS runtime_ms,
                            COUNT(DISTINCT f.id)::int AS file_count,
                            COALESCE(
                                NULLIF(s.params_json->>'total_pairs','')::int,
                                ((COUNT(DISTINCT f.id) * GREATEST(COUNT(DISTINCT f.id) - 1, 0)) / 2)::int
                            ) AS pair_count,
                            COALESCE(MAX(r.score), 0)::float8 AS top_similarity,
                            COALESCE(SUM(CASE WHEN r.score > 70 THEN 1 ELSE 0 END), 0)::int AS high_risk_count
                        FROM scans s
                        LEFT JOIN files f ON f.scan_id = s.scan_id
                        LEFT JOIN results r ON r.scan_id = s.scan_id
                        GROUP BY s.scan_id
                        ORDER BY s.created_at DESC
                        LIMIT :lim
                        """
                ),
                {"lim": limit},
        )
        return [dict(r) for r in res.mappings().all()]
