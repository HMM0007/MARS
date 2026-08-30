"""Sections and corridor API endpoints."""

from fastapi import APIRouter
import pandas as pd
from backend.config import SAMPLE_DATA_DIR

router = APIRouter(prefix="/api/sections", tags=["Sections"])

_SECTIONS_FILE = SAMPLE_DATA_DIR / "sections.csv"


@router.get("")
def get_sections():
    """Return all railway sections and corridor information."""
    if _SECTIONS_FILE.exists():
        try:
            df = pd.read_csv(_SECTIONS_FILE, keep_default_na=False)
            return {"count": len(df), "sections": df.to_dict(orient="records")}
        except Exception:
            pass

    return {
        "count": 5,
        "sections": [
            {"section_id": "SEC-100", "name": "Km 100 - 105", "block": "B100", "corridor": "Main Line Alpha", "status": "Normal"},
            {"section_id": "SEC-120", "name": "Km 120 - 125", "block": "B120", "corridor": "Main Line Alpha", "status": "Conflict"},
            {"section_id": "SEC-130", "name": "Km 130 - 135", "block": "B130", "corridor": "Main Line Alpha", "status": "Normal"},
            {"section_id": "SEC-150", "name": "Km 150 - 155", "block": "B150", "corridor": "Main Line Alpha", "status": "Normal"},
            {"section_id": "SEC-158", "name": "Km 158 - 159", "block": "B158", "corridor": "Main Line Alpha", "status": "Attention"},
        ],
    }
