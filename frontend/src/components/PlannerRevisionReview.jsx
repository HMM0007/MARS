import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck, X } from 'lucide-react';
import { approveWeeklyPlan, fetchApprovedWeeklyPlan, fetchPendingWeeklyRevision } from '../services/api';

const blocksOf = (plan) => plan?.scheduled_blocks || plan?.blocks || [];
const idsOf = (block) => Array.isArray(block?.job_ids) ? block.job_ids : [];
const fmt = (value) => value ? new Date(value).toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

const summarize = (baseline, proposal, newJobId) => {
  const before = blocksOf(baseline?.plan || baseline);
  const after = blocksOf(proposal);
  const beforeByJob = new Map();
  before.forEach((b) => idsOf(b).forEach((id) => beforeByJob.set(id, b)));
  const afterByJob = new Map();
  after.forEach((b) => idsOf(b).forEach((id) => afterByJob.set(id, b)));
  const moved = [];
  afterByJob.forEach((a, id) => {
    if (id === newJobId) return;
    const b = beforeByJob.get(id);
    if (b && (b.start_time !== a.start_time || b.end_time !== a.end_time || b.track_id !== a.track_id)) moved.push({ id, before: b, after: a });
  });
  const added = after.filter((b) => idsOf(b).includes(newJobId));
  const frozen = proposal?.incremental?.frozen_job_ids || [];
  const deferred = proposal?.deferred_jobs || proposal?.incremental?.deferred_job_ids || [];
  return { moved, added, frozen, deferred };
};

export default function PlannerRevisionReview({ currentRole }) {
  const [pending, setPending] = useState(null);
  const [approved, setApproved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const isPlanner = currentRole?.id === 'planner' || currentRole?.dept === 'Operations' || !currentRole;

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([fetchPendingWeeklyRevision(), fetchApprovedWeeklyPlan()]);
      setPending(p?.pending ? p : null); setApproved(a?.approved ? a : null);
    } catch (err) { setMessage({ error: err.message || 'Unable to load revision review.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const record = pending?.revision;
  const plan = record?.plan;
  const newJobId = record?.new_job_id;
  const summary = useMemo(() => record ? summarize(approved, plan, newJobId) : null, [record, approved, plan, newJobId]);
  if (loading || !record) return null;

  const approve = async () => {
    if (!isPlanner || !plan || !['FEASIBLE', 'OPTIMAL'].includes(plan.status)) return;
    setBusy(true); setMessage(null);
    try {
      const result = await approveWeeklyPlan({ week: record.planning_week, plan, approved_by: currentRole?.name || 'PLANNER' });
      setMessage({ success: `Revision R${result.revision} approved. It is now the protected operational baseline.` });
      await refresh();
    } catch (err) { setMessage({ error: err.message || 'Revision approval failed.' }); }
    finally { setBusy(false); }
  };

  const compliance = plan?.compliance;
  const unchanged = Math.max(0, summary.frozen.length);

  return <section className="mt-4 rounded border border-[#D6DEE6] bg-white shadow-sm overflow-hidden">
    <div className="border-b border-[#F0C36A] bg-[#FFF9E8] px-4 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
      <div className="flex items-start gap-2"><AlertTriangle className="h-5 w-5 text-[#C92A2A] mt-0.5"/><div><div className="flex items-center gap-2"><h2 className="text-sm font-black uppercase tracking-wide text-[#1F2933]">Planner Revision Review</h2><span className="rounded bg-[#C92A2A] px-2 py-0.5 text-[9px] font-black text-white">ACTION REQUIRED</span></div><p className="mt-1 text-[10px] text-[#52606D]">{newJobId} triggered an incremental repair of approved baseline R{record.source_revision ?? '—'}. Review only the changes below.</p></div></div>
      {isPlanner && <div className="flex gap-2"><button type="button" onClick={() => setPending(null)} className="rounded border border-[#D6DEE6] bg-white px-3 py-2 text-[10px] font-bold text-[#52606D]">Close</button><button type="button" onClick={approve} disabled={busy || !['FEASIBLE','OPTIMAL'].includes(plan?.status)} className="inline-flex items-center gap-2 rounded bg-[#1E3A5F] px-4 py-2 text-[10px] font-black text-white disabled:opacity-50">{busy ? <Clock3 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>} APPROVE REVISION</button></div>}
    </div>

    <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-[#D6DEE6] border-b border-[#D6DEE6]">
      {[['NEW JOB', newJobId], ['MOVED', summary.moved.length], ['ADDED', summary.added.length], ['FROZEN', unchanged], ['DEFERRED', summary.deferred.length], ['SOLVER', plan?.status || '—']].map(([label, value]) => <div key={label} className="bg-white px-3 py-2"><p className="text-[8px] font-bold uppercase text-[#718294]">{label}</p><p className="mt-0.5 truncate font-mono text-[12px] font-black text-[#1F2933]">{value}</p></div>)}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 p-4">
      <div className="xl:col-span-2 rounded border border-[#D6DEE6] overflow-hidden">
        <div className="border-b border-[#D6DEE6] bg-[#F4F6F8] px-3 py-2"><p className="text-[10px] font-black uppercase text-[#1F2933]">Exactly What Changes</p><p className="text-[9px] text-[#718294]">The list is intentionally limited to changed blocks so the Planner can decide quickly.</p></div>
        {summary.added.map((b) => <div key={`added-${b.block_id}`} className="border-b border-[#D6DEE6]/60 bg-[#F0FBF4] px-3 py-2"><div className="flex justify-between"><span className="text-[9px] font-black uppercase text-[#2F9E44]">+ New block for {newJobId}</span><span className="font-mono text-[9px]">{b.block_id}</span></div><p className="mt-1 text-[10px] font-bold">{b.section_id} • {b.track_id}</p><p className="text-[9px] font-mono text-[#52606D]">{fmt(b.start_time)} → {fmt(b.end_time)}</p></div>)}
        {summary.moved.map((m) => <div key={m.id} className="border-b border-[#D6DEE6]/60 px-3 py-2"><div className="flex justify-between"><span className="text-[9px] font-black uppercase text-[#C9842A]">Changed block</span><span className="font-mono text-[9px] font-bold">{m.id}</span></div><div className="mt-1 grid grid-cols-2 gap-2"><div className="rounded bg-[#F4F6F8] px-2 py-1"><p className="text-[8px] font-bold text-[#718294]">BEFORE</p><p className="text-[9px] font-mono">{fmt(m.before.start_time)} → {fmt(m.before.end_time)}</p><p className="text-[8px] text-[#718294]">{m.before.track_id}</p></div><div className="rounded bg-[#FFF9E8] px-2 py-1"><p className="text-[8px] font-bold text-[#8A5A00]">AFTER</p><p className="text-[9px] font-mono">{fmt(m.after.start_time)} → {fmt(m.after.end_time)}</p><p className="text-[8px] text-[#8A5A00]">{m.after.track_id}</p></div></div></div>)}
        {!summary.added.length && !summary.moved.length && <div className="px-3 py-5 text-center text-[10px] text-[#52606D]">No existing blocks moved. The proposed job is not present in a scheduled block.</div>}
      </div>

      <div className="space-y-3">
        <div className="rounded border border-[#D6DEE6] p-3"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#2F9E44]"/><p className="text-[10px] font-black uppercase">Decision checks</p></div><div className="mt-2 space-y-2 text-[10px]"><div className="flex justify-between"><span>New job scheduled</span><b>{plan?.incremental?.scheduled_new_job ? 'YES' : 'NO'}</b></div><div className="flex justify-between"><span>Compliance</span><b className={compliance?.overall_status === 'PASS' ? 'text-[#2F9E44]' : 'text-[#C9842A]'}>{compliance?.overall_status || 'NOT AVAILABLE'}</b></div><div className="flex justify-between"><span>Frozen approved jobs</span><b>{summary.frozen.length}</b></div><div className="flex justify-between"><span>Deferred jobs</span><b>{summary.deferred.length}</b></div></div></div>
        <div className="rounded border border-[#D6DEE6] bg-[#F8FAFB] p-3"><p className="text-[9px] font-black uppercase text-[#52606D]">Planner rule</p><p className="mt-1 text-[10px] leading-relaxed text-[#1F2933]">Approve only if the emergency/new job is safely placed and the resulting changes are acceptable. Closing this review does <b>not</b> activate the proposal.</p></div>
        {message && <div className={`rounded border p-2 text-[10px] ${message.error ? 'border-[#F1B5B5] bg-[#FFF5F5] text-[#C92A2A]' : 'border-[#B8E2C3] bg-[#F0FBF4] text-[#2F9E44]'}`}>{message.error || message.success}</div>}
      </div>
    </div>
  </section>;
}
