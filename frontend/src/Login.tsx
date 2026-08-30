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
      <header className="login-government-bar">
        <div className="login-gov-inner">
          <div className="rail-emblem" aria-hidden="true"><span>रेल</span></div>
          <div><strong>GOVERNMENT OF INDIA</strong><span>MINISTRY OF RAILWAYS</span></div>
          <div className="login-secure">AUTHORISED RAILWAY SYSTEM</div>
        </div>
      </header>

      <main className="login-main">
        <section className="login-brand-panel">
          <div className="rail-track-art" aria-hidden="true"><i /><i /><i /></div>
          <div className="login-brand-lockup">
            <div className="mars-seal">M</div>
            <div><div className="login-mars">MARS</div><div className="login-full">Maintenance Allocation &amp; Routing System</div></div>
          </div>
          <div className="login-rule" />
          <h1>Integrated Maintenance<br />Planning &amp; Coordination</h1>
          <p>Secure operational access for railway maintenance departments and divisional planners.</p>
          <div className="login-dept-strip"><span>ENGINEERING</span><span>S&amp;T</span><span>TRACTION</span></div>
        </section>

        <section className="login-card-wrap">
          <form className="login-card" onSubmit={submit}>
            <div className="login-card-head"><span className="login-kicker">MARS / SECURE ACCESS</span><h2>Sign in</h2><p>Use your authorised railway credentials.</p></div>

            <label className="login-label">Department
              <select value={department} onChange={e => setDepartment(e.target.value as Department)}>
                <option>Engineering</option><option>S&amp;T</option><option>Traction</option><option>Divisional Planner</option>
              </select>
            </label>

            <label className="login-label">Employee ID
              <input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Enter employee ID" autoComplete="username" />
            </label>

            <label className="login-label">Password
              <span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'HIDE' : 'SHOW'}</button></span>
            </label>

            <div className="login-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> <span>Remember this device</span></label><button type="button" onClick={() => setError('Please contact your system administrator for password recovery.')}>Forgot password?</button></div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit">SIGN IN <span>→</span></button>
            <div className="login-security"><span>▣</span><div><strong>Protected operational access</strong><small>Access is restricted to authorised personnel.</small></div></div>
          </form>
          <p className="login-support">For access issues, contact your Divisional System Administrator.</p>
        </section>
      </main>

      <footer className="login-footer"><span>© 2024 MARS · Indian Railways</span><span>Operational Planning System</span><span>Privacy · Security · Help</span></footer>
    </div>
  )
}
