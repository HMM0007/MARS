export type Department = 'Engineering' | 'S&T' | 'Traction' | 'Divisional Planner'

export type MarsUser = {
  employeeId: string
  displayName: string
  department: Department
  role: 'Department User' | 'Divisional Planner'
}

type DemoCredential = MarsUser & { password: string }

/**
 * Temporary frontend-only authentication while the backend has no auth endpoint.
 * These demo credentials must be replaced by the backend authentication API before deployment.
 */
const DEMO_USERS: DemoCredential[] = [
  { employeeId: 'ENG001', password: 'MARS@123', displayName: 'Engineering User', department: 'Engineering', role: 'Department User' },
  { employeeId: 'SNT001', password: 'MARS@123', displayName: 'S&T User', department: 'S&T', role: 'Department User' },
  { employeeId: 'TRD001', password: 'MARS@123', displayName: 'Traction User', department: 'Traction', role: 'Department User' },
  { employeeId: 'PLAN001', password: 'MARS@123', displayName: 'Divisional Planner', department: 'Divisional Planner', role: 'Divisional Planner' },
]

const SESSION_KEY = 'mars.auth.session'

export function authenticate(employeeId: string, password: string, department: Department): MarsUser | null {
  const user = DEMO_USERS.find(
    candidate => candidate.employeeId.toLowerCase() === employeeId.trim().toLowerCase()
      && candidate.password === password
      && candidate.department === department,
  )

  if (!user) return null

  const { password: _password, ...sessionUser } = user
  return sessionUser
}

export function saveSession(user: MarsUser, rememberDevice: boolean) {
  const value = JSON.stringify(user)
  sessionStorage.setItem(SESSION_KEY, value)
  if (rememberDevice) localStorage.setItem(SESSION_KEY, value)
  else localStorage.removeItem(SESSION_KEY)
}

export function getSession(): MarsUser | null {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as MarsUser
  } catch {
    clearSession()
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
}
