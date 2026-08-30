import { useState } from 'react'
import './login.css'

type Department = 'Engineering' | 'S&T' | 'Traction' | 'Divisional Planner'

export default function Login({ onLogin }: { onLogin: (department: Department) => void }) {
  const [department, setDepartment] = useState<Department>('Engineering')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.')
      return
    }
    onLogin(department)
  }

  return (
    <div className="login-page">
      <header className="login-portal-header">
        <div className="login-header-inner">
          <div className="railway-wheel" aria-hidden="true"><span>IR</span></div>
          <div className="login-government-copy"><strong>GOVERNMENT OF INDIA</strong><span>MINISTRY OF RAILWAYS</span><small>INDIAN RAILWAYS</small></div>
          <div className="login-header-divider" />
          <div className="login-portal-name"><strong>MARS</strong><span>Maintenance Allocation &amp; Routing System</span></div>
          <nav className="login-nav" aria-label="Portal navigation"><button type="button">Home</button><button type="button">About</button><button type="button" className="active">Login</button><button type="button">Contact</button></nav>
        </div>
      </header>

      <div className="login-accent-band" aria-hidden="true"><div className="rail-line rail-line-one" /><div className="rail-line rail-line-two" /><div className="rail-sleeper sleeper-one" /><div className="rail-sleeper sleeper-two" /><div className="rail-sleeper sleeper-three" /><div className="rail-sleeper sleeper-four" /><div className="rail-sleeper sleeper-five" /></div>

      <main className="login-main">
        <div className="login-breadcrumb">HOME <span>›</span> LOGIN</div>
        <div className="login-page-heading"><div className="heading-rule" /><span>RAILWAY MAINTENANCE OPERATIONS</span><div className="heading-rule" /></div>
        <section className="login-card-wrap">
          <form className="login-card" onSubmit={submit}>
            <div className="login-card-titlebar"><span>MARS</span><strong>USER LOGIN</strong></div>
            <div className="login-card-body">
              <p className="login-intro">Please enter your authorised railway credentials to access the Maintenance Allocation &amp; Routing System.</p>
              <label className="login-label">Department / Role<select value={department} onChange={e => setDepartment(e.target.value as Department)}><option>Engineering</option><option>S&amp;T</option><option>Traction</option><option>Divisional Planner</option></select></label>
              <label className="login-label">Employee ID<input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Employee ID" autoComplete="username" /></label>
              <label className="login-label">Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'HIDE' : 'SHOW'}</button></span></label>
              <div className="login-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Remember this device</span></label><button type="button" onClick={() => setError('Please contact your Divisional System Administrator for password recovery.')}>Forgot Password?</button></div>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="login-submit" type="submit">LOGIN <span>›</span></button>
              <div className="login-security"><span className="security-mark">✓</span><div><strong>Authorised Personnel Only</strong><small>Access is restricted to authorised Indian Railways users.</small></div></div>
            </div>
          </form>
          <div className="login-system-note">MARS Operational Planning System <b>•</b> Secure Government Network</div>
        </section>
      </main>

      <footer className="login-footer"><span>© 2026 MARS · Ministry of Railways, Government of India</span><span>Privacy · Security · Help Desk</span></footer>
    </div>
  )
}
