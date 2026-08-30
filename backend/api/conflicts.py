"""Conflict Detection API endpoints."""

from fastapi import APIRouter
from backend.services.conflict_service import conflict_service

router = APIRouter(prefix="/api/conflicts", tags=["Conflicts"])


@router.get("")
def get_conflicts():
    """Return all detected maintenance & train conflicts."""
    conflicts = conflict_service.detect_conflicts()
    return {
        "count": len(conflicts),
        "conflicts": conflicts,
    }
