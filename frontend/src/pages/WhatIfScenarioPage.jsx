import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, CloudRain, GitBranch, Loader2, ShieldCheck, SlidersHorizontal, TrainFront, Truck } from 'lucide-react';
import { fetchApprovedWeeklyPlan, fetchWhatIfOptions, simulateWhatIf } from '../services/api';

const SCENARIO_LABELS = {
  TRACK_OUTAGE: 'Track Outage',
  SECTION_OUTAGE: 'Section Outage',
  EMERGENCY_BLOCK: 'Emergency Block',
  FREIGHT_SURGE: 'Freight Traffic Surge',
  MONSOON_SLOWDOWN: 'Monsoon / Weather Slowdown',
};
const pad = (value) => String(value).padStart(2, '0');
const defaultStart = () => {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const severityClass = {
  LOW: 'border-[#B9D9C9] bg-[#F5FAF7] text-[#176B45]',
  MODERATE: 'border-[#B9CDE2] bg-[#F5F8FC] text-[#285B88]',
  HIGH: 'border-[#E3C999] bg-[#FFF9EE] text-[#8A5A10]',
  CRITICAL: 'border-[#E4B9B9] bg-[#FFF5F5] text-[#A51D1D]',
};

function Metric({ label, value, hint }) {
  return <div className="border border-[#D7DEE6] bg-white px-4 py-3">
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#68798A]">{label}</p>
    <p className="mt-1 text-[21px] font-bold text-[#173E6C]">{value}</p>
    {hint && <p className="mt-0.5 text-[9px] text-[#718294]">{hint}</p>}
  </div>;
}

export default function WhatIfScenarioPage() {
  const [options, setOptions] = useState({ scenario_types: [], sections: [], freight_surge_levels: [20, 40], monsoon_slowdown_levels: [10, 20, 30] });
  const [baseline, setBaseline] = useState(null);
  const [scenarioType, setScenarioType] = useState('FREIGHT_SURGE');
  const [sectionId, setSectionId] = useState('');
  const [trackId, setTrackId] = useState('');
  const [impactPercent, setImpactPercent] = useState(20);
  const [startTime, setStartTime] = useState(defaultStart);
  const [duration, setDuration] = useState(120);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingShell, setLoadingShell] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchWhatIfOptions(), fetchApprovedWeeklyPlan()])
      .then(([available, approved]) => {
        const next = available || {};
        setOptions({
          scenario_types: next.scenario_types || [],
          sections: next.sections || [],
          freight_surge_levels: next.freight_surge_levels || [20, 40],
          monsoon_slowdown_levels: next.monsoon_slowdown_levels || [10, 20, 30],
        });
        setBaseline(approved);
        const firstSection = next.sections?.[0];
        if (firstSection) {
          setSectionId(firstSection.section_id);
          setTrackId(firstSection.track_ids?.[0] || '');
        }
      })
      .catch((err) => setError(err.message || 'Unable to load What-If inputs.'))
      .finally(() => setLoadingShell(false));
  }, []);

  const selectedSection = useMemo(() => options.sections.find((item) => item.section_id === sectionId), [options.sections, sectionId]);
  const approvedWeek = Number(baseline?.planning_week || baseline?.plan?.planning_week || 1);
  const hasBaseline = Boolean(baseline?.approved && baseline?.plan);
  const isDemandScenario = scenarioType === 'FREIGHT_SURGE' || scenarioType === 'MONSOON_SLOWDOWN';
  const impactLevels = scenarioType === 'FREIGHT_SURGE' ? options.freight_surge_levels : options.monsoon_slowdown_levels;

  const handleScenarioChange = (value) => {
    setScenarioType(value);
    setResult(null);
    if (value === 'FREIGHT_SURGE') setImpactPercent(options.freight_surge_levels[0] || 20);
    if (value === 'MONSOON_SLOWDOWN') setImpactPercent(options.monsoon_slowdown_levels[0] || 10);
  };
  const handleSectionChange = (value) => {
    setSectionId(value);
    const section = options.sections.find((item) => item.section_id === value);
    setTrackId(section?.track_ids?.[0] || '');
    setResult(null);
  };
  const runScenario = async () => {
    setError('');
    setResult(null);
    if (!hasBaseline) {
      setError('An approved weekly baseline is required before running a What-If simulation.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        week: approvedWeek,
        scenario_type: scenarioType,
        section_id: sectionId,
        ...(scenarioType === 'TRACK_OUTAGE' || (!isDemandScenario && trackId) ? { track_id: trackId } : {}),
        ...(isDemandScenario ? { impact_percent: Number(impactPercent) } : {}),
        start_time: new Date(startTime).toISOString(),
        duration_minutes: Number(duration),
      };
      setResult(await simulateWhatIf(payload));
    } catch (err) {
      setError(err.message || 'Scenario simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingShell) return <div className="p-6 text-sm text-[#60748A]">Loading What-If Scenario Analysis…</div>;

  return <main className="min-h-full bg-[#EEF2F6] p-5 lg:p-6">
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-5 border-b border-[#C8D2DC] pb-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#617487]"><SlidersHorizontal className="h-3.5 w-3.5" /> Central Railway · Pune Division · Planner</div>
            <h1 className="mt-1 text-[24px] font-bold text-[#173E6C]">Operational What-If Analysis</h1>
            <p className="mt-1 max-w-[760px] text-[11px] leading-5 text-[#5E7082]">Decision-support simulation against the approved weekly maintenance plan. Scenario calculations are non-destructive.</p>
          </div>
          <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#176B45]"><ShieldCheck className="h-4 w-4" /> Approved baseline protected</div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="border border-[#CCD6DF] bg-white">
          <div className="border-b border-[#DCE3E9] bg-[#F6F8FA] px-5 py-4">
            <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-[#245D91]" /><div><h2 className="text-[13px] font-bold text-[#173E6C]">Scenario Parameters</h2><p className="text-[9px] text-[#6C7D8D]">Approved baseline: Week {approvedWeek}{baseline?.revision ? ` · Revision ${baseline.revision}` : ''}</p></div></div>
          </div>
          <div className="space-y-4 p-5">
            <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#607487]">Scenario</span><select value={scenarioType} onChange={(e) => handleScenarioChange(e.target.value)} className="h-10 w-full border border-[#BFCBD6] bg-white px-3 text-[11px] font-semibold text-[#274C72] outline-none focus:border-[#245D91]">{(options.scenario_types.length ? options.scenario_types : Object.keys(SCENARIO_LABELS)).map((type) => <option key={type} value={type}>{SCENARIO_LABELS[type] || type}</option>)}</select></label>

            {isDemandScenario && <div className="border border-[#D7DEE6] bg-[#F8FAFB] p-3.5">
              <div className="flex items-center gap-2">{scenarioType === 'FREIGHT_SURGE' ? <Truck className="h-4 w-4 text-[#245D91]" /> : <CloudRain className="h-4 w-4 text-[#245D91]" />}<div><p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#355675]">{scenarioType === 'FREIGHT_SURGE' ? 'Goods traffic stress' : 'Weather stress'}</p><p className="text-[9px] text-[#718294]">Select the planning stress level</p></div></div>
              <div className="mt-3 grid grid-cols-3 gap-2">{impactLevels.map((level) => <button key={level} type="button" onClick={() => { setImpactPercent(level); setResult(null); }} className={`h-9 border text-[10px] font-bold ${Number(impactPercent) === Number(level) ? 'border-[#245D91] bg-[#EAF2F8] text-[#173E6C]' : 'border-[#C8D2DC] bg-white text-[#65788A] hover:border-[#8FA3B5]'}`}>{scenarioType === 'FREIGHT_SURGE' ? `+${level}%` : `${level}%`}</button>)}</div>
              <p className="mt-2.5 text-[9px] leading-4 text-[#68798A]">{scenarioType === 'FREIGHT_SURGE' ? 'Models increased goods-train demand using the existing timetable as the demand shape.' : 'Models longer track occupancy during heavy-rain conditions; this is a planning proxy, not a live speed-restriction feed.'}</p>
            </div>}

            <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#607487]">Section</span><select value={sectionId} onChange={(e) => handleSectionChange(e.target.value)} className="h-10 w-full border border-[#BFCBD6] bg-white px-3 text-[11px] font-semibold text-[#274C72] outline-none focus:border-[#245D91]">{options.sections.map((section) => <option key={section.section_id} value={section.section_id}>{section.section_id}</option>)}</select></label>

            <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#607487]">Track {scenarioType === 'SECTION_OUTAGE' || isDemandScenario ? '(optional)' : ''}</span><select value={trackId} onChange={(e) => { setTrackId(e.target.value); setResult(null); }} disabled={!selectedSection || scenarioType === 'SECTION_OUTAGE' || isDemandScenario} className="h-10 w-full border border-[#BFCBD6] bg-white px-3 text-[11px] font-semibold text-[#274C72] outline-none disabled:bg-[#F0F3F5] focus:border-[#245D91]">{selectedSection?.track_ids?.map((track) => <option key={track} value={track}>{track}</option>)}</select></label>

            <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#607487]">Start Time</span><input type="datetime-local" step="900" value={startTime} onChange={(e) => { setStartTime(e.target.value); setResult(null); }} className="h-10 w-full border border-[#BFCBD6] bg-white px-3 text-[10px] font-semibold text-[#274C72] outline-none focus:border-[#245D91]" /></label><label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#607487]">Duration</span><select value={duration} onChange={(e) => { setDuration(e.target.value); setResult(null); }} className="h-10 w-full border border-[#BFCBD6] bg-white px-3 text-[11px] font-semibold text-[#274C72] outline-none focus:border-[#245D91]"><option value="60">1 hour</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option><option value="360">6 hours</option><option value="480">8 hours</option><option value="720">12 hours</option></select></label></div>

            {error && <div className="border border-[#E4B9B9] bg-[#FFF5F5] px-3 py-2.5 text-[10px] leading-4 text-[#A51D1D]"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{error}</span></div></div>}
            {!hasBaseline && !error && <div className="border border-[#E3C999] bg-[#FFF9EE] px-3 py-2.5 text-[10px] text-[#8A5A10]">No approved weekly baseline is available. Approve the current weekly plan before using What-If.</div>}
            <button type="button" disabled={loading || !hasBaseline || !sectionId} onClick={runScenario} className="flex h-10 w-full items-center justify-center gap-2 bg-[#245D91] text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#1D4F7C] disabled:cursor-not-allowed disabled:opacity-50">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating Scenario…</> : <><TrainFront className="h-4 w-4" /> Run Scenario Assessment</>}</button>
          </div>
        </section>

        <section className="border border-[#CCD6DF] bg-white">
          <div className="flex items-center justify-between border-b border-[#DCE3E9] bg-[#F6F8FA] px-5 py-4"><div><h2 className="text-[13px] font-bold text-[#173E6C]">Scenario Assessment</h2><p className="text-[9px] text-[#6C7D8D]">Comparison with the approved weekly baseline</p></div>{result?.impact?.severity && <span className={`border px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] ${severityClass[result.impact.severity] || severityClass.MODERATE}`}>{result.impact.severity} IMPACT</span>}</div>
          {!result ? <div className="flex min-h-[360px] flex-col items-center justify-center px-8 text-center"><div className="border border-[#D7DEE6] bg-[#F6F8FA] p-4 text-[#728496]"><SlidersHorizontal className="h-6 w-6" /></div><h3 className="mt-4 text-[12px] font-bold text-[#355675]">Assessment pending</h3><p className="mt-1 max-w-[410px] text-[10px] leading-5 text-[#718294]">Select an operational scenario and run the assessment. The result reports schedule movement, additional deferrals and operational consequences without altering the approved plan.</p></div> : <div className="p-5"><div className="grid grid-cols-2 gap-px border border-[#D7DEE6] bg-[#D7DEE6] sm:grid-cols-3"><Metric label="Jobs Affected" value={result.impact.jobs_affected} /><Metric label="Jobs Moved" value={result.impact.jobs_delayed_or_moved} /><Metric label="Additional Deferrals" value={result.impact.additional_deferrals} /><Metric label="Blocks Affected" value={result.impact.blocks_affected} /><Metric label="Baseline Jobs" value={result.impact.baseline_scheduled_jobs} /><Metric label="Scenario Jobs" value={result.impact.scenario_scheduled_jobs} /></div><div className="mt-5 border border-[#D7DEE6]"><div className="flex items-center gap-2 border-b border-[#DCE3E9] bg-[#F6F8FA] px-4 py-3"><Clock3 className="h-4 w-4 text-[#245D91]" /><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#45647F]">Operational Consequences</p></div><div className="space-y-2.5 p-4">{result.operational_impact?.map((item, index) => <div key={`${item}-${index}`} className="flex gap-2 text-[10px] leading-4 text-[#5F7183]"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#71879A]" />{item}</div>)}</div></div><div className="mt-4 flex items-center justify-between border border-[#B9D9C9] bg-[#F5FAF7] px-4 py-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#176B45]" /><div><p className="text-[10px] font-bold text-[#236148]">Baseline Protected</p><p className="text-[9px] text-[#5E7A6D]">Scenario evaluated without writing plan state.</p></div></div><span className="font-mono text-[8px] font-bold text-[#54816D]">{result.scenario_solver?.model || 'CP-SAT'}</span></div></div>}
        </section>
      </div>
    </div>
  </main>;
}
