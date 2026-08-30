import { useState } from 'react'
import './login.css'
import railwayLoginImage from './assets/railway-login.svg'

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
      <section className="login-visual-panel">
        <img className="login-railway-image" src={railwayLoginImage} alt="Indian Railways maintenance operations" />
        <div className="login-visual-shade" />
        <div className="login-visual-content">
          <div className="login-gov-line">GOVERNMENT OF INDIA</div>
          <div className="login-ministry">MINISTRY OF RAILWAYS</div>
          <div className="login-brand-block">
            <div className="login-mars">MARS</div>
            <div className="login-mars-full">Maintenance Allocation &amp; Routing System</div>
          </div>
          <div className="login-visual-rule" />
          <h1>Railway Maintenance<br />Operations Portal</h1>
          <p>Integrated planning and coordination for Engineering, S&amp;T and Traction maintenance activities.</p>
          <div className="login-departments"><span>ENGINEERING</span><span>S&amp;T</span><span>TRACTION</span></div>
        </div>
        <div className="login-visual-footer">INDIAN RAILWAYS <b>•</b> AUTHORISED OPERATIONS PORTAL</div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-top"><span>INDIAN RAILWAYS</span><span>Help &nbsp;|&nbsp; Contact</span></div>
        <div className="login-form-inner">
          <div className="login-portal-heading">
            <div className="portal-accent" />
            <div>
              <span>MAINTENANCE ALLOCATION &amp; ROUTING SYSTEM</span>
              <h2>USER LOGIN</h2>
            </div>
          </div>
          <p className="login-welcome">Enter your authorised credentials to access the MARS operational portal.</p>

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
              <span className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter Password" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'HIDE' : 'SHOW'}</button>
              </span>
            </label>

            <div className="form-options">
              <label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Remember this device</span></label>
              <button type="button" onClick={() => setError('Please contact your Divisional System Administrator for password recovery.')}>Forgot Password?</button>
            </div>

            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-button" type="submit">LOGIN <span>→</span></button>
          </form>

          <div className="login-security-box">
            <div className="security-symbol">✓</div>
            <div><strong>Authorised Personnel Only</strong><p>This system is restricted to authorised Indian Railways personnel.</p></div>
          </div>

          <div className="login-help">For access issues, contact your Divisional System Administrator.</div>
        </div>
        <footer className="login-footer">© 2026 MARS · Ministry of Railways, Government of India <span>Secure Government Network</span></footer>
      </section>
    </div>
  )
}
