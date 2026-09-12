import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, RefreshCw, Search, SlidersHorizontal, X, Wrench } from 'lucide-react';
import { fetchAllScoredJobs, fetchWeeklyPlan } from '../services/api';

const PRIORITY = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const STATUS = ['ALL', 'PENDING', 'SCHEDULED', 'DEFERRED', 'COMPLETED'];
const DEPARTMENTS = ['ALL', 'Engineering', 'S&T', 'Traction'];

const priorityClass = (value) => {
  if (value === 'CRITICAL') return 'bg-[#C92A2A]/10 text-[#C92A2A] border-[#C92A2A]/25';
  if (value === 'HIGH') return 'bg-[#F08C00]/10 text-[#A76614] border-[#F08C00]/25';
  if (value === 'LOW') return 'bg-[#EEF2F4] text-[#60748A] border-[#D6DEE6]';
  return 'bg-[#EEF5FC] text-[#315F8D] border-[#C9DCEC]';
};

const departmentClass = (dept) => dept === 'Engineering' ? 'text-[#3B6EA5]' : dept === 'S&T' ? 'text-[#2F8F6B]' : 'text-[#C9842A]';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [section, setSection] = useState('ALL');
  const [sort, setSort] = useState('priority');
  const [selected, setSelected] = useState(null);

  const loadJobs = async () => {
    try {
      setLoading(true); setError('');
      const [jobsData, planData] = await Promise.all([fetchAllScoredJobs(), fetchWeeklyPlan()]);
      setJobs(Array.isArray(jobsData) ? jobsData : (jobsData?.jobs || []));
      setWeeklyPlan(planData || null);
    } catch (err) {
      setError(err.message || 'Unable to load maintenance jobs.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadJobs(); }, []);

  // The job pool supplies work and AI priority. The weekly planning engine
  // supplies the current approved scheduling outcome. Nothing is inferred
  // from a hard-coded list of job IDs or a UI-only status flag.
  const planningStatus = useMemo(() => {
    const blocks = weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];
    const scheduled = new Set(blocks.flatMap(block => block.job_ids || []));
    const deferred = new Set(weeklyPlan?.deferred_jobs || []);
    const sourceStatus = new Map(jobs.map(job => [job.job_id, String(job.status || '').toUpperCase()]));
    return { scheduled, deferred, sourceStatus };
  }, [weeklyPlan, jobs]);

  const getJobStatus = (job) => {
    const source = planningStatus.sourceStatus.get(job.job_id);
    if (source === 'COMPLETED') return 'COMPLETED';
    if (planningStatus.scheduled.has(job.job_id)) return 'SCHEDULED';
    if (planningStatus.deferred.has(job.job_id)) return 'DEFERRED';
    return 'PENDING';
  };

  const sections = useMemo(() => ['ALL', ...Array.from(new Set(jobs.map(j => j.section_id).filter(Boolean))).sort()], [jobs]);
  const counts = useMemo(() => ({
    total: jobs.length,
    critical: jobs.filter(j => j.criticality_level === 'CRITICAL').length,
    high: jobs.filter(j => j.criticality_level === 'HIGH').length,
    pending: jobs.filter(j => getJobStatus(j) === 'PENDING').length,
    deferred: jobs.filter(j => getJobStatus(j) === 'DEFERRED').length,
  }), [jobs, planningStatus]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...jobs]
      .filter(j => department === 'ALL' || j.department === department)
      .filter(j => priority === 'ALL' || j.criticality_level === priority)
      .filter(j => status === 'ALL' || getJobStatus(j) === status)
      .filter(j => section === 'ALL' || j.section_id === section)
      .filter(j => !q || [j.job_id, j.asset_id, j.asset_type, j.section_id, j.track_id, j.defect_type].some(v => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => {
        if (sort === 'due') return String(a.due_date || '').localeCompare(String(b.due_date || ''));
        if (sort === 'id') return String(a.job_id).localeCompare(String(b.job_id));
        return Number(b.ai_priority_score || 0) - Number(a.ai_priority_score || 0);
      });
  }, [jobs, search, department, priority, status, section, sort, planningStatus]);

  const activeFilters = [department !== 'ALL', priority !== 'ALL', status !== 'ALL', section !== 'ALL'].filter(Boolean).length;
  const selectedStatus = selected ? getJobStatus(selected) : null;

  return (
    <main className="min-h-full bg-[#F4F6F8] p-3.5 font-sans text-[#1F2933]">
      <div className="mx-auto max-w-[1800px] space-y-3">
        <header className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[#1E3A5F] text-white"><Wrench className="h-5 w-5" /></div>
              <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-black uppercase tracking-wide text-[#1E3A5F]">Maintenance Jobs</h1><span className="rounded border border-[#D6DEE6] bg-[#F8FAFC] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#52606D]">Unified Job Pool</span></div><p className="mt-1 text-[10px] text-[#718294]">All maintenance work received by MARS from Engineering, S&T and Traction.</p></div>
            </div>
            <button type="button" onClick={loadJobs} disabled={loading} className="flex items-center justify-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#2F6F7E] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Jobs</button>
          </div>
        </header>

        {error && <div className="rounded border border-[#C92A2A]/25 bg-[#C92A2A]/5 px-3 py-2 text-[10px] font-semibold text-[#C92A2A]"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</div>}

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[['Total jobs', counts.total, 'text-[#1E3A5F]'], ['Critical', counts.critical, 'text-[#C92A2A]'], ['High priority', counts.high, 'text-[#A76614]'], ['Pending', counts.pending, 'text-[#315F8D]'], ['Deferred', counts.deferred, 'text-[#A76614]']].map(([label, value, cls]) => <div key={label} className="rounded border border-[#D6DEE6] bg-white px-3 py-2.5 shadow-sm"><div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{label}</div><div className={`mt-1 font-mono text-xl font-black ${cls}`}>{loading ? '—' : value}</div></div>)}
        </section>

        <section className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="border-b border-[#D6DEE6] bg-[#FAFBFC] px-3.5 py-3">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded border border-[#D6DEE6] bg-white px-2.5 py-2"><Search className="h-4 w-4 shrink-0 text-[#718294]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search job, asset, section or maintenance type" className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#9AA8B5]" />{search && <button type="button" onClick={() => setSearch('')} className="text-[#718294] hover:text-[#1E3A5F]"><X className="h-3.5 w-3.5" /></button>}</div>
              <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1 text-[9px] font-bold uppercase text-[#718294]"><SlidersHorizontal className="h-3.5 w-3.5" /> Filters</div><FilterSelect value={department} onChange={setDepartment} options={DEPARTMENTS} label="Department" /><FilterSelect value={priority} onChange={setPriority} options={PRIORITY} label="Priority" /><FilterSelect value={status} onChange={setStatus} options={STATUS} label="Status" /><FilterSelect value={section} onChange={setSection} options={sections} label="Section" /><FilterSelect value={sort} onChange={setSort} options={['priority','due','id']} labels={['Priority','Due date','Job ID']} label="Sort" />{activeFilters > 0 && <button type="button" onClick={() => { setDepartment('ALL'); setPriority('ALL'); setStatus('ALL'); setSection('ALL'); }} className="rounded border border-[#D6DEE6] bg-white px-2 py-1.5 text-[9px] font-bold text-[#52606D] hover:bg-[#F4F6F8]">Clear {activeFilters}</button>}</div>
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-[#E6EBEF] px-3.5 py-2 text-[9px] text-[#718294]"><span><strong className="text-[#1F2933]">{filteredJobs.length}</strong> jobs shown</span><span>{activeFilters ? `${activeFilters} filter${activeFilters === 1 ? '' : 's'} active` : 'Showing the full maintenance pool'}</span></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-[10px]">
              <thead><tr className="border-b border-[#D6DEE6] bg-[#F4F6F8] text-[9px] font-bold uppercase tracking-wider text-[#52606D]"><th className="px-3 py-2.5">Job</th><th className="px-3 py-2.5">Department</th><th className="px-3 py-2.5">Asset / Work</th><th className="px-3 py-2.5">Section / Track</th><th className="px-3 py-2.5">Due</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5">Score</th><th className="px-3 py-2.5">Status</th><th className="w-8 px-2 py-2.5"></th></tr></thead>
              <tbody className="divide-y divide-[#E8EDF1]">
                {filteredJobs.map(job => { const level = job.criticality_level || 'MEDIUM'; const state = getJobStatus(job); return <tr key={job.job_id} onClick={() => setSelected(job)} className="cursor-pointer hover:bg-[#F7F9FB]">
                  <td className="px-3 py-2.5"><div className="font-mono font-black text-[#1E3A5F]">{job.job_id}</div><div className="mt-0.5 text-[8px] text-[#8796A5]">{job.asset_id || 'Asset not listed'}</div></td>
                  <td className={`px-3 py-2.5 font-bold ${departmentClass(job.department)}`}>{job.department || '—'}</td>
                  <td className="px-3 py-2.5"><div className="font-semibold text-[#1F2933]">{String(job.defect_type || 'Maintenance').replaceAll('_', ' ')}</div><div className="text-[8px] text-[#8796A5]">{job.asset_type || 'Asset'}</div></td>
                  <td className="px-3 py-2.5"><div className="font-semibold">{job.section_id || '—'}</div><div className="font-mono text-[8px] text-[#8796A5]">{job.track_id || 'Track —'} · KM {job.location_km ?? '—'}</div></td>
                  <td className="px-3 py-2.5 font-mono">{job.due_date || '—'}</td>
                  <td className="px-3 py-2.5"><span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${priorityClass(level)}`}>{level}</span></td>
                  <td className="px-3 py-2.5 font-mono font-black text-[#1E3A5F]">{job.ai_priority_score == null ? '—' : Number(job.ai_priority_score).toFixed(1)}</td>
                  <td className="px-3 py-2.5"><span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${state === 'SCHEDULED' ? 'border-[#2F9E44]/25 bg-[#2F9E44]/5 text-[#2F9E44]' : state === 'DEFERRED' ? 'border-[#F08C00]/25 bg-[#F08C00]/5 text-[#A76614]' : state === 'COMPLETED' ? 'border-[#2F6F7E]/25 bg-[#EEF5F7] text-[#2F6F7E]' : 'border-[#D6DEE6] bg-[#F8FAFC] text-[#60748A]'}`}>{state}</span></td>
                  <td className="px-2 py-2.5 text-[#718294]"><ChevronRight className="h-4 w-4" /></td>
                </tr>; })}
                {!loading && !filteredJobs.length && <tr><td colSpan="9" className="px-3 py-10 text-center"><div className="text-[11px] font-bold text-[#52606D]">No jobs match these filters</div><button type="button" onClick={() => { setSearch(''); setDepartment('ALL'); setPriority('ALL'); setStatus('ALL'); setSection('ALL'); }} className="mt-2 text-[9px] font-bold text-[#1E3A5F] hover:underline">Clear filters</button></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10263D]/30 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="w-full max-w-2xl rounded-lg border border-[#D6DEE6] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#D6DEE6] px-4 py-3"><div><div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-[#1E3A5F]" /><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Job Details</h2><span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${priorityClass(selected.criticality_level || 'MEDIUM')}`}>{selected.criticality_level || 'MEDIUM'}</span></div><p className="mt-1 font-mono text-[10px] text-[#718294]">{selected.job_id}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded p-1 text-[#718294] hover:bg-[#F4F6F8]"><X className="h-4 w-4" /></button></div>
            <div className="grid gap-px bg-[#D6DEE6] sm:grid-cols-2">{[['Department', selected.department],['Asset', selected.asset_id],['Asset type', selected.asset_type],['Section', selected.section_id],['Track', selected.track_id],['Location', selected.location_km != null ? `KM ${selected.location_km}` : '—'],['Maintenance', String(selected.defect_type || 'Maintenance').replaceAll('_', ' ')],['Duration', selected.estimated_duration_hours ? `${selected.estimated_duration_hours} h` : '—'],['Due date', selected.due_date],['Preferred time', selected.preferred_window || 'Any'],['AI priority', selected.ai_priority_score == null ? '—' : `${Number(selected.ai_priority_score).toFixed(1)} / 100`],['Status', selectedStatus]].map(([label,value]) => <div key={label} className="bg-white px-3.5 py-2.5"><div className="text-[8px] font-bold uppercase tracking-wider text-[#8796A5]">{label}</div><div className="mt-1 text-[10px] font-semibold text-[#1F2933]">{value || '—'}</div></div>)}</div>
            <div className="flex items-center justify-between border-t border-[#D6DEE6] bg-[#FAFBFC] px-4 py-3"><div className="flex items-center gap-1.5 text-[9px] font-semibold text-[#2F9E44]"><CheckCircle2 className="h-3.5 w-3.5" /> Part of the unified maintenance pool</div><button type="button" onClick={() => setSelected(null)} className="rounded border border-[#D6DEE6] bg-white px-3 py-1.5 text-[9px] font-bold text-[#52606D]">Close</button></div>
          </div>
        </div>}
      </div>
    </main>
  );
}

function FilterSelect({ value, onChange, options, labels, label }) {
  return <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className="rounded border border-[#D6DEE6] bg-white px-2 py-1.5 text-[9px] font-bold text-[#52606D] outline-none hover:border-[#AFC0D1]">{options.map((option, index) => <option key={option} value={option}>{labels?.[index] || option === 'ALL' ? (labels?.[index] || (option === 'ALL' ? `All ${label.toLowerCase()}s` : option)) : option}</option>)}</select>;
}