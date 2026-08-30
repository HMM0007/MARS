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
  const [mouseX, setMouseX] = useState(50)
  const [mouseY, setMouseY] = useState(50)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.')
      return
    }
    onLogin(department)
  }

  const moveRailwayImage = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMouseX(((e.clientX - rect.left) / rect.width) * 100)
    setMouseY(((e.clientY - rect.top) / rect.height) * 100)
  }

  return (
    <div className="login-page">
      <section className="login-visual-panel" onMouseMove={moveRailwayImage}>
        <img
          className="login-railway-image"
          src="/railway-login.jpg"
          alt="Indian Railways locomotive"
          style={{ objectPosition: `${mouseX}% ${mouseY}%` }}
        />
        <div className="login-visual-shade" />

        <div className="mars-interactive" style={{ transform: `translate(${(mouseX - 50) * 0.12}px, ${(mouseY - 50) * 0.12}px)` }}>
          <span className="mars-interactive-small">MAINTENANCE ALLOCATION &amp; ROUTING SYSTEM</span>
          <strong>MARS</strong>
          <span className="mars-interactive-line" />
          <span className="mars-interactive-status">RAILWAY MAINTENANCE OPERATIONS</span>
        </div>

        <div className="railway-image-footer">
          <span>GOVERNMENT OF INDIA</span><b>•</b><span>MINISTRY OF RAILWAYS</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-top">
          <div className="railway-ministry-brand">
            <div className="railway-emblem" aria-hidden="true"><span>IR</span></div>
            <div><strong>MINISTRY OF INDIAN RAILWAYS</strong><small>GOVERNMENT OF INDIA</small></div>
          </div>
          <span className="login-help-links">Help &nbsp;|&nbsp; Contact</span>
        </div>

        <div className="login-form-inner">
          <div className="login-heading-block">
            <span className="login-section-kicker">MARS OPERATIONS PORTAL</span>
            <h1>USER LOGIN</h1>
            <div className="login-heading-rule" />
            <p>Sign in with your authorised railway credentials.</p>
          </div>

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
        </div>
        <footer className="login-footer"><span>© 2026 MARS · Ministry of Indian Railways</span><span>Secure Government Network</span></footer>
      </section>
    </div>
  )
}
