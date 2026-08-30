import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './login.css'

type Department = 'Engineering' | 'S&T' | 'Traction' | 'Divisional Planner'
type PointerVars = React.CSSProperties & { '--px'?: string; '--py'?: string; '--dx'?: string; '--dy'?: string }

interface LoginProps {
  onLogin: (credentials: { employeeId: string; password: string; department: Department; rememberDevice: boolean }) => Promise<void>
}

function Train3DCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const trainGroupRef = useRef<THREE.Group | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return
    const width = container.clientWidth || 480
    const height = container.clientHeight || 160
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    camera.position.set(0, 0, 24)
    camera.lookAt(0, -1.8, 0)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
    container.appendChild(renderer.domElement)
    scene.add(new THREE.AmbientLight(0xffffff, 2.6))
    const mainSun = new THREE.DirectionalLight(0xffffff, 4.0)
    mainSun.position.set(30, 35, 35)
    scene.add(mainSun)
    const fillLight = new THREE.DirectionalLight(0xffffff, 2.0)
    fillLight.position.set(-30, 20, -15)
    scene.add(fillLight)
    const loader = new GLTFLoader()
    loader.load('/train locomotive .glb', (gltf) => {
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      box.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 40 / maxDim
      model.scale.set(scale, scale, scale)
      const center = new THREE.Vector3()
      box.getCenter(center)
      model.position.sub(center.multiplyScalar(scale))
      model.position.y = -3.2
      model.rotation.y = Math.PI / 2
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
      const group = new THREE.Group()
      group.add(model)
      scene.add(group)
      trainGroupRef.current = group
      setLoading(false)
    }, undefined, () => setLoading(false))
    let animId: number
    let posX = -34
    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (trainGroupRef.current) {
        posX += 0.08
        if (posX > 34) posX = -34
        trainGroupRef.current.position.x = posX
        let alpha = 1
        if (posX < -20) alpha = (posX + 34) / 14
        else if (posX > 20) alpha = (34 - posX) / 14
        renderer.domElement.style.opacity = Math.max(0, Math.min(1, alpha)).toString()
      }
      renderer.render(scene, camera)
    }
    animate()
    const handleResize = () => {
      const w = container.clientWidth || 480
      const h = container.clientHeight || 160
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      if (renderer.domElement && container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div className="train-3d-viewport" ref={mountRef}>{loading && <div className="train-3d-loading">Loading 3D Train Locomotive (GLB)...</div>}</div>
}

export default function Login({ onLogin }: LoginProps) {
  const [department, setDepartment] = useState<Department>('Engineering')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [pointer, setPointer] = useState({ x: 50, y: 50, dx: 0, dy: 0 })
  const visualVars: PointerVars = { '--px': `${pointer.x}%`, '--py': `${pointer.y}%`, '--dx': `${pointer.dx}px`, '--dy': `${pointer.dy}px` }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.')
      return
    }
    setSubmitting(true)
    try {
      await onLogin({ employeeId: employeeId.trim(), password, department, rememberDevice: remember })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate with MARS backend.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual-panel" onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = ((e.clientX - rect.left) / rect.width) * 100
        const y = ((e.clientY - rect.top) / rect.height) * 100
        setPointer({ x, y, dx: (x - 50) / 4, dy: (y - 50) / 5 })
      }} onMouseLeave={() => setPointer({ x: 50, y: 50, dx: 0, dy: 0 })}>
        <img className="login-railway-image" src="/railway-login.jpg" alt="Indian Railways locomotive" />
        <div className="login-visual-shade" />
        <div className="login-cursor-light" style={{ left: `${pointer.x}%`, top: `${pointer.y}%` }} />
        <div className="login-mars-hero" style={visualVars}>
          <div className="mars-brand-lockup">
            <img src="/railway-symbol.png" alt="Indian Railways" className="mars-brand-symbol" />
            <div className="mars-brand-copy">
              <div className="mars-lettering"><span>M</span><span>A</span><span>R</span><span>S</span></div>
              <div className="mars-full-form">MAINTENANCE ALLOCATION &amp; ROUTING SYSTEM</div>
            </div>
          </div>
          <div className="mars-underline"><i /><i /><i /></div>
          <div className="mars-status"><span /> RAILWAY MAINTENANCE OPERATIONS</div>
        </div>
        <div className="login-visual-footer">MARS <b>•</b> INDIAN RAILWAYS <b>•</b> MAINTENANCE OPERATIONS</div>
      </section>

      <section className="login-form-panel">
        <div className="railway-authority"><img src="/railway-symbol.png" alt="Indian Railways symbol" className="railway-symbol" /><div><strong>MINISTRY OF INDIAN RAILWAYS</strong><span>Government of India</span></div></div>
        <div className="login-form-inner">
          <div className="login-heading-centered"><span className="heading-line" /><h1>USER LOGIN</h1><span className="heading-line" /><p>Authorised access to MARS operations</p></div>
          <form className="login-form" onSubmit={submit}>
            <label className="field-label">Department / Role<select value={department} onChange={e => setDepartment(e.target.value as Department)}><option>Engineering</option><option>S&amp;T</option><option>Traction</option><option>Divisional Planner</option></select></label>
            <label className="field-label">Employee ID<input value={employeeId} onChange={e => setEmployeeId(e.target.value)} placeholder="Enter Employee ID" autoComplete="username" /></label>
            <label className="field-label">Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter Password" autoComplete="current-password" /><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? 'HIDE' : 'SHOW'}</button></span></label>
            <div className="form-options"><label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Remember this device</span></label><button type="button" onClick={() => setError('Please contact your Divisional System Administrator for password recovery.')}>Forgot Password?</button></div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-button" type="submit" disabled={submitting}><span>{submitting ? 'AUTHENTICATING…' : 'LOGIN'}</span><b>→</b></button>
          </form>
          <div className="login-security-box"><div className="security-symbol">✓</div><div><strong>Authorised Personnel Only</strong><p>This system is restricted to authorised Indian Railways personnel.</p></div></div>
        </div>
        <footer className="login-footer">MARS · Ministry of Indian Railways, Government of India <span>Secure Government Network</span></footer>
      </section>
    </div>
  )
}
