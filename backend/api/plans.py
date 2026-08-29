"""Maintenance plan API endpoints."""

from fastapi import APIRouter, HTTPException

from backend.services.optimization_service import (
    OptimizationService,
)


router = APIRouter(
    prefix="/api/plan",
    tags=["Plan"],
)

service = OptimizationService()


@router.get("")
def get_current_plan():
    """Return the authoritative current active maintenance plan."""

    try:
        return service.get_current_plan()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load current plan: {exc}",
        )


@router.get("/summary")
def get_plan_summary():
    """Return metrics for the current active plan."""

    try:
        return service.get_summary()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load current plan summary: {exc}",
        )


@router.post("/optimize")
def run_optimization():
    """Run the MARS CP-SAT optimization pipeline."""

    try:
        return service.run_optimization()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Optimization failed: {exc}",
        )
