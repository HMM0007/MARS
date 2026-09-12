import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Filter, HelpCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchWeeklyPlan, fetchCOATimetable, fetchPendingWeeklyRevision } from '../services/api';
import UnifiedGantt from '../components/UnifiedGantt';
import ExplainabilityModal from '../components/ExplainabilityModal';
import PlannerRevisionReview from '../components/PlannerRevisionReview';

const DEPARTMENTS = [
  { id: 'ALL', label: 'All' },
  { id: 'Engineering', label: 'Engineering' },
  { id: 'S&T', label: 'S&T' },
  { id: 'Traction', label: 'Traction' },
  { id: 'CONSOLIDATED', label: 'Shared' },
];

const getStatus = (plan) => String(plan?.solver_status || plan?.status || '—').toUpperCase();
const getConflicts = (plan) => Number(plan?.metrics?.active_conflicts ?? plan?.compliance?.conflicts ?? 0);

export default function WeeklyPlanPage({ currentRole }) {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [trains, setTrains] = useState([]);
  const [pendingRevision, setPendingRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTrack, setSelectedTrack] = useState('ALL');
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [weekly, timetable, revision] = await Promise.all([
        fetchWeeklyPlan(),
        fetchCOATimetable().catch(() => []),
        fetchPendingWeeklyRevision().catch(() => null),
      ]);
      setWeeklyPlan(weekly);
      setTrains(Array.isArray(timetable) ? timetable : (timetable?.timetable || []));
      setPendingRevision(revision || null);
      const first = weekly?.blocks?.[0] || weekly?.scheduled_blocks?.[0];
      if (first) setSelectedBlock(first);
    } catch (err) {
      console.error('Failed to load weekly plan:', err);
      setError(err.message || 'Unable to load the weekly plan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const blocks = weeklyPlan?.blocks || weeklyPlan?.scheduled_blocks || [];
  const metrics = weeklyPlan?.metrics || weeklyPlan?.weekly_metrics || {};
  const conflicts = getConflicts(weeklyPlan);
  const status = getStatus(weeklyPlan);
  const tracks = useMemo(() => Array.from(new Set(blocks.map((b) => b?.track_id).filter(Boolean))).sort(), [blocks]);

  const filteredBlocks = useMemo(() => blocks.filter((block) => {
    const departments = block?.departments || [];
    const departmentMatch = selectedDept === 'ALL'
      || (selectedDept === 'CONSOLIDATED' ? Boolean(block?.is_consolidated || departments.length > 1) : departments.includes(selectedDept));
    const trackMatch = selectedTrack === 'ALL' || block?.track_id === selectedTrack;
    return departmentMatch && trackMatch;
  }), [blocks, selectedDept, selectedTrack]);

  const openBlock = (block) => {
    setSelectedBlock(block);
    setIsExplainOpen(true);
  };

  const baseline = weeklyPlan?.baseline_governance?.mode === 'APPROVED_BASELINE'
    ? `R${weeklyPlan?.baseline_governance?.revision ?? weeklyPlan?.baseline_revision ?? '—'}`
    : weeklyPlan?.baseline_approved ? `R${weeklyPlan?.baseline_revision ?? '—'}` : 'Candidate';

  return (
    <main className="min-h-full bg-[#F4F6F8] p-3.5 font-sans text-[#1F2933]">
      <div className="mx-auto max-w-[1800px] space-y-3">
        {/* Planner identity */}
        <header className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#1E3A5F]" />
                <h1 className="text-lg font-black uppercase tracking-wide text-[#1E3A5F]">Weekly Plan</h1>
                <span className="rounded border border-[#1E3A5F]/20 bg-[#1E3A5F]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1E3A5F]">7-Day Tactical Schedule</span>
              </div>
              <p className="mt-1 text-[10px] text-[#718294]">Pune Division • Approved baseline {baseline} • Planner scheduling workspace</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-bold uppercase ${conflicts ? 'border-[#C92A2A]/25 bg-[#C92A2A]/5 text-[#C92A2A]' : 'border-[#2F9E44]/25 bg-[#2F9E44]/5 text-[#2F9E44]'}`}>
                {conflicts ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {conflicts ? `${conflicts} conflict${conflicts === 1 ? '' : 's'}` : 'No conflicts'}
              </div>
              <div className="rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-1.5 text-[10px] font-bold uppercase text-[#52606D]">Solver: <span className="font-mono text-[#1E3A5F]">{loading ? '—' : status}</span></div>
              <button type="button" onClick={loadData} disabled={loading} className="flex items-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#2F6F7E] disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>
        </header>

        {error && <div className="rounded border border-[#C92A2A]/25 bg-[#C92A2A]/5 px-3 py-2 text-[10px] font-semibold text-[#C92A2A]"><AlertCircle className="mr-1.5 inline h-3.5 w-3.5" />{error}</div>}

        {/* Only show revision review when there is an actual decision to make. */}
        {pendingRevision && (
          <section>
            <PlannerRevisionReview currentRole={currentRole} />
          </section>
        )}

        {/* Compact plan summary — deliberately not a KPI wall. */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Scheduled blocks', blocks.length, 'text-[#1E3A5F]'],
            ['Shared blocks', blocks.filter((b) => b?.is_consolidated || (b?.departments || []).length > 1).length, 'text-[#6B5B95]'],
            ['Deferred', Number(metrics.total_jobs_deferred ?? weeklyPlan?.deferred_jobs?.length ?? 0), 'text-[#A76614]'],
            ['Risk coverage', metrics.risk_coverage_percentage != null ? `${metrics.risk_coverage_percentage}%` : '—', 'text-[#2F9E44]'],
          ].map(([label, value, cls]) => (
            <div key={label} className="rounded border border-[#D6DEE6] bg-white px-3 py-2 shadow-sm">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{label}</div>
              <div className={`mt-0.5 font-mono text-lg font-black ${cls}`}>{loading ? '—' : value}</div>
            </div>
          ))}
        </section>

        {/* Main planning workspace */}
        <section className="overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="border-b border-[#D6DEE6] px-3.5 py-2.5">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Weekly Schedule</h2>
                <p className="mt-0.5 text-[10px] text-[#718294]">Select a block to inspect its timing, departments, protection and MARS decision.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-[#718294]"><Filter className="h-3 w-3" /> Department</div>
                {DEPARTMENTS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedDept(item.id)} className={`rounded border px-2 py-1 text-[9px] font-bold ${selectedDept === item.id ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-[#D6DEE6] bg-[#F8FAFC] text-[#52606D] hover:bg-[#EEF2F5]'}`}>{item.label}</button>
                ))}
                <select aria-label="Track filter" value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)} className="ml-1 rounded border border-[#D6DEE6] bg-[#F8FAFC] px-2 py-1 text-[9px] font-bold text-[#52606D]">
                  <option value="ALL">All tracks</option>
                  {tracks.map((track) => <option key={track} value={track}>{track}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="border-b border-[#D6DEE6] bg-[#FAFBFC] px-3 py-1.5 text-[9px] text-[#718294]">
            <span className="font-bold text-[#52606D]">{filteredBlocks.length}</span> blocks shown • <span className="font-bold text-[#52606D]">{trains.length}</span> train movements protected • click any block for details
          </div>

          <div className="p-2.5">
            <UnifiedGantt
              blocks={filteredBlocks}
              trains={trains}
              onSelectBlock={openBlock}
              onBlockClick={openBlock}
              onSectionSelect={(sectionId) => {
                const matched = filteredBlocks.find((block) => block?.section_id === sectionId);
                if (matched) setSelectedBlock(matched);
              }}
              selectedBlockId={selectedBlock?.block_id}
              currentRole={currentRole}
              onOpenExplainability={openBlock}
            />
          </div>
        </section>

        {/* Small legend / navigation footer instead of another data-heavy register. */}
        <section className="flex flex-col gap-2 rounded-md border border-[#D6DEE6] bg-white px-3.5 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-semibold text-[#52606D]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#3B6EA5]" /> Engineering</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#2F8F6B]" /> S&T</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#C9842A]" /> Traction</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#6B5B95]" /> Shared</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-[#2F9E44]" /> Train protection active</span>
          </div>
          <div className="flex items-center gap-3 text-[9px] font-bold">
            <Link to="/corridor" className="text-[#1E3A5F] hover:text-[#2F6F7E]">Open Corridor View →</Link>
            <Link to="/monthly" className="text-[#1E3A5F] hover:text-[#2F6F7E]">Open Monthly Plan →</Link>
          </div>
        </section>
      </div>

      <ExplainabilityModal block={selectedBlock} isOpen={isExplainOpen} onClose={() => setIsExplainOpen(false)} />
    </main>
  );
}
