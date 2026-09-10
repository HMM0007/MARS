from fastapi import APIRouter
from typing import List

from app.models.job import MaintenanceJob
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.core.priority_engine import PriorityEngine

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