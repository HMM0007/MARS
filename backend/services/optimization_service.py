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

    def get_current_plan(self):
        """Return the most recently generated optimized plan."""

        if not OPTIMIZED_PLAN_FILE.exists():
            return {
                "available": False,
                "count": 0,
                "plan": [],
            }

        plan = pd.read_csv(
            OPTIMIZED_PLAN_FILE,
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
        """Return the most recent optimization summary."""

        if not OPTIMIZATION_SUMMARY_FILE.exists():
            return {
                "available": False,
                "summary": {},
            }

        with open(
            OPTIMIZATION_SUMMARY_FILE,
            "r",
            encoding="utf-8",
        ) as file:
            summary = json.load(file)

        return {
            "available": True,
            "summary": summary,
        }
    def run_optimization(self):
        """Run the existing MARS CP-SAT optimizer."""

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

        return {
            "status": result.get("status"),
            "objective_values": result.get(
                "objective_values",
                {},
            ),
            "plan": result.get(
                "plan",
                [],
            ),
        }