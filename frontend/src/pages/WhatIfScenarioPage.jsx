import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CloudRain,
  Copy,
  ExternalLink,
  Filter,
  GitBranch,
  Info,
  Loader2,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrainFront,
  Truck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchApprovedWeeklyPlan,
  fetchWhatIfOptions,
  promoteWhatIfScenario,
  simulateWhatIf,
} from '../services/api';

const SCENARIO_LABELS = {
  TRACK_OUTAGE: 'Track Outage (Single Track)',
  SECTION_OUTAGE: 'Section Outage (All Tracks)',
  EMERGENCY_BLOCK: 'Emergency Maintenance Block',
  FREIGHT_SURGE: 'Freight Traffic Surge (+%)',
  MONSOON_SLOWDOWN: 'Monsoon Weather Slowdown (TSR)',
};

const SEVERITY_CONFIG = {
  LOW: {
    badge: 'bg-[#2F9E44]/15 text-[#2F9E44] border-[#2F9E44]/30',
    dot: 'bg-[#2F9E44]',
    label: 'Low Operational Impact',
  },
  MODERATE: {
    badge: 'bg-[#2F6F7E]/15 text-[#2F6F7E] border-[#2F6F7E]/30',
    dot: 'bg-[#2F6F7E]',
    label: 'Moderate Shift Required',
  },
  HIGH: {
    badge: 'bg-[#F08C00]/15 text-[#A76614] border-[#F08C00]/30',
    dot: 'bg-[#F08C00]',
    label: 'High Schedule Disruption',
  },
  CRITICAL: {
    badge: 'bg-[#C92A2A]/15 text-[#C92A2A] border-[#C92A2A]/30',
    dot: 'bg-[#C92A2A]',
    label: 'Severe Disruption & Deferral',
  },
};

const WEEK_DAYS = [
  { day: 'Mon', date: '2026-09-07', label: 'Mon, 07 Sept' },
  { day: 'Tue', date: '2026-09-08', label: 'Tue, 08 Sept' },
  { day: 'Wed', date: '2026-09-09', label: 'Wed, 09 Sept' },
  { day: 'Thu', date: '2026-09-10', label: 'Thu, 10 Sept' },
  { day: 'Fri', date: '2026-09-11', label: 'Fri, 11 Sept' },
  { day: 'Sat', date: '2026-09-12', label: 'Sat, 12 Sept' },
  { day: 'Sun', date: '2026-09-13', label: 'Sun, 13 Sept' },
];

const TIME_SHIFTS = [
  { label: 'Morning Peak', time: '07:30', desc: '07:30 AM (High passenger commuter load)' },
  { label: 'Midday Window', time: '11:30', desc: '11:30 AM (Inter-city express slots)' },
  { label: 'Evening Peak', time: '17:00', desc: '05:00 PM (Return rush & goods traffic)' },
  { label: 'Night Possessions', time: '01:00', desc: '01:00 AM (Primary maintenance window)' },
];

export default function WhatIfScenarioPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState({ scenario_types: [], sections: [], presets: [] });
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState('');

  // Active scenario inputs
  const [selectedPresetId, setSelectedPresetId] = useState('CUSTOM');
  const [scenarioType, setScenarioType] = useState('EMERGENCY_BLOCK');
  const [sectionId, setSectionId] = useState('PUNE-LNL');
  const [trackId, setTrackId] = useState('PUNE-LNL-UP');
  const [selectedDay, setSelectedDay] = useState('2026-09-08');
  const [selectedTime, setSelectedTime] = useState('07:30');
  const [durationMinutes, setDurationMinutes] = useState(150);
  const [impactPercent, setImpactPercent] = useState(30);

  // Results & Diff View
  const [result, setResult] = useState(null);
  const [activeDiffTab, setActiveDiffTab] = useState('ALL'); // ALL | RESCHEDULED | DEFERRED | PROTECTED
  const [diffSearch, setDiffSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promotionNotice, setPromotionNotice] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [opt, base] = await Promise.all([
        fetchWhatIfOptions(),
        fetchApprovedWeeklyPlan(),
      ]);
      setOptions(opt || { scenario_types: [], sections: [], presets: [] });
      setBaseline(base);

      if (opt?.sections?.length > 0) {
        const defaultSec = opt.sections.find((s) => s.section_id === 'PUNE-LNL') || opt.sections[0];
        setSectionId(defaultSec.section_id);
        setTrackId(defaultSec.track_ids?.[0] || '');
      }
    } catch (err) {
      console.error('Failed to initialize What-If options:', err);
      setError(err.message || 'Unable to establish scenario simulation handshake.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedSectionObj = useMemo(
    () => options.sections.find((s) => s.section_id === sectionId),
    [options.sections, sectionId]
  );

  const hasBaseline = Boolean(baseline?.approved && baseline?.plan);
  const approvedWeek = Number(baseline?.planning_week || baseline?.plan?.planning_week || 1);
  const baselineRevision = baseline?.revision || baseline?.plan?.baseline_revision || 1;

  // Apply a preset
  const handleApplyPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setScenarioType(preset.scenario_type);
    setSectionId(preset.section_id);
    setTrackId(preset.track_id || '');
    if (preset.impact_percent != null) setImpactPercent(preset.impact_percent);
    setDurationMinutes(preset.duration_minutes || 120);

    // Split preset start_time
    if (preset.start_time) {
      const parts = preset.start_time.split('T');
      if (parts[0]) setSelectedDay(parts[0]);
      if (parts[1]) setSelectedTime(parts[1].slice(0, 5));
    }
    setResult(null);
    setPromotionNotice(null);
    setError('');
  };

  // Switch to custom mode
  const handleCustomMode = () => {
    setSelectedPresetId('CUSTOM');
    setResult(null);
    setPromotionNotice(null);
  };

  // Run Simulation
  const handleRunSimulation = async () => {
    if (!hasBaseline) {
      setError('An approved weekly baseline is required before running a What-If contingency simulation.');
      return;
    }
    setError('');
    setPromotionNotice(null);
    setSimulating(true);

    try {
      const fullStartTime = `${selectedDay}T${selectedTime}:00`;
      const payload = {
        week: approvedWeek,
        scenario_type: scenarioType,
        section_id: sectionId,
        track_id: scenarioType === 'SECTION_OUTAGE' ? null : trackId || null,
        start_time: fullStartTime,
        duration_minutes: Number(durationMinutes),
        impact_percent: ['FREIGHT_SURGE', 'MONSOON_SLOWDOWN'].includes(scenarioType)
          ? Number(impactPercent)
          : null,
      };

      const res = await simulateWhatIf(payload);
      setResult(res);
    } catch (err) {
      console.error('What-If simulation failed:', err);
      setError(err.message || 'Simulation could not be evaluated by CP-SAT solver.');
    } finally {
      setSimulating(false);
    }
  };

  // Filtered Job Comparisons
  const filteredComparisons = useMemo(() => {
    if (!result?.job_comparisons) return [];
    const list = result.job_comparisons;
    const q = diffSearch.trim().toLowerCase();

    return list.filter((j) => {
      // Tab filter
      if (activeDiffTab === 'RESCHEDULED' && j.status_change !== 'RESCHEDULED') return false;
      if (activeDiffTab === 'DEFERRED' && j.status_change !== 'NEWLY_DEFERRED') return false;
      if (activeDiffTab === 'PROTECTED' && j.status_change !== 'UNTOUCHED') return false;

      // Search query
      if (!q) return true;
      return (
        j.job_id.toLowerCase().includes(q) ||
        (j.department || '').toLowerCase().includes(q) ||
        (j.defect_type || '').toLowerCase().includes(q) ||
        (j.section_id || '').toLowerCase().includes(q) ||
        (j.track_id || '').toLowerCase().includes(q)
      );
    });
  }, [result?.job_comparisons, activeDiffTab, diffSearch]);

  const diffCounts = useMemo(() => {
    const list = result?.job_comparisons || [];
    return {
      all: list.length,
      rescheduled: list.filter((j) => j.status_change === 'RESCHEDULED').length,
      deferred: list.filter((j) => j.status_change === 'NEWLY_DEFERRED').length,
      protected: list.filter((j) => j.status_change === 'UNTOUCHED').length,
    };
  }, [result?.job_comparisons]);

  // Copy briefing report
  const handleCopyBriefing = () => {
    if (!result) return;
    const reportText = [
      `=== MARS OPERATIONAL CONTINGENCY BRIEFING ===`,
      `Scenario: ${SCENARIO_LABELS[result.scenario?.scenario_type] || result.scenario?.scenario_type}`,
      `Section: ${result.scenario?.section_id} | Blocked Tracks: ${(result.scenario?.blocked_tracks || []).join(', ')}`,
      `Disruption Window: ${result.scenario?.start_time} to ${result.scenario?.end_time}`,
      `Capacity Loss: ${result.impact?.capacity_loss_hours}h | Severity: ${result.impact?.severity}`,
      `Punctuality Risk Score: ${result.impact?.punctuality_risk_score}%`,
      `Jobs Affected: ${result.impact?.jobs_affected} | Rescheduled: ${result.impact?.jobs_delayed_or_moved} | Newly Deferred: ${result.impact?.jobs_deferred}`,
      `Solver Status: ${result.impact?.solver_status} (Zero safety conflicts proof)`,
      ``,
      `--- CONTROLLER ADVISORIES ---`,
      ...(result.dispatcher_advisories || []).map((a) => `• [${a.category}] ${a.title}: ${a.text}`),
      ``,
      `Generated from Approved Baseline Revision R${baselineRevision} at ${new Date().toLocaleTimeString()}`,
    ].join('\n');

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Promote Scenario to Candidate Plan
  const handlePromoteScenario = async () => {
    if (!result?.simulated_blocks) return;
    try {
      setPromoting(true);
      setError('');
      const res = await promoteWhatIfScenario({
        week: approvedWeek,
        scenario_type: scenarioType,
        scenario_name: SCENARIO_LABELS[scenarioType] || scenarioType,
        simulated_blocks: result.simulated_blocks,
        deferred_job_ids: result.deferred_job_ids || [],
        reason: `Contingency plan promoted from What-If simulation: ${SCENARIO_LABELS[scenarioType]} on ${sectionId}`,
      });
      setPromotionNotice({
        title: 'Scenario Successfully Promoted!',
        message: 'This contingency schedule has been saved as a pending revision in the Command Center. You can now review and officially sanction it.',
      });
    } catch (err) {
      console.error('Failed to promote scenario:', err);
      setError(`Failed to promote contingency plan: ${err.message}`);
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-full bg-[#F4F6F8] p-6 font-sans flex items-center justify-center">
        <div className="flex items-center space-x-3 bg-white p-5 rounded-lg border border-[#D6DEE6] shadow-xs">
          <Loader2 className="w-5 h-5 text-[#1E3A5F] animate-spin" />
          <span className="text-xs font-bold text-[#1E3A5F]">Loading MARS What-If Disruption Engine...</span>
        </div>
      </main>
    );
  }

  const severityData = SEVERITY_CONFIG[result?.impact?.severity] || SEVERITY_CONFIG.MODERATE;

  return (
    <main className="min-h-full bg-[#F4F6F8] p-4 lg:p-6 font-sans text-[#1F2933]">
      <div className="mx-auto max-w-[1720px] space-y-4">
        {/* Executive Header */}
        <header className="rounded-lg border border-[#D6DEE6] bg-white p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-[#1E3A5F]" />
              <h1 className="text-lg font-black uppercase tracking-wide text-[#1E3A5F]">
                Operational What-If Simulator
              </h1>
              <span className="rounded border border-[#2F9E44]/30 bg-[#EBFBEE] px-2.5 py-0.5 text-[10px] font-bold text-[#2F9E44] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Baseline R{baselineRevision} Protected (In-Memory Simulation)
              </span>
            </div>
            <p className="mt-1 text-xs text-[#52606D]">
              Pune Division (CR) • Stress-test disruptions, weather hazards, and traffic surges against the approved weekly schedule.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
            <span className="text-xs font-mono font-bold bg-[#F4F6F8] border border-[#D6DEE6] px-3 py-1.5 rounded text-[#1E3A5F]">
              Horizon: Mon 07 Sept — Sun 13 Sept 2026
            </span>
            <button
              type="button"
              onClick={handleCustomMode}
              className="px-3 py-1.5 bg-white hover:bg-[#F4F6F8] text-[#52606D] rounded text-xs font-semibold border border-[#D6DEE6] flex items-center space-x-1.5 shadow-2xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Setup</span>
            </button>
            {result && (
              <button
                type="button"
                onClick={handleCopyBriefing}
                className="px-3.5 py-1.5 bg-[#1E3A5F] hover:bg-[#152942] text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#2F9E44]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Export Briefing'}</span>
              </button>
            )}
          </div>
        </header>

        {/* 1-Click Operational Presets */}
        <section className="rounded-lg border border-[#D6DEE6] bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#52606D] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#F08C00]" />
              Quick Real-World Contingency Presets (1-Click Stress Tests)
            </span>
            <span className="text-[10px] text-[#718294]">Click any scenario to pre-configure solver parameters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
            {(options.presets || []).map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              const IconComponent =
                preset.icon === 'CloudRain'
                  ? CloudRain
                  : preset.icon === 'AlertTriangle'
                  ? AlertTriangle
                  : preset.icon === 'Truck'
                  ? Truck
                  : SlidersHorizontal;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-[#1E3A5F] bg-[#EEF5FC] ring-1 ring-[#1E3A5F] shadow-xs'
                      : 'border-[#D6DEE6] bg-white hover:bg-[#F8FAFC] hover:border-[#1E3A5F]/40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`p-1.5 rounded ${isSelected ? 'bg-[#1E3A5F] text-white' : 'bg-[#F4F6F8] text-[#1E3A5F]'}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-black/5 text-[#52606D]">
                      {preset.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-bold text-[#1F2933] leading-snug line-clamp-1">{preset.name}</p>
                  <p className="mt-0.5 text-[10px] text-[#718294] line-clamp-2">{preset.description}</p>
                  <div className="mt-2 pt-2 border-t border-black/5 text-[9px] font-mono text-[#52606D] flex items-center justify-between">
                    <span>{preset.section_id}</span>
                    <span>{preset.duration_minutes}m</span>
                  </div>
                </button>
              );
            })}

            {/* Custom Option */}
            <button
              type="button"
              onClick={handleCustomMode}
              className={`text-left p-3 rounded-lg border transition-all ${
                selectedPresetId === 'CUSTOM'
                  ? 'border-[#1E3A5F] bg-[#EEF5FC] ring-1 ring-[#1E3A5F] shadow-xs'
                  : 'border-[#D6DEE6] bg-white hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className={`p-1.5 rounded ${selectedPresetId === 'CUSTOM' ? 'bg-[#1E3A5F] text-white' : 'bg-[#F4F6F8] text-[#1E3A5F]'}`}>
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-black/5 text-[#52606D]">
                  Custom
                </span>
              </div>
              <p className="mt-2 text-xs font-bold text-[#1F2933]">Custom Contingency</p>
              <p className="mt-0.5 text-[10px] text-[#718294]">Manually configure track, window, duration, and disruption parameters.</p>
              <div className="mt-2 pt-2 border-t border-black/5 text-[9px] font-mono text-[#52606D]">
                <span>Planner defined</span>
              </div>
            </button>
          </div>
        </section>

        {/* Notices */}
        {promotionNotice && (
          <div className="bg-[#EBFBEE] border-l-4 border-[#2F9E44] border border-[#D6DEE6] p-3.5 rounded-lg shadow-xs flex items-center justify-between text-xs text-[#1F2933]">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#2F9E44] flex-shrink-0" />
              <div>
                <p className="font-bold text-[#1F2933]">{promotionNotice.title}</p>
                <p className="text-[11px] text-[#52606D]">{promotionNotice.message}</p>
              </div>
            </div>
            <Link
              to="/command-center"
              className="px-3 py-1.5 bg-[#2F9E44] hover:bg-[#28883B] text-white rounded text-xs font-bold flex items-center space-x-1 shadow-2xs"
            >
              <span>Open Command Center →</span>
            </Link>
          </div>
        )}

        {error && (
          <div className="bg-[#FFF5F5] border-l-4 border-[#C92A2A] border border-[#D6DEE6] p-3 rounded-lg text-xs text-[#C92A2A] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#C92A2A] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Contingency Solver Warning</p>
              <p className="text-[11px] text-[#52606D] mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Main 2-Column Work Area */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* LEFT: Scenario Configuration Deck (4 cols) */}
          <section className="xl:col-span-4 rounded-lg border border-[#D6DEE6] bg-white shadow-xs overflow-hidden">
            <div className="bg-[#FAFBFC] border-b border-[#D6DEE6] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-[#1E3A5F]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F]">
                  Scenario Setup Parameters
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold text-[#718294]">
                {selectedPresetId === 'CUSTOM' ? 'Manual Mode' : selectedPresetId}
              </span>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              {/* Scenario Type */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#52606D] mb-1">
                  Scenario Disruption Type
                </label>
                <select
                  value={scenarioType}
                  onChange={(e) => {
                    setScenarioType(e.target.value);
                    setResult(null);
                    setPromotionNotice(null);
                  }}
                  className="w-full bg-white border border-[#D6DEE6] rounded px-3 py-2 text-xs font-semibold text-[#1F2933] outline-none focus:border-[#1E3A5F]"
                >
                  {Object.entries(SCENARIO_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section & Track */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#52606D] mb-1">
                    Section
                  </label>
                  <select
                    value={sectionId}
                    onChange={(e) => {
                      setSectionId(e.target.value);
                      const sec = options.sections.find((s) => s.section_id === e.target.value);
                      setTrackId(sec?.track_ids?.[0] || '');
                      setResult(null);
                    }}
                    className="w-full bg-white border border-[#D6DEE6] rounded px-2.5 py-2 text-xs font-semibold text-[#1F2933] outline-none focus:border-[#1E3A5F]"
                  >
                    {options.sections.map((s) => (
                      <option key={s.section_id} value={s.section_id}>
                        {s.section_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-[#52606D] mb-1">
                    Track {scenarioType === 'SECTION_OUTAGE' ? '(All Tracks)' : ''}
                  </label>
                  <select
                    value={trackId}
                    disabled={scenarioType === 'SECTION_OUTAGE'}
                    onChange={(e) => {
                      setTrackId(e.target.value);
                      setResult(null);
                    }}
                    className="w-full bg-white border border-[#D6DEE6] rounded px-2.5 py-2 text-xs font-semibold text-[#1F2933] outline-none focus:border-[#1E3A5F] disabled:bg-[#F4F6F8] disabled:text-[#718294]"
                  >
                    {scenarioType === 'SECTION_OUTAGE' ? (
                      <option value="">Both UP & DN Tracks</option>
                    ) : (
                      (selectedSectionObj?.track_ids || []).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Day of Week Selector */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#52606D] mb-1.5 flex items-center justify-between">
                  <span>Day of Planning Week (07–13 Sept 2026)</span>
                  <span className="font-mono text-[#1E3A5F] font-bold">{selectedDay}</span>
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_DAYS.map((d) => {
                    const isDaySelected = selectedDay === d.date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setSelectedDay(d.date);
                          setResult(null);
                        }}
                        className={`py-1.5 px-1 rounded text-center transition-colors ${
                          isDaySelected
                            ? 'bg-[#1E3A5F] text-white font-bold shadow-2xs'
                            : 'bg-[#F4F6F8] hover:bg-[#EEF2F5] text-[#52606D] font-medium border border-[#D6DEE6]'
                        }`}
                      >
                        <div className="text-[10px]">{d.day}</div>
                        <div className="text-[9px] opacity-75">{d.date.slice(8)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shift & Time Presets */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#52606D] mb-1.5">
                  Operating Shift Window
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TIME_SHIFTS.map((ts) => {
                    const isTimeSelected = selectedTime === ts.time;
                    return (
                      <button
                        key={ts.time}
                        type="button"
                        onClick={() => {
                          setSelectedTime(ts.time);
                          setResult(null);
                        }}
                        className={`p-2 rounded text-left border transition-all ${
                          isTimeSelected
                            ? 'border-[#1E3A5F] bg-[#EEF5FC] text-[#1E3A5F] font-bold'
                            : 'border-[#D6DEE6] bg-white hover:bg-[#F8FAFC] text-[#52606D]'
                        }`}
                      >
                        <div className="text-[10px] font-bold">{ts.label}</div>
                        <div className="text-[9px] font-mono text-[#718294]">{ts.time} hrs</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-[#52606D] mb-1">
                  Disruption Duration
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => {
                    setDurationMinutes(Number(e.target.value));
                    setResult(null);
                  }}
                  className="w-full bg-white border border-[#D6DEE6] rounded px-3 py-2 text-xs font-semibold text-[#1F2933] outline-none focus:border-[#1E3A5F]"
                >
                  <option value="60">1.0 Hour (60 mins)</option>
                  <option value="90">1.5 Hours (90 mins)</option>
                  <option value="120">2.0 Hours (120 mins)</option>
                  <option value="150">2.5 Hours (150 mins)</option>
                  <option value="180">3.0 Hours (180 mins)</option>
                  <option value="240">4.0 Hours (240 mins)</option>
                  <option value="360">6.0 Hours (360 mins)</option>
                  <option value="480">8.0 Hours (480 mins)</option>
                </select>
              </div>

              {/* Stress Factor (for Freight Surge or Weather) */}
              {['FREIGHT_SURGE', 'MONSOON_SLOWDOWN'].includes(scenarioType) && (
                <div className="p-3 bg-[#FAFBFC] border border-[#D6DEE6] rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#1E3A5F]">
                      {scenarioType === 'FREIGHT_SURGE' ? 'Freight Traffic Surge' : 'Monsoon Delay Factor'}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#1E3A5F]">{impactPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={impactPercent}
                    onChange={(e) => {
                      setImpactPercent(Number(e.target.value));
                      setResult(null);
                    }}
                    className="w-full accent-[#1E3A5F] cursor-pointer"
                  />
                  <p className="text-[9px] text-[#718294]">
                    {scenarioType === 'FREIGHT_SURGE'
                      ? 'Simulates additional goods train paths injected into this corridor window.'
                      : 'Simulates extended line occupancy and speed restriction (TSR) headway dilation.'}
                  </p>
                </div>
              )}

              {/* Run Button */}
              <button
                type="button"
                disabled={simulating || !hasBaseline}
                onClick={handleRunSimulation}
                className="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#152942] active:scale-98 text-white rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xs transition-all disabled:opacity-50"
              >
                {simulating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F08C00]" />
                    <span>Evaluating CP-SAT Contingency...</span>
                  </>
                ) : (
                  <>
                    <TrainFront className="w-4 h-4" />
                    <span>Run Contingency Simulation →</span>
                  </>
                )}
              </button>

              <div className="text-[10px] text-[#718294] text-center flex items-center justify-center gap-1 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2F9E44]" />
                <span>Zero write-back • Approved baseline remains untouched</span>
              </div>
            </div>
          </section>

          {/* RIGHT: Scenario Results & Interactive Schedule Diff (8 cols) */}
          <section className="xl:col-span-8 space-y-4">
            {!result ? (
              <div className="rounded-lg border border-[#D6DEE6] bg-white p-8 shadow-xs text-center flex flex-col items-center justify-center min-h-[460px]">
                <div className="p-4 rounded-full bg-[#EEF5FC] border border-[#D6DEE6] text-[#1E3A5F]">
                  <TrainFront className="w-8 h-8 opacity-80" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-[#1E3A5F]">
                  Contingency Simulator Ready
                </h3>
                <p className="mt-1 text-xs text-[#52606D] max-w-md">
                  Select an operational preset above or adjust the parameters on the left, then click{' '}
                  <span className="font-semibold text-[#1E3A5F]">"Run Contingency Simulation"</span> to compute the CP-SAT impact diff.
                </p>
                <div className="mt-6 flex items-center space-x-4 text-[10px] text-[#718294] border-t border-[#D6DEE6] pt-4">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2F9E44]" /> No data overwritten
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#1E3A5F]" /> Real-time CP-SAT solver
                  </span>
                  <span className="flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#F08C00]" /> Delta schedule comparison
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Result KPIs */}
                <div className="rounded-lg border border-[#D6DEE6] bg-white p-4 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#D6DEE6] pb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold border flex items-center gap-1.5 ${severityData.badge}`}>
                        <span className={`w-2 h-2 rounded-full ${severityData.dot}`} />
                        {result.impact?.severity} SEVERITY
                      </span>
                      <span className="text-xs font-bold text-[#1F2933]">
                        {SCENARIO_LABELS[result.scenario?.scenario_type] || result.scenario?.scenario_type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        disabled={promoting}
                        onClick={handlePromoteScenario}
                        className="px-3 py-1.5 bg-[#2F9E44] hover:bg-[#28883B] text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-colors disabled:opacity-50"
                      >
                        {promoting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Adopt as Candidate Plan →</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <div className="p-2.5 bg-[#F8FAFC] border border-[#D6DEE6] rounded">
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#718294]">
                        Jobs Rescheduled
                      </div>
                      <div className="mt-1 font-mono text-xl font-black text-[#1E3A5F]">
                        {result.impact?.jobs_delayed_or_moved ?? 0}
                      </div>
                      <div className="text-[9px] text-[#52606D] mt-0.5">Moved to safe windows</div>
                    </div>

                    <div className="p-2.5 bg-[#F8FAFC] border border-[#D6DEE6] rounded">
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#718294]">
                        Newly Deferred
                      </div>
                      <div className={`mt-1 font-mono text-xl font-black ${
                        result.impact?.jobs_deferred > 0 ? 'text-[#C92A2A]' : 'text-[#2F9E44]'
                      }`}>
                        {result.impact?.jobs_deferred ?? 0}
                      </div>
                      <div className="text-[9px] text-[#52606D] mt-0.5">Pushed to Week 2</div>
                    </div>

                    <div className="p-2.5 bg-[#F8FAFC] border border-[#D6DEE6] rounded">
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#718294]">
                        Capacity Loss
                      </div>
                      <div className="mt-1 font-mono text-xl font-black text-[#F08C00]">
                        {result.impact?.capacity_loss_hours ?? 0}h
                      </div>
                      <div className="text-[9px] text-[#52606D] mt-0.5">Track occupancy hours lost</div>
                    </div>

                    <div className="p-2.5 bg-[#F8FAFC] border border-[#D6DEE6] rounded">
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#718294]">
                        Punctuality Risk
                      </div>
                      <div className="mt-1 font-mono text-xl font-black text-[#2F6F7E]">
                        {result.impact?.punctuality_risk_score ?? 0}%
                      </div>
                      <div className="text-[9px] text-[#52606D] mt-0.5">Train delay risk index</div>
                    </div>
                  </div>
                </div>

                {/* Dispatcher Advisories */}
                {(result.dispatcher_advisories || []).length > 0 && (
                  <div className="rounded-lg border border-[#D6DEE6] bg-white p-3.5 shadow-xs space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#52606D] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#F08C00]" />
                      Chief Controller & Traffic Dispatcher Advisories
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {result.dispatcher_advisories.map((adv, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded border border-[#D6DEE6] bg-[#FAFBFC] text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#1E3A5F] text-[11px]">{adv.title}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/5 text-[#52606D]">
                              {adv.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#52606D] leading-relaxed">{adv.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Before vs After Schedule Diff Table */}
                <div className="rounded-lg border border-[#D6DEE6] bg-white shadow-xs overflow-hidden">
                  {/* Table Header / Tabs */}
                  <div className="p-3.5 border-b border-[#D6DEE6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-[#FAFBFC]">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setActiveDiffTab('ALL')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          activeDiffTab === 'ALL'
                            ? 'bg-[#1E3A5F] text-white shadow-2xs'
                            : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#EEF2F5]'
                        }`}
                      >
                        All Jobs ({diffCounts.all})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveDiffTab('RESCHEDULED')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          activeDiffTab === 'RESCHEDULED'
                            ? 'bg-[#F08C00] text-white shadow-2xs'
                            : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#EEF2F5]'
                        }`}
                      >
                        Rescheduled ({diffCounts.rescheduled})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveDiffTab('DEFERRED')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          activeDiffTab === 'DEFERRED'
                            ? 'bg-[#C92A2A] text-white shadow-2xs'
                            : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#EEF2F5]'
                        }`}
                      >
                        Newly Deferred ({diffCounts.deferred})
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveDiffTab('PROTECTED')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                          activeDiffTab === 'PROTECTED'
                            ? 'bg-[#2F9E44] text-white shadow-2xs'
                            : 'bg-white text-[#52606D] border border-[#D6DEE6] hover:bg-[#EEF2F5]'
                        }`}
                      >
                        Protected ({diffCounts.protected})
                      </button>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={diffSearch}
                        onChange={(e) => setDiffSearch(e.target.value)}
                        placeholder="Filter job, track, defect..."
                        className="text-xs px-2.5 py-1 bg-white border border-[#D6DEE6] rounded outline-none focus:border-[#1E3A5F]"
                      />
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-[#F4F6F8] border-b border-[#D6DEE6] text-[10px] font-black uppercase tracking-wider text-[#52606D]">
                        <tr>
                          <th className="py-2.5 px-3">Job ID & Dept</th>
                          <th className="py-2.5 px-3">Defect / Work</th>
                          <th className="py-2.5 px-3">Section & Track</th>
                          <th className="py-2.5 px-3">Baseline Slot</th>
                          <th className="py-2.5 px-3">Simulated Slot</th>
                          <th className="py-2.5 px-3 text-right">Contingency Delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D6DEE6]">
                        {filteredComparisons.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-xs text-[#718294]">
                              No jobs match the active tab filter or search query.
                            </td>
                          </tr>
                        ) : (
                          filteredComparisons.map((item) => {
                            const isRescheduled = item.status_change === 'RESCHEDULED';
                            const isDeferred = item.status_change === 'NEWLY_DEFERRED';
                            const isUntouched = item.status_change === 'UNTOUCHED';

                            return (
                              <tr
                                key={item.job_id}
                                className={`hover:bg-[#F8FAFC] transition-colors ${
                                  isRescheduled
                                    ? 'bg-[#FFF9EE]/40'
                                    : isDeferred
                                    ? 'bg-[#FFF5F5]/40'
                                    : ''
                                }`}
                              >
                                <td className="py-2.5 px-3 font-mono font-bold text-[#1E3A5F]">
                                  <div>{item.job_id}</div>
                                  <span className="text-[9px] font-normal px-1.5 py-0.2 rounded bg-black/5 text-[#52606D]">
                                    {item.department}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 max-w-[200px]">
                                  <div className="font-semibold text-[#1F2933] truncate">{item.defect_type}</div>
                                  <div className="text-[10px] text-[#718294]">Asset: {item.asset_id}</div>
                                </td>

                                <td className="py-2.5 px-3 font-mono text-[11px] text-[#52606D]">
                                  <div>{item.section_id}</div>
                                  <div className="text-[10px] text-[#718294]">{item.track_id}</div>
                                </td>

                                <td className="py-2.5 px-3 text-[11px]">
                                  {item.baseline_start ? (
                                    <div>
                                      <div className="font-medium text-[#1F2933]">
                                        {item.baseline_start.replace('T', ' ').slice(5, 16)}
                                      </div>
                                      <div className="text-[10px] font-mono text-[#718294]">
                                        {item.baseline_block_id}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[#718294] italic">Deferred</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-[11px]">
                                  {item.simulated_start ? (
                                    <div>
                                      <div className="font-medium text-[#1E3A5F]">
                                        {item.simulated_start.replace('T', ' ').slice(5, 16)}
                                      </div>
                                      <div className="text-[10px] font-mono text-[#718294]">
                                        {item.simulated_block_id}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[#C92A2A] font-bold">Deferred</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isDeferred
                                        ? 'bg-[#C92A2A]/15 text-[#C92A2A]'
                                        : isRescheduled
                                        ? 'bg-[#F08C00]/15 text-[#A76614]'
                                        : isUntouched
                                        ? 'bg-[#2F9E44]/15 text-[#2F9E44]'
                                        : 'bg-[#F4F6F8] text-[#52606D]'
                                    }`}
                                  >
                                    {item.shift_label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
