"""Notifications API endpoints for department-aware alerts."""

from typing import Optional
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

_DEMO_NOTIFICATIONS = [
    {
        "id": "NOTIF-001",
        "department": "Engineering",
        "type": "conflict",
        "title": "Block Conflict Detected",
        "message": "MR-101 (Engineering) has a block conflict with S&T MR-102 on Section B120.",
        "timestamp": "10:20 AM",
        "read": False,
    },
    {
        "id": "NOTIF-002",
        "department": "Divisional Planner",
        "type": "review",
        "title": "Maintenance Requests Pending Review",
        "message": "3 new maintenance requests require planner review and block allocation.",
        "timestamp": "09:45 AM",
        "read": False,
    },
    {
        "id": "NOTIF-003",
        "department": "S&T",
        "type": "conflict",
        "title": "Signal Inspection Conflict",
        "message": "MR-102 signal inspection overlaps with Track Tamping on B120.",
        "timestamp": "09:10 AM",
        "read": False,
    },
    {
        "id": "NOTIF-004",
        "department": "Traction",
        "type": "schedule",
        "title": "OHE Isolation Scheduled",
        "message": "OHE inspection block allocated for B120 on 22 May (14:00 - 15:00).",
        "timestamp": "08:30 AM",
        "read": True,
    },
]


@router.get("")
def get_notifications(department: Optional[str] = Query(None)):
    """Return department-aware notifications."""
    notifs = _DEMO_NOTIFICATIONS
    if department and department != "All":
        notifs = [n for n in notifs if n["department"] == department or n["department"] == "Divisional Planner"]
    return {
        "count": len(notifs),
        "notifications": notifs,
    }
