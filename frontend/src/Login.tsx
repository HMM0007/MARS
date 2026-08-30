import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './login.css'

type Department = 'Engineering' | 'S&T' | 'Traction' | 'Divisional Planner'
type PointerVars = React.CSSProperties & { '--px'?: string; '--py'?: string; '--dx'?: string; '--dy'?: string }

interface LoginProps {
  onLogin: (department: Department) => void
}

/* -------------------------------------------------------------------------- */
/* 3D Train Loader Component with Smooth Canvas Fade-In / Fade-Out Effects    */
/* -------------------------------------------------------------------------- */
function Train3DCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const trainGroupRef = useRef<THREE.Group | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 480
    const height = container.clientHeight || 160

    // Scene setup
    const scene = new THREE.Scene()

    // Camera setup - Positioned downside
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    camera.position.set(0, 0, 24)
    camera.lookAt(0, -1.8, 0)

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.35
    container.appendChild(renderer.domElement)

    // Studio Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 2.6)
    scene.add(ambient)

    const mainSun = new THREE.DirectionalLight(0xffffff, 4.0)
    mainSun.position.set(30, 35, 35)
    scene.add(mainSun)

    const fillLight = new THREE.DirectionalLight(0xffffff, 2.0)
    fillLight.position.set(-30, 20, -15)
    scene.add(fillLight)

    // Load train locomotive .glb
    const loader = new GLTFLoader()
    loader.load(
      '/train locomotive .glb',
      (gltf) => {
        const model = gltf.scene

        // Auto-center & Auto-scale
        const box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = 40 / maxDim
        model.scale.set(scale, scale, scale)

        const center = new THREE.Vector3()
        box.getCenter(center)
        model.position.sub(center.multiplyScalar(scale))

        // Position downside (-3.2)
        model.position.y = -3.2

        // Side View Orientation
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
      },
      undefined,
      (err) => {
        console.error('Error loading train locomotive .glb model:', err)
        setLoading(false)
      }
    )

    // Animation loop with continuous movement & smooth Canvas Fade In / Fade Out
    let animId: number
    let posX = -34

    const animate = () => {
      animId = requestAnimationFrame(animate)

      if (trainGroupRef.current) {
        posX += 0.08 // Slow & majestic cruising speed
        if (posX > 34) posX = -34
        trainGroupRef.current.position.x = posX

        // Calculate Fade-In and Fade-Out opacity based on posX position
        // Fade in from posX = -34 to -20, solid from -20 to 20, fade out from 20 to 34
        let alpha = 1.0
        if (posX < -20) {
          alpha = (posX - (-34)) / 14 // 0.0 -> 1.0 fade-in
        } else if (posX > 20) {
          alpha = (34 - posX) / 14 // 1.0 -> 0.0 fade-out
        }
        alpha = Math.max(0, Math.min(1, alpha))

        // Update WebGL Canvas opacity directly for silky smooth, glitch-free fading
        if (renderer.domElement) {
          renderer.domElement.style.opacity = alpha.toString()
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container) return
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
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div className="train-3d-viewport" ref={mountRef}>
      {loading && <div className="train-3d-loading">Loading 3D Train Locomotive (GLB)...</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Ashoka Chakra 24-Spoke Official National Symbol Component                  */
/* -------------------------------------------------------------------------- */
function AshokaChakraSVG({ className = "ashoka-chakra-symbol" }: { className?: string }) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15)
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      width="34"
      height="34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ashoka Chakra"
    >
      {/* Outer Ring */}
      <circle cx="50" cy="50" r="46" stroke="#000080" strokeWidth="4" />
      <circle cx="50" cy="50" r="41" stroke="#000080" strokeWidth="1.5" />
      {/* Center Hub */}
      <circle cx="50" cy="50" r="8" fill="#000080" />
      {/* 24 Spokes */}
      {spokes.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 50 50)`}>
          <line x1="50" y1="42" x2="50" y2="9" stroke="#000080" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="50" cy="7" r="1.6" fill="#000080" />
        </g>
      ))}
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Main Login Component                                                       */
/* -------------------------------------------------------------------------- */
export default function Login({ onLogin }: LoginProps) {
  const [department, setDepartment] = useState<Department>('Engineering')
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [pointer, setPointer] = useState({ x: 50, y: 50, dx: 0, dy: 0 })

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
      {/* Left Visual Panel - High Contrast, Static Layout */}
      <section className="login-visual-panel">
        <img
          className="login-railway-image"
          src="/railway-login.jpg"
          alt="Indian Railways locomotive"
        />
        <div className="login-visual-shade" />

        {/* MARS Brand Hero Block */}
        <div className="login-mars-hero">
          <div className="mars-brand-lockup centered-lockup">
            {/* Official Indian Railways Emblem Centered Above MARS */}
            <img
              src="/railway-symbol.png"
              alt="Indian Railways symbol"
              className="mars-brand-symbol-centered"
            />

            <div className="mars-brand-copy centered-copy">
              <div className="mars-lettering-wrap">
                {/* Clean Official MARS Typography */}
                <div className="mars-prof-lettering" aria-label="MARS">
                  <span className="mars-char">M</span>
                  <span className="mars-char">A</span>
                  <span className="mars-char">R</span>
                  <span className="mars-char">S</span>
                </div>

                {/* Continuous 3D Train Viewport */}
                <div className="mars-under-track-container">
                  <Train3DCanvas />
                </div>
              </div>

              <div className="mars-full-form">
                MAINTENANCE ALLOCATION &amp; ROUTING SYSTEM
              </div>
            </div>
          </div>

          <div className="mars-status centered-status">
            <span /> RAILWAY MAINTENANCE OPERATIONS
          </div>
        </div>

        <div className="login-visual-footer">
          MINISTRY OF INDIAN RAILWAYS <b>·</b> GOVERNMENT OF INDIA
        </div>
      </section>

      {/* Right Form Panel - Clean Official Government Style */}
      <section className="login-form-panel">
        <div className="railway-authority">
          <img
            src="/railway-symbol.png"
            alt="Indian Railways symbol"
            className="railway-symbol"
          />
          <div className="authority-titles">
            <strong>MINISTRY OF INDIAN RAILWAYS</strong>
            <span>Government of India</span>
          </div>
          <img
            src="/emblem.png"
            alt="State Emblem of India"
            className="ashoka-chakra-symbol"
          />
        </div>

        <div className="login-form-inner">
          <div className="login-welcome-hero">
            <span className="welcome-subtext">WELCOME TO</span>
            <div className="highlight-mars-brand">MARS</div>
          </div>

          <div className="login-heading-centered">
            <span className="heading-line" />
            <h1>OFFICIAL SYSTEM ACCESS</h1>
            <span className="heading-line" />
            <p>Authorised access to MARS operations</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <label className="field-label">
              Department / Role
              <select
                value={department}
                onChange={e => setDepartment(e.target.value as Department)}
              >
                <option value="Engineering">Engineering</option>
                <option value="S&T">S&amp;T</option>
                <option value="Traction">Traction</option>
                <option value="Divisional Planner">Divisional Planner</option>
              </select>
            </label>

            <label className="field-label">
              Employee ID
              <input
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="Enter Employee ID"
                autoComplete="username"
              />
            </label>

            <label className="field-label">
              Password
              <span className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </span>
            </label>

            <div className="form-options">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                <span>Remember this device</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setError('Please contact your Divisional System Administrator for password recovery.')
                }
              >
                Forgot Password?
              </button>
            </div>

            {error && <div className="login-error" role="alert">{error}</div>}

            <button className="login-button" type="submit">
              <span>LOGIN</span>
              <b>→</b>
            </button>
          </form>

          <div className="login-security-box">
            <div className="security-symbol">✓</div>
            <div>
              <strong>Authorised Personnel Only</strong>
              <p>This system is restricted to authorised Indian Railways personnel.</p>
            </div>
          </div>
        </div>

        <footer className="login-footer">
          MARS · Ministry of Indian Railways, Government of India{' '}
          <span>Secure Government Network</span>
        </footer>
      </section>
    </div>
  )
}
