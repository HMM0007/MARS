"""Maintenance block API endpoints."""

from fastapi import APIRouter, HTTPException
import pandas as pd

from backend.config import BLOCKS_FILE


router = APIRouter(
    prefix="/api/blocks",
    tags=["Blocks"],
)


@router.get("")
def get_blocks():
    """Return all maintenance blocks from Dataset V1."""

    try:
        blocks = pd.read_csv(
            BLOCKS_FILE,
            keep_default_na=False,
        )

        return {
            "count": len(blocks),
            "blocks": blocks.to_dict(
                orient="records"
            ),
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset file not found: {BLOCKS_FILE}",
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load maintenance blocks: {exc}",
        )