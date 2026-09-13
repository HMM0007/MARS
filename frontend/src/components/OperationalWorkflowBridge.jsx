import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { approveWeeklyPlan, fetchApprovedWeeklyPlan, fetchPendingWeeklyRevision, fetchWeeklyPlan, submitEmergencyJob, submitJobIntake } from '../services/api';

const DEPARTMENT_BY_PATH = [['/dept/engineering', 'Engineering'], ['/dept/snt', 'S&T'], ['/dept/traction', 'Traction']];

const EMPTY_EMERGENCY = {
  job_id: '', asset_id: '', asset_type: '', section_id: 'PUNE-LNL', track_id: 'PUNE-LNL-UP', location_km: '227.4', defect_type: '',
  emergency_reason: '', estimated_duration_hours: '2', due_date: new Date().toISOString().slice(0, 10), preferred_window: 'ANY',
  machine_required: 'NO', dependency_job_id: '', safety_conflict_tag: 'NORMAL', power_block_required: false, train_operation_impact: false,
};

export default function OperationalWorkflowBridge() {
  const location = useLocation();
  const [weekly, setWeekly] = useState(null);
  const [approval, setApproval] = useState(null);
  const [pendingRevision, setPendingRevision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergency, setEmergency] = useState(EMPTY_EMERGENCY);
  const isWeekly = location.pathname === '/weekly';
  const department = DEPARTMENT_BY_PATH.find(([prefix]) => location.pathname.startsWith(prefix))?.[1];
  const savedRole = (() => { try { return JSON.parse(localStorage.getItem('mars_user') || '{}'); } catch { return {}; } })();
  const isPlanner = savedRole.id === 'planner' || savedRole.dept === 'Operations' || !savedRole.id;

  const refreshWorkflow = async () => {
    try {
      const [plan, approved, pending] = await Promise.all([fetchWeeklyPlan(), fetchApprovedWeeklyPlan(), fetchPendingWeeklyRevision()]);
      setWeekly(plan); setApproval(approved); setPendingRevision(pending);
    } catch (err) { console.warn('Workflow state refresh failed:', err); }
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
      event.preventDefault(); event.stopPropagation(); setBusy(true); setNotice(null);
      const payload = {
        job_id: String(data.get('job_id')).trim(), department, asset_id: String(data.get('asset_id')).trim(), asset_type: String(data.get('asset_type') || '').trim() || null,
        section_id: String(data.get('section_id')).trim(), track_id: String(data.get('track_id')).trim(), location_km: Number(data.get('location_km')),
        defect_type: String(data.get('defect_type')).trim(), estimated_duration_hours: Number(data.get('estimated_duration_hours')),
        criticality_level: String(data.get('criticality_level') || 'MEDIUM'), due_date: String(data.get('due_date')), preferred_window: String(data.get('preferred_window') || 'ANY'),
        machine_required: String(data.get('machine_required') || 'NO'), dependency_job_id: String(data.get('dependency_job_id') || '').trim() || null,
        safety_conflict_tag: String(data.get('safety_conflict_tag') || 'NORMAL'), power_block_required: department === 'Traction' && String(data.get('safety_conflict_tag') || '') === 'OHE_ISOLATION',
        work_type: department === 'Traction' ? 'POWER_BLOCK_MAINTENANCE' : 'DEPARTMENT_MAINTENANCE', planning_week: 1,
      };
      try {
        const result = await submitJobIntake(payload); form.reset();
        const scheduled = result.proposal?.incremental?.scheduled_new_job;
        setNotice({ type: 'success', title: result.status === 'REPAIR_PROPOSED' ? 'Job accepted • revision awaiting Planner approval' : 'Job accepted into Unified Job Pool', detail: result.status === 'REPAIR_PROPOSED' ? `${payload.job_id} was scored and checked against the approved baseline. ${scheduled ? 'A compliant slot was proposed.' : 'No safe slot was found in the repair result.'} Planner approval is required before the revision becomes active.` : `${payload.job_id} is stored as PENDING and will enter the next planning cycle.` });
        await refreshWorkflow(); window.dispatchEvent(new CustomEvent('mars:job-intake-complete', { detail: result }));
      } catch (err) { setNotice({ type: 'error', title: 'Job was not accepted', detail: err.message || 'The intake request failed.' }); }
      finally { setBusy(false); }
    };
    document.addEventListener('submit', handleSubmit, true);
    return () => document.removeEventListener('submit', handleSubmit, true);
  }, [department]);

  const approvePlan = async (plan, week, label) => {
    if (!plan || !['FEASIBLE', 'OPTIMAL'].includes(plan.status)) return;
    setBusy(true);
    try {
      const result = await approveWeeklyPlan({ week, plan, approved_by: 'PLANNER' });
      setApproval(result); setPendingRevision(null); setNotice({ type: 'success', title: label, detail: `Revision R${result.revision} is now the planner-approved baseline. Unaffected approved blocks remain protected during future incremental repairs.` }); await refreshWorkflow();
    } catch (err) { setNotice({ type: 'error', title: 'Approval rejected', detail: err.message || 'The plan could not be approved.' }); }
    finally { setBusy(false); }
  };

  const openEmergency = () => {
    setEmergency({ ...EMPTY_EMERGENCY, job_id: `${department === 'Engineering' ? 'ENG' : department === 'S&T' ? 'SNT' : 'TRC'}-EMG-${Date.now().toString().slice(-5)}` });
    setEmergencyOpen(true); setNotice(null);
  };

  const updateEmergency = (key, value) => setEmergency((current) => ({ ...current, [key]: value }));

  const reportEmergency = async (event) => {
    event.preventDefault();
    if (!department) return;
    setBusy(true); setNotice(null);
    try {
      const payload = {
        ...emergency, department, location_km: Number(emergency.location_km), estimated_duration_hours: Number(emergency.estimated_duration_hours),
        machine_required: emergency.machine_required, dependency_job_id: emergency.dependency_job_id.trim() || null,
        power_block_required: department === 'Traction' || emergency.power_block_required, planning_week: 1,
      };
      const result = await submitEmergencyJob(payload);
      setEmergencyOpen(false); setEmergency({ ...EMPTY_EMERGENCY });
      const scheduled = result.proposal?.incremental?.scheduled_new_job;
      setNotice({ type: 'success', title: result.status === 'EMERGENCY_REPAIR_PROPOSED' ? 'Emergency accepted • Planner approval required' : 'Emergency recorded in Unified Job Pool', detail: result.status === 'EMERGENCY_REPAIR_PROPOSED' ? `${payload.job_id} was forced to CRITICAL priority and checked against the approved baseline. ${scheduled ? 'A repair slot was proposed.' : 'No safe slot was found; the baseline was not changed.'}` : `${payload.job_id} is stored for the next planning cycle because no approved baseline exists.` });
      await refreshWorkflow(); window.dispatchEvent(new CustomEvent('mars:emergency-intake-complete', { detail: result }));
    } catch (err) { setNotice({ type: 'error', title: 'Emergency was not accepted', detail: err.message || 'The emergency intake request failed.' }); }
    finally { setBusy(false); }
  };

  if (!notice && !pendingRevision && !department) return null;
  const pendingPlan = pendingRevision?.revision?.plan;
  const pendingJob = pendingRevision?.revision?.new_job_id;

  return <div className="px-4 pt-3">
    {department && <div className="mb-2 flex justify-end"><button type="button" onClick={openEmergency} className="inline-flex items-center gap-2 rounded border border-[#C92A2A] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#C92A2A] shadow-sm hover:bg-[#FFF5F5]"><AlertTriangle className="h-3.5 w-3.5"/> Report Emergency</button></div>}

    {pendingRevision && <div className="mt-2 bg-white border border-[#F0C36A] rounded shadow-sm px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-wide text-[#8A5A00]">Plan Revision Awaiting Approval</p><p className="text-[10px] text-[#60748A]">New job <span className="font-mono font-bold">{pendingJob}</span> generated a controlled incremental repair. Unaffected approved blocks remain frozen.</p></div>{isPlanner && <button type="button" onClick={() => approvePlan(pendingPlan, pendingRevision.revision.planning_week, 'Incremental plan revision approved')} disabled={busy || !pendingPlan || !['FEASIBLE','OPTIMAL'].includes(pendingPlan.status)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#8A5A00] text-white text-[10px] font-bold disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <CheckCircle2 className="w-3.5 h-3.5"/>} Approve Plan Revision</button>}</div>}

    {notice && <div className={`mt-2 border rounded px-3 py-2 flex items-start gap-2 ${notice.type === 'error' ? 'bg-[#FFF5F5] border-[#F1B5B5]' : 'bg-[#F0FBF4] border-[#B8E2C3]'}`}><div className="min-w-0 flex-1"><p className="text-[11px] font-bold">{notice.title}</p><p className="text-[10px] text-[#52606D] mt-0.5">{notice.detail}</p></div><button type="button" onClick={() => setNotice(null)} className="text-[#718294]"><X className="w-3.5 h-3.5"/></button></div>}

    {emergencyOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-3xl rounded-lg border border-[#D6DEE6] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#D6DEE6] bg-[#FFF5F5] px-5 py-3"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#C92A2A]"/><div><p className="text-sm font-bold text-[#1F2933]">Report Emergency Maintenance</p><p className="text-[10px] text-[#60748A]">CRITICAL priority • Incremental repair against the approved weekly baseline</p></div></div><button type="button" onClick={() => !busy && setEmergencyOpen(false)} className="text-[#718294]"><X className="h-4 w-4"/></button></div><form onSubmit={reportEmergency} className="max-h-[75vh] overflow-y-auto p-5"><div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {[['job_id','Emergency Job ID','text'],['asset_id','Asset ID','text'],['asset_type','Asset Type','text'],['section_id','Section','text'],['track_id','Track','text'],['location_km','Location (KM)','number'],['defect_type','Failure / Defect','text'],['estimated_duration_hours','Duration (hours)','number'],['due_date','Required By','date']].map(([key,label,type]) => <label key={key} className="text-[10px] font-bold uppercase tracking-wide text-[#52606D]">{label}<input required={['job_id','asset_id','section_id','track_id','location_km','defect_type','estimated_duration_hours','due_date'].includes(key)} type={type} value={emergency[key]} onChange={(e) => updateEmergency(key,e.target.value)} step={type === 'number' ? '0.25' : undefined} className="mt-1 w-full rounded border border-[#D6DEE6] px-2 py-2 text-xs font-normal text-[#1F2933] outline-none focus:border-[#C92A2A]"/></label>)}
      <label className="text-[10px] font-bold uppercase tracking-wide text-[#52606D]">Preferred Window<select value={emergency.preferred_window} onChange={(e) => updateEmergency('preferred_window',e.target.value)} className="mt-1 w-full rounded border border-[#D6DEE6] px-2 py-2 text-xs font-normal"><option>NIGHT</option><option>DAY</option><option>ANY</option></select></label>
      <label className="text-[10px] font-bold uppercase tracking-wide text-[#52606D]">Machine Required<select value={emergency.machine_required} onChange={(e) => updateEmergency('machine_required',e.target.value)} className="mt-1 w-full rounded border border-[#D6DEE6] px-2 py-2 text-xs font-normal"><option>NO</option><option>YES</option></select></label>
      <label className="text-[10px] font-bold uppercase tracking-wide text-[#52606D] md:col-span-2">Emergency Reason<textarea required value={emergency.emergency_reason} onChange={(e) => updateEmergency('emergency_reason',e.target.value)} rows={2} className="mt-1 w-full rounded border border-[#D6DEE6] px-2 py-2 text-xs font-normal" placeholder="Describe the failure, safety issue, or operational trigger..."/></label>
      <label className="text-[10px] font-bold uppercase tracking-wide text-[#52606D]">Safety Conflict Tag<select value={emergency.safety_conflict_tag} onChange={(e) => updateEmergency('safety_conflict_tag',e.target.value)} className="mt-1 w-full rounded border border-[#D6DEE6] px-2 py-2 text-xs font-normal"><option>NORMAL</option><option>INTERLOCKING</option><option>LEVEL_CROSSING</option><option>OHE_ISOLATION</option></select></label>
      <label className="flex items-center gap-2 pt-5 text-[10px] font-bold uppercase tracking-wide text-[#52606D]"><input type="checkbox" checked={emergency.train_operation_impact} onChange={(e) => updateEmergency('train_operation_impact',e.target.checked)}/> Train operation impact</label>
    </div><div className="mt-4 flex items-center justify-end gap-2 border-t border-[#D6DEE6] pt-3"><button type="button" disabled={busy} onClick={() => setEmergencyOpen(false)} className="rounded border border-[#D6DEE6] px-3 py-2 text-[10px] font-bold text-[#52606D]">Cancel</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded bg-[#C92A2A] px-4 py-2 text-[10px] font-bold text-white disabled:opacity-60">{busy && <Loader2 className="h-3.5 w-3.5 animate-spin"/>} Report Emergency & Run Incremental Repair</button></div></form></div></div>}
  </div>;
}
