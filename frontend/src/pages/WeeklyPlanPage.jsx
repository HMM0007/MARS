/**
 * MARS 2.0 — Weekly Planning Console
 * The single authoritative detailed scheduling workspace for the Planner.
 * Gantt = when, register = exact block record, Corridor = where.
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronRight, Clock3, Filter, GitBranch, HelpCircle, Layers3, RefreshCw, ShieldCheck, SlidersHorizontal, TrainFront, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchCOATimetable, fetchWeeklyPlan } from '../services/api';
import UnifiedGantt from '../components/UnifiedGantt';
import ExplainabilityModal from '../components/ExplainabilityModal';
import PlannerRevisionReview from '../components/PlannerRevisionReview';

const deptStyles = {
  Engineering: 'border-[#3B6EA5]/30 bg-[#3B6EA5]/10 text-[#3B6EA5]',
  'S&T': 'border-[#2F8F6B]/30 bg-[#2F8F6B]/10 text-[#2F8F6B]',
  Traction: 'border-[#C9842A]/30 bg-[#C9842A]/10 text-[#A76614]',
};

const getBlocks = (plan) => plan?.blocks || plan?.scheduled_blocks || [];
const getDepartments = (block) => block?.departments || ['Engineering'];
const isConsolidated = (block) => Boolean(block?.is_consolidated || getDepartments(block).length > 1);

const WeeklyPlanPage = ({ currentRole }) => {
  const navigate = useNavigate();
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedTrack, setSelectedTrack] = useState('ALL');
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [weekly, timetable] = await Promise.all([
        fetchWeeklyPlan(),
        fetchCOATimetable().catch(() => []),
      ]);
      setWeeklyPlan(weekly);
      setTrains(Array.isArray(timetable) ? timetable : timetable?.timetable || []);
      const nextBlocks = getBlocks(weekly);
      setSelectedBlock((current) => current && nextBlocks.some((b) => b.block_id === current.block_id) ? current : nextBlocks[0] || null);
    } catch (err) {
      console.error('Failed to load weekly plan:', err);
      setError(err.message || 'Unable to load the weekly planning data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const blocks = getBlocks(weeklyPlan);
  const metrics = weeklyPlan?.metrics || weeklyPlan?.weekly_metrics || {};
  const filteredBlocks = useMemo(() => blocks.filter((block) => {
    const departments = getDepartments(block);
    const departmentMatch = selectedDept === 'ALL'
      ? true
      : selectedDept === 'CONSOLIDATED'
        ? isConsolidated(block)
        : departments.includes(selectedDept);
    const trackMatch = selectedTrack === 'ALL' || block?.track_id === selectedTrack;
    return departmentMatch && trackMatch;
  }), [blocks, selectedDept, selectedTrack]);

  const tracks = useMemo(() => Array.from(new Set(blocks.map((b) => b.track_id).filter(Boolean))).sort(), [blocks]);
  const consolidatedCount = blocks.filter(isConsolidated).length;
  const tsrCount = blocks.filter((b) => b?.tsr_recovery_profile).length;
  const conflicts = Number(metrics.active_conflicts ?? weeklyPlan?.compliance?.conflicts ?? 0);
  const riskCoverage = metrics.risk_coverage_percentage;
  const solverStatus = String(weeklyPlan?.solver_status || weeklyPlan?.status || '—').toUpperCase();
  const baseline = weeklyPlan?.baseline_governance?.mode === 'APPROVED_BASELINE'
    ? `R${weeklyPlan?.baseline_governance?.revision ?? weeklyPlan?.baseline_revision ?? '—'}`
    : weeklyPlan?.baseline_approved
      ? `R${weeklyPlan?.baseline_revision ?? '—'}`
      : 'CANDIDATE';

  const openBlock = (block) => {
    setSelectedBlock(block);
    setIsModalOpen(true);
  };

  return (
    <main className="min-h-full bg-[#F4F6F8] p-4 font-sans text-[#1F2933]">
      <div className="mx-auto max-w-[1700px] space-y-3">
        {/* Planner header */}
        <header className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#1E3A5F]" />
                <h1 className="text-lg font-black uppercase tracking-wide text-[#1E3A5F]">Weekly Plan</h1>
                <span className="rounded border border-[#1E3A5F]/20 bg-[#1E3A5F]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1E3A5F]">Tactical Planning</span>
                <span className="rounded border border-[#2F9E44]/20 bg-[#2F9E44]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#2F9E44]">Authoritative Workspace</span>
              </div>
              <p className="mt-1 text-[11px] text-[#52606D]">Pune Division (CR) • 7-day horizon • 15-minute planning grid • train movements protected by hard constraints</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[10px] font-bold uppercase ${conflicts ? 'border-[#C92A2A]/25 bg-[#C92A2A]/5 text-[#C92A2A]' : 'border-[#2F9E44]/20 bg-[#2F9E44]/5 text-[#2F9E44]'}`}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {conflicts ? `${conflicts} conflict${conflicts > 1 ? 's' : ''}` : 'Conflict free'}
              </div>
              <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#2F6F7E] disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing' : 'Refresh plan'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-[#D6DEE6] sm:grid-cols-4 lg:grid-cols-7">
            {[
              ['Baseline', baseline, 'text-[#1E3A5F]'],
              ['Solver', solverStatus, solverStatus === 'FEASIBLE' || solverStatus === 'OPTIMAL' ? 'text-[#2F9E44]' : 'text-[#52606D]'],
              ['Blocks', blocks.length, 'text-[#1E3A5F]'],
              ['Shared', consolidatedCount, 'text-[#6B5B95]'],
              ['TSR', tsrCount, 'text-[#A76614]'],
              ['COA movements', trains.length, 'text-[#B42318]'],
              ['Risk coverage', riskCoverage != null ? `${riskCoverage}%` : '—', 'text-[#2F9E44]'],
            ].map(([label, value, cls]) => (
              <div key={label} className="border-r border-b border-[#D6DEE6] px-3 py-2.5 last:border-r-0 lg:border-b-0">
                <div className="text-[8px] font-bold uppercase tracking-wider text-[#718294]">{label}</div>
                <div className={`mt-1 truncate font-mono text-[13px] font-black ${cls}`}>{loading ? '—' : value}</div>
              </div>
            ))}
          </div>
        </header>

        {error && <div className="rounded border border-[#C92A2A]/25 bg-[#C92A2A]/5 px-3 py-2 text-[11px] font-semibold text-[#C92A2A]">{error}</div>}

        {/* Revision review stays above the schedule because it is a planner decision, not another schedule view. */}
        <PlannerRevisionReview currentRole={currentRole} />

        {/* Planning controls */}
        <section className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-3 px-3.5 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#1E3A5F]" /><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Schedule View</h2></div>
              <p className="mt-0.5 text-[10px] text-[#718294]">Filter the unified plan without changing the approved schedule.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[9px] font-bold uppercase text-[#718294]"><Filter className="mr-1 inline h-3 w-3" />Department</span>
              {[
                ['ALL', 'All'],
                ['Engineering', 'Engineering'],
                ['S&T', 'S&T'],
                ['Traction', 'Traction'],
                ['CONSOLIDATED', 'Shared'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setSelectedDept(id)} className={`rounded border px-2.5 py-1.5 text-[9px] font-bold ${selectedDept === id ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-[#D6DEE6] bg-[#F8FAFC] text-[#52606D] hover:bg-[#EEF2F6]'}`}>{label}</button>
              ))}
              <span className="ml-2 hidden text-[#D6DEE6] lg:inline">|</span>
              <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-[#718294]">
                Track
                <select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)} className="rounded border border-[#D6DEE6] bg-[#F8FAFC] px-2 py-1.5 font-mono text-[9px] font-semibold text-[#1F2933] outline-none">
                  <option value="ALL">All corridor</option>
                  {tracks.map((track) => <option key={track} value={track}>{track}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#D6DEE6] bg-[#FAFBFC] px-3.5 py-2 text-[9px] text-[#52606D]">
            <span className="font-bold uppercase text-[#718294]">Legend</span>
            <span><b className="text-[#3B6EA5]">Engineering</b> · Civil / track</span>
            <span><b className="text-[#2F8F6B]">S&T</b> · Signals / telecom</span>
            <span><b className="text-[#A76614]">Traction</b> · OHE / power</span>
            <span><b className="text-[#6B5B95]">Shared</b> · coordinated possession</span>
            <span><b className="text-[#B42318]">Train</b> · protected movement</span>
          </div>
        </section>

        {/* The one and only detailed Gantt in the application */}
        <section className="overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#D6DEE6] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-[#1E3A5F]" /><h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Unified Weekly Schedule</h2></div>
              <p className="mt-0.5 text-[10px] text-[#718294]">Engineering + S&T + Traction • click a block to inspect its planning rationale</p>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold uppercase text-[#718294]">
              <span className="font-mono text-[#1E3A5F]">{filteredBlocks.length} / {blocks.length} blocks</span>
              <button type="button" onClick={() => navigate('/corridor')} className="inline-flex items-center gap-1 text-[#1E3A5F] hover:text-[#2F6F7E]">View corridor <ChevronRight className="h-3 w-3" /></button>
            </div>
          </div>
          <div className="p-2">
            <UnifiedGantt
              blocks={filteredBlocks}
              trains={trains}
              onSelectBlock={openBlock}
              onBlockClick={openBlock}
              onSectionSelect={(sectionId) => {
                const matched = filteredBlocks.find((block) => block.section_id === sectionId);
                if (matched) setSelectedBlock(matched);
              }}
              selectedBlockId={selectedBlock?.block_id}
              currentRole={currentRole}
              onOpenExplainability={openBlock}
            />
          </div>
        </section>

        {/* Exact block register: searchable-by-eye record beneath the visual schedule. */}
        <section className="overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#D6DEE6] bg-[#FAFBFC] px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-[#1E3A5F]" /><div><h2 className="text-xs font-black uppercase tracking-wider text-[#1E3A5F]">Block Register</h2><p className="text-[9px] text-[#718294]">Exact scheduled possessions represented above</p></div></div>
            <span className="rounded border border-[#D6DEE6] bg-white px-2 py-1 font-mono text-[9px] font-bold text-[#52606D]">{filteredBlocks.length} MATCHED</span>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-[#D6DEE6] bg-[#F4F6F8] text-[8px] font-bold uppercase tracking-wider text-[#718294]">
                <tr><th className="px-3 py-2">Block</th><th className="px-3 py-2">Section / Track</th><th className="px-3 py-2">Start</th><th className="px-3 py-2">End</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Department</th><th className="px-3 py-2">Protection</th><th className="px-3 py-2">Audit</th></tr>
              </thead>
              <tbody className="divide-y divide-[#E5EAF0]">
                {filteredBlocks.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-[10px] text-[#718294]">No blocks match the selected view.</td></tr>
                ) : filteredBlocks.map((block) => {
                  const departments = getDepartments(block);
                  return (
                    <tr key={block.block_id} onClick={() => openBlock(block)} className={`cursor-pointer hover:bg-[#F8FAFC] ${selectedBlock?.block_id === block.block_id ? 'bg-[#F4F8FB]' : ''}`}>
                      <td className="px-3 py-2 font-mono text-[9px] font-black text-[#1E3A5F]">{block.block_id || '—'}</td>
                      <td className="px-3 py-2"><div className="font-semibold text-[9px] text-[#1F2933]">{block.section_id || '—'}</div><div className="font-mono text-[8px] text-[#718294]">{block.track_id || '—'}</div></td>
                      <td className="px-3 py-2 font-mono text-[9px] text-[#1F2933]">{String(block.start_time || '—').replace('T', ' ')}</td>
                      <td className="px-3 py-2 font-mono text-[9px] text-[#1F2933]">{String(block.end_time || '—').replace('T', ' ')}</td>
                      <td className="px-3 py-2 font-mono text-[9px] font-bold">{block.duration_hours ?? '—'}h</td>
                      <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{departments.map((department) => <span key={department} className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${deptStyles[department] || 'border-[#D6DEE6] bg-[#F4F6F8] text-[#52606D]'}`}>{department}</span>)}{isConsolidated(block) && <span className="rounded bg-[#6B5B95]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#6B5B95]">SHARED</span>}</div></td>
                      <td className="px-3 py-2"><div className="flex items-center gap-1 text-[8px] font-bold">{block.tsr_recovery_profile ? <span className="rounded bg-[#C9842A]/10 px-1.5 py-1 text-[#A76614]">TSR</span> : <span className="text-[#718294]">Standard</span>}{block.power_block_required && <span className="rounded bg-[#B42318]/10 px-1.5 py-1 text-[#B42318]">POWER</span>}</div></td>
                      <td className="px-3 py-2"><button type="button" onClick={(event) => { event.stopPropagation(); openBlock(block); }} className="inline-flex items-center gap-1 rounded border border-[#1E3A5F]/20 bg-[#1E3A5F]/5 px-2 py-1 text-[8px] font-bold text-[#1E3A5F] hover:bg-[#1E3A5F]/10"><HelpCircle className="h-3 w-3" /> Why?</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Planner orientation strip */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3 shadow-sm"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#1E3A5F]" /><div><div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">When?</div><div className="text-[11px] font-black text-[#1E3A5F]">Weekly Plan</div></div></div><p className="mt-2 text-[9px] leading-relaxed text-[#52606D]">Detailed timing, train protection, dependencies and block sequencing are managed here.</p></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3 shadow-sm"><div className="flex items-center gap-2"><TrainFront className="h-4 w-4 text-[#B42318]" /><div><div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">Where?</div><button type="button" onClick={() => navigate('/corridor')} className="text-[11px] font-black text-[#1E3A5F] hover:text-[#2F6F7E]">Corridor View →</button></div></div><p className="mt-2 text-[9px] leading-relaxed text-[#52606D]">Use the corridor workspace for geographic context and Map ↔ Gantt interaction.</p></div>
          <div className="rounded-md border border-[#D6DEE6] bg-white p-3 shadow-sm"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-[#6B5B95]" /><div><div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">Coordinate</div><div className="text-[11px] font-black text-[#1E3A5F]">Shared Possessions</div></div></div><p className="mt-2 text-[9px] leading-relaxed text-[#52606D]">Purple/shared blocks identify coordinated Engineering, S&T and Traction work in one possession.</p></div>
        </section>
      </div>

      <ExplainabilityModal block={selectedBlock} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  );
};

export default WeeklyPlanPage;
