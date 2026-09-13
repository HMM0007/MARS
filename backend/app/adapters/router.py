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
    """Push a planner-approved, compliance-validated plan through the BDMS adapter."""
    if not isinstance(payload, dict) or not payload:
        raise HTTPException(status_code=400, detail="Payload cannot be empty")

    from app.core.plan_state_store import get_approved_plan
    approved = get_approved_plan()
    if approved:
        if "approval_status" not in payload:
            payload["approval_status"] = "APPROVED"
        if "approval_id" not in payload:
            payload["approval_id"] = f"APPR-R{approved.get('revision', 1)}-{approved.get('approved_by', 'PLANNER')}"
        if "plan_version" not in payload:
            payload["plan_version"] = f"v{approved.get('revision', 1)}.0"
        if "scheduled_blocks" not in payload:
            blocks = payload.get("blocks") or approved.get("plan", {}).get("scheduled_blocks") or approved.get("plan", {}).get("blocks") or []
            payload["scheduled_blocks"] = blocks

    try:
        return BDMSAdapter.push_approved_schedule(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/bdms/status/{transaction_id}")
def get_bdms_status(transaction_id: str):
    """Return the recorded outbound BDMS transaction status."""
    transaction = BDMSAdapter.get_transaction(transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "BDMS_TRANSACTION_NOT_FOUND",
                "transaction_id": transaction_id,
            },
        )

    return {
        "transaction_id": transaction["transaction_id"],
        "status": transaction["status"],
        "bdms_reference": transaction.get("bdms_reference"),
        "approval_id": transaction.get("approval_id"),
        "plan_version": transaction.get("plan_version"),
        "planning_week": transaction.get("planning_week"),
        "created_at": transaction.get("created_at"),
        "idempotency_key": transaction.get("idempotency_key"),
    }
