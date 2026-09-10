from fastapi import APIRouter
from typing import List, Dict, Any

from app.models.job import MaintenanceJob
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.core.priority_engine import PriorityEngine
from app.core.monthly_allocator import MonthlyAllocator

router = APIRouter(prefix="/api/v1/core", tags=["MARS Core AI Engine"])


@router.get("/jobs/all-scored", response_model=List[MaintenanceJob])
def get_all_scored_jobs():
    """
    Ingests raw jobs from TMS, SMMS, and TDMS adapters, runs the XGBoost Priority Engine 
    and Exponential Risk Clock, and returns all jobs ranked by AI Priority Score (0-100).
    """
    eng_jobs = TMSAdapter.fetch_engineering_jobs()
    snt_jobs = SMMSAdapter.fetch_snt_jobs()
    trc_jobs = TDMSAdapter.fetch_traction_jobs()

    all_raw_jobs = eng_jobs + snt_jobs + trc_jobs
    scored_jobs = PriorityEngine.process_job_batch(all_raw_jobs)
    return scored_jobs


@router.get("/plan/monthly", response_model=Dict[str, Any])
def get_monthly_strategic_plan():
    """
    Level 1 Monthly Strategic Engine:
    Takes AI-scored jobs, clusters by section, and uses First-Fit Decreasing (Bin Packing) 
    to generate a 4-week strategic workload allocation matrix across Pune Division.
    """
    eng_jobs = TMSAdapter.fetch_engineering_jobs()
    snt_jobs = SMMSAdapter.fetch_snt_jobs()
    trc_jobs = TDMSAdapter.fetch_traction_jobs()

    all_raw_jobs = eng_jobs + snt_jobs + trc_jobs
    scored_jobs = PriorityEngine.process_job_batch(all_raw_jobs)

    monthly_plan = MonthlyAllocator.generate_monthly_plan(scored_jobs)
    return monthly_plan