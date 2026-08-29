"""Independent validation of optimized MARS maintenance plans."""

import pandas as pd

from optimizer.heuristic.railway_heuristic import RailwayAwareHeuristic, TimeInterval


class OptimizedPlanValidator:
    def __init__(self, jobs_path, assets_path, blocks_path, train_schedule_path, train_sections_path):
        self.jobs_path, self.assets_path, self.blocks_path = jobs_path, assets_path, blocks_path
        self.train_schedule_path, self.train_sections_path = train_schedule_path, train_sections_path

    def validate(self, plan: pd.DataFrame) -> None:
        required = {"job_id", "plan_status", "asset_id", "section_id", "duration_min", "deadline", "block_id", "scheduled_start", "scheduled_end", "block_restrictions", "block_isolation_required"}
        missing = required - set(plan.columns)
        if missing or plan.job_id.duplicated().any():
            raise ValueError(f"Invalid optimized plan schema or duplicate jobs: {sorted(missing)}")
        jobs = pd.read_csv(self.jobs_path, keep_default_na=False).set_index("job_id")
        assets = pd.read_csv(self.assets_path, keep_default_na=False).set_index("asset_id")
        blocks = pd.read_csv(self.blocks_path, keep_default_na=False).set_index("block_id")
        schedules = pd.read_csv(self.train_schedule_path, keep_default_na=False)
        sections = pd.read_csv(self.train_sections_path, keep_default_na=False)
        trains = RailwayAwareHeuristic.normalize_train_intervals(schedules, sections)
        scheduled = plan[plan.plan_status == "SCHEDULED"]
        for row in scheduled.itertuples():
            if row.job_id not in jobs.index or row.asset_id not in assets.index or row.block_id not in blocks.index:
                raise ValueError(f"Unknown job, asset, or block in {row.job_id}")
            job, block = jobs.loc[row.job_id], blocks.loc[row.block_id]
            interval = TimeInterval(pd.Timestamp(row.scheduled_start), pd.Timestamp(row.scheduled_end))
            block_interval = RailwayAwareHeuristic.normalize_interval(block.block_date, block.start_time, block.end_time)
            if assets.loc[row.asset_id, "section_id"] != row.section_id or block.section_id != row.section_id:
                raise ValueError(f"Section mismatch for {row.job_id}")
            if interval.end - interval.start != pd.Timedelta(minutes=int(row.duration_min)) or not (block_interval.start <= interval.start < interval.end <= block_interval.end):
                raise ValueError(f"Duration or block containment failure for {row.job_id}")
            if interval.end > pd.Timestamp(row.deadline).normalize() + pd.Timedelta(days=1):
                raise ValueError(f"Deadline failure for {row.job_id}")
            if not RailwayAwareHeuristic._restriction_allows(row.department, block.restrictions):
                raise ValueError(f"Restriction failure for {row.job_id}")
            if str(job.isolation_required).upper() == "YES" and str(block.isolation_required).upper() != "YES":
                raise ValueError(f"Isolation failure for {row.job_id}")
            for train in trains[trains.section_id == row.section_id].itertuples():
                if interval.overlaps(TimeInterval(train.start, train.end)):
                    raise ValueError(f"Train conflict for {row.job_id}")
        for _, group in scheduled.groupby("section_id"):
            intervals = [TimeInterval(pd.Timestamp(row.scheduled_start), pd.Timestamp(row.scheduled_end)) for row in group.itertuples()]
            if any(a.overlaps(b) for index, a in enumerate(intervals) for b in intervals[index + 1:]):
                raise ValueError("Section maintenance overlap")
        for _, group in scheduled.groupby("block_id"):
            intervals = [TimeInterval(pd.Timestamp(row.scheduled_start), pd.Timestamp(row.scheduled_end)) for row in group.itertuples()]
            if any(a.overlaps(b) for index, a in enumerate(intervals) for b in intervals[index + 1:]):
                raise ValueError("Block maintenance overlap")
