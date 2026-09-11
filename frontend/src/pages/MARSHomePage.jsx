import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle2, FileCheck2, Layers3, ListChecks, Map, Play, ShieldCheck, TrainFront } from 'lucide-react';
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
      <section className="relative min-h-[500px] overflow-hidden border-b border-[#CBD6E2] bg-[#061E39] lg:min-h-[525px]">
        <BrandAsset
          name="vande_bharat_hero.jpg"
          alt="Vande Bharat train on an Indian railway corridor"
          className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
          fallback={null}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.62)_0%,rgba(0,0,0,.32)_25%,rgba(0,0,0,.06)_52%,rgba(0,0,0,.01)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.02)_0%,transparent_60%,rgba(0,0,0,.62)_100%)]" />
        <div className="absolute left-0 top-0 h-full w-[3px] bg-[#F2C94C]" />

        <div className="absolute right-7 top-6 z-20 lg:right-10 lg:top-7">
          <BrandAsset
            name="viksit_bharat_railways.png"
            alt="Viksit Bharat Viksit Railways"
            className="max-h-[88px] max-w-[205px] object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,.45)]"
            fallback={null}
          />
        </div>

        <div className="relative z-10 flex min-h-[500px] flex-col justify-between px-6 py-7 sm:px-8 lg:min-h-[525px] lg:px-14 lg:py-8">
          <div className="max-w-[620px] pt-1">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-8 w-[3px] bg-[#F2C94C]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[.26em] text-white/90">Pune Division (CR)</span>
            </div>

            <div className="flex flex-col items-start">
              <h1 className="m-0 text-[58px] font-black leading-[.86] tracking-[-.065em] text-[#F39A24] drop-shadow-[0_3px_10px_rgba(0,0,0,.42)] sm:text-[66px] lg:text-[76px]">MARS 2.0</h1>
              <div className="mt-3 font-[Noto_Sans_Devanagari,Arial,sans-serif] text-[24px] font-semibold leading-[1.15] tracking-[-.02em] text-white drop-shadow-[0_2px_7px_rgba(0,0,0,.5)] sm:text-[26px] lg:text-[29px]">
                सुरक्षित पथ<br />सशक्त भारत
              </div>
            </div>
          </div>

          <div className="relative flex items-end justify-between gap-5 pt-8">
            <BrandAsset
              name="india-pencil.jpg"
              alt="Indian railway heritage illustration"
              className="pointer-events-none absolute bottom-[-8px] left-[-18px] z-0 h-[150px] w-[390px] object-contain object-left-bottom opacity-42 mix-blend-screen drop-shadow-[0_3px_5px_rgba(0,0,0,.25)]"
              fallback={null}
            />
            <div className="relative z-10 w-[390px] border-l-[3px] border-[#F2C94C] pl-4 py-1 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.7)]">
              <div className="flex items-center gap-2 text-[14px] font-extrabold"><TrainFront className="h-4 w-4" /> Pune Division (CR)</div>
              <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-white/90">
                <span>People</span><span className="text-white/45">|</span><span>Performance</span><span className="text-white/45">|</span><span className="font-bold text-[#57D6A8]">Progress</span>
              </div>
              <div className="mt-2.5 flex h-[5px] w-[245px] overflow-hidden rounded-full bg-white/20 shadow-sm">
                <span className="w-[34%] bg-[#F2C94C]" /><span className="w-[33%] bg-white/85" /><span className="w-[33%] bg-[#16A878]" />
              </div>
              <div className="mt-1.5 flex w-[245px] justify-between text-[8px] font-bold uppercase tracking-wider text-white/80"><span>Division</span><span>Operational</span><span>On Track</span></div>
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