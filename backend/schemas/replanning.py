"""Pydantic schemas for MARS replanning APIs."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ============================================================
# REQUEST SCHEMAS
# ============================================================


class ReplanningRequest(BaseModel):
    """Request to trigger a MARS replanning operation."""

    event_type: str = Field(
        ...,
        description="Operational disruption type.",
        examples=["BLOCK_UNAVAILABLE"],
    )

    block_id: str = Field(
        ...,
        description="Railway maintenance block affected by the disruption.",
        examples=["B020"],
    )


# ============================================================
# EVENT RESPONSE
# ============================================================


class ReplanningEvent(BaseModel):
    """Disruption information returned by the API."""

    event_type: str
    block_id: str


# ============================================================
# SUMMARY
# ============================================================


class ReplanningSummary(BaseModel):
    """High-level replanning statistics."""

    previous_scheduled: int = 0
    revised_scheduled: int = 0

    frozen_jobs: int = 0
    released_jobs: int = 0
    affected_jobs: int = 0

    unchanged_jobs: int = 0
    rescheduled_jobs: int = 0
    dropped_jobs: int = 0
    newly_scheduled_jobs: int = 0

    schedule_stability: float = 0.0

    candidate_counts: dict[str, int] = Field(
        default_factory=dict
    )


# ============================================================
# OPTIMIZATION
# ============================================================


class OptimizationResult(BaseModel):
    """Optimization engine result."""

    solver_status: str | None = None

    objective_values: dict[str, Any] = Field(
        default_factory=dict
    )


# ============================================================
# CASCADE IMPACT
# ============================================================


class CascadeImpact(BaseModel):
    """High-level cascade impact information."""

    cascade_depth: int = 0
    direct_jobs: int = 0
    indirect_jobs: int = 0
    reconsidered_jobs: int = 0
    frozen_jobs: int = 0


# ============================================================
# API RESPONSE
# ============================================================


class ReplanningResponse(BaseModel):
    """Standard MARS dynamic replanning response."""

    event: ReplanningEvent

    summary: ReplanningSummary

    optimization: OptimizationResult

    changes: list[dict[str, Any]] = Field(
        default_factory=list
    )

    plan: list[dict[str, Any]] = Field(
        default_factory=list
    )


class CascadeReplanningResponse(
    ReplanningResponse
):
    """MARS cascading replanning response."""

    cascade: CascadeImpact

    impact_graph: list[dict[str, Any]] = Field(
        default_factory=list
    )