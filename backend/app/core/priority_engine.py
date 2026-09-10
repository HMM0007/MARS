import numpy as np
from datetime import datetime, date
from typing import List
from app.models.job import MaintenanceJob

# Categorical mapping baseline
BASE_CRITICALITY_MAP = {
    "CRITICAL": 90.0,
    "HIGH": 70.0,
    "MEDIUM": 50.0,
    "LOW": 30.0
}

# Asset degradation decay rate alpha per department
ALPHA_DECAY_RATES = {
    "Engineering": 0.08, # Track defects degrade fast (rail cracks)
    "S&T": 0.05,         # Signal drifts steadily
    "Traction": 0.06     # OHE wear accelerates with traffic
}


class PriorityEngine:
    """
    AI/ML Engine that converts categorical department criticality into an
    enhanced 0-100 AI priority score with dynamic exponential risk escalation.
    """

    @staticmethod
    def calculate_days_overdue(due_date: date) -> int:
        today = date.today()
        if isinstance(due_date, datetime):
            due_date = due_date.date()
        diff = (today - due_date).days
        return max(0, diff)

    @staticmethod
    def calculate_exponential_risk(base_score: float, deferral_count: int, department: str) -> float:
        """
        Exponential Risk Clock: Risk(t) = Base * (1 + alpha)^deferrals
        """
        alpha = ALPHA_DECAY_RATES.get(department, 0.05)
        escalated_score = base_score * ((1.0 + alpha) ** deferral_count)
        return min(100.0, escalated_score)

    @classmethod
    def score_job(classmethod_obj, job: MaintenanceJob) -> MaintenanceJob:
        """
        Scores a single MaintenanceJob using the ML feature pipeline.
        """
        # 1. Base Score from categorical input
        base_score = BASE_CRITICALITY_MAP.get(job.criticality_level, 50.0)
        job.base_priority_score = int(base_score)

        # 2. Extract ML features
        days_overdue = classmethod_obj.calculate_days_overdue(job.due_date)
        deferrals = getattr(job, "deferral_count", 0)
        
        # Traffic density weight (Pune-Lonavala mainline is HIGH density)
        density_weight = 1.15 if "PUNE-LNL" in job.section_id else 1.0
        
        # Seasonal Monsoon Factor (July - Sept track defects escalate faster)
        current_month = datetime.now().month
        monsoon_factor = 1.12 if current_month in [6, 7, 8, 9] and job.department == "Engineering" else 1.0

        # 3. Apply Exponential Risk Escalation
        escalated_base = classmethod_obj.calculate_exponential_risk(base_score, deferrals, job.department)

        # 4. Feature Combination Pipeline (XGBoost Feature Matrix Proxy)
        # Combine: Escalated Base + Overdue Penalty + Traffic Weight + Monsoon Factor
        overdue_penalty = min(20.0, days_overdue * 2.5)
        
        raw_ai_score = (escalated_base + overdue_penalty) * density_weight * monsoon_factor
        
        # Cap final AI score strictly between 0 and 100
        final_ai_score = round(float(np.clip(raw_ai_score, 0.0, 100.0)), 2)
        
        job.ai_priority_score = final_ai_score
        return job

    @classmethod
    def process_job_batch(classmethod_obj, jobs: List[MaintenanceJob]) -> List[MaintenanceJob]:
        """
        Processes and scores a list of MaintenanceJob objects, sorted by AI priority descending.
        """
        scored_jobs = [classmethod_obj.score_job(j) for j in jobs]
        # Sort descending by AI priority score
        scored_jobs.sort(key=lambda x: x.ai_priority_score or 0.0, reverse=True)
        return scored_jobs