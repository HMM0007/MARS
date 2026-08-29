"""Generate hard-feasible maintenance placement windows for CP-SAT."""

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from optimizer.heuristic.railway_heuristic import RailwayAwareHeuristic, TimeInterval


@dataclass(frozen=True)
class Candidate:
    job_id: str
    block_id: str
    section_id: str
    start: pd.Timestamp
    end: pd.Timestamp


class CandidateGenerator:
    """Creates every train-free contiguous window meeting static requirements."""

    def __init__(self, priority_results_path, jobs_path, assets_path, blocks_path, train_schedule_path, train_sections_path):
        self.heuristic_loader = RailwayAwareHeuristic(
            priority_results_path, jobs_path, assets_path, blocks_path,
            train_schedule_path, train_sections_path,
        )

    def generate(self):
        data = self.heuristic_loader.load_data()
        jobs = data["active_jobs"].merge(
            data["priority"], on="job_id", how="left", validate="one_to_one"
        ).merge(
            data["assets"][["asset_id", "section_id"]], on="asset_id", how="left"
        )
        jobs["deadline"] = pd.to_datetime(jobs["deadline"], errors="coerce")
        jobs["duration_min"] = pd.to_numeric(jobs["duration_min"], errors="coerce")
        blocks = data["blocks"].copy()
        blocks["interval"] = blocks.apply(
            lambda row: RailwayAwareHeuristic.normalize_interval(row["block_date"], row["start_time"], row["end_time"]), axis=1
        )
        trains = RailwayAwareHeuristic.normalize_train_intervals(data["train_schedule"], data["train_sections"])
        candidates, reasons = [], {}
        for job in jobs.itertuples():
            if pd.isna(job.section_id) or pd.isna(job.deadline) or pd.isna(job.duration_min) or int(job.duration_min) <= 0:
                reasons[job.job_id] = ("INVALID_INPUT", "Missing section, deadline, or positive duration.")
                continue
            section_blocks = blocks[(blocks.section_id == job.section_id) & (blocks.status.astype(str).str.upper() == "AVAILABLE")]
            if section_blocks.empty:
                reasons[job.job_id] = ("NO_SECTION_BLOCK", "No available maintenance block exists on the asset section.")
                continue
            deadline_end = pd.Timestamp(job.deadline).normalize() + pd.Timedelta(days=1)
            date_blocks = section_blocks[section_blocks.interval.map(lambda interval: interval.end <= deadline_end)]
            if date_blocks.empty:
                reasons[job.job_id] = ("BLOCK_AFTER_DEADLINE", "No available section block ends within the deadline day.")
                continue
            restriction_blocks = date_blocks[date_blocks.apply(lambda block: RailwayAwareHeuristic._restriction_allows(job.department, block.restrictions), axis=1)]
            if restriction_blocks.empty:
                reasons[job.job_id] = ("RESTRICTION_INCOMPATIBLE", "No deadline-compatible block permits this department.")
                continue
            if str(job.isolation_required).upper() == "YES":
                eligible = restriction_blocks[restriction_blocks.isolation_required.astype(str).str.upper() == "YES"]
            else:
                eligible = restriction_blocks
            if eligible.empty:
                reasons[job.job_id] = ("ISOLATION_UNAVAILABLE", "No compatible block provides required isolation.")
                continue
            train_intervals = [TimeInterval(row.start, row.end) for row in trains[trains.section_id == job.section_id].itertuples()]
            raw_fit = False
            for block in eligible.itertuples():
                raw_fit = raw_fit or (block.interval.end - block.interval.start >= pd.Timedelta(minutes=int(job.duration_min)))
                for safe in RailwayAwareHeuristic._subtract_intervals(block.interval, train_intervals):
                    if safe.end - safe.start >= pd.Timedelta(minutes=int(job.duration_min)):
                        candidates.append(Candidate(job.job_id, block.block_id, job.section_id, safe.start, safe.end))
            if not any(candidate.job_id == job.job_id for candidate in candidates):
                code = "TRAIN_CONFLICT" if raw_fit else "INSUFFICIENT_CONTIGUOUS_CAPACITY"
                reasons[job.job_id] = (code, "Train movements leave no contiguous eligible maintenance window." if raw_fit else "No eligible block is long enough for the job.")
        return jobs, blocks, trains, candidates, reasons
