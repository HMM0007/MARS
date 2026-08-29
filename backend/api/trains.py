"""Train schedule API endpoints."""

from fastapi import APIRouter, HTTPException
import pandas as pd

from backend.config import (
    TRAIN_SCHEDULE_FILE,
    TRAIN_SECTIONS_FILE,
)


router = APIRouter(
    prefix="/api/trains",
    tags=["Trains"],
)


@router.get("")
def get_trains():
    """Return train schedules with their section movements."""

    try:
        schedules = pd.read_csv(
            TRAIN_SCHEDULE_FILE,
            keep_default_na=False,
        )

        sections = pd.read_csv(
            TRAIN_SECTIONS_FILE,
            keep_default_na=False,
        )

        trains = schedules.merge(
            sections,
            on="train_id",
            how="left",
        )

        return {
            "count": len(schedules),
            "section_records": len(sections),
            "trains": trains.to_dict(
                orient="records"
            ),
        }

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Train dataset file not found: {exc}",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load train data: {exc}",
        )