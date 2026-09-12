"""Durable state for planner approvals, pending revisions, and runtime job intake."""

from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List

_STATE_DIR = Path(__file__).resolve().parents[2] / "data" / "runtime"
_JOBS_FILE = _STATE_DIR / "intake_jobs.json"
_APPROVED_FILE = _STATE_DIR / "approved_weekly_plan.json"
_PENDING_FILE = _STATE_DIR / "pending_plan_revision.json"
_LOCK = Lock()


def _ensure_dir() -> None:
    _STATE_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path, default: Any) -> Any:
    _ensure_dir()
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def _atomic_write(path: Path, value: Any) -> None:
    _ensure_dir()
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=_STATE_DIR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, sort_keys=True, default=str)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def list_intake_jobs() -> List[Dict[str, Any]]:
    with _LOCK:
        value = _read_json(_JOBS_FILE, [])
        return value if isinstance(value, list) else []


def add_intake_job(job: Dict[str, Any]) -> Dict[str, Any]:
    with _LOCK:
        jobs = _read_json(_JOBS_FILE, [])
        if not isinstance(jobs, list):
            jobs = []
        jobs.append(dict(job))
        _atomic_write(_JOBS_FILE, jobs)
        return dict(job)


def get_approved_plan() -> Dict[str, Any] | None:
    with _LOCK:
        value = _read_json(_APPROVED_FILE, None)
        return value if isinstance(value, dict) else None


def approve_plan(plan: Dict[str, Any], week: int, source: str = "PLANNER") -> Dict[str, Any]:
    previous = get_approved_plan()
    record = {
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approved_by": source,
        "planning_week": week,
        "revision": int((previous or {}).get("revision", 0)) + 1,
        "plan": plan,
    }
    with _LOCK:
        _atomic_write(_APPROVED_FILE, record)
    return record


def save_pending_revision(plan: Dict[str, Any], week: int, source_revision: int | None, job_id: str) -> Dict[str, Any]:
    record = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "planning_week": week,
        "source_revision": source_revision,
        "new_job_id": job_id,
        "plan": plan,
    }
    with _LOCK:
        _atomic_write(_PENDING_FILE, record)
    return record


def get_pending_revision() -> Dict[str, Any] | None:
    with _LOCK:
        value = _read_json(_PENDING_FILE, None)
        return value if isinstance(value, dict) else None


def clear_pending_revision() -> None:
    with _LOCK:
        if _PENDING_FILE.exists():
            _PENDING_FILE.unlink()
