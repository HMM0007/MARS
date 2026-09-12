import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { approveWeeklyPlan, fetchApprovedWeeklyPlan, fetchWeeklyPlan, submitJobIntake } from '../services/api';

const DEPARTMENT_BY_PATH = [
  ['/dept/engineering', 'Engineering'],
  ['/dept/snt', 'S&T'],
  ['/dept/traction', 'Traction'],
];

export default function OperationalWorkflowBridge() {
  const location = useLocation();
  const [weekly, setWeekly] = useState(null);
  const [approval, setApproval] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const isWeekly = location.pathname === '/weekly';
  const department = DEPARTMENT_BY_PATH.find(([prefix]) => location.pathname.startsWith(prefix))?.[1];

  const refreshApproval = async () => {
    try {
      const [plan, approved] = await Promise.all([fetchWeeklyPlan(), fetchApprovedWeeklyPlan()]);
      setWeekly(plan);
      setApproval(approved);
    } catch (err) {
      console.warn('Workflow state refresh failed:', err);
    }
  };

  useEffect(() => {
    if (isWeekly) refreshApproval();
  }, [isWeekly]);

  useEffect(() => {
    if (!department) return undefined;

    const handleSubmit = async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const data = new FormData(form);
      if (!data.get('job_id') || !data.get('asset_id') || !data.get('defect_type')) return;
      if (!data.get('estimated_duration_hours') || !data.get('due_date')) return;

      // Own the department intake submit so the existing local-only form handlers
      // cannot create a phantom job when the backend rejects the request.
      event.preventDefault();
      event.stopPropagation();
      setBusy(true);
      setNotice(null);

      const payload = {
        job_id: String(data.get('job_id')).trim(),
        department,
        asset_id: String(data.get('asset_id')).trim(),
        asset_type: String(data.get('asset_type') || '').trim() || null,
        section_id: String(data.get('section_id')).trim(),
        track_id: String(data.get('track_id')).trim(),
        location_km: Number(data.get('location_km')),
        defect_type: String(data.get('defect_type')).trim(),
        estimated_duration_hours: Number(data.get('estimated_duration_hours')),
        criticality_level: String(data.get('criticality_level') || 'MEDIUM'),
        due_date: String(data.get('due_date')),
        preferred_window: String(data.get('preferred_window') || 'ANY'),
        machine_required: String(data.get('machine_required') || 'NO'),
        dependency_job_id: String(data.get('dependency_job_id') || '').trim() || null,
        safety_conflict_tag: String(data.get('safety_conflict_tag') || 'NORMAL'),
        power_block_required: department === 'Traction' && String(data.get('safety_conflict_tag') || '') === 'OHE_ISOLATION',
        work_type: department === 'Traction' ? 'POWER_BLOCK_MAINTENANCE' : 'DEPARTMENT_MAINTENANCE',
        planning_week: 1,
      };

      try {
        const result = await submitJobIntake(payload);
        form.reset();
        const proposal = result.proposal;
        const scheduled = proposal?.incremental?.scheduled_new_job;
        setNotice({
          type: 'success',
          title: result.status === 'REPAIR_PROPOSED' ? 'Job accepted • plan revision proposed' : 'Job accepted into Unified Job Pool',
          detail: result.status === 'REPAIR_PROPOSED'
            ? `${payload.job_id} was scored and checked against the approved weekly baseline. ${scheduled ? 'A compliant slot was proposed; Planner approval is required.' : 'No safe slot was found in the repair result; Planner review is required.'}`
            : `${payload.job_id} is stored as PENDING and will enter the next planning cycle.`,
        });
        window.dispatchEvent(new CustomEvent('mars:job-intake-complete', { detail: result }));
      } catch (err) {
        setNotice({ type: 'error', title: 'Job was not accepted', detail: err.message || 'The intake request failed.' });
      } finally {
        setBusy(false);
      }
    };

    document.addEventListener('submit', handleSubmit, true);
    return () => document.removeEventListener('submit', handleSubmit, true);
  }, [department]);

  const approve = async () => {
    if (!weekly || !['FEASIBLE', 'OPTIMAL'].includes(weekly.status)) return;
    setBusy(true);
    try {
      const result = await approveWeeklyPlan({ week: weekly.planning_week || 1, plan: weekly, approved_by: 'PLANNER' });
      setApproval(result);
      setNotice({ type: 'success', title: 'Weekly baseline approved', detail: `Revision R${result.revision} is now the planner-approved baseline. Future intake jobs will trigger incremental repair against this baseline.` });
    } catch (err) {
      setNotice({ type: 'error', title: 'Approval rejected', detail: err.message || 'The plan could not be approved.' });
    } finally {
      setBusy(false);
    }
  };

  if (!isWeekly && !notice) return null;

  return (
    <div className="px-4 pt-3">
      {isWeekly && (
        <div className="bg-white border border-[#D6DEE6] rounded shadow-sm px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#1E3A5F]" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#1F2933]">Weekly Baseline Governance</p>
              <p className="text-[10px] text-[#60748A]">
                {approval?.approved ? `Approved baseline R${approval.revision} • ${approval.approved_at?.replace('T', ' ').slice(0, 19)} UTC` : 'Planner approval required before the weekly plan becomes the protected baseline.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={approve} disabled={busy || !weekly || !['FEASIBLE', 'OPTIMAL'].includes(weekly.status)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#1E3A5F] text-white text-[10px] font-bold disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {approval?.approved ? 'Approve Current Plan as New Baseline' : 'Approve Weekly Baseline'}
          </button>
        </div>
      )}

      {notice && (
        <div className={`mt-2 border rounded px-3 py-2 flex items-start gap-2 ${notice.type === 'error' ? 'bg-[#FFF5F5] border-[#F1B5B5]' : 'bg-[#F0FBF4] border-[#B8E2C3]'}`}>
          {notice.type === 'error' ? <RefreshCw className="w-4 h-4 text-[#C92A2A] mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-[#2F9E44] mt-0.5" />}
          <div className="min-w-0 flex-1"><p className="text-[11px] font-bold">{notice.title}</p><p className="text-[10px] text-[#52606D] mt-0.5">{notice.detail}</p></div>
          <button type="button" onClick={() => setNotice(null)} className="text-[#718294]"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}
