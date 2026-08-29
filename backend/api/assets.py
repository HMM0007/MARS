"""Asset API endpoints."""

from fastapi import APIRouter, HTTPException
import pandas as pd

from backend.config import ASSETS_FILE


router = APIRouter(
    prefix="/api/assets",
    tags=["Assets"],
)


@router.get("")
def get_assets():
    """Return all railway assets from Dataset V1."""

    try:
        assets = pd.read_csv(
            ASSETS_FILE,
            keep_default_na=False,
        )

        return {
            "count": len(assets),
            "assets": assets.to_dict(
                orient="records"
            ),
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset file not found: {ASSETS_FILE}",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load assets: {exc}",
        )