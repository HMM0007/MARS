"""MARS backend configuration."""

from pathlib import Path


# Project root:
# C:\HARSH_GARAGE\MARS
PROJECT_ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = PROJECT_ROOT / "data"
SAMPLE_DATA_DIR = DATA_DIR / "sample"
OUTPUT_DATA_DIR = DATA_DIR / "output"


# Dataset V1
JOBS_FILE = SAMPLE_DATA_DIR / "maintenance_jobs.csv"
ASSETS_FILE = SAMPLE_DATA_DIR / "assets.csv"
BLOCKS_FILE = SAMPLE_DATA_DIR / "block_availability.csv"
TRAIN_SCHEDULE_FILE = SAMPLE_DATA_DIR / "train_schedule.csv"
TRAIN_SECTIONS_FILE = SAMPLE_DATA_DIR / "train_sections.csv"

# Generated plans
OPTIMIZED_PLAN_FILE = (
    OUTPUT_DATA_DIR / "optimized_maintenance_plan.csv"
)

HEURISTIC_PLAN_FILE = (
    OUTPUT_DATA_DIR / "initial_maintenance_plan.csv"
)

PLAN_COMPARISON_FILE = (
    OUTPUT_DATA_DIR / "plan_comparison.csv"
)

OPTIMIZATION_SUMMARY_FILE = (
    OUTPUT_DATA_DIR / "optimization_summary.json"
)

# Replanning outputs
REPLANNING_DIR = OUTPUT_DATA_DIR / "replanning"

REPLAN_SUMMARY_FILE = (
    REPLANNING_DIR / "replan_summary.json"
)

REPLAN_CHANGES_FILE = (
    REPLANNING_DIR / "replan_changes.csv"
)

# Application
APP_NAME = "MARS"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = (
    "Maintenance Allocation and Railway Scheduling System"
)