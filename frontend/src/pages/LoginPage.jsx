import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './login.css';

export const ROLE_CONFIGS = {
  'Divisional Planner (Sr. DOM)': {
    id: 'planner',
    login_id: 'planner',
    name: 'Sr. DOM Pune',
    shortName: 'Sr. DOM Pune',
    dept: 'Operations',
    departmentLabel: 'Divisional Planner (Sr. DOM)',
    badge: 'D',
    employeeId: 'PLAN001',
    password: 'ir-pune-2026',
    defaultRoute: '/',
  },
  'Civil Engineering Dept': {
    id: 'engineering',
    login_id: 'engg',
    name: 'Sr. DEN (Civil)',
    shortName: 'Sr. DEN (Civil)',
    dept: 'Civil Engineering',
    departmentLabel: 'Civil Engineering Dept',
    badge: 'E',
    employeeId: 'ENG001',
    password: 'ir-pune-2026',
    defaultRoute: '/dept/engineering',
  },
  'Signalling & Telecom Dept': {
    id: 'snt',
    login_id: 'snt',
    name: 'Sr. DSTE (Signals)',
    shortName: 'Sr. DSTE (Signals)',
    dept: 'Signalling & Telecom',
    departmentLabel: 'Signalling & Telecom Dept',
    badge: 'S',
    employeeId: 'SNT001',
    password: 'ir-pune-2026',
    defaultRoute: '/dept/snt',
  },
  'Traction Distribution Dept': {
    id: 'traction',
    login_id: 'trac',
    name: 'Sr. DEE (TRD)',
    shortName: 'Sr. DEE (TRD)',
    dept: 'Traction',
    departmentLabel: 'Traction Distribution Dept',
    badge: 'T',
    employeeId: 'TRD001',
    password: 'ir-pune-2026',
    defaultRoute: '/dept/traction',
  },
};

/* -------------------------------------------------------------------------- */
/* 3D Train Loader Component with Smooth Canvas Fade-In / Fade-Out Effects    */
/* -------------------------------------------------------------------------- */
function Train3DCanvas() {
  const mountRef = useRef(null);
  const trainGroupRef = useRef(null);
  const particlesRef = useRef(null);
  const pantographLightRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 160;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) {
      console.warn('WebGL not available for 3D train, continuing in 2D mode', e);
      setLoading(false);
      return;
    }

    // Scene setup
    const scene = new THREE.Scene();

    // Side-view camera — locked, no parallax so train stays perfectly horizontal
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 1000);
    camera.position.set(0, 1, 18);
    camera.lookAt(0, -0.5, 0);

    // WebGL Renderer with High Dynamic Range Tone Mapping
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    // Cinematic Lighting Setup
    const ambient = new THREE.AmbientLight(0xffffff, 2.6);
    scene.add(ambient);

    const keySun = new THREE.DirectionalLight(0xfff7ed, 4.8);
    keySun.position.set(25, 30, 25);
    scene.add(keySun);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 3.0);
    rimLight.position.set(-25, 20, -15);
    scene.add(rimLight);

    // Locomotive Front Headlamp Spotlight (pointing right along track)
    const headlight = new THREE.SpotLight(0xfff5ea, 8.0, 45, Math.PI / 6, 0.4);
    headlight.position.set(8, 0, 2);
    headlight.target.position.set(25, 0, 2);
    scene.add(headlight);
    scene.add(headlight.target);

    // OHE Pantograph Electrical Arc Light (Electric Blue Flicker)
    const pantoLight = new THREE.PointLight(0x38bdf8, 2.5, 15);
    pantoLight.position.set(0, 2.5, 0);
    scene.add(pantoLight);
    pantographLightRef.current = pantoLight;

    // High-Speed Particle Speedlines
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 60;     // X range
      positions[i + 1] = (Math.random() - 0.5) * 12; // Y range
      positions[i + 2] = (Math.random() - 0.5) * 20; // Z range
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.22,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(geometry, pMaterial);
    scene.add(particleSystem);
    particlesRef.current = particleSystem;

    // Load 3D WAP-7 Locomotive GLB Model
    const loader = new GLTFLoader();
    const setupLocomotiveModel = (gltf) => {
      const model = gltf.scene;

      // Hide background tracks/camera/sun so only locomotive is displayed and measured
      model.traverse((child) => {
        const name = (child.name || '').toLowerCase();
        if (name.includes('track') || name.includes('camera') || name.includes('sun')) {
          child.visible = false;
        } else if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Calculate bounding box strictly of the locomotive
      const box = new THREE.Box3();
      model.traverse((child) => {
        if (child.isMesh && child.visible) {
          box.expandByObject(child);
        }
      });

      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 44 / maxDim;
      model.scale.set(scale, scale, scale);

      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.set(
        -center.x * scale,
        -center.y * scale,
        -center.z * scale
      );

      // Rotate model so camera (at +Z) sees the SIDE of the train
      model.rotation.x = 0;
      model.rotation.y = 0; // Side profile visible from Z-axis camera
      model.rotation.z = 0;

      const group = new THREE.Group();
      group.add(model);
      scene.add(group);
      trainGroupRef.current = group;
      setLoading(false);
    };

    const glbPath = '/train locomotive .glb';
    loader.load(
      glbPath,
      setupLocomotiveModel,
      undefined,
      (err) => {
        console.warn('Could not load primary GLB path, trying fallback /train_locomotive.glb:', err);
        loader.load(
          '/train_locomotive.glb',
          setupLocomotiveModel,
          undefined,
          (err2) => {
            console.error('3D train model load error:', err2);
            setLoading(false);
          }
        );
      }
    );

    // Interactive Mouse Parallax Tracking
    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (event) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((event.clientX - rect.left) / container.clientWidth - 0.5) * 2;
      mouseY = ((event.clientY - rect.top) / container.clientHeight - 0.5) * 2;
    };
    container.addEventListener('mousemove', onMouseMove);

    // High-Impact Cinematic Animation Loop - Moving in Arrow Direction (LEFT TO RIGHT -->)
    let animId;
    let clock = new THREE.Clock();
    let posX = -24;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // 1. Continuous Motion towards RIGHT (-->)
      posX += 0.055;  // Slowed down from 0.09
      if (posX > 24) posX = -24;

      // Fade-in as train enters from left, fade-out as it exits right
      // Wide fade zone (12 units) so effect is clearly visible
      let alpha = 1.0;
      if (posX < -12) alpha = (posX + 24) / 12;      // Fade in over first 12 units
      else if (posX > 12) alpha = (24 - posX) / 12;  // Fade out over last 12 units
      alpha = Math.max(0, Math.min(1, alpha));

      // Apply to canvas — renderer has alpha:true so background stays transparent
      if (renderer.domElement) {
        renderer.domElement.style.opacity = String(alpha);
      }

      // 2. High-speed rail movement - perfectly horizontal across track, facing right
      if (trainGroupRef.current) {
        trainGroupRef.current.position.x = posX;
        trainGroupRef.current.position.y = -1.2;  // Shifted down slightly
        trainGroupRef.current.position.z = 0;
        trainGroupRef.current.rotation.x = 0;
        trainGroupRef.current.rotation.y = -Math.PI * 0.5;
        trainGroupRef.current.rotation.z = 0;
      }

      // 3. Dynamic Pantograph Electrical Arc Flicker
      if (pantographLightRef.current) {
        pantographLightRef.current.intensity = Math.random() > 0.82 ? 4.5 : 1.2 + Math.sin(elapsedTime * 10) * 0.8;
      }

      // 4. Particle Speedlines Stream Effect (blowing backwards towards left)
      if (particlesRef.current) {
        const posAttr = particlesRef.current.geometry.attributes.position;
        const arr = posAttr.array;
        for (let i = 0; i < particleCount * 3; i += 3) {
          arr[i] -= 0.45; // High-speed particle stream backwards
          if (arr[i] < -30) arr[i] = 30;
        }
        posAttr.needsUpdate = true;
      }

      // 5. Camera locked — no drift, pure side view
      camera.lookAt(0, -0.5, 0);


      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 480;
      const h = container.clientHeight || 160;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="train-3d-viewport" ref={mountRef}>
      {loading && <div className="train-3d-loading">Loading High-Speed Telemetry Viewport…</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Login Component                                                       */
/* -------------------------------------------------------------------------- */
export default function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const defaultOption = 'Divisional Planner (Sr. DOM)';
  const [department, setDepartment] = useState(defaultOption);
  const [employeeId, setEmployeeId] = useState(ROLE_CONFIGS[defaultOption].employeeId);
  const [password, setPassword] = useState(ROLE_CONFIGS[defaultOption].password);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // When judge selects a different department, automatically pre-fill credentials
  const handleDepartmentChange = (selectedDept) => {
    setDepartment(selectedDept);
    const config = ROLE_CONFIGS[selectedDept];
    if (config) {
      setEmployeeId(config.employeeId);
      setPassword(config.password);
    }
    setError('');
  };

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.');
      return;
    }

    setSubmitting(true);
    const roleConfig = ROLE_CONFIGS[department] || ROLE_CONFIGS[defaultOption];

    setTimeout(() => {
      try {
        localStorage.setItem('mars_user', JSON.stringify(roleConfig));
        localStorage.setItem('mars_authenticated', 'true');
        onLoginSuccess?.(roleConfig);
        navigate(roleConfig.defaultRoute || '/');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to authenticate with MARS backend.');
      } finally {
        setSubmitting(false);
      }
    }, 450);
  };

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
                MAINTENANCE ALLOCATION &amp; RESOURCE SCHEDULING<br />
                परिरक्षण वाटप और संसाधन अनुसूचन प्रणाली
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
            <div className="heading-title-row">
              <span className="heading-line" />
              <h1>OFFICIAL SYSTEM ACCESS</h1>
              <span className="heading-line" />
            </div>
            <p>Authorised credentials required for MARS operations</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <label className="field-label">
              DEPARTMENT / ROLE
              <select
                value={department}
                onChange={e => handleDepartmentChange(e.target.value)}
              >
                <option value="Divisional Planner (Sr. DOM)">Divisional Planner (Sr. DOM)</option>
                <option value="Civil Engineering Dept">Civil Engineering Dept</option>
                <option value="Signalling & Telecom Dept">Signalling &amp; Telecom Dept</option>
                <option value="Traction Distribution Dept">Traction Distribution Dept</option>
              </select>
            </label>

            <label className="field-label">
              EMPLOYEE ID
              <input
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="Enter Official Employee ID"
                autoComplete="username"
              />
            </label>

            <label className="field-label">
              PASSWORD
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

            {/* Red Note for Judges */}
            <div className="login-judge-banner">
              <span className="judge-badge">DEMO INSTRUCTION FOR JUDGES</span>
              <p className="judge-note-text">
                * Select the role and login to see prototype.
              </p>
            </div>
          </form>
        </div>

        <footer className="login-footer">
          MARS · Ministry of Railways, Government of India{' '}
          <span>Secure Government Network · IR-NET</span>
        </footer>
      </section>
    </div>
  );
}
