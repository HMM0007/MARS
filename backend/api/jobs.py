"""Maintenance job API endpoints."""

from fastapi import APIRouter, HTTPException
import pandas as pd

from backend.config import JOBS_FILE


router = APIRouter(
    prefix="/api/jobs",
    tags=["Jobs"],
)


@router.get("")
def get_jobs():
    """Return all maintenance jobs from Dataset V1."""

    try:
        jobs = pd.read_csv(
            JOBS_FILE,
            keep_default_na=False,
        )

        return {
            "count": len(jobs),
            "jobs": jobs.to_dict(
                orient="records"
            ),
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset file not found: {JOBS_FILE}",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load maintenance jobs: {exc}",
        )