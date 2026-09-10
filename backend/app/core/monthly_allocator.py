from typing import List, Dict, Any
from collections import defaultdict
from app.models.job import MaintenanceJob

# Default capacity target per week per section in hours
DEFAULT_WEEKLY_CAPACITY_HOURS = 24.0  # 24 maintenance window hours available per week


class MonthlyAllocator:
    """
    Level 1 Strategic Engine: Groups jobs by section and allocates them 
    across 4 weeks of a month using First-Fit Decreasing (Bin Packing).
    """

    @staticmethod
    def group_by_section(jobs: List[MaintenanceJob]) -> Dict[str, List[MaintenanceJob]]:
        """
        Clusters maintenance jobs by section_id.
        """
        grouped = defaultdict(list)
        for job in jobs:
            grouped[job.section_id].append(job)
        return dict(grouped)

    @classmethod
    def allocate_week_bins(
        cls, 
        section_jobs: List[MaintenanceJob], 
        weekly_capacity: float = DEFAULT_WEEKLY_CAPACITY_HOURS
    ) -> Dict[str, Any]:
        """
        Applies First-Fit Decreasing Bin Packing to distribute jobs across 4 weeks.
        """
        # Ensure jobs are sorted by AI priority descending
        sorted_jobs = sorted(
            section_jobs, 
            key=lambda x: x.ai_priority_score or 0.0, 
            reverse=True
        )

        # 4 Week Bins
        weeks = {
            "week_1": {"jobs": [], "used_hours": 0.0, "capacity": weekly_capacity},
            "week_2": {"jobs": [], "used_hours": 0.0, "capacity": weekly_capacity},
            "week_3": {"jobs": [], "used_hours": 0.0, "capacity": weekly_capacity},
            "week_4": {"jobs": [], "used_hours": 0.0, "capacity": weekly_capacity},
        }

        deferred_to_next_month = []

        for job in sorted_jobs:
            placed = False
            # Try to place job in the first week bin that has enough capacity
            for w_key in ["week_1", "week_2", "week_3", "week_4"]:
                bin_data = weeks[w_key]
                if bin_data["used_hours"] + job.estimated_duration_hours <= bin_data["capacity"]:
                    bin_data["jobs"].append(job)
                    bin_data["used_hours"] += job.estimated_duration_hours
                    placed = True
                    break

            if not placed:
                # If low priority and monthly bins full, defer to next month
                deferred_to_next_month.append(job)

        return {
            "weeks": weeks,
            "deferred_next_month": deferred_to_next_month
        }

    @classmethod
    def generate_monthly_plan(
        cls, 
        jobs: List[MaintenanceJob], 
        capacity_per_week: float = DEFAULT_WEEKLY_CAPACITY_HOURS
    ) -> Dict[str, Any]:
        """
        Generates the complete Level 1 Monthly Strategic Plan.
        """
        section_groups = cls.group_by_section(jobs)
        monthly_section_summary = {}

        total_scheduled = 0
        total_deferred = 0

        for section_id, s_jobs in section_groups.items():
            allocation = cls.allocate_week_bins(s_jobs, capacity_per_week)
            
            section_weeks = {}
            for w_key, w_data in allocation["weeks"].items():
                scheduled_count = len(w_data["jobs"])
                total_scheduled += scheduled_count
                
                utilization_pct = round((w_data["used_hours"] / w_data["capacity"]) * 100, 1)
                
                section_weeks[w_key] = {
                    "job_count": scheduled_count,
                    "used_hours": round(w_data["used_hours"], 1),
                    "capacity_hours": w_data["capacity"],
                    "utilization_percentage": min(100.0, utilization_pct),
                    "job_ids": [j.job_id for j in w_data["jobs"]]
                }

            deferred_count = len(allocation["deferred_next_month"])
            total_deferred += deferred_count

            monthly_section_summary[section_id] = {
                "total_section_jobs": len(s_jobs),
                "scheduled_this_month": len(s_jobs) - deferred_count,
                "deferred_next_month": deferred_count,
                "weekly_breakdown": section_weeks
            }

        return {
            "month": "September 2024",
            "division": "Pune Division (CR)",
            "summary": {
                "total_jobs_evaluated": len(jobs),
                "scheduled_this_month": total_scheduled,
                "deferred_next_month": total_deferred,
                "sections_count": len(section_groups)
            },
            "section_allocations": monthly_section_summary
        }