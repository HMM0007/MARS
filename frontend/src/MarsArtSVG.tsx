import React from 'react'

export default function MarsArtSVG() {
  return (
    <div className="mars-svg-art-container">
      <svg
        className="mars-art-svg"
        viewBox="0 0 1000 370"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="MARS - Maintenance Allocation Routing System"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="navyStemGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0f2540" />
          </linearGradient>

          <linearGradient id="oheSteel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>

          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="signalGlowRed" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ====================================================================
            LETTER M: MAINTENANCE (Tracks & Semaphore Signal)
            ==================================================================== */}
        <g id="letter-M">
          {/* Top Left Semaphore Signal Mast */}
          <rect x="76" y="10" width="8" height="60" fill="#64748b" rx="2" />
          {/* Semaphore Arm */}
          <path d="M 76 25 L 25 25 L 30 15 L 76 15 Z" fill="#b91c1c" />
          <circle cx="45" cy="20" r="4" fill="#ffffff" />
          <circle cx="78" cy="20" r="7" fill="#0284c7" filter="url(#goldGlow)" />

          {/* Solid Navy 'M' Body */}
          <path
            d="M 70 70 L 98 70 L 175 195 L 252 70 L 280 70 L 280 270 L 250 270 L 250 120 L 186 220 L 164 220 L 100 120 L 100 270 L 70 270 Z"
            fill="url(#navyStemGrad)"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />

          {/* Bottom Left Curved Railway Track */}
          <g id="M-left-track">
            <path d="M 70 270 Q 55 310 35 345" stroke="#92400e" strokeWidth="6" fill="none" />
            <path d="M 86 270 Q 71 310 51 345" stroke="#92400e" strokeWidth="6" fill="none" />
            {/* Wooden Sleepers */}
            <line x1="62" y1="280" x2="94" y2="280" stroke="#78350f" strokeWidth="5" />
            <line x1="53" y1="298" x2="85" y2="298" stroke="#78350f" strokeWidth="5" />
            <line x1="43" y1="316" x2="75" y2="316" stroke="#78350f" strokeWidth="5" />
            <line x1="32" y1="334" x2="64" y2="334" stroke="#78350f" strokeWidth="5" />
            {/* Steel Rails */}
            <path d="M 70 270 Q 55 310 35 345" stroke="#e2e8f0" strokeWidth="2.5" fill="none" />
            <path d="M 86 270 Q 71 310 51 345" stroke="#e2e8f0" strokeWidth="2.5" fill="none" />
          </g>

          {/* Bottom Right Curved Railway Track */}
          <g id="M-right-track">
            <path d="M 264 270 Q 279 310 299 345" stroke="#92400e" strokeWidth="6" fill="none" />
            <path d="M 280 270 Q 295 310 315 345" stroke="#92400e" strokeWidth="6" fill="none" />
            {/* Wooden Sleepers */}
            <line x1="256" y1="280" x2="288" y2="280" stroke="#78350f" strokeWidth="5" />
            <line x1="265" y1="298" x2="297" y2="298" stroke="#78350f" strokeWidth="5" />
            <line x1="275" y1="316" x2="307" y2="316" stroke="#78350f" strokeWidth="5" />
            <line x1="286" y1="334" x2="318" y2="334" stroke="#78350f" strokeWidth="5" />
            {/* Steel Rails */}
            <path d="M 264 270 Q 279 310 299 345" stroke="#e2e8f0" strokeWidth="2.5" fill="none" />
            <path d="M 280 270 Q 295 310 315 345" stroke="#e2e8f0" strokeWidth="2.5" fill="none" />
          </g>
        </g>

        {/* ====================================================================
            LETTER A: ALLOCATION (Crossovers & Yard Switches)
            ==================================================================== */}
        <g id="letter-A">
          {/* Solid Navy 'A' Outer Frame */}
          <path
            d="M 430 70 L 460 70 L 530 270 L 495 270 L 478 220 L 412 220 L 395 270 L 360 270 Z"
            fill="url(#navyStemGrad)"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />

          {/* Inner Yard Crossover Diagram */}
          <g id="A-yard-crossovers">
            {/* Parallel Track Lines */}
            <line x1="375" y1="238" x2="515" y2="238" stroke="#92400e" strokeWidth="4" />
            <line x1="375" y1="258" x2="515" y2="258" stroke="#92400e" strokeWidth="4" />
            <line x1="375" y1="238" x2="515" y2="238" stroke="#f8fafc" strokeWidth="1.8" />
            <line x1="375" y1="258" x2="515" y2="258" stroke="#f8fafc" strokeWidth="1.8" />

            {/* Crossover Diagonal Track */}
            <line x1="410" y1="258" x2="465" y2="238" stroke="#f8fafc" strokeWidth="2" />
            <line x1="445" y1="258" x2="500" y2="238" stroke="#f8fafc" strokeWidth="2" />

            {/* Yard Color Light Signal Mast inside A */}
            <rect x="472" y="165" width="4" height="35" fill="#475569" />
            <rect x="467" y="150" width="14" height="22" fill="#0f172a" rx="3" stroke="#94a3b8" strokeWidth="1" />
            <circle cx="474" cy="157" r="3.5" fill="#ef4444" filter="url(#signalGlowRed)" />
            <circle cx="474" cy="166" r="3.5" fill="#22c55e" filter="url(#goldGlow)" />

            {/* Track Sleeper Ties in Yard Diagram */}
            {[385, 400, 415, 430, 445, 460, 475, 490, 505].map((x, i) => (
              <line key={i} x1={x} y1="233" x2={x} y2="263" stroke="#78350f" strokeWidth="2.5" opacity="0.8" />
            ))}
          </g>
        </g>

        {/* ====================================================================
            LETTER R: ROUTING (OHE Catenary & Track Ladder)
            ==================================================================== */}
        <g id="letter-R">
          {/* Left Vertical Leg: Vertical Railway Track Ladder */}
          <g id="R-track-ladder">
            {/* Rails */}
            <rect x="580" y="70" width="6" height="200" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
            <rect x="610" y="70" width="6" height="200" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
            {/* Horizontal Wooden Sleepers */}
            {[78, 96, 114, 132, 150, 168, 186, 204, 222, 240, 258].map((y, i) => (
              <rect key={i} x="572" y={y} width="52" height="6" fill="#78350f" rx="1" stroke="#451a03" strokeWidth="0.8" />
            ))}
          </g>

          {/* Loop & Right Leg of 'R' */}
          <path
            d="M 616 70 L 710 70 C 745 70 745 160 710 160 L 616 160 Z M 670 160 L 735 270 L 700 270 L 640 160 Z"
            fill="url(#navyStemGrad)"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />

          {/* OHE Catenary Mast & Power Line Assembly */}
          <g id="R-OHE-mast">
            {/* Metal Lattice Mast */}
            <rect x="668" y="145" width="8" height="125" fill="url(#oheSteel)" />
            <line x1="668" y1="155" x2="676" y2="170" stroke="#334155" strokeWidth="1.2" />
            <line x1="668" y1="185" x2="676" y2="200" stroke="#334155" strokeWidth="1.2" />
            <line x1="668" y1="215" x2="676" y2="230" stroke="#334155" strokeWidth="1.2" />

            {/* Cantilever Arm & Insulators */}
            <path d="M 676 155 L 720 155 L 710 175 Z" fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
            <circle cx="690" cy="155" r="4" fill="#38bdf8" />
            <circle cx="705" cy="155" r="4" fill="#38bdf8" />

            {/* Contact Overhead Wire */}
            <line x1="640" y1="175" x2="740" y2="175" stroke="#facc15" strokeWidth="2" strokeDasharray="6 3" />
          </g>

          {/* Bottom Right Turnout Track Curve */}
          <g id="R-turnout-curve">
            <path d="M 700 270 Q 720 310 745 345" stroke="#92400e" strokeWidth="6" fill="none" />
            <path d="M 716 270 Q 736 310 761 345" stroke="#92400e" strokeWidth="6" fill="none" />
            <path d="M 700 270 Q 720 310 745 345" stroke="#e2e8f0" strokeWidth="2.5" fill="none" />
            <path d="M 716 270 Q 736 310 761 345" stroke="#e2e8f0" strokeWidth="2.5" fill="none" />
          </g>
        </g>

        {/* ====================================================================
            LETTER S: SYSTEM (Winding Tracks & Network Routing Signals)
            ==================================================================== */}
        <g id="letter-S">
          {/* Continuous S-Curved Railway Track Body */}
          <g id="S-track-body">
            {/* Outer Rail Bed */}
            <path
              d="M 940 90 C 940 45, 820 45, 820 135 C 820 215, 940 215, 940 295 C 940 355, 810 355, 810 305"
              stroke="#92400e"
              strokeWidth="24"
              fill="none"
              strokeLinecap="round"
            />
            {/* Sleepers Overlay */}
            <path
              d="M 940 90 C 940 45, 820 45, 820 135 C 820 215, 940 215, 940 295 C 940 355, 810 355, 810 305"
              stroke="#78350f"
              strokeWidth="24"
              strokeDasharray="4 8"
              fill="none"
              strokeLinecap="round"
            />
            {/* Steel Dual Rails */}
            <path
              d="M 940 90 C 940 45, 820 45, 820 135 C 820 215, 940 215, 940 295 C 940 355, 810 355, 810 305"
              stroke="#0f172a"
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 940 90 C 940 45, 820 45, 820 135 C 820 215, 940 215, 940 295 C 940 355, 810 355, 810 305"
              stroke="#f8fafc"
              strokeWidth="3"
              strokeDasharray="18 4"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* Color Light Signal Masts around S */}
          <g id="S-signals">
            {/* Left Signal */}
            <rect x="785" y="70" width="12" height="34" fill="#0f172a" rx="3" stroke="#38bdf8" strokeWidth="1" />
            <circle cx="791" cy="77" r="3.5" fill="#ef4444" filter="url(#signalGlowRed)" />
            <circle cx="791" cy="87" r="3.5" fill="#eab308" />
            <circle cx="791" cy="97" r="3.5" fill="#22c55e" filter="url(#goldGlow)" />

            {/* Right Signal */}
            <rect x="960" y="175" width="12" height="34" fill="#0f172a" rx="3" stroke="#38bdf8" strokeWidth="1" />
            <circle cx="966" cy="182" r="3.5" fill="#ef4444" />
            <circle cx="966" cy="192" r="3.5" fill="#eab308" filter="url(#goldGlow)" />
            <circle cx="966" cy="202" r="3.5" fill="#22c55e" />
          </g>

          {/* Inner Network Routing Flow Arrows & Mini Train */}
          <g id="S-routing-arrows">
            {/* Arrows inside top loop */}
            <path d="M 855 125 L 895 125 M 885 120 L 895 125 L 885 130" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 895 145 L 855 145 M 865 140 L 855 145 L 865 150" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />

            {/* Arrows inside bottom loop */}
            <path d="M 865 245 L 905 245 M 895 240 L 905 245 L 895 250" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

            {/* Mini Electric Locomotive Icon inside S */}
            <rect x="868" y="260" width="22" height="12" fill="#0284c7" rx="2" stroke="#f8fafc" strokeWidth="1" />
            <circle cx="874" cy="272" r="2.5" fill="#475569" />
            <circle cx="884" cy="272" r="2.5" fill="#475569" />
            <path d="M 885 264 L 889 266 L 889 268 Z" fill="#facc15" />
          </g>
        </g>
      </svg>

      {/* Sub-label badges indicating exact meanings */}
      <div className="mars-acronym-badges">
        <div className="acronym-badge">
          <strong>M</strong>AINTENANCE
          <span>Tracks &amp; Signals</span>
        </div>
        <div className="acronym-badge">
          <strong>A</strong>LLOCATION
          <span>Yards &amp; Crossovers</span>
        </div>
        <div className="acronym-badge">
          <strong>R</strong>OUTING
          <span>OHE &amp; Electrification</span>
        </div>
        <div className="acronym-badge">
          <strong>S</strong>YSTEM
          <span>Network &amp; Operations</span>
        </div>
      </div>
    </div>
  )
}
