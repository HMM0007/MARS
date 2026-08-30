"""Maintenance Job API Endpoints for MARS Backend.

Supports filtering by department, status, section, priority,
along with full CRUD operations and authorization checks.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Header, status
from pydantic import BaseModel, Field

from backend.services.job_service import job_service


router = APIRouter(
    prefix="/api/jobs",
    tags=["Jobs"],
)


class CreateJobRequest(BaseModel):
    description: str = Field(min_length=1)
    department: Optional[str] = None
    work_type: Optional[str] = None
    section: Optional[str] = "Km 120 - 121"
    block: Optional[str] = "B120"
    asset_id: Optional[str] = "A001"
    priority: Optional[str] = "Medium"
    duration_min: Optional[int] = 90
    deadline: Optional[str] = None
    preferred_date: Optional[str] = "2026-05-20"
    preferred_time_window: Optional[str] = "10:00 - 12:00"
    required_block_type: Optional[str] = "Absolute"
    safety_requirements: Optional[str] = "OHE Power Isolation"
    dependencies: Optional[str] = "None"
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
    """Helper to extract user info from development token."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if "ENG001" in token:
        return {"employee_id": "ENG001", "department": "Engineering", "role": "Department Planner"}
    elif "SNT001" in token:
        return {"employee_id": "SNT001", "department": "S&T", "role": "Department Planner"}
    elif "TRD001" in token:
        return {"employee_id": "TRD001", "department": "Traction", "role": "Department Planner"}
    elif "PLAN001" in token:
        return {"employee_id": "PLAN001", "department": "Divisional Planner", "role": "Divisional Planner"}
    return None


@router.get("")
def get_jobs(
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
):
    """Return filtered list of maintenance jobs."""
    jobs = job_service.get_all_jobs(
        department=department,
        status=status,
        section=section,
        priority=priority,
    )
    return {
        "count": len(jobs),
        "jobs": jobs,
    }


@router.get("/{job_id}")
def get_job_by_id(job_id: str):
    """Return a single maintenance job by ID."""
    job = job_service.get_job_by_id(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return job


@router.post("", status_code=status.HTTP_201_CREATED)
def create_job(
    payload: CreateJobRequest,
    authorization: Optional[str] = Header(None),
):
    """Create a new maintenance request."""
    user = _get_mock_user_from_token(authorization)
    new_job = job_service.create_job(payload.dict(), user_info=user)
    return {
        "message": "Maintenance request created successfully.",
        "job": new_job,
    }


@router.put("/{job_id}")
def update_job(
    job_id: str,
    payload: UpdateJobRequest,
    authorization: Optional[str] = Header(None),
):
    """Update an existing maintenance job."""
    user = _get_mock_user_from_token(authorization)
    try:
        updated = job_service.update_job(job_id, payload.dict(exclude_unset=True), user_info=user)
        if not updated:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
        return {
            "message": "Job updated successfully.",
            "job": updated,
        }
    except PermissionError as err:
        raise HTTPException(status_code=403, detail=str(err))


@router.delete("/{job_id}")
def delete_job(
    job_id: str,
    authorization: Optional[str] = Header(None),
):
    """Delete a maintenance request."""
    user = _get_mock_user_from_token(authorization)
    try:
        success = job_service.delete_job(job_id, user_info=user)
        if not success:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
        return {"message": f"Job {job_id} deleted successfully."}
    except PermissionError as err:
        raise HTTPException(status_code=403, detail=str(err))