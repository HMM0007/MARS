/**
 * MARS 2.0 API Service Client
 * Professional Government Railway Application
 * Connects to FastAPI backend at port 8000
 */

const BASE_URL = 'http://127.0.0.1:8000';

// ============================================
// ADAPTER ENDPOINTS (Phase 2 Task A)
// ============================================

export const fetchTMSJobs = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/adapters/tms/jobs`);
  if (!response.ok) throw new Error('Failed to fetch TMS jobs');
  return response.json();
};

export const fetchSMMSJobs = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/adapters/smms/jobs`);
  if (!response.ok) throw new Error('Failed to fetch SMMS jobs');
  return response.json();
};

export const fetchTDMSJobs = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/adapters/tdms/jobs`);
  if (!response.ok) throw new Error('Failed to fetch TDMS jobs');
  return response.json();
};

export const fetchCOATimetable = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/adapters/coa/timetable`);
  if (!response.ok) throw new Error('Failed to fetch COA timetable');
  return response.json();
};

export const fetchFreightForecast = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/adapters/coa/freight-forecast`);
  if (!response.ok) throw new Error('Failed to fetch freight forecast');
  return response.json();
};

export const pushToBDMS = async (schedulePayload) => {
  const response = await fetch(`${BASE_URL}/api/v1/adapters/bdms/push-sanctions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(schedulePayload),
  });
  if (!response.ok) throw new Error('Failed to push to BDMS');
  return response.json();
};

// ============================================
// CORE ENDPOINTS (Phase 2 Tasks B, C, D)
// ============================================

export const fetchAllScoredJobs = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/core/jobs/all-scored`);
  if (!response.ok) throw new Error('Failed to fetch scored jobs');
  return response.json();
};

export const fetchMonthlyPlan = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/core/plan/monthly`);
  if (!response.ok) throw new Error('Failed to fetch monthly plan');
  return response.json();
};

export const fetchWeeklyPlan = async () => {
  const response = await fetch(`${BASE_URL}/api/v1/core/plan/weekly`);
  if (!response.ok) throw new Error('Failed to fetch weekly plan');
  return response.json();
};

// ============================================
// HEALTH & SYSTEM ENDPOINTS
// ============================================

export const fetchHealth = async () => {
  const response = await fetch(`${BASE_URL}/health`);
  if (!response.ok) throw new Error('Backend health check failed');
  return response.json();
};

export const fetchSystemInfo = async () => {
  const response = await fetch(`${BASE_URL}/`);
  if (!response.ok) throw new Error('Failed to fetch system info');
  return response.json();
};

// ============================================
// UTILITY: Fetch with error handling
// ============================================

export const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API Error ${response.status}: ${errorData.detail || response.statusText}`
      );
    }
    return response.json();
  } catch (error) {
    console.error('API Request Error:', error.message);
    throw error;
  }
};
