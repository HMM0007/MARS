import { useState } from 'react'
import './login.css'

type Department = 'Engineering' | 'S&T' | 'Traction' | 'Divisional Planner'
type PointerVars = React.CSSProperties & { '--px'?: string; '--py'?: string; '--dx'?: string; '--dy'?: string }

export default function Login({ onLogin }: { onLogin: (department: Department) => void }) {
  const [department, setDepartment] = useState<Department>('Engineering')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [pointer, setPointer] = useState({ x: 50, y: 50, dx: 0, dy: 0 })
  const [marsActive, setMarsActive] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.')
      return
    }
    onLogin(department)
  }

  const handleVisualMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPointer({ x, y, dx: (x - 50) / 4, dy: (y - 50) / 5 })
  }

  const visualVars: PointerVars = { '--px': `${pointer.x}%`, '--py': `${pointer.y}%`, '--dx': `${pointer.dx}px`, '--dy': `${pointer.dy}px` }

  return (
    <div className="login-page">
      <section className="login-visual-panel" onMouseMove={handleVisualMove} onMouseLeave={() => setPointer({ x: 50, y: 50, dx: 0, dy: 0 })}>
        <img className="login-railway-image" src="/railway-login.jpg" alt="Indian Railways locomotive" />
        <div className="login-visual-shade" />
        <div className="login-cursor-light" style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }} />
        <div className={`login-mars-hero ${marsActive ? 'is-active' : ''}`} style={visualVars} onMouseEnter={() => setMarsActive(true)} onMouseLeave={() => setMarsActive(false)}>
          <div className="mars-brand-lockup">
            <img src="/railway-symbol.png" alt="Indian Railways" className="mars-brand-symbol" />
            <div className="mars-brand-copy">
              <div className="mars-lettering" aria-label="MARS"><span>M</span><span>A</span><span>R</span><span>S</span></div>
              <div className="mars-full-form">MAINTENANCE ALLOCATION &amp; ROUTING SYSTEM</div>
            </div>
          </div>
          <div className="mars-underline"><i /><i /><i /></div>
          <div className="mars-status"><span /> RAILWAY MAINTENANCE OPERATIONS</div>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="railway-authority">
          <img src="/railway-symbol.png" alt="Indian Railways symbol" className="railway-symbol" />
          <div><strong>MINISTRY OF INDIAN RAILWAYS</strong><span>Government of India</span></div>
        </div>
        <div className="login-form-inner">
          <div className="login-heading-centered"><span className="heading-line" /><h1>USER LOGIN</h1><span className="heading-line" /><p>Authorised access to MARS operations</p></div>
          <form className="login-form" onSubmit={submit}>
            <label className="field-label">Department / Role<select value={department} onChange={e => setDepartment(e.target.value as Department)}><option>Engineering</option><option>S&amp;T</option><option>Traction</option><option>Divisional Planner</option></select></label>
            <label className="field-label">Employee ID<input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Enter Employee ID" autoComplete="username" /></label>
            <label className="field-label">Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter Password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'HIDE' : 'SHOW'}</button></span></label>
            <div className="form-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Remember this device</span></label><button type="button" onClick={() => setError('Please contact your Divisional System Administrator for password recovery.')}>Forgot Password?</button></div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-button" type="submit"><span>LOGIN</span><b>→</b></button>
          </form>
          <div className="login-security-box"><div className="security-symbol">✓</div><div><strong>Authorised Personnel Only</strong><p>This system is restricted to authorised Indian Railways personnel.</p></div></div>
        </div>
        <footer className="login-footer">MARS · Ministry of Indian Railways, Government of India <span>Secure Government Network</span></footer>
      </section>
    </div>
  )
}
