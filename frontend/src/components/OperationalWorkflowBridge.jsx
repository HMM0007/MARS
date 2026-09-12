import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { approveWeeklyPlan, fetchApprovedWeeklyPlan, fetchPendingWeeklyRevision, fetchWeeklyPlan, submitJobIntake } from '../services/api';

const DEPARTMENT_BY_PATH = [['/dept/engineering', 'Engineering'], ['/dept/snt', 'S&T'], ['/dept/traction', 'Traction']];

export default function OperationalWorkflowBridge() {
  const location = useLocation();
  const [weekly, setWeekly] = useState(null);
  const [approval, setApproval] = useState(null);
  const [pendingRevision, setPendingRevision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const isWeekly = location.pathname === '/weekly';
  const department = DEPARTMENT_BY_PATH.find(([prefix]) => location.pathname.startsWith(prefix))?.[1];
  const savedRole = (() => { try { return JSON.parse(localStorage.getItem('mars_user') || '{}'); } catch { return {}; } })();
  const isPlanner = savedRole.id === 'planner' || savedRole.dept === 'Operations' || !savedRole.id;

  const refreshWorkflow = async () => {
    try {
      const [plan, approved, pending] = await Promise.all([fetchWeeklyPlan(), fetchApprovedWeeklyPlan(), fetchPendingWeeklyRevision()]);
      setWeekly(plan);
      setApproval(approved);
      setPendingRevision(pending);
    } catch (err) {
      console.warn('Workflow state refresh failed:', err);
    }
  };

  useEffect(() => { refreshWorkflow(); }, [isWeekly, department]);

  useEffect(() => {
    if (!department) return undefined;
    const handleSubmit = async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const data = new FormData(form);
      if (!data.get('job_id') || !data.get('asset_id') || !data.get('defect_type')) return;
      if (!data.get('estimated_duration_hours') || !data.get('due_date')) return;
      event.preventDefault();
      event.stopPropagation();
      setBusy(true); setNotice(null);
      const payload = {
        job_id: String(data.get('job_id')).trim(), department,
        asset_id: String(data.get('asset_id')).trim(), asset_type: String(data.get('asset_type') || '').trim() || null,
        section_id: String(data.get('section_id')).trim(), track_id: String(data.get('track_id')).trim(), location_km: Number(data.get('location_km')),
        defect_type: String(data.get('defect_type')).trim(), estimated_duration_hours: Number(data.get('estimated_duration_hours')),
        criticality_level: String(data.get('criticality_level') || 'MEDIUM'), due_date: String(data.get('due_date')),
        preferred_window: String(data.get('preferred_window') || 'ANY'), machine_required: String(data.get('machine_required') || 'NO'),
        dependency_job_id: String(data.get('dependency_job_id') || '').trim() || null, safety_conflict_tag: String(data.get('safety_conflict_tag') || 'NORMAL'),
        power_block_required: department === 'Traction' && String(data.get('safety_conflict_tag') || '') === 'OHE_ISOLATION',
        work_type: department === 'Traction' ? 'POWER_BLOCK_MAINTENANCE' : 'DEPARTMENT_MAINTENANCE', planning_week: 1,
      };
      try {
        const result = await submitJobIntake(payload);
        form.reset();
        const scheduled = result.proposal?.incremental?.scheduled_new_job;
        setNotice({ type: 'success', title: result.status === 'REPAIR_PROPOSED' ? 'Job accepted • revision awaiting Planner approval' : 'Job accepted into Unified Job Pool', detail: result.status === 'REPAIR_PROPOSED' ? `${payload.job_id} was scored and checked against the approved baseline. ${scheduled ? 'A compliant slot was proposed.' : 'No safe slot was found in the repair result.'} Planner approval is required before the revision becomes active.` : `${payload.job_id} is stored as PENDING and will enter the next planning cycle.` });
        await refreshWorkflow();
        window.dispatchEvent(new CustomEvent('mars:job-intake-complete', { detail: result }));
      } catch (err) {
        setNotice({ type: 'error', title: 'Job was not accepted', detail: err.message || 'The intake request failed.' });
      } finally { setBusy(false); }
    };
    document.addEventListener('submit', handleSubmit, true);
    return () => document.removeEventListener('submit', handleSubmit, true);
  }, [department]);

  const approvePlan = async (plan, week, label) => {
    if (!plan || !['FEASIBLE', 'OPTIMAL'].includes(plan.status)) return;
    setBusy(true);
    try {
      const result = await approveWeeklyPlan({ week, plan, approved_by: 'PLANNER' });
      setApproval(result); setPendingRevision(null);
      setNotice({ type: 'success', title: label, detail: `Revision R${result.revision} is now the planner-approved baseline. Unaffected approved blocks remain protected during future incremental repairs.` });
      await refreshWorkflow();
    } catch (err) { setNotice({ type: 'error', title: 'Approval rejected', detail: err.message || 'The plan could not be approved.' }); }
    finally { setBusy(false); }
  };

  if (!isWeekly && !notice && !pendingRevision) return null;
  const pendingPlan = pendingRevision?.revision?.plan;
  const pendingJob = pendingRevision?.revision?.new_job_id;

  return <div className="px-4 pt-3">
    {isWeekly && <div className="bg-white border border-[#D6DEE6] rounded shadow-sm px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
      <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#1E3A5F]"/><div><p className="text-[11px] font-bold uppercase tracking-wide text-[#1F2933]">Weekly Baseline Governance</p><p className="text-[10px] text-[#60748A]">{approval?.approved ? `Approved baseline R${approval.revision}` : 'Planner approval required before the weekly plan becomes the protected baseline.'}</p></div></div>
      <button type="button" onClick={() => approvePlan(weekly, weekly?.planning_week || 1, 'Weekly baseline approved')} disabled={busy || !weekly || !['FEASIBLE','OPTIMAL'].includes(weekly.status)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#1E3A5F] text-white text-[10px] font-bold disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle2 className="w-3.5 h-3.5"/>}{approval?.approved ? 'Approve Current Plan as New Baseline' : 'Approve Weekly Baseline'}</button>
    </div>}

    {pendingRevision && <div className="mt-2 bg-white border border-[#F0C36A] rounded shadow-sm px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
      <div><p className="text-[11px] font-bold uppercase tracking-wide text-[#8A5A00]">Plan Revision Awaiting Approval</p><p className="text-[10px] text-[#60748A]">New job <span className="font-mono font-bold">{pendingJob}</span> generated a controlled incremental repair. Unaffected approved blocks remain frozen.</p></div>
      {isPlanner && <button type="button" onClick={() => approvePlan(pendingPlan, pendingRevision.revision.planning_week, 'Incremental plan revision approved')} disabled={busy || !pendingPlan || !['FEASIBLE','OPTIMAL'].includes(pendingPlan.status)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#8A5A00] text-white text-[10px] font-bold disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle2 className="w-3.5 h-3.5"/>} Approve Plan Revision</button>}
    </div>}

    {notice && <div className={`mt-2 border rounded px-3 py-2 flex items-start gap-2 ${notice.type === 'error' ? 'bg-[#FFF5F5] border-[#F1B5B5]' : 'bg-[#F0FBF4] border-[#B8E2C3]'}`}>
      {notice.type === 'error' ? <RefreshCw className="w-4 h-4 text-[#C92A2A] mt-0.5"/> : <CheckCircle2 className="w-4 h-4 text-[#2F9E44] mt-0.5"/>}<div className="min-w-0 flex-1"><p className="text-[11px] font-bold">{notice.title}</p><p className="text-[10px] text-[#52606D] mt-0.5">{notice.detail}</p></div><button type="button" onClick={() => setNotice(null)} className="text-[#718294]"><X className="w-3.5 h-3.5"/></button>
    </div>}
  </div>;
}
