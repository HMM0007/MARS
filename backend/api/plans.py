"""Operational maintenance plan API endpoints."""

from fastapi import APIRouter, HTTPException, Query

from backend.services.optimization_service import OptimizationService


router = APIRouter(
    prefix="/api/plan",
    tags=["Plan"],
)

service = OptimizationService()


@router.get("")
def get_current_plan(
    status: str | None = Query(default=None, description="Filter by plan status."),
    section_id: str | None = Query(default=None, description="Filter by section."),
    block_id: str | None = Query(default=None, description="Filter by block."),
    job_id: str | None = Query(default=None, description="Filter by job."),
):
    """Return the authoritative current active maintenance plan."""
    try:
        return service.get_current_plan(status, section_id, block_id, job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load current plan: {exc}") from exc


@router.get("/summary")
def get_plan_summary():
    """Return operational KPIs calculated from the current active plan."""
    try:
        return service.get_plan_summary()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to calculate plan summary: {exc}") from exc


@router.get("/jobs")
def get_plan_jobs(
    status: str | None = Query(default=None),
    section_id: str | None = Query(default=None),
    block_id: str | None = Query(default=None),
    department: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    criticality: str | None = Query(default=None),
):
    """Return dashboard-ready jobs from the current active plan."""
    try:
        return service.get_plan_jobs(
            plan_status=status,
            section_id=section_id,
            block_id=block_id,
            department=department,
            priority=priority,
            criticality=criticality,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load plan jobs: {exc}") from exc


@router.get("/jobs/{job_id}")
def get_plan_job(job_id: str):
    """Return one job's current planning state."""
    try:
        return service.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load job {job_id}: {exc}") from exc


@router.get("/blocks")
def get_plan_blocks():
    """Return maintenance blocks enriched with current-plan assignments."""
    try:
        return service.get_plan_blocks()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load plan blocks: {exc}") from exc


@router.get("/blocks/{block_id}")
def get_plan_block(block_id: str):
    """Return one block's current operational assignment."""
    try:
        return service.get_current_block(block_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load block {block_id}: {exc}") from exc


@router.get("/sections")
def get_plan_sections():
    """Return section-level workload derived from the current active plan."""
    try:
        return service.get_plan_sections()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load plan sections: {exc}") from exc


@router.get("/sections/{section_id}")
def get_plan_section(section_id: str):
    """Return one section's current operational state."""
    try:
        return service.get_current_section(section_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load section {section_id}: {exc}") from exc


@router.post("/optimize")
def run_optimization():
    """Run the existing MARS CP-SAT optimization pipeline."""
    try:
        return service.run_optimization()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}") from exc
