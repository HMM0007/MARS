from pathlib import Path

import pandas as pd

from optimizer.heuristic.railway_heuristic import RailwayAwareHeuristic, TimeInterval


ROOT = Path(__file__).resolve().parents[1]


def write_csv(path: Path, rows: list[dict]) -> None:
    pd.DataFrame(rows).to_csv(path, index=False)


def make_engine(tmp_path: Path, jobs: list[dict], assets: list[dict], blocks: list[dict], trains=None, train_sections=None, priority=None):
    trains = trains or [{"train_id": "T1", "schedule_date": "2026-08-30", "status": "Scheduled"}]
    train_sections = train_sections or []
    priority = priority or [
        {"job_id": job["job_id"], "priority_rank": index + 1, "priority_score": 100 - index}
        for index, job in enumerate(jobs)
    ]
    paths = {}
    for name, rows in {
        "priority": priority,
        "jobs": jobs,
        "assets": assets,
        "blocks": blocks,
        "trains": trains,
    }.items():
        paths[name] = tmp_path / f"{name}.csv"
        write_csv(paths[name], rows)
    paths["train_sections"] = tmp_path / "train_sections.csv"
    pd.DataFrame(
        train_sections,
        columns=[
            "train_section_id", "train_id", "section_id", "sequence",
            "arrival_time", "departure_time",
        ],
    ).to_csv(paths["train_sections"], index=False)
    return RailwayAwareHeuristic(paths["priority"], paths["jobs"], paths["assets"], paths["blocks"], paths["trains"], paths["train_sections"])


def job(job_id="J1", asset_id="A1", department="Engineering", duration=60, deadline="2026-08-30", isolation="No"):
    return {"job_id": job_id, "asset_id": asset_id, "department": department, "work_type": "Work", "duration_min": duration, "deadline": deadline, "status": "Pending", "isolation_required": isolation}


def block(block_id="B1", section="S1", start="08:00", end="10:00", restriction="None", isolation="No", date="2026-08-30"):
    return {"block_id": block_id, "section_id": section, "block_date": date, "start_time": start, "end_time": end, "duration_min": 120, "status": "Available", "block_type": "Planned", "restrictions": restriction, "isolation_required": isolation}


def test_overnight_block_normalization():
    interval = RailwayAwareHeuristic.normalize_interval("2026-08-30", "22:00", "00:00")
    assert interval.start == pd.Timestamp("2026-08-30 22:00")
    assert interval.end == pd.Timestamp("2026-08-31 00:00")


def test_overnight_train_normalization():
    schedule = pd.DataFrame([{ "train_id": "T1", "schedule_date": "2026-08-30", "status": "Scheduled" }])
    sections = pd.DataFrame([{ "train_section_id": "TS1", "train_id": "T1", "section_id": "S1", "sequence": 1, "arrival_time": "23:30", "departure_time": "00:15" }])
    normalized = RailwayAwareHeuristic.normalize_train_intervals(schedule, sections)
    assert normalized.iloc[0].start == pd.Timestamp("2026-08-30 23:30")
    assert normalized.iloc[0].end == pd.Timestamp("2026-08-31 00:15")


def test_touching_train_endpoint_is_feasible(tmp_path):
    engine = make_engine(tmp_path, [job()], [{"asset_id": "A1", "section_id": "S1"}], [block(start="08:00", end="09:00")], train_sections=[{"train_section_id": "TS1", "train_id": "T1", "section_id": "S1", "sequence": 1, "arrival_time": "09:00", "departure_time": "10:00"}])
    assert engine.build_plan().iloc[0].plan_status == "SCHEDULED"


def test_actual_train_overlap_is_rejected(tmp_path):
    engine = make_engine(tmp_path, [job()], [{"asset_id": "A1", "section_id": "S1"}], [block(start="08:00", end="09:00")], train_sections=[{"train_section_id": "TS1", "train_id": "T1", "section_id": "S1", "sequence": 1, "arrival_time": "08:15", "departure_time": "09:00"}])
    row = engine.build_plan().iloc[0]
    assert row.plan_status == "UNSCHEDULED"
    assert row.scheduling_reason_code == "TRAIN_CONFLICT"


def test_section_mismatch(tmp_path):
    engine = make_engine(tmp_path, [job()], [{"asset_id": "A1", "section_id": "S2"}], [block(section="S1")])
    assert engine.build_plan().iloc[0].scheduling_reason_code == "NO_SECTION_BLOCK"


def test_restriction_and_isolation_compatibility(tmp_path):
    restriction_engine = make_engine(tmp_path, [job(department="Traction")], [{"asset_id": "A1", "section_id": "S1"}], [block(restriction="Engineering work only")])
    assert restriction_engine.build_plan().iloc[0].scheduling_reason_code == "RESTRICTION_INCOMPATIBLE"
    isolation_engine = make_engine(tmp_path, [job(isolation="Yes")], [{"asset_id": "A1", "section_id": "S1"}], [block(isolation="No")])
    assert isolation_engine.build_plan().iloc[0].scheduling_reason_code == "ISOLATION_UNAVAILABLE"


def test_duration_deadline_and_competing_jobs(tmp_path):
    capacity_engine = make_engine(tmp_path, [job(duration=121)], [{"asset_id": "A1", "section_id": "S1"}], [block()])
    assert capacity_engine.build_plan().iloc[0].scheduling_reason_code == "INSUFFICIENT_CONTIGUOUS_CAPACITY"
    deadline_engine = make_engine(tmp_path, [job(deadline="2026-08-29")], [{"asset_id": "A1", "section_id": "S1"}], [block()])
    assert deadline_engine.build_plan().iloc[0].scheduling_reason_code == "BLOCK_AFTER_DEADLINE"
    jobs = [job("J1", duration=75), job("J2", duration=75)]
    engine = make_engine(tmp_path, jobs, [{"asset_id": "A1", "section_id": "S1"}], [block()])
    plan = engine.build_plan()
    assert plan.iloc[0].plan_status == "SCHEDULED"
    assert plan.iloc[1].scheduling_reason_code == "INSUFFICIENT_CONTIGUOUS_CAPACITY"


def test_deterministic_ordering(tmp_path):
    jobs = [job("J2", duration=30), job("J1", duration=60)]
    priority = [
        {"job_id": "J2", "priority_rank": 1, "priority_score": 90},
        {"job_id": "J1", "priority_rank": 1, "priority_score": 90},
    ]
    engine = make_engine(tmp_path, jobs, [{"asset_id": "A1", "section_id": "S1"}], [block()], priority=priority)
    assert engine.build_plan().job_id.tolist() == ["J1", "J2"]


def test_dataset_v1_integration_and_output_location(tmp_path):
    sample_dir = ROOT / "data" / "sample"
    before = {path.name: path.read_bytes() for path in sample_dir.glob("*.csv")}
    output = tmp_path / "data" / "output" / "initial_maintenance_plan.csv"
    engine = RailwayAwareHeuristic(sample_dir / "priority_results.csv", sample_dir / "maintenance_jobs.csv", sample_dir / "assets.csv", sample_dir / "block_availability.csv", sample_dir / "train_schedule.csv", sample_dir / "train_sections.csv")
    plan = engine.save_plan(output)
    assert len(plan) == 40
    assert set(plan.plan_status) <= {"SCHEDULED", "UNSCHEDULED"}
    assert output.exists()
    assert output.parts[-3:] == ("data", "output", "initial_maintenance_plan.csv")
    assert not (sample_dir / "initial_maintenance_plan.csv").exists()
    assert before == {path.name: path.read_bytes() for path in sample_dir.glob("*.csv")}
    scheduled = plan.loc[plan.plan_status == "SCHEDULED"]
    assert (pd.to_datetime(scheduled.scheduled_end) <= pd.to_datetime(scheduled.deadline) + pd.Timedelta(days=1)).all()
    blocks = pd.read_csv(sample_dir / "block_availability.csv", keep_default_na=False)
    jobs = pd.read_csv(sample_dir / "maintenance_jobs.csv", keep_default_na=False).set_index("job_id")
    train_intervals = RailwayAwareHeuristic.normalize_train_intervals(
        pd.read_csv(sample_dir / "train_schedule.csv", keep_default_na=False),
        pd.read_csv(sample_dir / "train_sections.csv", keep_default_na=False),
    )
    for row in scheduled.itertuples():
        source_block = blocks.loc[blocks.block_id == row.block_id].iloc[0]
        scheduled_interval = TimeInterval(pd.Timestamp(row.scheduled_start), pd.Timestamp(row.scheduled_end))
        block_interval = RailwayAwareHeuristic.normalize_interval(
            source_block.block_date, source_block.start_time, source_block.end_time
        )
        assert source_block.status == "Available"
        assert row.section_id == source_block.section_id
        assert block_interval.start <= scheduled_interval.start < scheduled_interval.end <= block_interval.end
        assert scheduled_interval.end - scheduled_interval.start == pd.Timedelta(minutes=int(row.duration_min))
        assert RailwayAwareHeuristic._restriction_allows(row.department, source_block.restrictions)
        if jobs.loc[row.job_id, "isolation_required"] == "Yes":
            assert source_block.isolation_required == "Yes"
        section_trains = train_intervals.loc[train_intervals.section_id == row.section_id]
        assert all(
            not scheduled_interval.overlaps(TimeInterval(train.start, train.end))
            for train in section_trains.itertuples()
        )
    for _, group in scheduled.groupby("section_id"):
        intervals = [TimeInterval(pd.Timestamp(row.scheduled_start), pd.Timestamp(row.scheduled_end)) for row in group.itertuples()]
        assert all(not first.overlaps(second) for index, first in enumerate(intervals) for second in intervals[index + 1:])
