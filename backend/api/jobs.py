"""Maintenance Job API endpoints for MARS.

The CSV remains the source of maintenance-request data. This API layer enriches
legacy Dataset V1 rows with section and active-plan block information so the
frontend does not have to guess or hard-code operational fields.
"""

from typing import Optional, Dict, Any
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Header, status
from pydantic import BaseModel, Field

from backend.services.job_service import job_service
from backend.config import ASSETS_FILE, CURRENT_PLAN_FILE

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


class CreateJobRequest(BaseModel):
    description: str = Field(min_length=1)
    department: Optional[str] = None
    work_type: Optional[str] = None
    section: Optional[str] = None
    block: Optional[str] = None
    asset_id: Optional[str] = None
    priority: Optional[str] = "Medium"
    duration_min: Optional[int] = 90
    deadline: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time_window: Optional[str] = None
    required_block_type: Optional[str] = None
    safety_requirements: Optional[str] = None
    dependencies: Optional[str] = None
    remarks: Optional[str] = None


class UpdateJobRequest(BaseModel):
    description: Optional[str] = None
    section: Optional[str] = None
    block: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    duration_min: Optional[int] = None
    remarks: Optional[str] = None


def _get_mock_user_from_token(authorization: Optional[str]) -> Optional[Dict[str, Any]]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if "ENG001" in token:
        return {"employee_id": "ENG001", "department": "Engineering", "role": "Department Planner"}
    if "SNT001" in token:
        return {"employee_id": "SNT001", "department": "S&T", "role": "Department Planner"}
    if "TRD001" in token:
        return {"employee_id": "TRD001", "department": "Traction", "role": "Department Planner"}
    if "PLAN001" in token:
        return {"employee_id": "PLAN001", "department": "Divisional Planner", "role": "Divisional Planner"}
    return None


def _enrich_jobs(jobs: list[dict]) -> list[dict]:
    """Join legacy request rows to assets and the authoritative active plan."""
    assets: dict[str, dict] = {}
    plan: dict[str, dict] = {}
    try:
        if Path(ASSETS_FILE).exists():
            asset_df = pd.read_csv(ASSETS_FILE, keep_default_na=False)
            assets = {str(r["asset_id"]): r for r in asset_df.to_dict("records")}
    except Exception:
        assets = {}
    try:
        if Path(CURRENT_PLAN_FILE).exists():
            plan_df = pd.read_csv(CURRENT_PLAN_FILE, keep_default_na=False)
            plan = {str(r["job_id"]): r for r in plan_df.to_dict("records")}
    except Exception:
        plan = {}

    enriched: list[dict] = []
    for raw in jobs:
        job = dict(raw)
        job_id = str(job.get("job_id") or job.get("id") or "")
        asset = assets.get(str(job.get("asset_id", "")), {})
        current = plan.get(job_id, {})
        job["section"] = asset.get("section_id") or current.get("section_id") or job.get("section") or ""
        if not job.get("block"):
            job["block"] = current.get("block_id") or ""
        job["plan_status"] = current.get("plan_status") or "UNPLANNED"
        job["scheduled_start"] = current.get("scheduled_start") or ""
        job["scheduled_end"] = current.get("scheduled_end") or ""
        job["block_date"] = current.get("block_date") or ""
        job["asset_criticality"] = asset.get("criticality") or ""
        enriched.append(job)
    return enriched


@router.get("")
def get_jobs(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
):
    jobs = job_service.get_all_jobs(department=department, status=status, section=section, priority=priority)
    jobs = _enrich_jobs(jobs)
    if status and status != "All":
        jobs = [j for j in jobs if str(j.get("status", "")).upper() == status.upper() or str(j.get("plan_status", "")).upper() == status.upper()]
    return {"count": len(jobs), "jobs": jobs}


@router.get("/{job_id}")
def get_job_by_id(job_id: str):
    job = job_service.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return _enrich_jobs([job])[0]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_job(payload: CreateJobRequest, authorization: Optional[str] = Header(None)):
    user = _get_mock_user_from_token(authorization)
    data = payload.model_dump(exclude_none=True) if hasattr(payload, "model_dump") else payload.dict(exclude_none=True)
    if user and user.get("department") != "Divisional Planner":
        data["department"] = user["department"]
    new_job = job_service.create_job(data, user_info=user)
    return {"message": "Maintenance request created successfully.", "job": _enrich_jobs([new_job])[0]}


@router.put("/{job_id}")
def update_job(job_id: str, payload: UpdateJobRequest, authorization: Optional[str] = Header(None)):
    user = _get_mock_user_from_token(authorization)
    try:
        data = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
        updated = job_service.update_job(job_id, data, user_info=user)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
        return {"message": "Job updated successfully.", "job": _enrich_jobs([updated])[0]}
    except PermissionError as err:
        raise HTTPException(status_code=403, detail=str(err)) from err


@router.delete("/{job_id}")
def delete_job(job_id: str, authorization: Optional[str] = Header(None)):
    user = _get_mock_user_from_token(authorization)
    try:
        if not job_service.delete_job(job_id, user_info=user):
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
        return {"message": f"Job {job_id} deleted successfully."}
    except PermissionError as err:
        raise HTTPException(status_code=403, detail=str(err)) from err
