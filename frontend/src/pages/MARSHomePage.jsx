import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function MARSHomePage({ currentRole }) {
  const [weekly, setWeekly] = useState(null);
  const [monthly, setMonthly] = useState(null);

  useEffect(() => {
    Promise.all([fetchWeeklyPlan().catch(() => null), fetchMonthlyPlan().catch(() => null)]).then(([w, m]) => {
      setWeekly(w);
      setMonthly(m);
    });
  }, []);

  const metrics = weekly?.metrics || weekly?.weekly_metrics || {};
  const monthlySummary = monthly?.summary || {};
  const scheduled = metrics.total_jobs_scheduled ?? metrics.scheduled_jobs_count ?? 0;
  const deferred = metrics.total_jobs_deferred ?? metrics.deferred_jobs_count ?? 0;
  const activeBlocks = metrics.total_blocks ?? metrics.total_blocks_created ?? weekly?.blocks?.length ?? 0;
  const consolidated = metrics.consolidated_blocks ?? metrics.consolidated_blocks_count ?? 0;
  const evaluated = metrics.total_jobs_evaluated ?? 150;
  const riskCoverage = metrics.risk_coverage_percentage ?? 0;
  const displayMonth = useMemo(() => monthly?.month || 'September 2026', [monthly]);

  return (
    <main className="min-h-full bg-[#EEF2F6] text-[#17345C]">
      <section className="relative min-h-[480px] overflow-hidden border-b border-[#CBD6E2] bg-[#08294D]">
        <BrandAsset
          name="vande_bharat_hero.jpg"
          alt="Vande Bharat train on an Indian railway corridor"
          className="absolute inset-0 h-full w-full object-cover object-center"
          fallback={null}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#041A32]/95 via-[#06284B]/80 to-[#06284B]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#041A32]/75 via-transparent to-transparent" />
        <div className="absolute left-0 top-0 h-full w-1 bg-[#F2C94C]" />

        <div className="relative z-10 flex min-h-[480px] flex-col justify-between px-7 py-7 lg:px-11 lg:py-9">
          <div className="max-w-[760px] pt-3">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-8 w-1 bg-[#F2C94C]" />
              <span className="text-[12px] font-bold uppercase tracking-[.24em] text-white/90">Pune Division (CR)</span>
            </div>

            <div className="flex items-center gap-4">
              <h1 className="text-6xl font-black tracking-[-.04em] text-white drop-shadow-lg lg:text-[70px]">MARS 2.0</h1>
              <span className="hidden h-16 w-px bg-white/50 sm:block" />
              <div className="hidden text-3xl font-semibold leading-tight text-white sm:block">सुरक्षित पथ<br />सशक्त भारत</div>
            </div>

            <p className="mt-4 text-xl font-semibold leading-snug text-white lg:text-[23px]">AI-Powered Maintenance Planning<br />for a More Reliable Tomorrow</p>

            <div className="mt-7 flex flex-wrap">
              {[
                [Gauge, 'OPTIMIZE', 'BLOCKS'],
                [Wrench, 'MAXIMIZE', 'ASSET AVAILABILITY'],
                [Layers3, 'UNIFY', 'DEPARTMENTS'],
                [ListChecks, 'ENABLE', 'DATA-DRIVEN DECISIONS'],
              ].map(([Icon, a, b], i) => (
                <div key={a} className={`flex min-w-[145px] items-center border-white/30 py-2 pr-5 ${i > 0 ? 'border-l pl-5' : ''}`}>
                  <Icon className="mr-3 h-7 w-7 shrink-0 text-white" strokeWidth={1.7} />
                  <div className="text-[10px] font-extrabold leading-tight tracking-wide text-white">{a}<br />{b}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-end justify-between gap-6">
            <div className="border-l-4 border-[#F2C94C] bg-[#041A32]/70 px-5 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-white"><TrainFront className="h-4 w-4" /> Pune Division (CR)</div>
              <div className="mt-1 text-[10px] text-white/80">People &nbsp;|&nbsp; Performance &nbsp;|&nbsp; Progress</div>
              <div className="mt-2 h-1 w-52 bg-white/20"><div className="h-full w-[70%] bg-gradient-to-r from-[#F2C94C] via-white to-[#16A878]" /></div>
            </div>
            <BrandAsset name="viksit_bharat_railways.png" alt="Viksit Bharat Viksit Railways" className="hidden max-h-24 max-w-64 object-contain drop-shadow-lg lg:block" />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-8 right-10 hidden text-right lg:block">
          <div className="text-5xl font-black tracking-tight text-white/15">INDIAN RAILWAYS</div>
          <div className="mt-1 text-[9px] font-bold tracking-[.42em] text-white/25">SAFETY • SERVICE • PROGRESS</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 bg-[#EEF2F6] p-4 md:grid-cols-2 xl:grid-cols-5 xl:px-5">
        {quickActions.map(({ to, icon: Icon, title, sub, tone }) => (
          <Link key={to} to={to} className="group flex min-h-[88px] items-center justify-between rounded-md border border-[#D6DEE6] bg-white px-4 shadow-[0_1px_3px_rgba(20,45,75,.08)] transition hover:-translate-y-0.5 hover:border-[#A9BDD4] hover:shadow-md">
            <div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-md ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></span><span><span className="block text-[13px] font-extrabold text-[#123C70]">{title}</span><span className="mt-1 block text-[10px] font-medium text-[#66788A]">{sub}</span></span></div>
            <ArrowRight className="h-5 w-5 text-[#123C70] transition group-hover:translate-x-1" />
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3 px-4 pb-5 md:grid-cols-3 lg:grid-cols-6 lg:px-5">
        {[
          ['Jobs Evaluated', evaluated, FileCheck2, 'blue'],
          ['Scheduled', scheduled, CheckCircle2, 'green'],
          ['Deferred', deferred, CalendarDays, 'amber'],
          ['Active Blocks', activeBlocks, TrainFront, 'blue'],
          ['Consolidated', consolidated, Layers3, 'purple'],
          ['Risk Coverage', `${riskCoverage}%`, ShieldCheck, 'green'],
        ].map(([label, value, Icon, tone]) => (
          <div key={label} className="rounded-md border border-[#D6DEE6] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-wider text-[#738496]">{label}</span><Icon className={`h-4 w-4 ${tone === 'green' ? 'text-[#16A878]' : tone === 'amber' ? 'text-[#E58B13]' : tone === 'purple' ? 'text-[#7353B6]' : 'text-[#2374E1]'}`} /></div>
            <div className="mt-2 text-2xl font-black text-[#163F70]">{value}</div>
          </div>
        ))}
      </section>

      <section className="mx-4 mb-6 grid gap-4 lg:mx-5 lg:grid-cols-3">
        <div className="rounded-md border border-[#D6DEE6] bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E4EAF0] pb-3"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7C8E]">Current Planning Horizon</p><h2 className="mt-1 text-lg font-extrabold text-[#123C70]">{displayMonth}</h2></div><span className="rounded bg-[#E9F7F1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#16865F]">CP-SAT {weekly?.status || 'READY'}</span></div>
          <div className="grid grid-cols-2 gap-3 pt-4 md:grid-cols-4"><Metric label="Scheduled This Month" value={monthlySummary.scheduled_this_month ?? 0} /><Metric label="Deferred Next Month" value={monthlySummary.deferred_next_month ?? 0} /><Metric label="Sections" value={monthlySummary.sections_count ?? 5} /><Metric label="Weekly Blocks" value={activeBlocks} /></div>
        </div>
        <div className="rounded-md border border-[#D6DEE6] bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7C8E]">Planner Authority</p><div className="mt-3 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E7F0FC] text-sm font-black text-[#1F5EAC]">{currentRole?.badge || 'D'}</div><div><p className="text-sm font-extrabold text-[#123C70]">{currentRole?.name || 'Sr. DOM Pune'}</p><p className="text-[10px] text-[#718294]">{currentRole?.dept || 'Divisional Operations'}</p></div></div><div className="mt-4 flex items-center gap-2 border-t border-[#E4EAF0] pt-3 text-[10px] font-bold text-[#16865F]"><CheckCircle2 className="h-4 w-4" /> BDMS OUTBOUND READY</div></div>
      </section>
    </main>
  );
}

function Metric({ label, value }) { return <div className="rounded border border-[#E3E9EF] bg-[#F7F9FB] p-3"><p className="text-[9px] font-semibold text-[#738496]">{label}</p><p className="mt-1 text-xl font-black text-[#123C70]">{value}</p></div>; }
