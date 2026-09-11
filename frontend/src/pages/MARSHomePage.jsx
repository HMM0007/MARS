import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, FileCheck2, Gauge, Layers3, ListChecks, Map, Play, ShieldCheck, TrainFront, Wrench } from 'lucide-react';
import BrandAsset from '../components/BrandAsset';
import { fetchMonthlyPlan, fetchWeeklyPlan } from '../services/api';

const quickActions = [
  { to: '/monthly', icon: CalendarDays, title: 'View Monthly Plan', sub: 'Section-wise strategic plan', tone: 'blue' },
  { to: '/weekly', icon: Play, title: 'Run Weekly Plan', sub: 'AI-optimized block schedule', tone: 'blue' },
  { to: '/corridor', icon: Map, title: 'View Corridor Map', sub: 'Interactive asset view', tone: 'green' },
  { to: '/dept/engineering', icon: ListChecks, title: 'Jobs & Assets', sub: 'Maintenance workload', tone: 'blue' },
  { to: '/impact', icon: ShieldCheck, title: 'Compliance', sub: 'Safety & rule validation', tone: 'green' },
];

const toneClasses = { blue: 'bg-[#2374E1] text-white', green: 'bg-[#16A878] text-white' };

const heroCapabilities = [
  [Gauge, 'OPTIMIZE', 'BLOCKS'],
  [Wrench, 'MAXIMIZE', 'ASSET AVAILABILITY'],
  [Layers3, 'UNIFY', 'DEPARTMENTS'],
  [ListChecks, 'ENABLE', 'DATA-DRIVEN DECISIONS'],
];

export default function MARSHomePage({ currentRole }) {
  const [weekly, setWeekly] = useState(null);
  const [monthly, setMonthly] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchWeeklyPlan().catch(() => null),
      fetchMonthlyPlan().catch(() => null),
    ]).then(([w, m]) => {
      setWeekly(w);
      setMonthly(m);
    });
  }, []);

  const weeklyMetrics = weekly?.metrics || weekly?.weekly_metrics || {};
  const monthlySummary = monthly?.summary || monthly?.monthly_summary || {};
  const evaluated = monthlySummary.total_jobs ?? monthlySummary.jobs_evaluated ?? weeklyMetrics.total_jobs_evaluated ?? 150;
  const scheduled = monthlySummary.scheduled_this_month ?? monthlySummary.total_jobs_scheduled ?? 116;
  const deferred = monthlySummary.deferred_next_month ?? monthlySummary.total_jobs_deferred ?? 34;
  const activeBlocks = weeklyMetrics.total_blocks ?? weeklyMetrics.total_blocks_created ?? weekly?.blocks?.length ?? 38;
  const consolidated = weeklyMetrics.consolidated_blocks ?? weeklyMetrics.consolidated_blocks_count ?? weekly?.consolidated_block_count ?? 1;
  const riskCoverage = weeklyMetrics.risk_coverage_percentage ?? 0;
  const displayMonth = useMemo(() => monthly?.month || 'September 2026', [monthly]);

  return (
    <main className="min-h-full bg-[#EEF2F6] text-[#17345C]">
      <section className="relative min-h-[535px] overflow-hidden border-b border-[#CBD6E2] bg-[#061E39] lg:min-h-[575px]">
        <BrandAsset
          name="vande_bharat_hero.jpg"
          alt="Vande Bharat train on an Indian railway corridor"
          className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
          fallback={null}
        />

        {/* Deliberately asymmetric overlays: dense readable copy on the left, clean train imagery on the right. */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,20,39,.97)_0%,rgba(3,23,43,.91)_27%,rgba(4,30,55,.67)_46%,rgba(4,30,55,.12)_74%,rgba(4,30,55,.02)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,18,35,.18)_0%,transparent_46%,rgba(2,18,35,.76)_100%)]" />
        <div className="absolute inset-y-0 left-0 w-[42%] bg-[#061E39]/25 blur-2xl" />
        <div className="absolute left-0 top-0 h-full w-1 bg-[#F2C94C]" />

        <div className="relative z-10 flex min-h-[535px] flex-col justify-between px-6 py-8 sm:px-8 lg:min-h-[575px] lg:px-14 lg:py-9">
          <div className="max-w-[790px] pt-1">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-9 w-[3px] bg-[#F2C94C]" />
              <span className="text-[11px] font-extrabold uppercase tracking-[.28em] text-white/90">Pune Division (CR)</span>
            </div>

            <div className="flex items-center gap-4 lg:gap-5">
              <h1 className="m-0 text-[56px] font-black leading-[.9] tracking-[-.045em] text-white drop-shadow-[0_3px_12px_rgba(0,0,0,.35)] sm:text-[64px] lg:text-[72px]">MARS 2.0</h1>
              <span className="h-[62px] w-[3px] shrink-0 bg-[#2B82F6] lg:h-[70px]" />
              <div className="font-[Noto_Sans_Devanagari,Arial,sans-serif] text-[25px] font-semibold leading-[1.22] tracking-tight text-white sm:text-[28px] lg:text-[31px]">
                सुरक्षित पथ<br />सशक्त भारत
              </div>
            </div>

            <div className="mt-5 max-w-[560px] border-l-2 border-white/20 pl-4">
              <p className="m-0 text-[19px] font-semibold leading-[1.35] tracking-[-.01em] text-white sm:text-[21px] lg:text-[23px]">AI-Powered Maintenance Planning<br />for a More Reliable Tomorrow</p>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[.16em] text-white/60">Divisional decision support for safe, coordinated railway possessions</p>
            </div>

            <div className="mt-8 flex max-w-[780px] flex-wrap items-stretch border-y border-white/20 bg-[#03172B]/20 backdrop-blur-[2px]">
              {heroCapabilities.map(([Icon, title, sub], i) => (
                <div key={title} className={`flex min-h-[72px] flex-1 basis-[180px] items-center gap-3 py-3 pr-4 ${i > 0 ? 'border-l border-white/20 pl-4' : 'pl-1'}`}>
                  <Icon className="h-7 w-7 shrink-0 text-white" strokeWidth={1.65} />
                  <div className="text-[9px] font-extrabold leading-[1.25] tracking-[.06em] text-white sm:text-[10px]">{title}<br />{sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between gap-5 pt-7">
            <div className="w-[275px] border-l-[3px] border-[#F2C94C] bg-[#041A32]/78 px-5 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,.18)] backdrop-blur-md">
              <div className="flex items-center gap-2 text-[13px] font-extrabold text-white"><TrainFront className="h-4 w-4" /> Pune Division (CR)</div>
              <div className="mt-1 text-[9px] font-medium tracking-wide text-white/75">People &nbsp;|&nbsp; Performance &nbsp;|&nbsp; Progress</div>
              <div className="mt-2.5 flex h-[3px] w-full overflow-hidden bg-white/15"><span className="w-[34%] bg-[#F2C94C]" /><span className="w-[33%] bg-white/75" /><span className="w-[33%] bg-[#16A878]" /></div>
              <div className="mt-2 flex justify-between text-[8px] font-bold uppercase tracking-wider text-white/55"><span>Division</span><span>Operational</span><span>On Track</span></div>
            </div>

            <div className="hidden items-end gap-4 lg:flex">
              <BrandAsset
                name="on-track-better-tomorrow.png"
                alt="On Track for a Better Tomorrow"
                className="max-h-[72px] max-w-[250px] object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,.4)]"
                fallback={<div className="text-right font-serif text-[19px] font-semibold italic leading-tight text-white/90">On Track<br />for a Better Tomorrow</div>}
              />
              <BrandAsset name="viksit_bharat_railways.png" alt="Viksit Bharat Viksit Railways" className="max-h-[105px] max-w-[225px] object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,.4)]" fallback={null} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 bg-[#EEF2F6] p-4 md:grid-cols-2 xl:grid-cols-5 xl:px-5">
        {quickActions.map(({ to, icon: Icon, title, sub, tone }) => <Link key={to} to={to} className="group flex min-h-[88px] items-center justify-between rounded-md border border-[#D6DEE6] bg-white px-4 shadow-[0_1px_3px_rgba(20,45,75,.08)] transition hover:-translate-y-0.5 hover:border-[#A9BDD4] hover:shadow-md"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-md ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></span><span><span className="block text-[13px] font-extrabold text-[#123C70]">{title}</span><span className="mt-1 block text-[10px] font-medium text-[#66788A]">{sub}</span></span></div><ArrowRight className="h-5 w-5 text-[#123C70] transition group-hover:translate-x-1" /></Link>)}
      </section>

      <section className="grid grid-cols-2 gap-3 px-4 pb-5 md:grid-cols-3 lg:grid-cols-6 lg:px-5">
        {[
          ['Jobs Evaluated', evaluated, FileCheck2, 'blue'],
          ['Scheduled This Month', scheduled, CheckCircle2, 'green'],
          ['Deferred', deferred, CalendarDays, 'amber'],
          ['Active Blocks (Week)', activeBlocks, TrainFront, 'blue'],
          ['Consolidated Blocks', consolidated, Layers3, 'purple'],
          ['Risk Coverage', `${riskCoverage}%`, ShieldCheck, 'green'],
        ].map(([label, value, Icon, tone]) => <div key={label} className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 shadow-sm"><div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-wider text-[#738496]">{label}</span><Icon className={`h-4 w-4 ${tone === 'green' ? 'text-[#16A878]' : tone === 'amber' ? 'text-[#E58B13]' : tone === 'purple' ? 'text-[#7353B6]' : 'text-[#2374E1]'}`} /></div><div className="mt-2 text-2xl font-black text-[#163F70]">{value}</div></div>)}
      </section>

      <section className="mx-4 mb-6 grid gap-4 lg:mx-5 lg:grid-cols-3">
        <div className="rounded-md border border-[#D6DEE6] bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E4EAF0] pb-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7C8E]">Current Planning Horizon</p><h2 className="mt-1 text-lg font-extrabold text-[#123C70]">{displayMonth}</h2></div><span className="rounded bg-[#E9F7F1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#16865F]">CP-SAT {weekly?.status || 'READY'}</span></div>
          <div className="grid grid-cols-2 gap-3 pt-4 md:grid-cols-4"><Metric label="Scheduled This Month" value={scheduled} /><Metric label="Deferred Next Month" value={deferred} /><Metric label="Sections" value={monthlySummary.sections_count ?? 5} /><Metric label="Weekly Blocks" value={activeBlocks} /></div>
        </div>
        <div className="rounded-md border border-[#D6DEE6] bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7C8E]">Planner Authority</p><div className="mt-3 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E7F0FC] text-sm font-black text-[#1F5EAC]">{currentRole?.badge || 'D'}</div><div><p className="text-sm font-extrabold text-[#123C70]">{currentRole?.shortName || currentRole?.name || 'Sr. DOM Pune'}</p><p className="text-[10px] text-[#718294]">{currentRole?.dept || 'Divisional Operations'}</p></div></div><div className="mt-4 flex items-center gap-2 border-t border-[#E4EAF0] pt-3 text-[10px] font-bold text-[#16865F]"><CheckCircle2 className="h-4 w-4" /> BDMS OUTBOUND READY</div></div>
      </section>
    </main>
  );
}

function Metric({ label, value }) { return <div className="rounded border border-[#E3E9EF] bg-[#F7F9FB] p-3"><p className="text-[9px] font-semibold text-[#738496]">{label}</p><p className="mt-1 text-xl font-black text-[#123C70]">{value}</p></div>; }
