import { getSession, type Department } from '../auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getAuthHeaders(): Record<string, string> {
  const session = getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session?.accessToken) {
    headers['Authorization'] = `Bearer ${session.accessToken}`
  }
  return headers
}

/* -------------------------------------------------------------------------- */
/* Maintenance Jobs API                                                       */
/* -------------------------------------------------------------------------- */
export async function fetchJobs(filters?: { department?: string; status?: string; section?: string; priority?: string }) {
  const params = new URLSearchParams()
  if (filters?.department && filters.department !== 'All') params.append('department', filters.department)
  if (filters?.status && filters.status !== 'All') params.append('status', filters.status)
  if (filters?.section) params.append('section', filters.section)
  if (filters?.priority && filters.priority !== 'All') params.append('priority', filters.priority)

  const url = `${API_BASE_URL}/api/jobs${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(url, { headers: getAuthHeaders() })
  if (!response.ok) throw new Error('Failed to fetch maintenance jobs.')
  return response.json()
}

export async function createJob(jobData: Record<string, any>) {
  const response = await fetch(`${API_BASE_URL}/api/jobs`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(jobData),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to create maintenance request.')
  }
  return response.json()
}

export async function updateJob(jobId: string, updates: Record<string, any>) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to update maintenance request.')
  }
  return response.json()
}

export async function deleteJob(jobId: string) {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to delete maintenance request.')
  }
  return response.json()
}

/* -------------------------------------------------------------------------- */
/* Conflicts & Notifications API                                              */
/* -------------------------------------------------------------------------- */
export async function fetchConflicts() {
  const response = await fetch(`${API_BASE_URL}/api/conflicts`, { headers: getAuthHeaders() })
  if (!response.ok) throw new Error('Failed to fetch conflict data.')
  return response.json()
}

export async function fetchNotifications(department?: string) {
  const url = `${API_BASE_URL}/api/notifications${department ? `?department=${department}` : ''}`
  const response = await fetch(url, { headers: getAuthHeaders() })
  if (!response.ok) throw new Error('Failed to fetch notifications.')
  return response.json()
}

export async function fetchAnalytics() {
  const response = await fetch(`${API_BASE_URL}/api/analytics`, { headers: getAuthHeaders() })
  if (!response.ok) throw new Error('Failed to fetch analytics metrics.')
  return response.json()
}

/* -------------------------------------------------------------------------- */
/* Optimization & Re-planning API                                             */
/* -------------------------------------------------------------------------- */
export async function generateOptimizationPlan() {
  const response = await fetch(`${API_BASE_URL}/api/plans/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to generate optimized plan.')
  return response.json()
}

export async function triggerReplanning(constraint: Record<string, any>) {
  const response = await fetch(`${API_BASE_URL}/api/replanning`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(constraint),
  })
  if (!response.ok) throw new Error('Failed to execute replanning.')
  return response.json()
}
