"""Planner review actions for the current MARS active plan."""

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import CURRENT_PLAN_FILE

router = APIRouter(prefix="/api/plan-review", tags=["Plan Review"])
REVIEW_FILE = CURRENT_PLAN_FILE.with_name("plan_review.json")


class ReviewRequest(BaseModel):
    action: str
    reviewer: str | None = None
    remarks: str | None = None


@router.get("")
def get_review():
    if not REVIEW_FILE.exists():
        return {"status": "PENDING_REVIEW", "reviewer": None, "remarks": ""}
    return json.loads(REVIEW_FILE.read_text(encoding="utf-8"))


@router.post("")
def review_plan(request: ReviewRequest):
    action = request.action.strip().upper()
    if action not in {"APPROVE", "REJECT"}:
        raise HTTPException(status_code=400, detail="Review action must be APPROVE or REJECT.")
    if not CURRENT_PLAN_FILE.exists():
        raise HTTPException(status_code=503, detail="No current active plan is available for review.")
    result = {
        "status": "APPROVED" if action == "APPROVE" else "REJECTED",
        "reviewer": request.reviewer or "Divisional Planner",
        "remarks": request.remarks or "",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    REVIEW_FILE.parent.mkdir(parents=True, exist_ok=True)
    REVIEW_FILE.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result
