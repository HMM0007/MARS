from pathlib import Path
import pandas as pd
from optimizer.cp_sat.candidate_generator import CandidateGenerator
from optimizer.cp_sat.cp_sat_optimizer import CPSATOptimizer
from optimizer.cp_sat.plan_validator import OptimizedPlanValidator
from optimizer.heuristic.railway_heuristic import RailwayAwareHeuristic

ROOT=Path(__file__).resolve().parents[1]

def test_candidate_generation_dataset_v1_has_multiple_windows_and_overnight_support():
    s=ROOT/"data/sample"; jobs,blocks,trains,candidates,reasons=CandidateGenerator(s/"priority_results.csv",s/"maintenance_jobs.csv",s/"assets.csv",s/"block_availability.csv",s/"train_schedule.csv",s/"train_sections.csv").generate()
    assert len(jobs)==len(pd.read_csv(s/"maintenance_jobs.csv")) and candidates
    overnight=RailwayAwareHeuristic.normalize_interval("2026-08-30","22:00","00:00")
    assert overnight.end.day==31
    assert any(candidate.end > candidate.start for candidate in candidates)

def test_optimizer_dataset_v1_outputs_valid_plan(tmp_path):
    s=ROOT/"data/sample"; before={p.name:p.read_bytes() for p in s.glob("*.csv")}; output=tmp_path/"data/output"
    plan,summary=CPSATOptimizer(s/"priority_results.csv",s/"maintenance_jobs.csv",s/"assets.csv",s/"block_availability.csv",s/"train_schedule.csv",s/"train_sections.csv",ROOT/"data/output/initial_maintenance_plan.csv",output).optimize()
    assert len(plan)==len(pd.read_csv(s/"maintenance_jobs.csv")) and (output/"optimized_maintenance_plan.csv").exists() and (output/"plan_comparison.csv").exists() and (output/"optimization_summary.json").exists()
    assert summary["optimized_priority_value"] >= summary["heuristic_priority_value"]
    # Stage 6 is selected-only: no unselected candidate end may affect it.
    assert summary["objective_values"]["completion_minutes"] == summary["optimized_selected_completion_minutes"]
    assert summary["completion_improvement_minutes"] == summary["heuristic_selected_completion_minutes"] - summary["optimized_selected_completion_minutes"]
    assert before=={p.name:p.read_bytes() for p in s.glob("*.csv")}
