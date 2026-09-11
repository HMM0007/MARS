/**
 * MARS 2.0 API Service Client
 * Professional Government Railway Application
 * Connects to FastAPI backend at port 8000
 */

const BASE_URL = 'http://127.0.0.1:8000';

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message || errorData.detail || `${response.status} ${response.statusText}`
    );
  }
  return response.json();
};

// Normalize the backend weekly-plan contract once so every frontend component
// consumes the same stable shape. Backend remains authoritative.
const normalizeWeeklyPlan = (data) => {
  const metrics = data.weekly_metrics || data.metrics || {};
  const blocks = data.scheduled_blocks || data.blocks || [];

  return {
    ...data,
    status: data.status || data.solver_status || 'UNKNOWN',
    solver_status: data.solver_status || data.status || 'UNKNOWN',
    solve_time_seconds: Number(data.solve_time_seconds ?? metrics.solve_time_seconds ?? 0),
    metrics: {
      ...metrics,
      total_jobs_evaluated: Number(metrics.total_jobs_evaluated ?? 0),
      total_jobs_scheduled: Number(metrics.total_jobs_scheduled ?? metrics.scheduled_jobs_count ?? 0),
      total_jobs_deferred: Number(metrics.total_jobs_deferred ?? metrics.deferred_jobs_count ?? 0),
      total_blocks: Number(metrics.total_blocks ?? metrics.total_blocks_created ?? 0),
      consolidated_blocks: Number(metrics.consolidated_blocks ?? metrics.consolidated_blocks_count ?? 0),
      active_conflicts: Number(metrics.active_conflicts ?? 0),
      risk_coverage_percentage: Number(metrics.risk_coverage_percentage ?? 0),
      solve_time_seconds: Number(data.solve_time_seconds ?? metrics.solve_time_seconds ?? 0),
    },
    blocks,
    deferred_jobs: data.deferred_jobs || [],
  };
};

// ============================================
// ADAPTER ENDPOINTS
// ============================================

export const fetchTMSJobs = () => requestJson(`${BASE_URL}/api/v1/adapters/tms/jobs`);
export const fetchSMMSJobs = () => requestJson(`${BASE_URL}/api/v1/adapters/smms/jobs`);
export const fetchTDMSJobs = () => requestJson(`${BASE_URL}/api/v1/adapters/tdms/jobs`);
export const fetchCOATimetable = () => requestJson(`${BASE_URL}/api/v1/adapters/coa/timetable`);
export const fetchFreightForecast = () => requestJson(`${BASE_URL}/api/v1/adapters/coa/freight-forecast`);

export const pushToBDMS = (schedulePayload) => requestJson(
  `${BASE_URL}/api/v1/adapters/bdms/push-sanctions`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedulePayload),
  }
);

// ============================================
// CORE ENDPOINTS
// ============================================

export const fetchAllScoredJobs = () => requestJson(`${BASE_URL}/api/v1/core/jobs/all-scored`);
export const fetchMonthlyPlan = () => requestJson(`${BASE_URL}/api/v1/core/plan/monthly`);

export const fetchWeeklyPlan = async () => {
  const data = await requestJson(`${BASE_URL}/api/v1/core/plan/weekly`);
  return normalizeWeeklyPlan(data);
};

// ============================================
// HEALTH & DATA DIAGNOSTICS
// ============================================

export const fetchHealth = () => requestJson(`${BASE_URL}/health`);
export const fetchDatasetStatus = () => requestJson(`${BASE_URL}/api/v1/dataset/status`);
export const fetchSystemInfo = () => requestJson(`${BASE_URL}/`);

// ============================================
// UTILITY
// ============================================

export const apiRequest = async (endpoint, options = {}) => {
  return requestJson(`${BASE_URL}${endpoint}`, options);
};
