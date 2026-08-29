"""Models for operational disruptions that can trigger MARS replanning."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class DisruptionEvent:
    """Represents one operational change that may invalidate a plan."""

    event_id: str
    event_type: str
    severity: str = "HIGH"

    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None

    block_id: Optional[str] = None
    train_id: Optional[str] = None
    section_id: Optional[str] = None
    job_id: Optional[str] = None

    delay_minutes: Optional[int] = None
    description: str = ""

    def __post_init__(self):
        allowed_types = {
            "BLOCK_UNAVAILABLE",
            "BLOCK_TIME_CHANGE",
            "TRAIN_DELAY",
            "NEW_MAINTENANCE_JOB",
        }

        if self.event_type not in allowed_types:
            raise ValueError(
                f"Unsupported disruption type: {self.event_type}"
            )

        if self.event_type == "BLOCK_UNAVAILABLE" and not self.block_id:
            raise ValueError(
                "BLOCK_UNAVAILABLE requires block_id."
            )

        if self.event_type == "TRAIN_DELAY" and not self.train_id:
            raise ValueError(
                "TRAIN_DELAY requires train_id."
            )

        if self.event_type == "NEW_MAINTENANCE_JOB" and not self.job_id:
            raise ValueError(
                "NEW_MAINTENANCE_JOB requires job_id."
            )