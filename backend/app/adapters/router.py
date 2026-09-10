from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from app.models.job import MaintenanceJob
from app.models.train import TrainMovement, FreightForecast
from app.adapters.tms_adapter import TMSAdapter
from app.adapters.smms_adapter import SMMSAdapter
from app.adapters.tdms_adapter import TDMSAdapter
from app.adapters.coa_adapter import COAAdapter
from app.adapters.bdms_adapter import BDMSAdapter

router = APIRouter(prefix="/api/v1/adapters", tags=["CRIS System Adapters"])


@router.get("/tms/jobs", response_model=List[MaintenanceJob])
def get_tms_jobs():
    """Fetch Engineering track/civil maintenance jobs from TMS adapter"""
    return TMSAdapter.fetch_engineering_jobs()


@router.get("/smms/jobs", response_model=List[MaintenanceJob])
def get_smms_jobs():
    """Fetch Signal & Telecom maintenance jobs from SMMS adapter"""
    return SMMSAdapter.fetch_snt_jobs()


@router.get("/tdms/jobs", response_model=List[MaintenanceJob])
def get_tdms_jobs():
    """Fetch Traction OHE maintenance jobs from TDMS adapter"""
    return TDMSAdapter.fetch_traction_jobs()


@router.get("/coa/timetable", response_model=List[TrainMovement])
def get_coa_timetable():
    """Fetch Passenger & Express train timetable from COA adapter"""
    return COAAdapter.fetch_passenger_timetable()


@router.get("/coa/freight-forecast", response_model=List[FreightForecast])
def get_coa_freight_forecast():
    """Fetch Goods & Freight train density forecast from COA adapter"""
    return COAAdapter.fetch_freight_forecast()


@router.post("/bdms/push-sanctions")
def push_to_bdms(payload: Dict[str, Any]):
    """Push human-approved block plan to CRIS BDMS workflow"""
    if not payload:
        raise HTTPException(status_code=400, detail="Payload cannot be empty")
    return BDMSAdapter.push_approved_schedule(payload)