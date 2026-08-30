"""Department-aware operational notifications for MARS."""

from typing import Optional
from fastapi import APIRouter, Query

from backend.services.conflict_service import conflict_service
from backend.services.job_service import job_service

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def get_notifications(department: Optional[str] = Query(None)):
    """Build notifications from current jobs and detected conflicts."""
    conflicts = conflict_service.detect_conflicts()
    jobs = job_service.get_all_jobs()
    notifications: list[dict] = []

    for conflict in conflicts:
        departments = conflict.get("departments") or []
        if department and department != "All" and department not in departments and department != "Divisional Planner":
            continue
        notifications.append({
            "id": conflict.get("conflict_id"),
            "department": departments[0] if departments else "Divisional Planner",
            "type": "conflict",
            "severity": conflict.get("severity", "INFO"),
            "title": conflict.get("type", "Operational conflict"),
            "message": conflict.get("description", "Operational conflict detected."),
            "job_ids": conflict.get("job_ids", []),
            "block_id": conflict.get("block_id", ""),
            "section_id": conflict.get("section_id", ""),
            "timestamp": conflict.get("time_window", ""),
            "read": False,
        })

    open_jobs = [j for j in jobs if str(j.get("status", "")).upper() in {"OPEN", "PENDING", "SUBMITTED", "UNDER REVIEW"}]
    if department in (None, "All", "Divisional Planner"):
        notifications.append({
            "id": "NOTIF-OPEN-JOBS",
            "department": "Divisional Planner",
            "type": "review",
            "severity": "INFO",
            "title": "Maintenance requests pending planning",
            "message": f"{len(open_jobs)} open maintenance request(s) require planning review.",
            "job_ids": [j.get("job_id") for j in open_jobs[:20]],
            "read": False,
        })

    return {"count": len(notifications), "notifications": notifications}
