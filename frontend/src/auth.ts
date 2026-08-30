export type Department = 'Engineering' | 'S&T' | 'Traction' | 'Divisional Planner'

export type MarsUser = {
  employeeId: string
  displayName: string
  department: Department
  role: 'Department User' | 'Divisional Planner'
}

export type MarsSession = MarsUser & {
  accessToken: string
}

const SESSION_KEY = 'mars.auth.session'

export function saveSession(user: MarsUser, rememberDevice: boolean, accessToken = '') {
  const value = JSON.stringify({ ...user, accessToken })
  sessionStorage.setItem(SESSION_KEY, value)
  if (rememberDevice) localStorage.setItem(SESSION_KEY, value)
  else localStorage.removeItem(SESSION_KEY)
}

export function getSession(): MarsSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    const session = JSON.parse(raw) as MarsSession
    if (!session.employeeId || !session.department || !session.role) {
      clearSession()
      return null
    }
    return session
  } catch {
    clearSession()
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
}
