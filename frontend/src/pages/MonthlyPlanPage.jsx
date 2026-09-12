/**
 * MARS 2.0 Monthly Strategic Planning Console
 * Four-week section allocation and workload overview.
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Layers, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchMonthlyPlan } from '../services/api';

const WEEK_KEYS = ['week_1', 'week_2', 'week_3', 'week_4'];
const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const formatHours = (value) => `${Number(value || 0).toFixed(1)} h`;

const getSectionRows = (plan) => {
  const allocations = plan?.section_allocations || {};
  return Object.entries(allocations).map(([sectionId, section]) => ({
    section_id: sectionId,
    total: Number(section?.total_section_jobs || 0),
    scheduled: Number(section?.scheduled_this_month || 0),
    deferred: Number(section?.deferred_next_month || 0),
    weeks: section?.weekly_breakdown || {},
  }));
};

const MonthlyPlanPage = () => {
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setMonthlyPlan(await fetchMonthlyPlan());
    } catch (err) {
      console.error('Failed to load monthly plan:', err);
      setError(err.message || 'Unable to load the monthly plan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const summary = monthlyPlan?.summary || {};
  const sections = useMemo(() => getSectionRows(monthlyPlan), [monthlyPlan]);
  const weeklyTotals = useMemo(() => WEEK_KEYS.map((weekKey) => {
    let jobs = 0;
    let hours = 0;
    let capacity = 0;
    sections.forEach((section) => {
      const week = section.weeks?.[weekKey] || {};
      jobs += Number(week.job_count || 0);
      hours += Number(week.used_hours || 0);
      capacity += Number(week.capacity_hours || 0);
    });
    return { jobs, hours, capacity, utilization: capacity ? Math.min(100, (hours / capacity) * 100) : 0 };
  }), [sections]);

  const highestLoadSection = useMemo(() => {
    if (!sections.length) return null;
    return [...sections].sort((a, b) => b.scheduled - a.scheduled)[0];
  }, [sections]);

  const monthLabel = monthlyPlan?.month || 'Monthly plan';

  return (
    <main className="min-h-full bg-[#F4F6F8] p-3.5 font-sans text-[#1F2933]">
      <div className="mx-auto max-w-[1800px] space-y-3">
        <header className="rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CalendarDays className="h-5 w-5 text-[#1E3A5F]" />
                <h1 className="text-lg font-black uppercase tracking-wide text-[#1E3A5F]">Monthly Plan</h1>
                <span className="rounded border border-[#1E3A5F]/20 bg-[#1E3A5F]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#1E3A5F]">4-Week Planning View</span>
              </div>
              <p className="mt-1 text-[10px] text-[#718294]">{monthLabel} • Pune Division • Strategic maintenance allocation across railway sections</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 rounded bg-[#1E3A5F] px-3 py-1.5 text-[10px] font-bold text-white hover:bg-[#2F6F7E] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Plan
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded border border-[#C92A2A]/25 bg-[#C92A2A]/5 px-3 py-2 text-[10px] font-semibold text-[#C92A2A]">
            <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />{error}
          </div>
        )}

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Jobs reviewed', Number(summary.total_jobs_evaluated || 0), 'text-[#1E3A5F]'],
            ['Planned this month', Number(summary.scheduled_this_month || 0), 'text-[#2F9E44]'],
            ['Moved to next month', Number(summary.deferred_next_month || 0), 'text-[#C9842A]'],
            ['Shared work groups', Number(summary.consolidation_groups || 0), 'text-[#6B5B95]'],
          ].map(([label, value, valueClass]) => (
            <div key={label} className="rounded border border-[#D6DEE6] bg-white px-3 py-2.5 shadow-sm">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{label}</div>
              <div className={`mt-0.5 font-mono text-xl font-black ${valueClass}`}>{loading ? '—' : value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
          <div className="overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-sm">
            <div className="border-b border-[#D6DEE6] bg-[#FAFBFC] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Four-Week Workload</h2>
                  <p className="mt-0.5 text-[10px] text-[#718294]">How planned work is distributed across the month.</p>
                </div>
                <span className="rounded border border-[#D6DEE6] bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#52606D]">{summary.sections_count || 0} sections</span>
              </div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-[#D6DEE6]">
              {weeklyTotals.map((week, index) => (
                <div key={WEEK_KEYS[index]} className="min-w-0 px-3 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#718294]">{WEEK_LABELS[index]}</div>
                  <div className="mt-1 font-mono text-xl font-black text-[#1E3A5F]">{loading ? '—' : week.jobs}</div>
                  <div className="text-[9px] font-semibold text-[#52606D]">jobs planned</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-[#E9EEF2]">
                    <div className="h-full rounded bg-[#2F6F7E]" style={{ width: `${week.utilization}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[8px] font-bold text-[#718294]">
                    <span>{formatHours(week.hours)}</span><span>{week.utilization.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[#D6DEE6] bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#D6DEE6] pb-2">
              <CheckCircle2 className="h-4 w-4 text-[#2F9E44]" />
              <h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Planner Summary</h2>
            </div>
            <div className="mt-3 space-y-2.5 text-[10px]">
              <div className="flex items-center justify-between rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-2">
                <span className="text-[#718294]">Sections covered</span>
                <span className="font-mono font-black text-[#1E3A5F]">{summary.sections_count || 0}</span>
              </div>
              <div className="flex items-center justify-between rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-2">
                <span className="text-[#718294]">Planned work</span>
                <span className="font-mono font-black text-[#2F9E44]">{summary.scheduled_this_month || 0} jobs</span>
              </div>
              <div className="flex items-center justify-between rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-2">
                <span className="text-[#718294]">Next-month carryover</span>
                <span className="font-mono font-black text-[#C9842A]">{summary.deferred_next_month || 0} jobs</span>
              </div>
              <div className="flex items-center justify-between rounded border border-[#D6DEE6] bg-[#FAFBFC] px-2.5 py-2">
                <span className="text-[#718294]">Largest planned section</span>
                <span className="font-mono font-black text-[#1E3A5F]">{highestLoadSection?.section_id || '—'}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-[#D6DEE6] bg-white shadow-sm">
          <div className="border-b border-[#D6DEE6] bg-[#FAFBFC] px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#1E3A5F]" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-wide text-[#1E3A5F]">Section Allocation</h2>
                <p className="mt-0.5 text-[10px] text-[#718294]">Planned workload and available weekly capacity for each section.</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-[10px]">
              <thead>
                <tr className="border-b border-[#D6DEE6] bg-[#F4F6F8] text-[9px] font-bold uppercase tracking-wider text-[#52606D]">
                  <th className="px-3 py-2.5">Section</th>
                  <th className="px-3 py-2.5 text-right">Jobs</th>
                  <th className="px-3 py-2.5 text-right">Planned</th>
                  <th className="px-3 py-2.5 text-right">Carryover</th>
                  {WEEK_LABELS.map((label) => <th key={label} className="px-3 py-2.5 text-right">{label}</th>)}
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEE6]/70">
                {sections.map((section) => (
                  <tr key={section.section_id} className="hover:bg-[#FAFBFC]">
                    <td className="px-3 py-2.5 font-mono font-black text-[#1E3A5F]">{section.section_id}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#52606D]">{section.total}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#2F9E44]">{section.scheduled}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-[#C9842A]">{section.deferred}</td>
                    {WEEK_KEYS.map((weekKey) => {
                      const week = section.weeks?.[weekKey] || {};
                      return (
                        <td key={weekKey} className="px-3 py-2.5 text-right">
                          <div className="font-mono font-bold text-[#1F2933]">{week.job_count || 0}</div>
                          <div className="text-[8px] text-[#718294]">{formatHours(week.used_hours)}</div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded border border-[#2F9E44]/25 bg-[#2F9E44]/5 px-1.5 py-1 text-[8px] font-bold uppercase text-[#2F9E44]">
                        <CheckCircle2 className="h-3 w-3" /> Planned
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && !sections.length && (
                  <tr><td colSpan="9" className="px-3 py-8 text-center text-[10px] text-[#718294]">No monthly allocation is available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#D6DEE6] bg-white px-3.5 py-2.5 shadow-sm text-[9px] font-semibold text-[#52606D]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#2F9E44]" /> Planned</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#C9842A]" /> Carryover</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#6B5B95]" /> Shared work</span>
          </div>
          <span className="flex items-center gap-1 text-[#718294]"><CheckCircle2 className="h-3 w-3 text-[#2F9E44]" /> Plan generated from the Unified Job Pool</span>
        </section>
      </div>
    </main>
  );
};

export default MonthlyPlanPage;
