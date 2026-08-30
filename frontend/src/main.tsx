import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Login from './Login'
import { clearSession, getSession, saveSession, type Department } from './auth'
import './styles.css'
import './map-interactions.css'
import './login.css'

const AUTH_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function Root() {
  const existingSession = getSession()
  const [authenticated, setAuthenticated] = useState(Boolean(existingSession))
  const [currentSession, setCurrentSession] = useState(existingSession)

  const handleLogin = async (credentials: { employeeId: string; password: string; department: Department; rememberDevice?: boolean }) => {
    const response = await fetch(`${AUTH_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: credentials.employeeId,
        password: credentials.password,
        department: credentials.department,
      }),
    })

    let payload: any = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      throw new Error(payload?.detail || 'Invalid Employee ID, password, or department.')
    }

    const user = {
      employeeId: payload.user.employee_id,
      displayName: payload.user.name,
      department: payload.user.department as Department,
      role: payload.user.role as 'Department User' | 'Divisional Planner',
    }

    saveSession(user, Boolean(credentials.rememberDevice), payload.access_token)
    setCurrentSession(getSession())
    setAuthenticated(true)
  }

  const handleLogout = async () => {
    try {
      const token = getSession()?.accessToken
      await fetch(`${AUTH_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
    } catch {
      // Local logout still succeeds
    }
    clearSession()
    setCurrentSession(null)
    setAuthenticated(false)
  }

  if (!authenticated) return <Login onLogin={handleLogin} />

  return <App key={currentSession?.employeeId || currentSession?.department || 'default'} onLogout={handleLogout} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
