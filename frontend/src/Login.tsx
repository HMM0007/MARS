import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import './login.css'

export type Department = 'Engineering' | 'S&T' | 'Traction' | 'Divisional Planner'

interface LoginCredentials {
  employeeId: string
  password: string
  department: Department
  rememberDevice?: boolean
}

interface LoginProps {
  onLogin: (credentials: LoginCredentials) => Promise<void> | void
}

/* -------------------------------------------------------------------------- */
/* 3D Train Loader Component with Smooth Canvas Fade-In / Fade-Out Effects    */
/* -------------------------------------------------------------------------- */
function Train3DCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const trainGroupRef = useRef<THREE.Group | null>(null)
  const particlesRef = useRef<THREE.Points | null>(null)
  const pantographLightRef = useRef<THREE.PointLight | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const width = container.clientWidth || 480
    const height = container.clientHeight || 160

    // Scene setup
    const scene = new THREE.Scene()

    // Dynamic Camera setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    camera.position.set(0, 0.5, 22)
    camera.lookAt(0, -0.5, 0)

    // WebGL Renderer with High Dynamic Range Tone Mapping
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.5
    container.appendChild(renderer.domElement)

    // Cinematic Lighting Setup
    const ambient = new THREE.AmbientLight(0xffffff, 2.4)
    scene.add(ambient)

    const keySun = new THREE.DirectionalLight(0xfff7ed, 4.8)
    keySun.position.set(25, 30, 25)
    scene.add(keySun)

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 3.0)
    rimLight.position.set(-25, 20, -15)
    scene.add(rimLight)

    // Locomotive Front Headlamp Spotlight
    const headlight = new THREE.SpotLight(0xfff5ea, 8.0, 45, Math.PI / 6, 0.4)
    headlight.position.set(-8, 1, 4)
    headlight.target.position.set(-25, -2, 4)
    scene.add(headlight)
    scene.add(headlight.target)

    // OHE Pantograph Electrical Arc Light (Electric Blue Flicker)
    const pantoLight = new THREE.PointLight(0x38bdf8, 2.5, 15)
    pantoLight.position.set(2, 4.5, 0)
    scene.add(pantoLight)
    pantographLightRef.current = pantoLight

    // High-Speed Particle Speedlines
    const particleCount = 200
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 60     // X range
      positions[i + 1] = (Math.random() - 0.5) * 12 // Y range
      positions[i + 2] = (Math.random() - 0.5) * 20 // Z range
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const pMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.22,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    })

    const particleSystem = new THREE.Points(geometry, pMaterial)
    scene.add(particleSystem)
    particlesRef.current = particleSystem

    // Load 3D WAP-7 Locomotive GLB Model
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
        const scale = 38 / maxDim
        model.scale.set(scale, scale, scale)

        const center = new THREE.Vector3()
        box.getCenter(center)
        model.position.sub(center.multiplyScalar(scale))

        // Position & Dynamic Perspective Angle
        model.position.y = -2.2
        model.rotation.y = Math.PI * 0.28 // 3/4 Front View

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

    // Interactive Mouse Parallax Tracking
    let mouseX = 0
    let mouseY = 0
    const onMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((event.clientX - rect.left) / container.clientWidth - 0.5) * 2
      mouseY = ((event.clientY - rect.top) / container.clientHeight - 0.5) * 2
    }
    container.addEventListener('mousemove', onMouseMove)

    // High-Impact Cinematic Animation Loop with Movable Train & Particle Wind
    let animId: number
    let clock = new THREE.Clock()
    let posX = -34

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      // 1. Continuous Horizontal Motion across track (Left to Right)
      posX += 0.08
      if (posX > 34) posX = -34

      // Calculate Fade-In and Fade-Out opacity for smooth edge entry/exit
      let alpha = 1.0
      if (posX < -20) {
        alpha = (posX - (-34)) / 14
      } else if (posX > 20) {
        alpha = (34 - posX) / 14
      }
      alpha = Math.max(0, Math.min(1, alpha))

      if (renderer.domElement) {
        renderer.domElement.style.opacity = alpha.toString()
      }

      // 2. High-speed rail movement, micro-vibrations & camera sway
      if (trainGroupRef.current) {
        trainGroupRef.current.position.x = posX
        trainGroupRef.current.position.y = -2.2 + Math.sin(elapsedTime * 4) * 0.05
        trainGroupRef.current.rotation.z = Math.sin(elapsedTime * 2.5) * 0.012
        trainGroupRef.current.rotation.y = (Math.PI * 0.28) + Math.cos(elapsedTime * 0.6) * 0.04 + mouseX * 0.1
      }

      // 2. Dynamic Pantograph Electrical Arc Flicker
      if (pantographLightRef.current) {
        pantographLightRef.current.intensity = Math.random() > 0.82 ? 4.5 : 1.2 + Math.sin(elapsedTime * 10) * 0.8
      }

      // 3. High-Speed Particle Speedlines Stream Effect
      if (particlesRef.current) {
        const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute
        const arr = posAttr.array as Float32Array
        for (let i = 0; i < particleCount * 3; i += 3) {
          arr[i] += 0.45 // High-speed particle stream
          if (arr[i] > 30) arr[i] = -30
        }
        posAttr.needsUpdate = true
      }

      // 4. Smooth Camera Parallax Response
      camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.05
      camera.position.y += (-mouseY * 0.8 + 0.5 - camera.position.y) * 0.05
      camera.lookAt(0, -0.5, 0)

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
      container.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', handleResize)
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  return (
    <div className="train-3d-viewport" ref={mountRef}>
      {loading && <div className="train-3d-loading">Loading High-Speed Telemetry Viewport…</div>}
    </div>
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
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.')
      return
    }

    setSubmitting(true)
    try {
      await onLogin({
        employeeId: employeeId.trim(),
        password,
        department,
        rememberDevice: remember,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate with MARS backend.')
    } finally {
      setSubmitting(false)
    }
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
                {/* Official Clean High-Trust MARS Brand Title */}
                <h1 className="mars-gov-title" aria-label="MARS">MARS</h1>
                <div className="mars-gov-tricolor-divider" />

                {/* Continuous 3D Train Viewport */}
                <div className="mars-under-track-container">
                  <Train3DCanvas />
                </div>
              </div>

              <div className="mars-full-form">
                परिरक्षण वाटप और मार्गनियोजन प्रणाली · MAINTENANCE ALLOCATION &amp; ROUTING SYSTEM
              </div>
            </div>
          </div>

          <div className="mars-status centered-status">
            <span /> भारतीय रेल · INDIAN RAILWAYS DIVISIONAL OPERATIONS
          </div>
        </div>

        <div className="login-visual-footer">
          MINISTRY OF RAILWAYS <b>·</b> GOVERNMENT OF INDIA
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
            <strong>MINISTRY OF RAILWAYS · रेल मंत्रालय</strong>
            <span>Government of India · भारत सरकार</span>
          </div>
          <img
            src="/emblem.png"
            alt="State Emblem of India"
            className="ashoka-chakra-symbol"
          />
        </div>

        <div className="login-form-inner">
          {/* Stacked Welcome Header */}
          <div className="login-welcome-hero">
            <span className="welcome-subtext">WELCOME TO</span>
            <div className="highlight-mars-brand">MARS</div>
          </div>

          {/* Form Section Title */}
          <div className="login-heading-centered">
            <span className="heading-line" />
            <h1>OFFICIAL SYSTEM ACCESS</h1>
            <span className="heading-line" />
            <p>Authorised credentials required for MARS operations</p>
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
                placeholder="Enter Official Employee ID"
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

            <button className="login-button" type="submit" disabled={submitting}>
              <span>{submitting ? 'AUTHENTICATING…' : 'AUTHORISED LOGIN'}</span>
            </button>
          </form>
        </div>

        <footer className="login-footer">
          MARS · Ministry of Railways, Government of India{' '}
          <span>Secure Government Network · IR-NET</span>
        </footer>
      </section>
    </div>
  )
}
