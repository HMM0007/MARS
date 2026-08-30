"""Adapter between MARS operational data and the existing optimizer."""

from __future__ import annotations

import json
from pathlib import Path
import pandas as pd

from backend.config import ASSETS_FILE, BLOCKS_FILE, CURRENT_PLAN_FILE, HEURISTIC_PLAN_FILE, JOBS_FILE, OPTIMIZATION_SUMMARY_FILE, TRAIN_SCHEDULE_FILE, TRAIN_SECTIONS_FILE, OUTPUT_DATA_DIR


class OptimizationService:
    """Prepare complete runtime inputs, then invoke the unchanged CP-SAT engine."""

    def __init__(self):
        self.jobs_file = JOBS_FILE
        self.assets_file = ASSETS_FILE
        self.blocks_file = BLOCKS_FILE
        self.train_schedule_file = TRAIN_SCHEDULE_FILE
        self.train_sections_file = TRAIN_SECTIONS_FILE
        self.runtime_jobs_file = OUTPUT_DATA_DIR / ".runtime_maintenance_jobs.csv"
        self.runtime_priority_file = OUTPUT_DATA_DIR / ".runtime_priority_results.csv"
        self.runtime_heuristic_file = OUTPUT_DATA_DIR / ".runtime_heuristic_plan.csv"

    @staticmethod
    def _records(frame: pd.DataFrame) -> list[dict]:
        if frame.empty: return []
        def clean(v):
            if isinstance(v, pd.Timestamp): return v.isoformat()
            if hasattr(v, "item") and not isinstance(v, (str, bytes)):
                try: return v.item()
                except Exception: pass
            if isinstance(v, float) and pd.isna(v): return None
            return v
        return [{str(k): clean(v) for k, v in row.items()} for row in frame.to_dict("records")]

    @staticmethod
    def _require(path: Path, label: str):
        if not path.exists(): raise FileNotFoundError(f"{label} not found: {path}")

    @staticmethod
    def _priority(value: str) -> float:
        return {"CRITICAL":100.0,"HIGH":75.0,"MEDIUM":50.0,"LOW":25.0}.get(str(value).upper(),50.0)

    def _ensure_runtime_jobs(self) -> Path:
        """Normalize legacy/manual request rows without changing the source CSV."""
        self._require(self.jobs_file, "Maintenance jobs")
        jobs = pd.read_csv(self.jobs_file, keep_default_na=False)
        assets = pd.read_csv(self.assets_file, keep_default_na=False)
        today = pd.Timestamp.now().normalize()
        if "job_id" not in jobs.columns: raise ValueError("Maintenance jobs must contain job_id.")
        if "asset_id" not in jobs.columns: jobs["asset_id"] = ""
        if "department" not in jobs.columns: jobs["department"] = "Engineering"
        if "work_type" not in jobs.columns: jobs["work_type"] = jobs.get("description", "Maintenance Work")
        if "description" not in jobs.columns: jobs["description"] = jobs["work_type"]
        if "duration_min" not in jobs.columns: jobs["duration_min"] = 90
        if "priority" not in jobs.columns: jobs["priority"] = "Medium"
        if "deadline" not in jobs.columns: jobs["deadline"] = ""
        if "status" not in jobs.columns: jobs["status"] = "OPEN"
        if "isolation_required" not in jobs.columns: jobs["isolation_required"] = "No"
        if "created_date" not in jobs.columns: jobs["created_date"] = str(today.date())
        jobs["deadline"] = jobs["deadline"].replace("", pd.NA)
        jobs["deadline"] = jobs["deadline"].fillna(str(today.date()))
        jobs["duration_min"] = pd.to_numeric(jobs["duration_min"], errors="coerce").fillna(90).astype(int).clip(lower=1)
        jobs["priority"] = jobs["priority"].replace("", "Medium")
        jobs["status"] = jobs["status"].replace("", "OPEN")
        jobs["isolation_required"] = jobs["isolation_required"].replace("", "No")
        if "section" not in jobs.columns:
            section_map = {str(r.asset_id): str(r.section_id) for r in assets.itertuples()} if {"asset_id","section_id"}.issubset(assets.columns) else {}
            jobs["section"] = jobs["asset_id"].map(section_map).fillna("")
        self.runtime_jobs_file.parent.mkdir(parents=True, exist_ok=True)
        jobs.to_csv(self.runtime_jobs_file, index=False)
        return self.runtime_jobs_file

    def _ensure_runtime_priority_results(self, jobs_path: Path) -> Path:
        jobs = pd.read_csv(jobs_path, keep_default_na=False); assets = pd.read_csv(self.assets_file, keep_default_na=False)
        source = self.jobs_file.parent / "priority_results.csv"
        existing = pd.read_csv(source, keep_default_na=False) if source.exists() else pd.DataFrame()
        required=["job_id","job_priority_score","asset_criticality_score","deadline_urgency_score","job_age_score","priority_score","priority_rank"]
        for c in required:
            if c not in existing.columns: existing[c] = ""
        today=pd.Timestamp.now().normalize(); critical={str(r.asset_id):self._priority(r.criticality) for r in assets.itertuples()} if {"asset_id","criticality"}.issubset(assets.columns) else {}
        existing_ids=set(existing["job_id"].astype(str)) if not existing.empty else set(); additions=[]
        for r in jobs.to_dict("records"):
            jid=str(r["job_id"])
            if jid in existing_ids: continue
            p=self._priority(r.get("priority","Medium")); c=critical.get(str(r.get("asset_id","")),50.0); deadline=pd.to_datetime(r.get("deadline",""),errors="coerce"); days=0 if pd.isna(deadline) else int((deadline.normalize()-today).days); dscore=100.0 if days<=0 else 90.0 if days<=2 else 75.0 if days<=4 else 60.0 if days<=7 else 40.0 if days<=14 else 20.0; created=pd.to_datetime(r.get("created_date",""),errors="coerce"); age=0.0 if pd.isna(created) else min(100.0,max(0.0,float((today-created.normalize()).days)/30*100)); additions.append({"job_id":jid,"job_priority_score":p,"asset_criticality_score":c,"deadline_urgency_score":dscore,"job_age_score":age,"priority_score":round((p+c+dscore+age)/4,2),"priority_rank":0})
        if additions: existing=pd.concat([existing,pd.DataFrame(additions)],ignore_index=True)
        existing=existing[existing.job_id.astype(str).isin(set(jobs.job_id.astype(str)))].copy(); existing["priority_score"]=pd.to_numeric(existing.priority_score,errors="coerce").fillna(50); existing=existing.sort_values(["priority_score","job_id"],ascending=[False,True]).reset_index(drop=True); existing["priority_rank"]=range(1,len(existing)+1)
        self.runtime_priority_file.parent.mkdir(parents=True,exist_ok=True); existing.to_csv(self.runtime_priority_file,index=False); return self.runtime_priority_file

    def _ensure_runtime_heuristic_plan(self, jobs_path: Path, priority_path: Path) -> Path:
        jobs=pd.read_csv(jobs_path,keep_default_na=False); assets=pd.read_csv(self.assets_file,keep_default_na=False); base=pd.read_csv(HEURISTIC_PLAN_FILE,keep_default_na=False); priority=pd.read_csv(priority_path,keep_default_na=False).set_index("job_id")
        columns=["job_id","plan_status","priority_rank","priority_score","asset_id","section_id","department","work_type","duration_min","deadline","block_id","block_date","scheduled_start","scheduled_end","block_type","block_restrictions","block_isolation_required","train_conflict_checked","scheduling_reason_code","scheduling_reason_detail"]
        for c in columns:
            if c not in base.columns: base[c]=""
        base=base[columns]; ids=set(jobs.job_id.astype(str)); base=base[base.job_id.astype(str).isin(ids)].copy(); present=set(base.job_id.astype(str)); section_map={str(r.asset_id):str(r.section_id) for r in assets.itertuples()} if {"asset_id","section_id"}.issubset(assets.columns) else {}; additions=[]
        for r in jobs.to_dict("records"):
            jid=str(r["job_id"])
            if jid in present: continue
            p=priority.loc[jid]; additions.append({"job_id":jid,"plan_status":"UNSCHEDULED","priority_rank":int(p.priority_rank),"priority_score":float(p.priority_score),"asset_id":str(r.get("asset_id","")),"section_id":section_map.get(str(r.get("asset_id","")),""),"department":str(r.get("department","")),"work_type":str(r.get("work_type",r.get("description","Maintenance Work"))),"duration_min":int(r.get("duration_min",90)),"deadline":str(r.get("deadline","")),"block_id":"","block_date":"","scheduled_start":"","scheduled_end":"","block_type":"","block_restrictions":"","block_isolation_required":"","train_conflict_checked":False,"scheduling_reason_code":"NEW_REQUEST_PENDING","scheduling_reason_detail":"New request was added after the baseline heuristic plan."})
        if additions: base=pd.concat([base,pd.DataFrame(additions)],ignore_index=True)
        self.runtime_heuristic_file.parent.mkdir(parents=True,exist_ok=True); base.to_csv(self.runtime_heuristic_file,index=False); return self.runtime_heuristic_file

    @staticmethod
    def _persist(plan):
        if not isinstance(plan,pd.DataFrame): plan=pd.DataFrame(plan or [])
        if plan.empty: raise ValueError("Optimization produced an empty plan.")
        CURRENT_PLAN_FILE.parent.mkdir(parents=True,exist_ok=True); temp=CURRENT_PLAN_FILE.with_name(f".{CURRENT_PLAN_FILE.name}.tmp"); plan.to_csv(temp,index=False); temp.replace(CURRENT_PLAN_FILE)

    def _load_current_plan(self): self._require(CURRENT_PLAN_FILE,"Current active plan"); return pd.read_csv(CURRENT_PLAN_FILE,keep_default_na=False)

    def get_current_plan(self,status=None,section_id=None,block_id=None,job_id=None):
        plan=self._load_current_plan()
        for c,v in {"plan_status":status,"section_id":section_id,"block_id":block_id,"job_id":job_id}.items():
            if v is not None and c in plan.columns: plan=plan[plan[c].astype(str).str.upper()==str(v).upper()]
        return {"available":True,"count":len(plan),"plan":self._records(plan)}

    def get_plan_summary(self):
        plan=self._load_current_plan(); blocks=pd.read_csv(self.blocks_file,keep_default_na=False); scheduled=plan[plan.plan_status.astype(str).str.upper()=="SCHEDULED"]; total=len(plan); mins=int(pd.to_numeric(scheduled.get("duration_min",pd.Series(dtype=float)),errors="coerce").fillna(0).sum()); cap=int(pd.to_numeric(blocks.get("duration_min",pd.Series(dtype=float)),errors="coerce").fillna(0).sum()); used=int(scheduled.block_id.astype(str).replace("",pd.NA).dropna().nunique()) if not scheduled.empty else 0
        return {"total_jobs":total,"scheduled_jobs":len(scheduled),"unscheduled_jobs":total-len(scheduled),"schedule_rate":round(len(scheduled)/total*100,2) if total else 0,"total_blocks":len(blocks),"used_blocks":used,"available_blocks":int(blocks.status.astype(str).str.upper().eq("AVAILABLE").sum()) if "status" in blocks else 0,"block_utilization":round(mins/cap*100,2) if cap else 0}

    def get_plan_jobs(self,**filters):
        plan=self._load_current_plan(); jobs=pd.read_csv(self.runtime_jobs_file if self.runtime_jobs_file.exists() else self.jobs_file,keep_default_na=False); assets=pd.read_csv(self.assets_file,keep_default_na=False); cols=[c for c in ["job_id","priority","description"] if c in jobs.columns];
        if cols: plan=plan.merge(jobs[cols],on="job_id",how="left",suffixes=("","_source"))
        if "criticality" not in plan.columns and {"asset_id","criticality"}.issubset(assets.columns): plan=plan.merge(assets[["asset_id","criticality"]],on="asset_id",how="left")
        for c,v in filters.items():
            if v is not None and c in plan.columns: plan=plan[plan[c].astype(str).str.upper()==str(v).upper()]
        return {"count":len(plan),"jobs":self._records(plan)}

    def get_job(self,job_id):
        result=self.get_plan_jobs(job_id=job_id)
        if not result["jobs"]: raise KeyError(f"Job not found: {job_id}")
        return result["jobs"][0]

    def get_plan_blocks(self,block_id=None):
        blocks=pd.read_csv(self.blocks_file,keep_default_na=False); plan=self._load_current_plan(); scheduled=plan[plan.plan_status.astype(str).str.upper()=="SCHEDULED"]; rows=[]
        for _,b in blocks.iterrows():
            if block_id and str(b.block_id)!=str(block_id): continue
            assigned=scheduled[scheduled.block_id.astype(str)==str(b.block_id)]; cap=float(pd.to_numeric(pd.Series([b.get("duration_min",0)]),errors="coerce").fillna(0).iloc[0]); used=float(pd.to_numeric(assigned.get("duration_min",pd.Series(dtype=float)),errors="coerce").fillna(0).sum()); item=b.to_dict(); item.update({"assigned_jobs":assigned.job_id.astype(str).tolist(),"assigned_job_count":len(assigned),"utilization":round(used/cap*100,2) if cap else 0}); rows.append(item)
        return {"count":len(rows),"blocks":self._records(pd.DataFrame(rows))}

    def get_current_block(self,block_id):
        r=self.get_plan_blocks(block_id)
        if not r["blocks"]: raise KeyError(f"Block not found: {block_id}")
        return r["blocks"][0]

    def get_plan_sections(self,section_id=None):
        plan=self._load_current_plan(); blocks=pd.read_csv(self.blocks_file,keep_default_na=False); rows=[]
        for sid in sorted(set(blocks.section_id.astype(str))|set(plan.section_id.astype(str))):
            if section_id and sid!=str(section_id): continue
            sp=plan[plan.section_id.astype(str)==sid]; sch=sp[sp.plan_status.astype(str).str.upper()=="SCHEDULED"]; sb=blocks[blocks.section_id.astype(str)==sid]; rows.append({"section_id":sid,"scheduled_jobs":len(sch),"unscheduled_jobs":len(sp)-len(sch),"maintenance_workload_min":int(pd.to_numeric(sch.get("duration_min",pd.Series(dtype=float)),errors="coerce").fillna(0).sum()),"used_blocks":int(sch.block_id.astype(str).replace("",pd.NA).dropna().nunique()) if not sch.empty else 0,"total_blocks":len(sb)})
        return {"count":len(rows),"sections":rows}

    def get_current_section(self,section_id):
        r=self.get_plan_sections(section_id)
        if not r["sections"]: raise KeyError(f"Section not found: {section_id}")
        return r["sections"][0]

    def run_optimization(self):
        from optimizer.cp_sat.cp_sat_optimizer import CPSATOptimizer
        runtime_jobs=self._ensure_runtime_jobs(); priority=self._ensure_runtime_priority_results(runtime_jobs); heuristic=self._ensure_runtime_heuristic_plan(runtime_jobs,priority)
        for p,l in [(self.assets_file,"Assets"),(self.blocks_file,"Block availability"),(self.train_schedule_file,"Train schedule"),(self.train_sections_file,"Train sections")]: self._require(p,l)
        optimizer=CPSATOptimizer(priority_results_path=priority,jobs_path=runtime_jobs,assets_path=self.assets_file,blocks_path=self.blocks_file,train_schedule_path=self.train_schedule_file,train_sections_path=self.train_sections_file,heuristic_plan_path=heuristic,output_dir=OUTPUT_DATA_DIR)
        try: plan,summary=optimizer.optimize()
        except Exception as exc: raise RuntimeError(f"CP-SAT optimization failed: {type(exc).__name__}: {exc}") from exc
        if str(summary.get("solver_status","UNKNOWN")).upper() not in {"OPTIMAL","FEASIBLE"}: raise RuntimeError(f"Optimization did not produce a usable plan: {summary.get('solver_status')}")
        self._persist(plan)
        return {"status":summary.get("solver_status"),"objective_values":summary.get("objective_values",{}),"plan":self._records(plan),"current_plan_promoted":True}

    def get_summary(self):
        if not CURRENT_PLAN_FILE.exists(): return {"available":False,"summary":{}}
        summary=json.loads(OPTIMIZATION_SUMMARY_FILE.read_text(encoding="utf-8")) if OPTIMIZATION_SUMMARY_FILE.exists() else {}; ps=self.get_plan_summary(); summary.update({"optimized_scheduled_jobs":ps["scheduled_jobs"],"optimized_blocks_used":ps["used_blocks"],"jobs_unscheduled":ps["unscheduled_jobs"]}); return {"available":True,"summary":summary}
