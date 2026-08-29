"""MARS replanning API endpoints."""

from fastapi import APIRouter, HTTPException

from backend.schemas.replanning import (
    CascadeReplanningResponse,
    ReplanningRequest,
    ReplanningResponse,
)

from backend.services.replanning_service import (
    ReplanningService,
)


router = APIRouter(
    prefix="/api/replanning",
    tags=["Replanning"],
)

service = ReplanningService()


# ============================================================
# DYNAMIC REPLANNING
# ============================================================


@router.post(
    "",
    response_model=ReplanningResponse,
)
def run_replanning(
    request: ReplanningRequest,
):
    """Run dynamic MARS replanning."""

    try:
        result = service.replan(
            event_type=request.event_type,
            block_id=request.block_id,
        )

        return result

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Replanning failed: {exc}",
        ) from exc


# ============================================================
# CASCADING REPLANNING
# ============================================================


@router.post(
    "/cascade",
    response_model=CascadeReplanningResponse,
)
def run_cascade_replanning(
    request: ReplanningRequest,
):
    """Run cascading MARS replanning."""

    try:
        result = service.cascade_replan(
            event_type=request.event_type,
            block_id=request.block_id,
        )

        return result

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Cascade replanning failed: "
                f"{exc}"
            ),
        ) from exc