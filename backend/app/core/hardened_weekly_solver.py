from app.core.weekly_solver import WeeklyCPSATSolver
from app.models.job import MaintenanceJob


CONSOLIDATION_LOCATION_TOLERANCE_KM = 0.05


class HardenedWeeklyCPSATSolver(WeeklyCPSATSolver):
    """Production guard around the unified CP-SAT solver.

    The base solver owns the scheduling model. This class tightens the
    consolidation eligibility gate so a shared possession is only available
    when the two jobs are physically co-located within the same worksite
    tolerance used by the monthly allocator.
    """

    @classmethod
    def _can_share_possession(cls, j1: MaintenanceJob, j2: MaintenanceJob) -> bool:
        if not super()._can_share_possession(j1, j2):
            return False
        try:
            location_delta = abs(float(j1.location_km) - float(j2.location_km))
        except (TypeError, ValueError):
            return False
        return location_delta <= CONSOLIDATION_LOCATION_TOLERANCE_KM
