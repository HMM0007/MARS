from typing import List, Dict, Any, Tuple
from collections import defaultdict
from datetime import date
from app.models.job import MaintenanceJob

# Strategic planning capacity target per week per section.
DEFAULT_WEEKLY_CAPACITY_HOURS = 24.0

# Jobs at the same physical worksite can share one possession when the
# operational compatibility checks below pass. Five hundredths of a km is
# 50 m, which is intentionally conservative for a synthetic planning model.
CONSOLIDATION_LOCATION_TOLERANCE_KM = 0.05


class MonthlyAllocator:
    """Level 1 strategic engine using section clustering + FFD across 4 weeks.

    The allocator discovers compatible cross-department work before bin
    packing. A compatible group is treated as ONE possession item, so the
    jobs cannot be split into different strategic weeks.
    """

    @staticmethod
    def group_by_section(jobs: List[MaintenanceJob]) -> Dict[str, List[MaintenanceJob]]:
        grouped = defaultdict(list)
        for job in jobs:
            grouped[job.section_id].append(job)
        return dict(grouped)

    @staticmethod
    def _norm(value: Any, default: str = "") -> str:
        return str(value if value is not None else default).strip().upper()

    @classmethod
    def _is_heavy_machine(cls, job: MaintenanceJob) -> bool:
        machine = cls._norm(job.machine_required)
        work_type = cls._norm(job.work_type)
        return any(token in machine or token in work_type for token in ("BCM", "CSM", "PQRS", "T-28"))

    @classmethod
    def _can_consolidate(cls, j1: MaintenanceJob, j2: MaintenanceJob) -> bool:
        """Return whether two jobs are safe candidates for one shared possession."""
        if j1.job_id == j2.job_id:
            return False
        if cls._norm(j1.department) == cls._norm(j2.department):
            return False
        if cls._norm(j1.section_id) != cls._norm(j2.section_id):
            return False
        if cls._norm(j1.track_id) != cls._norm(j2.track_id):
            return False

        try:
            location_delta = abs(float(j1.location_km) - float(j2.location_km))
        except (TypeError, ValueError):
            return False
        if location_delta > CONSOLIDATION_LOCATION_TOLERANCE_KM:
            return False

        if bool(j1.power_block_required) or bool(j2.power_block_required):
            return False
        if cls._is_heavy_machine(j1) or cls._is_heavy_machine(j2):
            return False

        tag1 = cls._norm(getattr(j1, "safety_conflict_tag", "NORMAL"), "NORMAL")
        tag2 = cls._norm(getattr(j2, "safety_conflict_tag", "NORMAL"), "NORMAL")
        if tag1 != "NORMAL" or tag2 != "NORMAL":
            return False

        # Keep the explicit incompatible safety relationship documented here
        # even though the NORMAL-tag gate already rejects non-normal pairs.
        if {tag1, tag2} == {"WELDING", "SIGNAL_SENSITIVE"}:
            return False
        return True

    @classmethod
    def find_consolidation_groups(
        cls, section_jobs: List[MaintenanceJob]
    ) -> List[List[MaintenanceJob]]:
        """Discover deterministic, non-overlapping compatible job pairs."""
        candidates: List[Tuple[float, str, str, MaintenanceJob, MaintenanceJob]] = []

        for i, j1 in enumerate(section_jobs):
            for j2 in section_jobs[i + 1:]:
                if not cls._can_consolidate(j1, j2):
                    continue
                score = float(j1.ai_priority_score or 0.0) + float(j2.ai_priority_score or 0.0)
                a, b = sorted((j1.job_id, j2.job_id))
                candidates.append((score, a, b, j1, j2))

        # Highest combined risk first, then stable job IDs for reproducibility.
        candidates.sort(key=lambda item: (-item[0], item[1], item[2]))

        used: set[str] = set()
        groups: List[List[MaintenanceJob]] = []
        for _, _, _, j1, j2 in candidates:
            if j1.job_id in used or j2.job_id in used:
                continue
            group = sorted([j1, j2], key=lambda job: job.job_id)
            groups.append(group)
            used.update(job.job_id for job in group)

        return groups

    @classmethod
    def _build_consolidation_groups(
        cls, section_jobs: List[MaintenanceJob]
    ) -> Tuple[List[List[MaintenanceJob]], set[str]]:
        """Backward-compatible wrapper returning groups and participating IDs."""
        groups = cls.find_consolidation_groups(section_jobs)
        used = {job.job_id for group in groups for job in group}
        return groups, used

    @classmethod
    def allocate_week_bins(
        cls,
        section_jobs: List[MaintenanceJob],
        weekly_capacity: float = DEFAULT_WEEKLY_CAPACITY_HOURS,
    ) -> Dict[str, Any]:
        """Allocate work with first-fit decreasing while preserving groups."""
        weeks = {
            f"week_{index}": {
                "jobs": [],
                "used_hours": 0.0,
                "capacity": weekly_capacity,
                "consolidation_groups": [],
            }
            for index in range(1, 5)
        }
        deferred_to_next_month: List[MaintenanceJob] = []

        groups, grouped_job_ids = cls._build_consolidation_groups(section_jobs)

        # A shared possession consumes the maximum simultaneous work duration,
        # not the sum of department task durations. For the deterministic demo
        # pair (2h + 2h), the strategic possession requirement is therefore 2h.
        allocation_items: List[Tuple[List[MaintenanceJob], float, float, str]] = []
        for group in groups:
            possession_hours = max(float(job.estimated_duration_hours) for job in group)
            priority = sum(float(job.ai_priority_score or 0.0) for job in group)
            key = "+".join(job.job_id for job in group)
            allocation_items.append((group, possession_hours, priority, key))

        for job in section_jobs:
            if job.job_id in grouped_job_ids:
                continue
            allocation_items.append(
                ([job], float(job.estimated_duration_hours), float(job.ai_priority_score or 0.0), job.job_id)
            )

        allocation_items.sort(key=lambda item: (-item[1], -item[2], item[3]))

        for group, possession_hours, _, _ in allocation_items:
            placed = False
            for week_key, week in weeks.items():
                if week["used_hours"] + possession_hours <= week["capacity"]:
                    week["jobs"].extend(group)
                    week["used_hours"] += possession_hours
                    if len(group) > 1:
                        week["consolidation_groups"].append(
                            [job.job_id for job in group]
                        )
                    placed = True
                    break

            if not placed:
                deferred_to_next_month.extend(group)

        return {"weeks": weeks, "deferred_next_month": deferred_to_next_month}

    @classmethod
    def generate_monthly_plan(
        cls,
        jobs: List[MaintenanceJob],
        capacity_per_week: float = DEFAULT_WEEKLY_CAPACITY_HOURS,
    ) -> Dict[str, Any]:
        section_groups = cls.group_by_section(jobs)
        monthly_section_summary = {}
        total_scheduled = 0
        total_deferred = 0
        total_consolidation_groups = 0

        for section_id, section_jobs in section_groups.items():
            allocation = cls.allocate_week_bins(section_jobs, capacity_per_week)
            section_weeks = {}

            for week_key, week_data in allocation["weeks"].items():
                job_count = len(week_data["jobs"])
                total_scheduled += job_count
                total_consolidation_groups += len(week_data["consolidation_groups"])
                utilization = (week_data["used_hours"] / week_data["capacity"]) * 100
                section_weeks[week_key] = {
                    "job_count": job_count,
                    "used_hours": round(week_data["used_hours"], 1),
                    "capacity_hours": week_data["capacity"],
                    "utilization_percentage": min(100.0, round(utilization, 1)),
                    "job_ids": [job.job_id for job in week_data["jobs"]],
                    "consolidation_groups": week_data["consolidation_groups"],
                }

            deferred_count = len(allocation["deferred_next_month"])
            total_deferred += deferred_count
            monthly_section_summary[section_id] = {
                "total_section_jobs": len(section_jobs),
                "scheduled_this_month": len(section_jobs) - deferred_count,
                "deferred_next_month": deferred_count,
                "weekly_breakdown": section_weeks,
            }

        return {
            "month": date.today().strftime("%B %Y"),
            "division": "Pune Division (CR)",
            "summary": {
                "total_jobs_evaluated": len(jobs),
                "scheduled_this_month": total_scheduled,
                "deferred_next_month": total_deferred,
                "sections_count": len(section_groups),
                "consolidation_groups": total_consolidation_groups,
            },
            "section_allocations": monthly_section_summary,
        }
