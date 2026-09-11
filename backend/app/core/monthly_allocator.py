from typing import List, Dict, Any
from collections import defaultdict
from datetime import date
from app.models.job import MaintenanceJob

# Strategic planning capacity target per week per section.
DEFAULT_WEEKLY_CAPACITY_HOURS = 24.0


class MonthlyAllocator:
    """Level 1 strategic engine using section clustering + FFD across 4 weeks."""

    @staticmethod
    def group_by_section(jobs: List[MaintenanceJob]) -> Dict[str, List[MaintenanceJob]]:
        grouped = defaultdict(list)
        for job in jobs:
            grouped[job.section_id].append(job)
        return dict(grouped)

    @classmethod
    def allocate_week_bins(
        cls,
        section_jobs: List[MaintenanceJob],
        weekly_capacity: float = DEFAULT_WEEKLY_CAPACITY_HOURS,
    ) -> Dict[str, Any]:
        sorted_jobs = sorted(
            section_jobs,
            key=lambda job: job.ai_priority_score or 0.0,
            reverse=True,
        )

        weeks = {
            f"week_{index}": {
                "jobs": [],
                "used_hours": 0.0,
                "capacity": weekly_capacity,
            }
            for index in range(1, 5)
        }
        deferred_to_next_month = []

        for job in sorted_jobs:
            for week in weeks.values():
                if week["used_hours"] + job.estimated_duration_hours <= week["capacity"]:
                    week["jobs"].append(job)
                    week["used_hours"] += job.estimated_duration_hours
                    break
            else:
                deferred_to_next_month.append(job)

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

        for section_id, section_jobs in section_groups.items():
            allocation = cls.allocate_week_bins(section_jobs, capacity_per_week)
            section_weeks = {}

            for week_key, week_data in allocation["weeks"].items():
                job_count = len(week_data["jobs"])
                total_scheduled += job_count
                utilization = (week_data["used_hours"] / week_data["capacity"]) * 100
                section_weeks[week_key] = {
                    "job_count": job_count,
                    "used_hours": round(week_data["used_hours"], 1),
                    "capacity_hours": week_data["capacity"],
                    "utilization_percentage": min(100.0, round(utilization, 1)),
                    "job_ids": [job.job_id for job in week_data["jobs"]],
                }

            deferred_count = len(allocation["deferred_next_month"])
            total_deferred += deferred_count
            monthly_section_summary[section_id] = {
                "total_section_jobs": len(section_jobs),
                "scheduled_this_month": len(section_jobs) - deferred_count,
                "deferred_next_month": deferred_count,
                "weekly_breakdown": section_weeks,
            }

        today = date.today()
        return {
            "month": today.strftime("%B %Y"),
            "division": "Pune Division (CR)",
            "summary": {
                "total_jobs_evaluated": len(jobs),
                "scheduled_this_month": total_scheduled,
                "deferred_next_month": total_deferred,
                "sections_count": len(section_groups),
            },
            "section_allocations": monthly_section_summary,
        }
