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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load all data in parallel
        const [weekly, monthly, jobs] = await Promise.all([
          fetchWeeklyPlan(),
          fetchMonthlyPlan(),
          fetchAllScoredJobs(),
        ]);

        setWeeklyPlan(weekly);
        setMonthlyPlan(monthly);
        setScoredJobs(jobs);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (error) {
    return (
      <main className="flex-1 bg-[#F4F6F8] p-6">
        <div className="bg-[#FEE] border border-[#B42318] rounded-md p-4 text-[#B42318]">
          <p className="font-medium">Connection Error</p>
          <p className="text-sm mt-1">
            Unable to connect to backend server. Please ensure the FastAPI backend 
            is running at http://127.0.0.1:8000
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-[#1E3A5F] text-white rounded-md text-sm hover:bg-[#2F6F7E] transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-[#F4F6F8] min-h-screen">
      {/* Dashboard Header */}
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1F2933]">
              Command Center
            </h1>
            <p className="text-sm text-[#52606D] mt-1">
              Pune Division (CR) - Unified Block Planning System
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-[#2F8F6B] rounded-full animate-pulse" />
            <span className="text-sm text-[#52606D]">Backend Online</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards />

      {/* Main Content Area */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Weekly Plan Summary */}
          <div className="bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-[#1F2933]">Weekly Plan</h2>
              <span className="text-xs bg-[#1E3A5F] text-white px-2 py-1 rounded">
                Level 2 - CP-SAT
              </span>
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
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Solver Status
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {weeklyPlan.solver_status || 'FEASIBLE'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Total Blocks
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {weeklyPlan.metrics?.total_blocks || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Jobs Scheduled
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {weeklyPlan.metrics?.total_jobs_scheduled || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Jobs Deferred
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {weeklyPlan.metrics?.total_jobs_deferred || 0}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#D6DEE6]">
                  <p className="text-[#52606D] text-xs uppercase tracking-wide mb-2">
                    Solve Time
                  </p>
                  <p className="text-sm text-[#1F2933]">
                    {weeklyPlan.metrics?.solve_time_seconds 
                      ? `${weeklyPlan.metrics.solve_time_seconds.toFixed(2)}s`
                      : '< 1s'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Monthly Plan Summary */}
          <div className="bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-[#1F2933]">Monthly Plan</h2>
              <span className="text-xs bg-[#2F6F7E] text-white px-2 py-1 rounded">
                Level 1 - Bin Packing
              </span>
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
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Month
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {monthlyPlan.month || 'September 2026'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Division
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {monthlyPlan.division || 'Pune Division (CR)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Total Jobs
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {monthlyPlan.summary?.total_jobs_evaluated || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#52606D] text-xs uppercase tracking-wide">
                      Scheduled
                    </p>
                    <p className="font-medium text-[#1F2933]">
                      {monthlyPlan.summary?.scheduled_this_month || 0}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#D6DEE6]">
                  <p className="text-[#52606D] text-xs uppercase tracking-wide mb-2">
                    Deferred to Next Month
                  </p>
                  <p className="text-sm text-[#1F2933]">
                    {monthlyPlan.summary?.deferred_next_month || 0}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Quick Actions */}
          <div className="bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-[#1F2933]">Quick Actions</h2>
            </div>
            <div className="space-y-3">
              <button className="w-full flex items-center space-x-3 px-4 py-3 border border-[#D6DEE6] rounded-md text-left hover:bg-[#F4F6F8] transition-colors text-sm text-[#1F2933]">
                <div className="w-8 h-8 bg-[#1E3A5F] rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">+</span>
                </div>
                <span>Generate New Weekly Plan</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-4 py-3 border border-[#D6DEE6] rounded-md text-left hover:bg-[#F4F6F8] transition-colors text-sm text-[#1F2933]">
                <div className="w-8 h-8 bg-[#2F6F7E] rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">→</span>
                </div>
                <span>Push to BDMS</span>
              </button>
              <button className="w-full flex items-center space-x-3 px-4 py-3 border border-[#D6DEE6] rounded-md text-left hover:bg-[#F4F6F8] transition-colors text-sm text-[#1F2933]">
                <div className="w-8 h-8 bg-[#3B6EA5] rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
                <span>Compliance Certificate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Data Status */}
        <div className="mt-6 bg-white border border-[#D6DEE6] rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[#1F2933]">System Status</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">Backend API</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">TMS Adapter</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">SMMS Adapter</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">TDMS Adapter</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">COA Adapter</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">BDMS Adapter</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">Priority Engine</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-[#2F8F6B] rounded-full" />
              <span className="text-[#1F2933]">CP-SAT Solver</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default PlannerDashboard;
