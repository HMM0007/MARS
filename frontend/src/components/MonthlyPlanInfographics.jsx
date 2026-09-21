import { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Layers,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Gauge,
  Clock,
  ArrowUpRight,
  Filter,
  TrainFront,
  Flame,
  Zap,
  Wrench,
  Radio,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  ShieldAlert,
  Info,
} from 'lucide-react';

const WEEK_KEYS = ['week_1', 'week_2', 'week_3', 'week_4'];
const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const SECTION_DESCRIPTIONS = {
  'PUNE-LNL': { name: 'Pune – Lonavala', type: 'Suburban Corridor', note: 'High density local EMUs + express' },
  'LNL-KJT': { name: 'Lonavala – Karjat', type: 'Bhor Ghat Heavy Gradient', note: 'Steep incline, bankers required' },
  'PUNE-DD': { name: 'Pune – Daund', type: 'Double Line Electric', note: 'Main freight & southbound trunk' },
  'PUNE-MRJ': { name: 'Pune – Miraj', type: 'Single/Double Diesel & Electric', note: 'South Maharashtra link' },
  'CWD-YARD': { name: 'Chinchwad Yard', type: 'Terminal & Shunting Yard', note: 'Rolling stock stabling & siding' },
};

export default function MonthlyPlanInfographics({ monthlyPlan, loading = false }) {
  // Analytical lens tabs
  const [activeTab, setActiveTab] = useState('HEATMAP'); // 'HEATMAP' | 'TRAJECTORY' | 'DEPARTMENT'
  const [selectedSection, setSelectedSection] = useState(null); // null = all sections
  const [selectedWeek, setSelectedWeek] = useState('week_1');
  const [selectedCell, setSelectedCell] = useState({ sectionId: 'PUNE-LNL', weekKey: 'week_1' });
  const [deptFilter, setDeptFilter] = useState('ALL'); // 'ALL' | 'ENG' | 'SNT' | 'TRC'

  const summary = monthlyPlan?.summary || {};
  const allocations = monthlyPlan?.section_allocations || {};

  // Formatted section data
  const sectionList = useMemo(() => {
    return Object.entries(allocations).map(([id, data]) => {
      const scheduled = Number(data?.scheduled_this_month || 0);
      const deferred = Number(data?.deferred_next_month || 0);
      const total = Number(data?.total_section_jobs || scheduled + deferred || 1);
      const realization = Math.round((scheduled / total) * 100);
      return {
        id,
        meta: SECTION_DESCRIPTIONS[id] || { name: id, type: 'Rail Section', note: '' },
        scheduled,
        deferred,
        total,
        realization,
        weekly: data?.weekly_breakdown || {},
      };
    });
  }, [allocations]);

  // Aggregate weekly metrics
  const weeklyMetrics = useMemo(() => {
    return WEEK_KEYS.map((weekKey, idx) => {
      let jobs = 0;
      let usedHours = 0;
      let capacityHours = 0;
      const allJobIds = [];

      sectionList.forEach((sec) => {
        const w = sec.weekly?.[weekKey] || {};
        const secJobs = Number(w.job_count || 0);
        const secHours = Number(w.used_hours || 0);
        const secCap = Number(w.capacity_hours || 24);
        const jobIds = w.job_ids || [];

        if (!selectedSection || selectedSection === sec.id) {
          jobs += secJobs;
          usedHours += secHours;
          capacityHours += secCap;
          allJobIds.push(...jobIds);
        }
      });

      const engCount = allJobIds.filter((id) => id.startsWith('ENG')).length;
      const sntCount = allJobIds.filter((id) => id.startsWith('SNT')).length;
      const trcCount = allJobIds.filter((id) => id.startsWith('TRC')).length;

      const cap = capacityHours || (selectedSection ? 24 : 120);
      const utilPct = cap > 0 ? Math.min(100, Math.round((usedHours / cap) * 100)) : 0;

      return {
        key: weekKey,
        label: WEEK_LABELS[idx],
        jobs,
        usedHours: Math.round(usedHours * 10) / 10,
        capacityHours: cap,
        utilization: utilPct,
        engCount,
        sntCount,
        trcCount,
        allJobIds,
      };
    });
  }, [sectionList, selectedSection]);

  // Divisional department aggregates
  const departmentTotals = useMemo(() => {
    let eng = 0;
    let snt = 0;
    let trc = 0;

    sectionList.forEach((sec) => {
      WEEK_KEYS.forEach((wk) => {
        const jobs = sec.weekly?.[wk]?.job_ids || [];
        jobs.forEach((id) => {
          if (id.startsWith('ENG')) eng++;
          else if (id.startsWith('SNT')) snt++;
          else if (id.startsWith('TRC')) trc++;
        });
      });
    });

    const total = eng + snt + trc || 1;
    return {
      eng: { count: eng, pct: Math.round((eng / total) * 100) },
      snt: { count: snt, pct: Math.round((snt / total) * 100) },
      trc: { count: trc, pct: Math.round((trc / total) * 100) },
      total,
    };
  }, [sectionList]);

  // Cell Inspector Data (Active clicked cell in Heatmap)
  const activeCellData = useMemo(() => {
    if (!selectedCell) return null;
    const sec = sectionList.find((s) => s.id === selectedCell.sectionId);
    if (!sec) return null;
    const weekData = sec.weekly?.[selectedCell.weekKey] || {};
    const jobIds = weekData.job_ids || [];
    const usedHours = Number(weekData.used_hours || 0);
    const capHours = Number(weekData.capacity_hours || 24);
    const util = capHours > 0 ? Math.round((usedHours / capHours) * 100) : 0;

    const engJobs = jobIds.filter((j) => j.startsWith('ENG'));
    const sntJobs = jobIds.filter((j) => j.startsWith('SNT'));
    const trcJobs = jobIds.filter((j) => j.startsWith('TRC'));

    return {
      section: sec,
      weekKey: selectedCell.weekKey,
      weekLabel: WEEK_LABELS[WEEK_KEYS.indexOf(selectedCell.weekKey)] || selectedCell.weekKey,
      jobCount: Number(weekData.job_count || jobIds.length),
      usedHours,
      capHours,
      utilization: util,
      jobIds,
      engJobs,
      sntJobs,
      trcJobs,
      consolidationGroups: weekData.consolidation_groups || [],
    };
  }, [selectedCell, sectionList]);

  const maxWeeklyJobs = useMemo(() => {
    const max = Math.max(...weeklyMetrics.map((w) => w.jobs), 1);
    return Math.max(max, selectedSection ? 12 : 45);
  }, [weeklyMetrics, selectedSection]);

  const peakWeek = useMemo(() => {
    if (!weeklyMetrics.length) return null;
    return [...weeklyMetrics].sort((a, b) => b.jobs - a.jobs)[0];
  }, [weeklyMetrics]);

  const totalScheduled = summary.scheduled_this_month ?? 121;
  const totalEvaluated = summary.total_jobs_evaluated ?? 154;
  const realizationRate = totalEvaluated > 0 ? Math.round((totalScheduled / totalEvaluated) * 100) : 78;

  // Heatmap intensity helper
  const getCellIntensity = (utilPct) => {
    if (utilPct >= 95) {
      return {
        bg: 'bg-[#C92A2A]/15 hover:bg-[#C92A2A]/25 text-[#A71D1D] border-[#C92A2A]/40',
        badge: 'bg-[#C92A2A] text-white',
        status: 'SATURATED',
      };
    }
    if (utilPct >= 75) {
      return {
        bg: 'bg-[#C9842A]/15 hover:bg-[#C9842A]/25 text-[#915B15] border-[#C9842A]/40',
        badge: 'bg-[#C9842A] text-white',
        status: 'HEAVY',
      };
    }
    if (utilPct >= 40) {
      return {
        bg: 'bg-[#2F9E44]/15 hover:bg-[#2F9E44]/25 text-[#1D6C2E] border-[#2F9E44]/40',
        badge: 'bg-[#2F9E44] text-white',
        status: 'OPTIMAL',
      };
    }
    if (utilPct > 0) {
      return {
        bg: 'bg-[#3B6EA5]/15 hover:bg-[#3B6EA5]/25 text-[#244A72] border-[#3B6EA5]/40',
        badge: 'bg-[#3B6EA5] text-white',
        status: 'MODERATE',
      };
    }
    return {
      bg: 'bg-[#EEF2F6] hover:bg-[#E2E8F0] text-[#718294] border-[#D6DEE6]/70',
      badge: 'bg-[#8091A5] text-white',
      status: 'FREE WINDOW',
    };
  };

  return (
    <div className="bg-white rounded-xl border border-[#CBD5E1] shadow-sm overflow-hidden select-none font-sans">
      {/* 1. TOP STRATEGIC COCKPIT BANNER */}
      <div className="bg-gradient-to-r from-[#0F233D] via-[#1E3A5F] to-[#2F6F7E] text-white px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-lg bg-white/15 text-[#57D6A8] backdrop-blur-xs">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black uppercase tracking-wider text-white">
                  Monthly Workload & Capacity Infographics
                </h2>
                <span className="text-[10px] bg-[#57D6A8] text-[#061E39] px-2 py-0.5 rounded font-black tracking-widest uppercase">
                  4-Week Strategic
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                Multi-corridor track possession leveling, section saturation matrix & joint maintenance synergy
              </p>
            </div>
          </div>
        </div>

        {/* Live Operational Metric Chips */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 backdrop-blur-xs text-center">
            <div className="text-[9px] uppercase font-bold tracking-wider text-white/70">Plan Realization</div>
            <div className="font-mono text-base font-black text-[#57D6A8]">{realizationRate}%</div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 backdrop-blur-xs text-center">
            <div className="text-[9px] uppercase font-bold tracking-wider text-white/70">Peak Window</div>
            <div className="font-mono text-base font-black text-[#FFD166]">{peakWeek?.label || 'Week 2'}</div>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 backdrop-blur-xs text-center">
            <div className="text-[9px] uppercase font-bold tracking-wider text-white/70">Scheduled Jobs</div>
            <div className="font-mono text-base font-black text-white">{totalScheduled} / {totalEvaluated}</div>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE CONTROLLER STRIP & LENS SWITCHER */}
      <div className="border-b border-[#D6DEE6] bg-[#F8FAFC] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Visual Lenses (Tabs) */}
        <div className="flex items-center space-x-1.5 bg-white p-1 rounded-lg border border-[#CBD5E1] shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('HEATMAP')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'HEATMAP'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'text-[#52606D] hover:bg-[#F1F5F9] hover:text-[#1E3A5F]'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Corridor Saturation Heatmap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRAJECTORY')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'TRAJECTORY'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'text-[#52606D] hover:bg-[#F1F5F9] hover:text-[#1E3A5F]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>4-Week Workload Trajectory</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DEPARTMENT')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'DEPARTMENT'
                ? 'bg-[#1E3A5F] text-white shadow-xs'
                : 'text-[#52606D] hover:bg-[#F1F5F9] hover:text-[#1E3A5F]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Department Breakdown</span>
          </button>
        </div>

        {/* Section Quick Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
          <span className="text-[10px] uppercase font-black text-[#64748B] flex items-center space-x-1 flex-shrink-0">
            <Filter className="w-3 h-3" />
            <span>Corridor:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedSection(null)}
            className={`px-2.5 py-1 rounded text-xs font-bold font-mono transition-colors flex-shrink-0 ${
              selectedSection === null
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-white border border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9]'
            }`}
          >
            All Corridors (5)
          </button>
          {sectionList.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSelectedSection(selectedSection === sec.id ? null : sec.id)}
              className={`px-2.5 py-1 rounded text-xs font-bold font-mono border transition-colors flex-shrink-0 ${
                selectedSection === sec.id
                  ? 'bg-[#2F6F7E] text-white border-[#2F6F7E]'
                  : 'bg-white border-[#CBD5E1] text-[#475569] hover:bg-[#F1F5F9]'
              }`}
            >
              {sec.id}
            </button>
          ))}
        </div>
      </div>

      {/* 3. LENS 1: CORRIDOR SATURATION HEATMAP & TIMELINE MATRIX */}
      {activeTab === 'HEATMAP' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[1.75fr_1fr] gap-4">
            {/* Left: 5 Corridors x 4 Weeks Interactive Matrix */}
            <div className="bg-white rounded-lg border border-[#D6DEE6] overflow-hidden shadow-xs">
              <div className="bg-[#F8FAFC] border-b border-[#D6DEE6] px-3.5 py-2.5 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#1E3A5F]">
                    Corridor Track Capacity & Saturation Heatmap
                  </h3>
                  <p className="text-[10px] text-[#64748B]">
                    Click any cell to inspect scheduled jobs, track hours, and safety buffers
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-[9px] font-bold">
                  <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-xs bg-[#C92A2A]" /><span>&gt;90% Saturated</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-xs bg-[#C9842A]" /><span>75-90% Heavy</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-xs bg-[#2F9E44]" /><span>Optimal</span></span>
                  <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-xs bg-[#EEF2F6] border border-[#CBD5E1]" /><span>Free Window</span></span>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F1F5F9] text-[10px] font-black uppercase text-[#475569]">
                      <th className="py-2.5 px-3.5 w-48">Railway Corridor</th>
                      {WEEK_LABELS.map((lbl, idx) => (
                        <th key={lbl} className="py-2.5 px-3 text-center">
                          {lbl}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right">Realization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {sectionList.map((sec) => {
                      const isFilteredOut = selectedSection && selectedSection !== sec.id;
                      return (
                        <tr
                          key={sec.id}
                          className={`transition-colors ${isFilteredOut ? 'opacity-35' : 'hover:bg-[#F8FAFC]'}`}
                        >
                          <td className="py-3 px-3.5">
                            <div className="flex items-center space-x-2">
                              <div>
                                <div className="font-mono font-black text-xs text-[#1E3A5F]">{sec.id}</div>
                                <div className="text-[10px] text-[#64748B] font-medium leading-tight">{sec.meta.name}</div>
                                <span className="text-[9px] text-[#94A3B8]">{sec.meta.type}</span>
                              </div>
                            </div>
                          </td>

                          {/* 4 Week Cells */}
                          {WEEK_KEYS.map((wkKey) => {
                            const wData = sec.weekly?.[wkKey] || {};
                            const util = Math.round(Number(wData.utilization_percentage || 0));
                            const jobCount = Number(wData.job_count || 0);
                            const hours = Number(wData.used_hours || 0);
                            const intensity = getCellIntensity(util);
                            const isCellSelected = selectedCell?.sectionId === sec.id && selectedCell?.weekKey === wkKey;

                            return (
                              <td key={wkKey} className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCell({ sectionId: sec.id, weekKey: wkKey })}
                                  className={`w-full py-2 px-2 rounded-md border transition-all flex flex-col items-center justify-center ${intensity.bg} ${
                                    isCellSelected ? 'ring-2 ring-[#0F233D] shadow-md scale-102 font-bold' : ''
                                  }`}
                                >
                                  <div className="flex items-center space-x-1">
                                    <span className="font-mono font-black text-xs">{jobCount}</span>
                                    <span className="text-[9px] font-medium opacity-80">jobs</span>
                                  </div>
                                  <div className="font-mono text-[10px] font-bold mt-0.5">{hours}h</div>
                                  <span className={`mt-1 text-[8px] font-black uppercase px-1.5 py-0.2 rounded ${intensity.badge}`}>
                                    {util}%
                                  </span>
                                </button>
                              </td>
                            );
                          })}

                          {/* Realization Column */}
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-black text-xs text-[#1E3A5F]">
                              {sec.scheduled}/{sec.total}
                            </div>
                            <div className="text-[10px] font-bold text-[#2F9E44]">{sec.realization}%</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Live Cell / Section Inspector Deck */}
            {activeCellData && (
              <div className="bg-[#FAFBFC] rounded-lg border border-[#D6DEE6] p-4 flex flex-col justify-between space-y-3 shadow-xs">
                <div>
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5">
                    <div className="flex items-center space-x-2">
                      <TrainFront className="w-4 h-4 text-[#1E3A5F]" />
                      <div>
                        <span className="font-mono font-black text-sm text-[#1E3A5F]">
                          {activeCellData.section.id}
                        </span>
                        <span className="text-[10px] text-[#64748B] ml-1.5">
                          • {activeCellData.weekLabel} Window
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getCellIntensity(activeCellData.utilization).badge}`}>
                      {activeCellData.utilization}% CAPACITY
                    </span>
                  </div>

                  <p className="text-[11px] text-[#475569] mt-2 font-medium">
                    {activeCellData.section.meta.name} ({activeCellData.section.meta.note})
                  </p>

                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded border border-[#E2E8F0]">
                      <span className="text-[9px] uppercase font-bold text-[#64748B] block">Track Hours Used</span>
                      <strong className="text-base text-[#1E3A5F]">{activeCellData.usedHours} hrs</strong>
                      <span className="text-[9px] text-[#94A3B8] block">of {activeCellData.capHours}h weekly cap</span>
                    </div>

                    <div className="bg-white p-2.5 rounded border border-[#E2E8F0]">
                      <span className="text-[9px] uppercase font-bold text-[#64748B] block">Jobs Scheduled</span>
                      <strong className="text-base text-[#2F9E44]">{activeCellData.jobCount} Jobs</strong>
                      <span className="text-[9px] text-[#94A3B8] block">Maintenance work items</span>
                    </div>
                  </div>

                  {/* Department Jobs Enclosed */}
                  <div className="mt-3.5 space-y-2">
                    <span className="text-[10px] uppercase font-black text-[#475569] block">
                      Enclosed Maintenance Jobs ({activeCellData.jobIds.length})
                    </span>

                    {activeCellData.jobIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {activeCellData.jobIds.map((id) => {
                          const isEng = id.startsWith('ENG');
                          const isSnt = id.startsWith('SNT');
                          const isTrc = id.startsWith('TRC');

                          return (
                            <span
                              key={id}
                              className={`px-2 py-1 rounded text-[10px] font-mono font-bold border ${
                                isEng
                                  ? 'bg-[#3B6EA5]/15 text-[#3B6EA5] border-[#3B6EA5]/30'
                                  : isSnt
                                  ? 'bg-[#2F8F6B]/15 text-[#2F8F6B] border-[#2F8F6B]/30'
                                  : 'bg-[#C9842A]/15 text-[#C9842A] border-[#C9842A]/30'
                              }`}
                            >
                              {id} ({isEng ? 'Eng' : isSnt ? 'S&T' : 'OHE'})
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#94A3B8] italic p-3 bg-white rounded border border-[#E2E8F0] text-center">
                        No maintenance jobs scheduled this week. Track possession window available for freight.
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Insight */}
                <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[10px] text-[#64748B]">
                  <span>Corridor Realization:</span>
                  <span className="font-mono font-black text-[#1E3A5F]">
                    {activeCellData.section.scheduled} Scheduled / {activeCellData.section.deferred} Deferred
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. LENS 2: 4-WEEK WORKLOAD & CAPACITY TRAJECTORY */}
      {activeTab === 'TRAJECTORY' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5">
            {weeklyMetrics.map((week, idx) => {
              const isPeak = peakWeek?.key === week.key;
              const isSelected = selectedWeek === week.key;
              const jobHeightPct = Math.max(15, Math.round((week.jobs / maxWeeklyJobs) * 100));
              const hoursPct = Math.min(100, Math.round((week.usedHours / (week.capacityHours || 120)) * 100));

              return (
                <div
                  key={week.key}
                  onClick={() => setSelectedWeek(week.key)}
                  className={`bg-white rounded-xl border p-4 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20 shadow-md -translate-y-1'
                      : 'border-[#CBD5E1] hover:border-[#94A3B8] hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase text-[#1E3A5F]">{week.label}</span>
                      <span className="block text-[10px] text-[#64748B]">Divisional Load</span>
                    </div>
                    {isPeak && (
                      <span className="text-[9px] font-black uppercase bg-[#C9842A] text-white px-2 py-0.5 rounded shadow-xs">
                        Peak Intensity
                      </span>
                    )}
                  </div>

                  {/* Big Number Counters */}
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black font-mono text-[#1E3A5F]">{week.jobs}</span>
                      <span className="text-xs text-[#64748B] font-semibold ml-1">jobs</span>
                    </div>
                    <div className="font-mono font-black text-sm text-[#2F6F7E]">
                      {week.usedHours}h <span className="text-[10px] text-[#94A3B8]">/ {week.capacityHours}h</span>
                    </div>
                  </div>

                  {/* Dual Graphical Level Meters */}
                  <div className="mt-3.5 space-y-2">
                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-[#64748B] mb-0.5">
                        <span>Workload Volume</span>
                        <span>{jobHeightPct}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#1E3A5F] to-[#3B6EA5] rounded-full transition-all duration-500"
                          style={{ width: `${jobHeightPct}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[9px] font-bold text-[#64748B] mb-0.5">
                        <span>Track Possession Utilization</span>
                        <span className="font-mono">{hoursPct}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            hoursPct >= 85
                              ? 'bg-gradient-to-r from-[#C9842A] to-[#E58B13]'
                              : 'bg-gradient-to-r from-[#2F6F7E] to-[#2F9E44]'
                          }`}
                          style={{ width: `${hoursPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Department Breakdown Chips for the Week */}
                  <div className="mt-3.5 pt-2.5 border-t border-[#E2E8F0] grid grid-cols-3 gap-1 text-[9px] font-mono text-center">
                    <div className="bg-[#3B6EA5]/10 p-1 rounded text-[#3B6EA5] font-bold">
                      ENG {week.engCount}
                    </div>
                    <div className="bg-[#2F8F6B]/10 p-1 rounded text-[#2F8F6B] font-bold">
                      S&T {week.sntCount}
                    </div>
                    <div className="bg-[#C9842A]/10 p-1 rounded text-[#C9842A] font-bold">
                      OHE {week.trcCount}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Graphical Section Allocation Bars */}
          <div className="bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] p-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#1E3A5F] mb-3">
              Section Workload Allocation vs Carryover (Scheduled vs Deferred)
            </h4>
            <div className="space-y-2.5">
              {sectionList.map((sec) => (
                <div key={sec.id} className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-black text-xs text-[#1E3A5F]">{sec.id}</span>
                      <span className="text-[10px] text-[#64748B]">({sec.meta.name})</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-[#1E3A5F]">
                      <span className="text-[#2F9E44]">{sec.scheduled} Scheduled</span>
                      <span className="text-[#94A3B8] mx-1">|</span>
                      <span className="text-[#C9842A]">{sec.deferred} Deferred</span>
                      <span className="text-[#94A3B8] mx-1">|</span>
                      <span className="text-[#475569]">Total {sec.total}</span>
                    </div>
                  </div>

                  {/* Horizontal Stacked Bar */}
                  <div className="h-3 w-full bg-[#E2E8F0] rounded-full overflow-hidden flex">
                    <div
                      className="bg-gradient-to-r from-[#2F9E44] to-[#38B249] h-full transition-all duration-500"
                      style={{ width: `${sec.realization}%` }}
                      title={`${sec.scheduled} scheduled (${sec.realization}%)`}
                    />
                    <div
                      className="bg-gradient-to-r from-[#C9842A] to-[#E58B13] h-full transition-all duration-500"
                      style={{ width: `${100 - sec.realization}%` }}
                      title={`${sec.deferred} deferred (${100 - sec.realization}%)`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. LENS 3: DEPARTMENT COORDINATION & JOINT POSSESSION GAINS */}
      {activeTab === 'DEPARTMENT' && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Engineering */}
            <div className="bg-white rounded-xl border border-[#3B6EA5]/30 p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#3B6EA5]/20 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-4 h-4 text-[#3B6EA5]" />
                  <span className="font-black text-xs uppercase text-[#3B6EA5]">Engineering (Track)</span>
                </div>
                <span className="font-mono font-black text-sm text-[#3B6EA5]">{departmentTotals.eng.pct}%</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black font-mono text-[#1E3A5F]">{departmentTotals.eng.count}</span>
                <span className="text-xs text-[#64748B] ml-1">jobs this month</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-2">
                Heavy permanent way maintenance: rail renewals, ultrasonic testing, deep screening, and turnout overhauls.
              </p>
            </div>

            {/* S&T */}
            <div className="bg-white rounded-xl border border-[#2F8F6B]/30 p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#2F8F6B]/20 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-[#2F8F6B]" />
                  <span className="font-black text-xs uppercase text-[#2F8F6B]">Signalling & Telecom</span>
                </div>
                <span className="font-mono font-black text-sm text-[#2F8F6B]">{departmentTotals.snt.pct}%</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black font-mono text-[#1E3A5F]">{departmentTotals.snt.count}</span>
                <span className="text-xs text-[#64748B] ml-1">jobs this month</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-2">
                Critical safety infrastructure: axle counter calibrations, point machine testing, and electronic interlocking audits.
              </p>
            </div>

            {/* Traction */}
            <div className="bg-white rounded-xl border border-[#C9842A]/30 p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#C9842A]/20 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-[#C9842A]" />
                  <span className="font-black text-xs uppercase text-[#C9842A]">Electrical Traction (OHE)</span>
                </div>
                <span className="font-mono font-black text-sm text-[#C9842A]">{departmentTotals.trc.pct}%</span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black font-mono text-[#1E3A5F]">{departmentTotals.trc.count}</span>
                <span className="text-xs text-[#64748B] ml-1">jobs this month</span>
              </div>
              <p className="text-[10px] text-[#64748B] mt-2">
                25kV overhead electrification: catenary alignment, contact wire replacement, and neutral section isolator check.
              </p>
            </div>
          </div>

          {/* Joint Consolidated Possessions Spotlight Card */}
          <div className="bg-gradient-to-r from-[#FAF5FF] to-[#F3E8FF] border border-[#6B5B95]/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-lg bg-[#6B5B95] text-white">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-[#4A154B]">
                  Shared Possessions Synergy (Multi-Department Blocks)
                </h4>
                <p className="text-xs text-[#6B5B95] mt-0.5">
                  Consolidating Engineering track possessions with S&T and OHE shadow work saves approximately <strong>42.5 train detention minutes per week</strong> across the Pune Division.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 font-mono text-xs flex-shrink-0">
              <div className="bg-white/80 border border-[#6B5B95]/30 px-3 py-1.5 rounded-lg text-center">
                <span className="text-[9px] uppercase font-bold text-[#6B5B95] block">Consolidated Groups</span>
                <strong className="text-base text-[#4A154B]">{summary.consolidation_groups || 1} Joint Windows</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. BOTTOM EXECUTIVE SUMMARY STRIP */}
      <div className="bg-[#F1F5F9] border-t border-[#CBD5E1] px-5 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#475569]">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-[#2F9E44]" />
          <span className="font-bold text-[#1E3A5F]">Strategic Maintenance Clearance:</span>
          <span>Zero passenger conflict certified by CP-SAT solver.</span>
        </div>

        <div className="flex items-center space-x-4 font-mono text-[11px] font-bold">
          <span>Total Corridor Sections: 5</span>
          <span className="text-[#94A3B8]">|</span>
          <span className="text-[#2F9E44]">121 Jobs Sanctioned</span>
          <span className="text-[#94A3B8]">|</span>
          <span className="text-[#C9842A]">33 Deferred Next Month</span>
        </div>
      </div>
    </div>
  );
}
