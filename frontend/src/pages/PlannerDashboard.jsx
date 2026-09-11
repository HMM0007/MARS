/**
 * MARS 2.0 Planner Dashboard (Command Center)
 * Professional Government Railway Application
 * Railway Blue Theme - No Neon Colors
 */

import { useState, useEffect } from 'react';
import { fetchWeeklyPlan, fetchMonthlyPlan, fetchAllScoredJobs } from '../services/api';
import KPICards from '../components/KPICards';

const PlannerDashboard = () => {
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);
  const [scoredJobs, setScoredJobs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // One request per resource. KPICards receives weeklyPlan as a prop,
      // preventing a second CP-SAT execution for the same dashboard view.
      const [weekly, monthly, jobs] = await Promise.all([
        fetchWeeklyPlan(),
        fetchMonthlyPlan(),
        fetchAllScoredJobs(),
      ]);

      setWeeklyPlan(weekly);
      setMonthlyPlan(monthly);
      setScoredJobs(jobs);
    } catch (err) {
      setError(err.message || 'Unable to load MARS dashboard data');
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (error) {
    return (
      <main className="flex-1 bg-[#F4F6F8] p-6">
        <div className="bg-white border border-[#B42318] rounded-md p-5 text-[#B42318] shadow-sm">
          <p className="font-medium">Unable to load Command Center data</p>
          <p className="text-sm mt-1 text-[#52606D]">{error}</p>
          <p className="text-xs mt-2 text-[#52606D]">
            Check that FastAPI is running at http://127.0.0.1:8000 and that the dataset status endpoint is healthy.
          </p>
          <button
            onClick={loadData}
            className="mt-3 px-4 py-2 bg-[#1E3A5F] text-white rounded-md text-sm hover:bg-[#2F6F7E] transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </main>
    );
  }

  const weeklyMetrics = weeklyPlan?.metrics || {};
  const monthlySummary = monthlyPlan?.summary || {};

  return (
    <main className="flex-1 bg-[#F4F6F8] min-h-screen">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1F2933]">Command Center</h1>
            <p className="text-sm text-[#52606D] mt-1">
              Pune Division (CR) - Unified Block Planning System
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-[#2F8F6B] rounded-full" />
            <span className="text-sm text-[#52606D]">Backend Online</span>
          </div>
        </div>
      </div>

      <KPICards planData={weeklyPlan} loading={loading} />

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-[#1F2933]">Weekly Plan</h2>
              <span className="text-xs bg-[#1E3A5F] text-white px-2 py-1 rounded">Level 2 - CP-SAT</span>
            </div>
            {loading ? (
              <div className="space-y-2">
                <div className="animate-pulse h-4 bg-[#D6DEE6] rounded w-3/4" />
                <div className="animate-pulse h-4 bg-[#D6DEE6] rounded w-1/2" />
                <div className="animate-pulse h-4 bg-[#D6DEE6] rounded w-2/3" />
              </div>
            ) : weeklyPlan ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Solver Status</p>
                    <p className="font-medium text-[#1F2933]">{weeklyPlan.status}</p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Total Blocks</p>
                    <p className="font-medium text-[#1F2933]">{weeklyMetrics.total_blocks}</p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Jobs Scheduled</p>
                    <p className="font-medium text-[#1F2933]">{weeklyMetrics.total_jobs_scheduled}</p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Jobs Deferred</p>
                    <p className="font-medium text-[#1F2933]">{weeklyMetrics.total_jobs_deferred}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#D6DEE6]">
                  <p className="text-[#52606D] text-xs uppercase tracking-wide mb-2">Solve Time</p>
                  <p className="text-sm text-[#1F2933]">{weeklyPlan.solve_time_seconds.toFixed(2)}s</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-[#1F2933]">Monthly Plan</h2>
              <span className="text-xs bg-[#2F6F7E] text-white px-2 py-1 rounded">Level 1 - Bin Packing</span>
            </div>
            {loading ? (
              <div className="space-y-2">
                <div className="animate-pulse h-4 bg-[#D6DEE6] rounded w-3/4" />
                <div className="animate-pulse h-4 bg-[#D6DEE6] rounded w-1/2" />
              </div>
            ) : monthlyPlan ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Month</p>
                    <p className="font-medium text-[#1F2933]">{monthlyPlan.month}</p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Division</p>
                    <p className="font-medium text-[#1F2933]">{monthlyPlan.division}</p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Total Jobs</p>
                    <p className="font-medium text-[#1F2933]">{monthlySummary.total_jobs_evaluated}</p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">Scheduled</p>
                    <p className="font-medium text-[#1F2933]">{monthlySummary.scheduled_this_month}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#D6DEE6]">
                  <p className="text-[#52606D] text-xs uppercase tracking-wide mb-2">Deferred to Next Month</p>
                  <p className="text-sm text-[#1F2933]">{monthlySummary.deferred_next_month}</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-[#1F2933]">Quick Actions</h2>
            </div>
            <div className="space-y-3">
              <button onClick={loadData} className="w-full flex items-center space-x-3 px-4 py-3 border border-[#D6DEE6] rounded-md text-left hover:bg-[#F4F6F8] transition-colors text-sm text-[#1F2933]">
                <div className="w-8 h-8 bg-[#1E3A5F] rounded flex items-center justify-center"><span className="text-white text-xs font-bold">+</span></div>
                <span>Generate New Weekly Plan</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-4 py-3 border border-[#D6DEE6] rounded-md text-left hover:bg-[#F4F6F8] transition-colors text-sm text-[#1F2933]">
                <div className="w-8 h-8 bg-[#2F6F7E] rounded flex items-center justify-center"><span className="text-white text-xs font-bold">→</span></div>
                <span>Push to BDMS</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-4 py-3 border border-[#D6DEE6] rounded-md text-left hover:bg-[#F4F6F8] transition-colors text-sm text-[#1F2933]">
                <div className="w-8 h-8 bg-[#3B6EA5] rounded flex items-center justify-center"><span className="text-white text-xs font-bold">✓</span></div>
                <span>Compliance Certificate</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[#1F2933]">System Status</h2>
            <span className="text-xs text-[#52606D]">{scoredJobs?.length || 0} scored jobs loaded</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {['Backend API', 'TMS Adapter', 'SMMS Adapter', 'TDMS Adapter', 'COA Adapter', 'BDMS Adapter', 'Priority Engine', 'CP-SAT Solver'].map((label) => (
              <div key={label} className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
                <span className="text-[#1F2933]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default PlannerDashboard;
