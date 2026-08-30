"""Operational maintenance plan API endpoints."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.config import ASSETS_FILE, BLOCKS_FILE, JOBS_FILE, TRAIN_SCHEDULE_FILE, TRAIN_SECTIONS_FILE
from backend.services.optimization_service import OptimizationService

router = APIRouter(prefix="/api/plan", tags=["Plan"])
service = OptimizationService()


@router.get("")
def get_current_plan(status: str | None = Query(None), section_id: str | None = Query(None), block_id: str | None = Query(None), job_id: str | None = Query(None)):
    try:
        return service.get_current_plan(status, section_id, block_id, job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load current plan: {exc}") from exc


@router.get("/summary")
def get_plan_summary():
    try:
        return service.get_plan_summary()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to calculate plan summary: {exc}") from exc


@router.get("/jobs")
def get_plan_jobs(status: str | None = Query(None), section_id: str | None = Query(None), block_id: str | None = Query(None), department: str | None = Query(None), priority: str | None = Query(None), criticality: str | None = Query(None)):
    try:
        return service.get_plan_jobs(plan_status=status, section_id=section_id, block_id=block_id, department=department, priority=priority, criticality=criticality)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load plan jobs: {exc}") from exc


@router.get("/jobs/{job_id}")
def get_plan_job(job_id: str):
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
    try:
        return service.get_plan_blocks()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load plan blocks: {exc}") from exc


@router.get("/blocks/{block_id}")
def get_plan_block(block_id: str):
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
    try:
        return service.get_plan_sections()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load plan sections: {exc}") from exc


@router.get("/sections/{section_id}")
def get_plan_section(section_id: str):
    try:
        return service.get_current_section(section_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load section {section_id}: {exc}") from exc


class AllocationCheck(BaseModel):
    job_id: str
    block_id: str


@router.post("/check-allocation")
def check_allocation(request: AllocationCheck):
    """Check a job/block pairing without changing the active plan or optimizer."""
    try:
        import pandas as pd
        from optimizer.cp_sat.candidate_generator import CandidateGenerator
        from optimizer.heuristic.railway_heuristic import RailwayAwareHeuristic

        jobs = pd.read_csv(JOBS_FILE, keep_default_na=False)
        assets = pd.read_csv(ASSETS_FILE, keep_default_na=False)
        blocks = pd.read_csv(BLOCKS_FILE, keep_default_na=False)
        job = jobs[jobs["job_id"].astype(str) == request.job_id]
        block = blocks[blocks["block_id"].astype(str) == request.block_id]
        if job.empty:
            raise HTTPException(status_code=404, detail=f"Job {request.job_id} not found.")
        if block.empty:
            raise HTTPException(status_code=404, detail=f"Block {request.block_id} not found.")
        job_row = job.iloc[0]; block_row = block.iloc[0]
        asset = assets[assets["asset_id"].astype(str) == str(job_row.get("asset_id", ""))]
        section_id = str(asset.iloc[0]["section_id"]) if not asset.empty else ""
        if str(block_row["section_id"]) != section_id:
            return {"feasible": False, "job_id": request.job_id, "block_id": request.block_id, "section_id": section_id, "reason_code": "SECTION_MISMATCH", "reason": "The selected block is not on the maintenance asset section.", "slots": []}
        if str(block_row["status"]).upper() != "AVAILABLE":
            return {"feasible": False, "job_id": request.job_id, "block_id": request.block_id, "section_id": section_id, "reason_code": "BLOCK_UNAVAILABLE", "reason": "The selected block is not currently available.", "slots": []}
        if str(job_row.get("isolation_required", "NO")).upper() == "YES" and str(block_row.get("isolation_required", "NO")).upper() != "YES":
            return {"feasible": False, "job_id": request.job_id, "block_id": request.block_id, "section_id": section_id, "reason_code": "ISOLATION_UNAVAILABLE", "reason": "The job requires isolation but the selected block does not provide it.", "slots": []}
        if not RailwayAwareHeuristic._restriction_allows(job_row.get("department", ""), block_row.get("restrictions", "")):
            return {"feasible": False, "job_id": request.job_id, "block_id": request.block_id, "section_id": section_id, "reason_code": "RESTRICTION_INCOMPATIBLE", "reason": "The block restriction does not permit this department's work.", "slots": []}

        generator = CandidateGenerator(service.runtime_priority_file if service.runtime_priority_file.exists() else service._ensure_runtime_priority_results(), JOBS_FILE, ASSETS_FILE, BLOCKS_FILE, TRAIN_SCHEDULE_FILE, TRAIN_SECTIONS_FILE)
        _, _, _, candidates, reasons = generator.generate()
        matches = [c for c in candidates if str(c.job_id) == request.job_id and str(c.block_id) == request.block_id]
        slots = [{"start": c.start.isoformat(), "end": c.end.isoformat()} for c in matches]
        return {"feasible": bool(slots), "job_id": request.job_id, "block_id": request.block_id, "section_id": section_id, "reason_code": "FEASIBLE" if slots else reasons.get(request.job_id, ("NO_FEASIBLE_WINDOW", "No train-free contiguous window is available."))[0], "reason": "A train-free feasible maintenance window exists." if slots else reasons.get(request.job_id, ("", "No train-free contiguous window is available."))[1], "slots": slots}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Allocation check failed: {type(exc).__name__}: {exc}") from exc


@router.post("/optimize")
def run_optimization():
    try:
        return service.run_optimization()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {type(exc).__name__}: {exc}") from exc
