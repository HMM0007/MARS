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
      setError('Enter your Employee ID and password to continue.')
      return
    }
    onLogin(department)
  }

  return (
    <div className="login-page">
      <header className="login-portal-header">
        <div className="login-header-inner">
          <div className="railway-wheel" aria-hidden="true"><span>IR</span></div>
          <div className="login-government-copy">
            <strong>GOVERNMENT OF INDIA</strong>
            <span>MINISTRY OF RAILWAYS</span>
          </div>
          <div className="login-header-divider" />
          <div className="login-portal-name">
            <strong>MARS</strong>
            <span>Maintenance Allocation &amp; Routing System</span>
          </div>
          <nav className="login-nav" aria-label="Portal navigation">
            <span>Operations</span><span>Help</span><span>Contact</span>
          </nav>
        </div>
      </header>

      <div className="login-accent-band" aria-hidden="true">
        <div className="rail-line rail-line-one" /><div className="rail-line rail-line-two" />
      </div>

      <main className="login-main">
        <div className="login-breadcrumb">HOME <span>›</span> SECURE ACCESS</div>
        <section className="login-card-wrap">
          <form className="login-card" onSubmit={submit}>
            <div className="login-card-titlebar">MARS LOGIN</div>
            <div className="login-card-body">
              <div className="login-card-intro">
                <h1>Secure Login</h1>
                <p>Authorised personnel access only</p>
              </div>

              <label className="login-label">Department
                <select value={department} onChange={e => setDepartment(e.target.value as Department)}>
                  <option>Engineering</option><option>S&amp;T</option><option>Traction</option><option>Divisional Planner</option>
                </select>
              </label>

              <label className="login-label">Employee ID
                <input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Enter Employee ID" autoComplete="username" />
              </label>

              <label className="login-label">Password
                <span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter Password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'HIDE' : 'SHOW'}</button></span>
              </label>

              <div className="login-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> <span>Remember this device</span></label><button type="button" onClick={() => setError('Please contact your Divisional System Administrator for password recovery.')}>Forgot password?</button></div>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button className="login-submit" type="submit">SIGN IN <span>→</span></button>

              <div className="login-security"><span className="security-mark">✓</span><div><strong>Authorised Railway Personnel</strong><small>This portal is restricted to approved MARS users.</small></div></div>
            </div>
          </form>
          <div className="login-system-note"><span>●</span> MARS Operational Planning System <b>•</b> Secure Government Network</div>
        </section>
      </main>

      <footer className="login-footer"><span>© 2026 MARS · Ministry of Railways, Government of India</span><span>Privacy · Security · Help Desk</span></footer>
    </div>
  )
}
