import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Login from './Login'
import { clearSession, getSession, saveSession, type Department } from './auth'
import './styles.css'
import './map-interactions.css'
import './login.css'

function Root() {
  const existingSession = getSession()
  const [authenticated, setAuthenticated] = useState(Boolean(existingSession))
  const [department, setDepartment] = useState<Department>(existingSession?.department || 'Engineering')

  const handleLogin = (selectedDepartment: Department) => {
    // The backend currently exposes no authentication endpoint. Until it does,
    // the selected department is stored as the authenticated frontend session.
    // Employee/password validation will move here when the backend auth API exists.
    const user = {
      employeeId: 'PENDING_BACKEND_AUTH',
      displayName: selectedDepartment === 'Divisional Planner' ? 'Divisional Planner' : `${selectedDepartment} User`,
      department: selectedDepartment,
      role: selectedDepartment === 'Divisional Planner' ? 'Divisional Planner' as const : 'Department User' as const,
    }
    saveSession(user, false)
    setDepartment(selectedDepartment)
    setAuthenticated(true)
  }

  const handleLogout = () => {
    clearSession()
    setAuthenticated(false)
  }

  if (!authenticated) return <Login onLogin={handleLogin} />

  return (
    <AppSessionBoundary department={department} onLogout={handleLogout} />
  )
}

function AppSessionBoundary({ department, onLogout }: { department: Department; onLogout: () => void }) {
  // Keep the session metadata available to the dashboard without changing its
  // existing visual/component structure. Role-specific filtering is the next
  // integration step once backend authentication is available.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mars:session', { detail: { department, onLogout } }))
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
