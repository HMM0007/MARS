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
      <header className="login-topbar">
        <div className="login-top-inner">
          <div className="login-emblem" aria-hidden="true"><span>IR</span></div>
          <div className="login-gov-text"><strong>GOVERNMENT OF INDIA</strong><span>MINISTRY OF RAILWAYS</span><small>INDIAN RAILWAYS</small></div>
          <nav className="login-nav" aria-label="Portal navigation"><button>Home</button><button>About</button><button className="active">Login</button><button>Contact</button></nav>
        </div>
      </header>

      <div className="login-banner">
        <div className="banner-track track-a" /><div className="banner-track track-b" />
        <div className="banner-sleeper s1" /><div className="banner-sleeper s2" /><div className="banner-sleeper s3" /><div className="banner-sleeper s4" /><div className="banner-sleeper s5" /><div className="banner-sleeper s6" />
        <div className="banner-copy"><span>RAILWAY OPERATIONS</span><strong>Maintenance Planning &amp; Coordination</strong></div>
      </div>

      <main className="login-content">
        <section className="login-left-panel">
          <div className="rail-illustration" aria-hidden="true">
            <div className="rail-horizon" />
            <div className="rail-line-art line-one" /><div className="rail-line-art line-two" />
            <div className="signal signal-one"><i /><b /></div><div className="signal signal-two"><i /><b /></div>
            <div className="train-art"><span className="engine-window" /><span className="engine-window second" /><span className="engine-wheel w1" /><span className="engine-wheel w2" /><span className="coach" /><span className="coach-window cw1" /><span className="coach-window cw2" /><span className="coach-window cw3" /></div>
          </div>
          <div className="login-left-overlay" />
          <div className="login-left-copy">
            <div className="mars-mark">M</div>
            <div className="mars-wordmark">MARS</div>
            <div className="mars-subtitle">Maintenance Allocation &amp; Routing System</div>
            <div className="left-divider" />
            <h1>Integrated Railway<br />Maintenance Operations</h1>
            <p>A unified operational platform for maintenance departments, block planning and divisional coordination.</p>
            <div className="department-badges"><span>ENGINEERING</span><span>S&amp;T</span><span>TRACTION</span></div>
          </div>
        </section>

        <section className="login-right-panel">
          <div className="portal-label"><span className="portal-dot" /> MARS USER MANAGEMENT PORTAL</div>
          <div className="login-heading"><h2>Login</h2><p>Sign in with your authorised railway credentials.</p></div>

          <form className="login-form" onSubmit={submit}>
            <label className="field-label">Department / Role
              <select value={department} onChange={e => setDepartment(e.target.value as Department)}>
                <option>Engineering</option><option>S&amp;T</option><option>Traction</option><option>Divisional Planner</option>
              </select>
            </label>
            <label className="field-label">Employee ID
              <input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Enter Employee ID" autoComplete="username" />
            </label>
            <label className="field-label">Password
              <span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter Password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'HIDE' : 'SHOW'}</button></span>
            </label>

            <div className="form-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Remember this device</span></label><button type="button" onClick={() => setError('Please contact your Divisional System Administrator for password recovery.')}>Forgot Password?</button></div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-button" type="submit">LOGIN <span>→</span></button>
          </form>

          <div className="login-notice"><div className="notice-icon">✓</div><div><strong>Authorised Railway Personnel</strong><p>This system is restricted to approved MARS users on the railway operations network.</p></div></div>
          <div className="login-footer-note">MARS Operational Planning System <b>•</b> Secure Government Network</div>
        </section>
      </main>

      <footer className="login-footer"><span>© 2026 MARS · Ministry of Railways, Government of India</span><span>Privacy · Security · Help Desk</span></footer>
    </div>
  )
}
