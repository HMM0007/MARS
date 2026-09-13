from datetime import datetime
from app.core.plan_state_store import get_approved_plan
from app.core.what_if_engine import simulate_scenario


def test_what_if_track_outage_returns_rich_diff():
    approved = get_approved_plan()
    assert approved is not None, "Approved plan required for test"
    
    scenario = {
        "week": 1,
        "scenario_type": "TRACK_OUTAGE",
        "section_id": "PUNE-LNL",
        "track_id": "PUNE-LNL-UP",
        "start_time": datetime(2026, 9, 8, 8, 0, 0),
        "duration_minutes": 180,
        "impact_percent": None,
    }
    result = simulate_scenario(scenario, approved)
    assert result["status"] == "SIMULATED"
    assert "impact" in result
    assert "capacity_loss_hours" in result["impact"]
    assert result["impact"]["capacity_loss_hours"] == 3.0
    assert "job_comparisons" in result
    assert len(result["job_comparisons"]) > 0
    assert "dispatcher_advisories" in result
    assert len(result["dispatcher_advisories"]) > 0
    assert "simulated_blocks" in result
    assert len(result["simulated_blocks"]) > 0


def test_what_if_freight_surge_resilient_synthesis():
    approved = get_approved_plan()
    assert approved is not None
    
    # CWD-YARD has no timetable freight in trains.json, engine must synthesize
    scenario = {
        "week": 1,
        "scenario_type": "FREIGHT_SURGE",
        "section_id": "CWD-YARD",
        "track_id": "CWD-YARD-DN",
        "start_time": datetime(2026, 9, 9, 14, 0, 0),
        "duration_minutes": 120,
        "impact_percent": 30,
    }
    result = simulate_scenario(scenario, approved)
    assert result["status"] == "SIMULATED"
    assert result["impact"]["solver_status"] in ("OPTIMAL", "FEASIBLE")
    assert len(result["job_comparisons"]) > 0


def test_what_if_monsoon_slowdown_resilient_synthesis():
    approved = get_approved_plan()
    assert approved is not None
    
    scenario = {
        "week": 1,
        "scenario_type": "MONSOON_SLOWDOWN",
        "section_id": "LNL-KJT",
        "track_id": "LNL-KJT-UP",
        "start_time": datetime(2026, 9, 10, 11, 0, 0),
        "duration_minutes": 180,
        "impact_percent": 35,
    }
    result = simulate_scenario(scenario, approved)
    assert result["status"] == "SIMULATED"
    assert result["impact"]["solver_status"] in ("OPTIMAL", "FEASIBLE")
    assert len(result["job_comparisons"]) > 0
