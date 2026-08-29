"""MARS optimization service.

This module connects the FastAPI backend to the existing
CP-SAT optimization engine.
"""

import json
from pathlib import Path

import pandas as pd

from backend.config import (
    ASSETS_FILE,
    BLOCKS_FILE,
    CURRENT_PLAN_FILE,
    HEURISTIC_PLAN_FILE,
    JOBS_FILE,
    OPTIMIZED_PLAN_FILE,
    OPTIMIZATION_SUMMARY_FILE,
    TRAIN_SCHEDULE_FILE,
    TRAIN_SECTIONS_FILE,
)


class OptimizationService:
    """Run and expose the existing MARS optimization pipeline."""

    def __init__(self):
        self.jobs_file = JOBS_FILE
        self.assets_file = ASSETS_FILE
        self.blocks_file = BLOCKS_FILE
        self.train_schedule_file = TRAIN_SCHEDULE_FILE
        self.train_sections_file = TRAIN_SECTIONS_FILE

    @staticmethod
    def _persist_current_plan(plan) -> None:
        """Atomically promote a validated plan to the current active plan."""
        if isinstance(plan, pd.DataFrame):
            dataframe = plan.copy()
        else:
            dataframe = pd.DataFrame(plan or [])

        if dataframe.empty:
            raise ValueError("Cannot promote an empty plan to the current plan.")

        CURRENT_PLAN_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary_file = CURRENT_PLAN_FILE.with_name(
            f".{CURRENT_PLAN_FILE.name}.tmp"
        )
        try:
            dataframe.to_csv(temporary_file, index=False)
            temporary_file.replace(CURRENT_PLAN_FILE)
        except Exception:
            if temporary_file.exists():
                temporary_file.unlink()
            raise

    def get_current_plan(self):
        """Return the authoritative current active maintenance plan."""
        if not CURRENT_PLAN_FILE.exists():
            return {
                "available": False,
                "count": 0,
                "plan": [],
            }

        plan = pd.read_csv(
            CURRENT_PLAN_FILE,
            keep_default_na=False,
        )

        return {
            "available": True,
            "count": len(plan),
            "plan": plan.to_dict(
                orient="records"
            ),
        }

    def get_summary(self):
        """Return optimization metrics with current-plan metrics authoritative."""
        if not CURRENT_PLAN_FILE.exists():
            return {
                "available": False,
                "summary": {},
            }

        plan = pd.read_csv(
            CURRENT_PLAN_FILE,
            keep_default_na=False,
        )

        summary = {}
        if OPTIMIZATION_SUMMARY_FILE.exists():
            with open(
                OPTIMIZATION_SUMMARY_FILE,
                "r",
                encoding="utf-8",
            ) as file:
                summary = json.load(file)

        scheduled = plan[
            plan.get("plan_status", pd.Series(dtype=str)).astype(str).str.upper()
            == "SCHEDULED"
        ].copy()
        unscheduled_jobs = int(len(plan) - len(scheduled))
        scheduled_minutes = int(
            pd.to_numeric(
                scheduled.get("duration_min", pd.Series(dtype=float)),
                errors="coerce",
            ).fillna(0).sum()
        )
        blocks_used = int(
            scheduled.get("block_id", pd.Series(dtype=str))
            .astype(str)
            .loc[lambda values: values.ne("")]
            .nunique()
        )
        emergency_blocks = 0
        if "block_type" in scheduled.columns:
            emergency_blocks = int(
                scheduled.loc[
                    scheduled["block_type"].astype(str).str.upper() == "EMERGENCY",
                    "block_id",
                ].astype(str).loc[lambda values: values.ne("")].nunique()
            )

        total_block_minutes = 0
        if BLOCKS_FILE.exists():
            blocks = pd.read_csv(BLOCKS_FILE, keep_default_na=False)
            total_block_minutes = int(
                pd.to_numeric(
                    blocks.get("duration_min", pd.Series(dtype=float)),
                    errors="coerce",
                ).fillna(0).sum()
            )

        block_utilization = (
            scheduled_minutes / total_block_minutes
            if total_block_minutes
            else 0.0
        )

        summary.update(
            {
                "optimized_scheduled_jobs": int(len(scheduled)),
                "optimized_scheduled_minutes": scheduled_minutes,
                "optimized_block_utilization": float(block_utilization),
                "optimized_blocks_used": blocks_used,
                "optimized_emergency_blocks": emergency_blocks,
                "jobs_unscheduled": unscheduled_jobs,
            }
        )

        objective_values = summary.get("objective_values")
        if isinstance(objective_values, dict):
            objective_values = dict(objective_values)
            objective_values.update(
                {
                    "scheduled_jobs": int(len(scheduled)),
                    "used_blocks": blocks_used,
                    "emergency_blocks": emergency_blocks,
                }
            )
            summary["objective_values"] = objective_values

        summary["current_plan"] = {
            "source": "CURRENT_ACTIVE_PLAN",
            "file": str(CURRENT_PLAN_FILE),
            "job_count": int(len(plan)),
            "scheduled_jobs": int(len(scheduled)),
            "unscheduled_jobs": unscheduled_jobs,
        }

        return {
            "available": True,
            "summary": summary,
        }

    def run_optimization(self):
        """Run the existing MARS CP-SAT optimizer and promote its plan."""

        from optimizer.cp_sat.cp_sat_optimizer import (
            CPSATOptimizer,
        )

        optimizer = CPSATOptimizer(
            priority_results_path=(
                self.jobs_file.parent
                / "priority_results.csv"
            ),
            jobs_path=self.jobs_file,
            assets_path=self.assets_file,
            blocks_path=self.blocks_file,
            train_schedule_path=self.train_schedule_file,
            train_sections_path=self.train_sections_file,
            heuristic_plan_path=HEURISTIC_PLAN_FILE,
        )

        result = optimizer.optimize()
        plan = result.get("plan", [])
        status = result.get("status")

        if str(status).upper() not in {"OPTIMAL", "FEASIBLE"}:
            raise RuntimeError(
                f"Optimization did not produce a usable plan: {status}"
            )

        self._persist_current_plan(plan)

        return {
            "status": status,
            "objective_values": result.get(
                "objective_values",
                {},
            ),
            "plan": plan,
            "current_plan_promoted": True,
        }
