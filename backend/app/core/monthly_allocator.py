from typing import List, Dict, Any, Tuple
from collections import defaultdict
from app.models.job import MaintenanceJob

# Strategic planning capacity target per week per section.
DEFAULT_WEEKLY_CAPACITY_HOURS = 24.0


class MonthlyAllocator:
    """Level 1 strategic engine using section clustering + FFD across 4 weeks.

    The monthly allocator is consolidation-aware: compatible cross-department
    maintenance jobs on the same section/track are kept together in one
    strategic week so Level 2 CP-SAT can turn them into a shared possession.
    """

    @staticmethod
    def group_by_section(jobs: List[MaintenanceJob]) -> Dict[str, List[MaintenanceJob]]:
        grouped = defaultdict(list)
        for job in jobs:
            grouped[job.section_id].append(job)
        return dict(grouped)

    @staticmethod
    def _is_heavy_machine(job: MaintenanceJob) -> bool:
        machine = (job.machine_required or "").strip().upper()
        work_type = (job.work_type or "").strip().upper()
        return any(token in machine or token in work_type for token in ("BCM", "CSM", "PQRS", "T-28"))

    @classmethod
    def _can_consolidate(cls, j1: MaintenanceJob, j2: MaintenanceJob) -> bool:
        """Return whether two jobs are eligible for a shared possession."""
        if j1.department == j2.department:
            return False
        if j1.section_id != j2.section_id or j1.track_id != j2.track_id:
            return False
        if j1.power_block_required or j2.power_block_required:
            return False
        if cls._is_heavy_machine(j1) or cls._is_heavy_machine(j2):
            return False

        tag1 = (getattr(j1, "safety_conflict_tag", "NORMAL") or "NORMAL").upper()
        tag2 = (getattr(j2, "safety_conflict_tag", "NORMAL") or "NORMAL").upper()
        if tag1 != "NORMAL" or tag2 != "NORMAL":
            return False
        if {tag1, tag2} == {"WELDING", "SIGNAL_SENSITIVE"}:
            return False
        return True

    @classmethod
    def _build_consolidation_groups(
        cls, section_jobs: List[MaintenanceJob]
    ) -> Tuple[List[List[MaintenanceJob]], set[str]]:
        """Build deterministic compatible cross-department pairs.

        Each job participates in at most one consolidation group. Pairs are
        selected by descending combined AI priority so important compatible
        work is protected during FFD allocation.
        """
        candidates: List[Tuple[float, str, str, MaintenanceJob, MaintenanceJob]] = []
        for i, j1 in enumerate(section_jobs):
            for j2 in section_jobs[i + 1:]:
                if cls._can_consolidate(j1, j2):
                    score = float(j1.ai_priority_score or 0.0) + float(j2.ai_priority_score or 0.0)
                    a, b = sorted((j1.job_id, j2.job_id))
                    candidates.append((score, a, b, j1, j2))

        candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
        used: set[str] = set()
        groups: List[List[MaintenanceJob]] = []
        for _, _, _, j1, j2 in candidates:
            if j1.job_id in used or j2.job_id in used:
                continue
            groups.append([j1, j2])
            used.add(j1.job_id)
            used.add(j2.job_id)
        return groups, used

    @classmethod
    def allocate_week_bins(
        cls,
        section_jobs: List[MaintenanceJob],
        weekly_capacity: float = DEFAULT_WEEKLY_CAPACITY_HOURS,
    ) -> Dict[str, Any]:
        """Allocate work with first-fit decreasing while preserving pairs."""
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

        # Treat a compatible pair as one FFD item. This guarantees both jobs
        # enter the same strategic week and remain eligible for Level-2 sharing.
        allocation_items: List[Tuple[List[MaintenanceJob], float, float, str]] = []
        for group in groups:
            duration = sum(job.estimated_duration_hours for job in group)
            priority = sum(float(job.ai_priority_score or 0.0) for job in group)
            key = "+".join(sorted(job.job_id for job in group))
            allocation_items.append((group, duration, priority, key))

        for job in section_jobs:
            if job.job_id in grouped_job_ids:
                continue
            allocation_items.append(
                ([job], float(job.estimated_duration_hours), float(job.ai_priority_score or 0.0), job.job_id)
            )

        # First-Fit Decreasing: largest possession requirement first, with
        # priority as the deterministic tie-breaker.
        allocation_items.sort(key=lambda item: (-item[1], -item[2], item[3]))

        for group, duration, _, _ in allocation_items:
            placed = False
            for week_key, week in weeks.items():
                if week["used_hours"] + duration <= week["capacity"]:
                    week["jobs"].extend(group)
                    week["used_hours"] += duration
                    if len(group) > 1:
                        week["consolidation_groups"].append(
                            [job.job_id for job in sorted(group, key=lambda j: j.job_id)]
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
            "month": __import__("datetime").date.today().strftime("%B %Y"),
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
