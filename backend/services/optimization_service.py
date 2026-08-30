"""MARS optimization and operational planning service."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from backend.config import (
    ASSETS_FILE, BLOCKS_FILE, CURRENT_PLAN_FILE, HEURISTIC_PLAN_FILE,
    JOBS_FILE, OPTIMIZATION_SUMMARY_FILE, TRAIN_SCHEDULE_FILE,
    TRAIN_SECTIONS_FILE, OUTPUT_DATA_DIR,
)


class OptimizationService:
    """Run the existing MARS optimizer and expose operational plan views.

    This service is an adapter around the optimizer. The optimizer implementation
    itself is intentionally not changed. New/updated request rows are normalized
    here so the existing engine always receives a complete planning input.
    """

    def __init__(self):
        self.jobs_file = JOBS_FILE
        self.assets_file = ASSETS_FILE
        self.blocks_file = BLOCKS_FILE
        self.train_schedule_file = TRAIN_SCHEDULE_FILE
        self.train_sections_file = TRAIN_SECTIONS_FILE
        self.runtime_priority_file = OUTPUT_DATA_DIR / ".runtime_priority_results.csv"
        self.runtime_heuristic_file = OUTPUT_DATA_DIR / ".runtime_heuristic_plan.csv"

    @staticmethod
    def _serialize_value(value):
        if value is None:
            return None
        if isinstance(value, pd.Timestamp):
            return value.isoformat()
        if hasattr(value, "item") and not isinstance(value, (str, bytes)):
            try:
                return OptimizationService._serialize_value(value.item())
            except (ValueError, TypeError):
                pass
        if isinstance(value, float) and pd.isna(value):
            return None
        if isinstance(value, dict):
            return {str(k): OptimizationService._serialize_value(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set, frozenset)):
            values = sorted(value, key=str) if isinstance(value, (set, frozenset)) else list(value)
            return [OptimizationService._serialize_value(v) for v in values]
        return value

    @classmethod
    def _records(cls, dataframe: pd.DataFrame) -> list[dict]:
        if dataframe.empty:
            return []
        return [{str(k): cls._serialize_value(v) for k, v in row.items()} for row in dataframe.to_dict(orient="records")]

    @staticmethod
    def _require_file(path: Path, label: str) -> None:
        if not path.exists():
            raise FileNotFoundError(f"{label} not found: {path}")

    @staticmethod
    def _priority_value(value: str) -> float:
        return {"CRITICAL": 100.0, "HIGH": 75.0, "MEDIUM": 50.0, "LOW": 25.0}.get(str(value).upper(), 50.0)

    def _ensure_runtime_priority_results(self) -> Path:
        self._require_file(self.jobs_file, "Maintenance jobs")
        self._require_file(self.assets_file, "Assets")
        jobs = pd.read_csv(self.jobs_file, keep_default_na=False)
        assets = pd.read_csv(self.assets_file, keep_default_na=False)
        source = self.jobs_file.parent / "priority_results.csv"
        existing = pd.read_csv(source, keep_default_na=False) if source.exists() else pd.DataFrame()
        required = ["job_id", "job_priority_score", "asset_criticality_score", "deadline_urgency_score", "job_age_score", "priority_score", "priority_rank"]
        for column in required:
            if column not in existing.columns:
                existing[column] = pd.Series(dtype=float if column != "job_id" else str)
        existing_ids = set(existing["job_id"].astype(str)) if not existing.empty else set()
        asset_criticality = {str(r.asset_id): self._priority_value(r.criticality) for r in assets.itertuples()} if {"asset_id", "criticality"}.issubset(assets.columns) else {}
        today = pd.Timestamp.now().normalize()
        missing_rows = []
        for row in jobs.itertuples():
            job_id = str(row.job_id)
            if job_id in existing_ids:
                continue
            priority = self._priority_value(getattr(row, "priority", "Medium"))
            criticality = asset_criticality.get(str(getattr(row, "asset_id", "")), 50.0)
            deadline = pd.to_datetime(getattr(row, "deadline", ""), errors="coerce")
            if pd.isna(deadline):
                deadline_score = 50.0
            else:
                days = int((deadline.normalize() - today).days)
                deadline_score = 100.0 if days <= 0 else 90.0 if days <= 2 else 75.0 if days <= 4 else 60.0 if days <= 7 else 40.0 if days <= 14 else 20.0
            created = pd.to_datetime(getattr(row, "created_date", ""), errors="coerce")
            age_score = 0.0 if pd.isna(created) else min(100.0, max(0.0, float((today - created.normalize()).days) / 30.0 * 100.0))
            score = round((priority + criticality + deadline_score + age_score) / 4.0, 2)
            missing_rows.append({"job_id": job_id, "job_priority_score": priority, "asset_criticality_score": criticality, "deadline_urgency_score": deadline_score, "job_age_score": round(age_score, 2), "priority_score": score, "priority_rank": 0})
        if missing_rows:
            existing = pd.concat([existing, pd.DataFrame(missing_rows)], ignore_index=True)
        existing["priority_score"] = pd.to_numeric(existing["priority_score"], errors="coerce").fillna(50.0)
        existing["priority_rank"] = pd.to_numeric(existing["priority_rank"], errors="coerce").fillna(0)
        existing = existing[existing["job_id"].astype(str).isin(set(jobs["job_id"].astype(str)))].copy()
        existing = existing.sort_values(["priority_score", "job_id"], ascending=[False, True]).reset_index(drop=True)
        existing["priority_rank"] = range(1, len(existing) + 1)
        self.runtime_priority_file.parent.mkdir(parents=True, exist_ok=True)
        existing.to_csv(self.runtime_priority_file, index=False)
        return self.runtime_priority_file

    def _ensure_runtime_heuristic_plan(self) -> Path:
        """Make the optimizer's immutable heuristic input complete for new jobs."""
        self._require_file(self.jobs_file, "Maintenance jobs")
        self._require_file(HEURISTIC_PLAN_FILE, "Initial maintenance plan")
        jobs = pd.read_csv(self.jobs_file, keep_default_na=False)
        assets = pd.read_csv(self.assets_file, keep_default_na=False)
        heuristic = pd.read_csv(HEURISTIC_PLAN_FILE, keep_default_na=False)
        required = ["job_id", "plan_status", "priority_rank", "priority_score", "asset_id", "section_id", "department", "work_type", "duration_min", "deadline", "block_id", "block_date", "scheduled_start", "scheduled_end", "block_type", "block_restrictions", "block_isolation_required", "train_conflict_checked", "scheduling_reason_code", "scheduling_reason_detail"]
        for column in required:
            if column not in heuristic.columns:
                heuristic[column] = ""
        heuristic = heuristic[required].copy()
        job_ids = set(jobs["job_id"].astype(str))
        heuristic = heuristic[heuristic["job_id"].astype(str).isin(job_ids)].copy()
        present = set(heuristic["job_id"].astype(str))
        asset_section = {str(r.asset_id): str(r.section_id) for r in assets.itertuples()} if {"asset_id", "section_id"}.issubset(assets.columns) else {}
        priority = pd.read_csv(self.runtime_priority_file, keep_default_na=False).set_index("job_id")
        rows = []
        for row in jobs.to_dict("records"):
            job_id = str(row["job_id"])
            if job_id in present:
                continue
            p = priority.loc[job_id]
            deadline = str(row.get("deadline", ""))
            rows.append({
                "job_id": job_id, "plan_status": "UNSCHEDULED", "priority_rank": int(p["priority_rank"]), "priority_score": float(p["priority_score"]),
                "asset_id": str(row.get("asset_id", "")), "section_id": str(asset_section.get(str(row.get("asset_id", "")), "")),
                "department": str(row.get("department", "")), "work_type": str(row.get("work_type", row.get("description", "Maintenance Work"))),
                "duration_min": int(pd.to_numeric(row.get("duration_min", 0), errors="coerce") or 0), "deadline": deadline,
                "block_id": "", "block_date": "", "scheduled_start": "", "scheduled_end": "", "block_type": "", "block_restrictions": "", "block_isolation_required": "",
                "train_conflict_checked": False, "scheduling_reason_code": "NEW_REQUEST_PENDING", "scheduling_reason_detail": "New request added after the baseline heuristic plan; optimizer may schedule it if a feasible candidate exists.",
            })
        if rows:
            heuristic = pd.concat([heuristic, pd.DataFrame(rows)], ignore_index=True)
        self.runtime_heuristic_file.parent.mkdir(parents=True, exist_ok=True)
        heuristic.to_csv(self.runtime_heuristic_file, index=False)
        return self.runtime_heuristic_file

    @staticmethod
    def _persist_current_plan(plan) -> None:
        dataframe = plan.copy() if isinstance(plan, pd.DataFrame) else pd.DataFrame(plan or [])
        if dataframe.empty:
            raise ValueError("Cannot promote an empty plan to the current plan.")
        CURRENT_PLAN_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary_file = CURRENT_PLAN_FILE.with_name(f".{CURRENT_PLAN_FILE.name}.tmp")
        try:
            dataframe.to_csv(temporary_file, index=False)
            temporary_file.replace(CURRENT_PLAN_FILE)
        except Exception:
            if temporary_file.exists():
                temporary_file.unlink()
            raise

    def _load_current_plan(self) -> pd.DataFrame:
        self._require_file(CURRENT_PLAN_FILE, "Current active plan")
        return pd.read_csv(CURRENT_PLAN_FILE, keep_default_na=False)

    def get_current_plan(self, status: str | None = None, section_id: str | None = None, block_id: str | None = None, job_id: str | None = None) -> dict:
        plan = self._load_current_plan()
        for column, value in {"plan_status": status, "section_id": section_id, "block_id": block_id, "job_id": job_id}.items():
            if value is not None and column in plan.columns:
                plan = plan[plan[column].astype(str).str.upper() == str(value).strip().upper()]
        return {"available": True, "count": len(plan), "plan": self._records(plan)}

    def get_plan_summary(self) -> dict:
        plan = self._load_current_plan(); blocks = pd.read_csv(self.blocks_file, keep_default_na=False); assets = pd.read_csv(self.assets_file, keep_default_na=False)
        scheduled = plan[plan["plan_status"].astype(str).str.upper() == "SCHEDULED"].copy(); total_jobs = len(plan); scheduled_jobs = len(scheduled)
        used_blocks = int(scheduled["block_id"].astype(str).replace("", pd.NA).dropna().nunique()) if not scheduled.empty else 0
        available_blocks = int((blocks["status"].astype(str).str.upper() == "AVAILABLE").sum()) if "status" in blocks else 0
        total_sections = int(assets["section_id"].astype(str).nunique()) if "section_id" in assets else int(blocks["section_id"].astype(str).nunique())
        active_sections = int(scheduled["section_id"].astype(str).nunique()) if not scheduled.empty else 0
        critical_assets = assets[assets["criticality"].astype(str).str.upper() == "CRITICAL"] if "criticality" in assets else pd.DataFrame()
        critical_jobs = int(plan["asset_id"].astype(str).isin(critical_assets["asset_id"].astype(str)).sum()) if not critical_assets.empty else 0
        high_priority_jobs = int(plan["priority"].astype(str).str.upper().isin({"HIGH", "CRITICAL"}).sum()) if "priority" in plan else 0
        scheduled_minutes = int(pd.to_numeric(scheduled.get("duration_min", pd.Series(dtype=float)), errors="coerce").fillna(0).sum())
        total_block_minutes = int(pd.to_numeric(blocks.get("duration_min", pd.Series(dtype=float)), errors="coerce").fillna(0).sum())
        return {"total_jobs": int(total_jobs), "scheduled_jobs": int(scheduled_jobs), "unscheduled_jobs": int(total_jobs - scheduled_jobs), "schedule_rate": round((scheduled_jobs / total_jobs) * 100, 2) if total_jobs else 0.0, "total_blocks": len(blocks), "used_blocks": used_blocks, "available_blocks": available_blocks, "block_utilization": round((scheduled_minutes / total_block_minutes) * 100, 2) if total_block_minutes else 0.0, "total_sections": total_sections, "active_sections": active_sections, "critical_jobs": critical_jobs, "high_priority_jobs": high_priority_jobs}

    def get_plan_jobs(self, **filters) -> dict:
        plan = self._load_current_plan(); jobs = pd.read_csv(self.jobs_file, keep_default_na=False); assets = pd.read_csv(self.assets_file, keep_default_na=False)
        job_columns = [c for c in ["job_id", "priority", "description"] if c in jobs.columns]
        if job_columns: plan = plan.merge(jobs[job_columns], on="job_id", how="left", suffixes=("", "_source"))
        if "criticality" not in plan.columns and {"asset_id", "criticality"}.issubset(assets.columns): plan = plan.merge(assets[["asset_id", "criticality"]], on="asset_id", how="left")
        for field, value in filters.items():
            if value is not None and field in plan.columns: plan = plan[plan[field].astype(str).str.upper() == str(value).strip().upper()]
        return {"count": len(plan), "jobs": self._records(plan)}

    def get_job(self, job_id: str) -> dict:
        result = self.get_plan_jobs(job_id=job_id)
        if not result["jobs"]: raise KeyError(f"Job not found: {job_id}")
        return result["jobs"][0]

    def get_plan_blocks(self, block_id: str | None = None) -> dict:
        blocks = pd.read_csv(self.blocks_file, keep_default_na=False); plan = self._load_current_plan(); scheduled = plan[plan["plan_status"].astype(str).str.upper() == "SCHEDULED"].copy(); records = []
        for _, block in blocks.iterrows():
            bid = str(block["block_id"])
            if block_id is not None and bid != str(block_id): continue
            assigned = scheduled[scheduled["block_id"].astype(str) == bid]; duration = float(pd.to_numeric(assigned.get("duration_min", pd.Series(dtype=float)), errors="coerce").fillna(0).sum()); capacity = float(pd.to_numeric(pd.Series([block.get("duration_min", 0)]), errors="coerce").fillna(0).iloc[0])
            item = block.to_dict(); item["assigned_jobs"] = [str(v) for v in assigned["job_id"].tolist()]; item["assigned_job_count"] = len(assigned); item["utilization"] = round((duration / capacity) * 100, 2) if capacity else 0.0; records.append(item)
        return {"count": len(records), "blocks": self._records(pd.DataFrame(records))}

    def get_current_block(self, block_id: str) -> dict:
        result = self.get_plan_blocks(block_id=block_id)
        if not result["blocks"]: raise KeyError(f"Block not found: {block_id}")
        return result["blocks"][0]

    def get_plan_sections(self, section_id: str | None = None) -> dict:
        plan = self._load_current_plan(); blocks = pd.read_csv(self.blocks_file, keep_default_na=False); section_ids = sorted(set(blocks["section_id"].astype(str)) | set(plan["section_id"].astype(str))); records = []
        for sid in section_ids:
            if section_id is not None and sid != str(section_id): continue
            section_plan = plan[plan["section_id"].astype(str) == sid]; scheduled = section_plan[section_plan["plan_status"].astype(str).str.upper() == "SCHEDULED"]; section_blocks = blocks[blocks["section_id"].astype(str) == sid]
            records.append({"section_id": sid, "scheduled_jobs": len(scheduled), "unscheduled_jobs": len(section_plan) - len(scheduled), "maintenance_workload_min": int(pd.to_numeric(scheduled.get("duration_min", pd.Series(dtype=float)), errors="coerce").fillna(0).sum()), "used_blocks": int(scheduled["block_id"].astype(str).replace("", pd.NA).dropna().nunique()) if not scheduled.empty else 0, "total_blocks": len(section_blocks)})
        return {"count": len(records), "sections": records}

    def get_current_section(self, section_id: str) -> dict:
        result = self.get_plan_sections(section_id=section_id)
        if not result["sections"]: raise KeyError(f"Section not found: {section_id}")
        return result["sections"][0]

    def get_summary(self):
        if not CURRENT_PLAN_FILE.exists(): return {"available": False, "summary": {}}
        plan_summary = self.get_plan_summary(); summary = {}
        if OPTIMIZATION_SUMMARY_FILE.exists(): summary = json.loads(OPTIMIZATION_SUMMARY_FILE.read_text(encoding="utf-8"))
        summary.update({"optimized_scheduled_jobs": plan_summary["scheduled_jobs"], "optimized_scheduled_minutes": int(pd.to_numeric(self._load_current_plan().query("plan_status == 'SCHEDULED'").get("duration_min", pd.Series(dtype=float)), errors="coerce").fillna(0).sum()), "optimized_blocks_used": plan_summary["used_blocks"], "jobs_unscheduled": plan_summary["unscheduled_jobs"], "current_plan": {"source": "CURRENT_ACTIVE_PLAN", "file": str(CURRENT_PLAN_FILE), "job_count": plan_summary["total_jobs"], "scheduled_jobs": plan_summary["scheduled_jobs"], "unscheduled_jobs": plan_summary["unscheduled_jobs"]}})
        return {"available": True, "summary": summary}

    def run_optimization(self):
        """Run the existing CP-SAT engine without modifying its implementation."""
        from optimizer.cp_sat.cp_sat_optimizer import CPSATOptimizer
        priority_results_path = self._ensure_runtime_priority_results()
        heuristic_plan_path = self._ensure_runtime_heuristic_plan()
        for path, label in [(self.jobs_file, "Maintenance jobs"), (self.assets_file, "Assets"), (self.blocks_file, "Block availability"), (self.train_schedule_file, "Train schedule"), (self.train_sections_file, "Train sections"), (heuristic_plan_path, "Runtime heuristic plan")]: self._require_file(path, label)
        optimizer = CPSATOptimizer(priority_results_path=priority_results_path, jobs_path=self.jobs_file, assets_path=self.assets_file, blocks_path=self.blocks_file, train_schedule_path=self.train_schedule_file, train_sections_path=self.train_sections_file, heuristic_plan_path=heuristic_plan_path, output_dir=OUTPUT_DATA_DIR)
        try:
            plan, summary = optimizer.optimize()
        except Exception as exc:
            raise RuntimeError(f"CP-SAT optimization failed: {type(exc).__name__}: {exc}") from exc
        if not isinstance(plan, pd.DataFrame): plan = pd.DataFrame(plan)
        if plan.empty: raise ValueError("Optimization produced an empty plan.")
        status = summary.get("solver_status", "UNKNOWN")
        if str(status).upper() not in {"OPTIMAL", "FEASIBLE"}: raise RuntimeError(f"Optimization did not produce a usable plan: {status}")
        self._persist_current_plan(plan)
        return {"status": status, "objective_values": summary.get("objective_values", {}), "plan": self._records(plan), "current_plan_promoted": True}
