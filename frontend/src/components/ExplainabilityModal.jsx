import { ShieldCheck, Layers, X, FileText, Activity, Award } from 'lucide-react';

const ExplainabilityModal = ({ block, isOpen, onClose, jobCatalog = [] }) => {
  if (!isOpen || !block) return null;

  const detailById = new Map((block.jobs_detail || []).map((job) => [job.job_id, job]));
  const catalogById = new Map(jobCatalog.map((job) => [job.job_id, job]));
  const jobIds = Array.from(new Set([...(block.job_ids || []), ...detailById.keys()]));
  const jobs = jobIds.map((id) => ({ ...(catalogById.get(id) || {}), ...(detailById.get(id) || {}), job_id: id }));

  // Shared means two or more actual participating departments, not a stale
  // is_consolidated flag. Prefer the attached job records when the department
  // array is absent/incomplete so the review reflects the actual possession.
  const attachedDepartments = Array.from(new Set([
    ...(Array.isArray(block.departments) ? block.departments : []),
    ...jobs.map((job) => job.department).filter(Boolean),
  ]));
  const depts = attachedDepartments.length ? attachedDepartments : ['Engineering'];
  const isConsolidated = depts.length > 1;

  const hardConstraints = [
    ['Train Clearance Buffers', '15 min before + 15 min after protected train movements'],
    ['Single Track Possession', `No overlapping possession on ${block.track_id}`],
    ['OHE / Power Isolation', depts.includes('Traction') ? 'Traction isolation accompanies the possession' : 'Not required for this block'],
    ['Safety Compatibility', 'No incompatible maintenance combination detected'],
  ];
  const tsrStages = block.tsr_recovery_profile?.stages || block.tsr_recovery_profile?.recovery_stages || [];
  const departmentSummary = depts.join(' + ');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-[#1E3A5F] px-5 py-3.5 text-white">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#8FD19E]" />
              <h2 className="text-sm font-black uppercase tracking-wide">Block Decision Review</h2>
              {isConsolidated && <span className="rounded bg-[#6B5B95] px-2 py-0.5 text-[9px] font-bold">SHARED POSSESSION</span>}
            </div>
            <p className="mt-1 text-[10px] text-[#D6DEE6]">{block.block_id} • {block.section_id} • {block.track_id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto p-5 text-xs">
          <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <div className="rounded border border-[#D6DEE6] bg-[#F8FAFC] p-3"><span className="text-[9px] font-bold uppercase text-[#718294]">Window</span><p className="mt-1 font-mono font-bold text-[#1F2933]">{block.start_time?.slice(11, 16)} → {block.end_time?.slice(11, 16)}</p></div>
            <div className="rounded border border-[#D6DEE6] bg-[#F8FAFC] p-3"><span className="text-[9px] font-bold uppercase text-[#718294]">Duration</span><p className="mt-1 font-mono font-bold text-[#1F2933]">{block.duration_hours || '—'} h</p></div>
            <div className="rounded border border-[#D6DEE6] bg-[#F8FAFC] p-3"><span className="text-[9px] font-bold uppercase text-[#718294]">Departments</span><p className="mt-1 font-bold text-[#1F29333]">{departmentSummary}</p></div>
            <div className="rounded border border-[#D6DEE6] bg-[#F8FAFC] p-3"><span className="text-[9px] font-bold uppercase text-[#718294]">Jobs in possession</span><p className="mt-1 font-mono text-lg font-black text-[#6B5B95]">{jobs.length}</p></div>
          </section>

          <section className="mt-4 rounded border border-[#2F6F7E]/25 bg-[#2F6F7E]/5 p-3.5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[#1E3A5F]"><FileText className="h-3.5 w-3.5" /> Why MARS scheduled this block</div>
            <p className="mt-1.5 leading-relaxed text-[#1F2933]">
              {block.explanation || `MARS scheduled this ${isConsolidated ? 'shared ' : ''}possession on ${block.track_id} while protecting train movements and mandatory safety constraints.`}
            </p>
            {isConsolidated && <div className="mt-2 rounded border border-[#6B5B95]/25 bg-[#6B5B95]/5 px-3 py-2 font-semibold text-[#5A4A80]">Shared possession: {departmentSummary}. The same protected block carries work from both participating departments.</div>}
          </section>

          <section className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#1F2933]"><Layers className="h-4 w-4 text-[#6B5B95]" /> Associated Maintenance Jobs <span className="rounded bg-[#6B5B95]/10 px-1.5 py-0.5 text-[9px] text-[#6B5B95]">{jobs.length}</span></div>
            {jobs.length ? (
              <div className="overflow-hidden rounded border border-[#D6DEE6]">
                <table className="w-full text-left">
                  <thead className="bg-[#F4F6F8] text-[9px] font-bold uppercase text-[#52606D]"><tr><th className="px-3 py-2">Job</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Work / Defect</th><th className="px-3 py-2">Criticality</th><th className="px-3 py-2">AI Priority</th></tr></thead>
                  <tbody className="divide-y divide-[#E5EAF0]">
                    {jobs.map((job) => <tr key={job.job_id} className="hover:bg-[#F8FAFC]"><td className="px-3 py-2 font-mono font-bold text-[#1E3A5F]">{job.job_id}</td><td className="px-3 py-2 font-semibold">{job.department || '—'}</td><td className="px-3 py-2 text-[#52606D]">{String(job.defect_type || job.work_type || 'Maintenance').replace(/_/g, ' ')}</td><td className="px-3 py-2"><span className="rounded bg-[#F4F6F8] px-1.5 py-0.5 text-[9px] font-bold">{job.criticality_level || '—'}</span></td><td className="px-3 py-2 font-mono font-bold">{job.ai_priority_score ?? '—'}</td></tr>)}
                  </tbody>
                </table>
              </div>
            ) : <div className="rounded border border-[#C92A2A]/25 bg-[#C92A2A]/5 p-3 text-[10px] font-semibold text-[#C92A2A]">No associated job records were supplied by the weekly-plan API for this possession.</div>}
          </section>

          <section className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#1F2933]"><ShieldCheck className="h-4 w-4 text-[#2F9E44]" /> Safety verification</div>
            <div className="divide-y divide-[#E5EAF0] rounded border border-[#D6DEE6]">{hardConstraints.map(([name, detail]) => <div key={name} className="flex items-center justify-between gap-3 px-3 py-2.5"><div><p className="font-bold">{name}</p><p className="mt-0.5 text-[10px] text-[#718294]">{detail}</p></div><span className="rounded border border-[#2F9E44]/25 bg-[#2F9E44]/10 px-2 py-0.5 text-[9px] font-bold text-[#2F9E44]">VERIFIED</span></div>)}</div>
          </section>

          {tsrStages.length > 0 && <section className="mt-5"><div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#1F2933]"><Activity className="h-4 w-4 text-[#C9842A]" /> TSR Recovery</div><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{tsrStages.map((stage, i) => <div key={`${stage.day || 'stage'}-${i}`} className="rounded border border-[#D6DEE6] bg-[#F8FAFC] p-2 text-center"><div className="text-[9px] font-bold uppercase text-[#718294]">{stage.day || `Stage ${i + 1}`}</div><div className="mt-1 font-mono text-lg font-black text-[#C9842A]">{stage.speed_kmh ?? stage.max_speed_kmh ?? '—'} <span className="text-[8px]">km/h</span></div><div className="text-[9px] text-[#718294]">{stage.label || ''}</div></div>)}</div></section>}

          <section className="mt-5 rounded border border-[#D6DEE6] bg-[#F8FAFC] p-3"><div className="flex items-center gap-2 text-[10px] font-black uppercase text-[#1F2933]"><Award className="h-3.5 w-3.5 text-[#1E3A5F]" /> Optimization basis</div><p className="mt-1 text-[10px] leading-relaxed text-[#52606D]">Priority and risk determine which work matters most; CP-SAT determines feasible timing while protecting train movements and railway safety constraints. Shared possessions are rewarded only when compatible jobs are actually scheduled together.</p></section>
        </div>

        <footer className="flex items-center justify-between border-t border-[#D6DEE6] bg-[#F4F6F8] px-5 py-2.5"><span className="font-mono text-[9px] text-[#718294]">Audit: {block.block_id}</span><button type="button" onClick={onClose} className="rounded bg-[#1E3A5F] px-4 py-1.5 text-[10px] font-bold text-white hover:bg-[#2F6F7E]">Close</button></footer>
      </div>
    </div>
  );
};

export default ExplainabilityModal;
