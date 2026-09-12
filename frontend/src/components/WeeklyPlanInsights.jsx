import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

const shared = (block) => Array.isArray(block?.departments) && new Set(block.departments.filter(Boolean)).size > 1;
const departments = (block) => Array.isArray(block?.departments) ? block.departments.filter(Boolean) : [];
const jobIds = (block) => Array.isArray(block?.job_ids) ? block.job_ids : [];

export default function WeeklyPlanInsights({ blocks = [], jobs = [], metrics = {}, conflicts = 0 }) {
  const scheduledIds = new Set(blocks.flatMap(jobIds));
  const deferredJobs = jobs.filter((job) => {
    const id = job?.job_id || job?.id;
    return id && !scheduledIds.has(id) && ['CRITICAL', 'HIGH'].includes(String(job?.criticality || '').toUpperCase());
  }).slice(0, 5);

  const attention = [...blocks]
    .filter((block) => String(block?.criticality || '').toUpperCase() === 'CRITICAL' || Number(block?.ai_priority_score || block?.priority_score || 0) >= 90)
    .sort((a, b) => Number(b?.ai_priority_score || b?.priority_score || 0) - Number(a?.ai_priority_score || a?.priority_score || 0))
    .slice(0, 5);

  const deptRows = ['Engineering', 'S&T', 'Traction'].map((dept) => {
    const deptBlocks = blocks.filter((block) => departments(block).includes(dept));
    const sharedBlocks = deptBlocks.filter(shared).length;
    return { dept, jobs: new Set(deptBlocks.flatMap(jobIds)).size, blocks: deptBlocks.length, shared: sharedBlocks };
  });

  const deferredCount = Number(metrics.total_jobs_deferred ?? metrics.deferred_jobs ?? deferredJobs.length ?? 0);
  const sharedCount = blocks.filter(shared).length;

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Total jobs', jobs.length || '—', 'text-[#1E3A5F]'],
          ['Scheduled blocks', blocks.length, 'text-[#1E3A5F]'],
          ['Shared blocks', sharedCount, 'text-[#6B5B95]'],
          ['Deferred', deferredCount, 'text-[#A76614]'],
          ['Critical work', attention.length || '—', 'text-[#C92A2A]'],
          ['Conflicts', conflicts, conflicts ? 'text-[#C92A2A]' : 'text-[#2F9E44]'],
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded-md border border-[#D6DEE6] bg-white px-3 py-2.5 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{label}</div>
            <div className={`mt-1 font-mono text-lg font-black ${cls}`}>{value}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="border-b border-[#D6DEE6] px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Planner Attention</h2><p className="mt-0.5 text-[10px] text-[#718294]">Items that may need a planner decision.</p></div>
              <AlertCircle className="h-4 w-4 text-[#A76614]" />
            </div>
          </div>
          <div className="divide-y divide-[#EEF2F6]">
            {attention.length ? attention.map((block) => (
              <div key={block.block_id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0"><div className="truncate text-[11px] font-extrabold text-[#1F2933]">{jobIds(block)[0] || block.block_id}</div><div className="mt-0.5 text-[9px] text-[#718294]">{departments(block).join(' + ') || 'Maintenance'} · {block.track_id || 'Track not listed'}</div></div>
                <div className="shrink-0 text-right"><div className="text-[9px] font-bold uppercase text-[#C92A2A]">{String(block.criticality || 'HIGH')}</div><div className="font-mono text-[9px] text-[#52606D]">Priority {Math.round(Number(block.ai_priority_score || block.priority_score || 0)) || '—'}</div></div>
              </div>
            )) : <div className="px-3.5 py-5 text-[10px] text-[#718294]"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#2F9E44]" />No high-priority items need attention.</div>}
          </div>
        </div>

        <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="border-b border-[#D6DEE6] px-3.5 py-2.5"><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Department Coordination</h2><p className="mt-0.5 text-[10px] text-[#718294]">Work planned across Engineering, S&T and Traction.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-wider text-[#718294]"><tr><th className="px-3.5 py-2">Department</th><th className="px-2 py-2">Jobs</th><th className="px-2 py-2">Blocks</th><th className="px-3.5 py-2">Shared</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{deptRows.map((row) => <tr key={row.dept} className="text-[10px]"><td className="px-3.5 py-2.5 font-bold text-[#1F2933]">{row.dept}</td><td className="px-2 py-2.5 font-mono">{row.jobs}</td><td className="px-2 py-2.5 font-mono">{row.blocks}</td><td className="px-3.5 py-2.5 font-mono text-[#6B5B95]">{row.shared}</td></tr>)}</tbody></table></div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="border-b border-[#D6DEE6] px-3.5 py-2.5"><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Deferred Work</h2><p className="mt-0.5 text-[10px] text-[#718294]">Higher-priority jobs not included in this week's schedule.</p></div>
          {deferredJobs.length ? <div className="divide-y divide-[#EEF2F6]">{deferredJobs.map((job) => <div key={job.job_id || job.id} className="flex items-center justify-between px-3.5 py-2.5"><div><div className="text-[10px] font-extrabold">{job.job_id || job.id}</div><div className="text-[9px] text-[#718294]">{job.department || job.dept || 'Department not listed'}</div></div><span className="rounded border border-[#F08C00]/25 bg-[#F08C00]/5 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#A76614]">{job.criticality || 'HIGH'}</span></div>)}</div> : <div className="px-3.5 py-5 text-[10px] text-[#718294]"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#2F9E44]" />No higher-priority deferred work is listed.</div>}
        </div>
        <div className="rounded-md border border-[#D6DEE6] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[#D6DEE6] px-3.5 py-2.5"><div><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Safety Check</h2><p className="mt-0.5 text-[10px] text-[#718294]">Weekly plan protection status.</p></div><ShieldCheck className="h-4 w-4 text-[#2F9E44]" /></div><div className="grid grid-cols-2 gap-2 p-3.5 sm:grid-cols-3"><div className="rounded border border-[#2F9E44]/20 bg-[#2F9E44]/5 p-2"><div className="text-[9px] font-bold uppercase text-[#718294]">Train protection</div><div className="mt-1 text-[11px] font-extrabold text-[#2F9E44]">Active</div></div><div className="rounded border border-[#2F9E44]/20 bg-[#2F9E44]/5 p-2"><div className="text-[9px] font-bold uppercase text-[#718294]">Schedule conflicts</div><div className="mt-1 text-[11px] font-extrabold text-[#2F9E44]">{conflicts ? conflicts : 'None'}</div></div><div className="rounded border border-[#2F9E44]/20 bg-[#2F9E44]/5 p-2"><div className="text-[9px] font-bold uppercase text-[#718294]">Plan status</div><div className="mt-1 text-[11px] font-extrabold text-[#2F9E44]">Ready for review</div></div></div></div>
      </section>
    </div>
  );
}
