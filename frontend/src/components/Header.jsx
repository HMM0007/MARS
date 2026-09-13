import { useEffect, useState } from 'react';
import { Bell, CalendarDays, ChevronDown, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandAsset from './BrandAsset';

const divisions = [
  { id: 'pune-cr', name: 'Pune Division (CR)', code: 'PUNE-CR' },
  { id: 'mumbai-cr', name: 'Mumbai Division (CR)', code: 'BB-CR' },
  { id: 'delhi-nr', name: 'Delhi Division (NR)', code: 'DLI-NR' },
];

const roles = [
  { id: 'planner', name: 'Planner', shortName: 'Planner', badge: 'P', dept: 'Divisional Operations' },
  { id: 'engineering', name: 'Engineering', shortName: 'Sr. DEN (Civil)', badge: 'E', dept: 'Civil Engineering' },
  { id: 'snt', name: 'S&T Officer', shortName: 'Sr. DSTE (Signals)', badge: 'S', dept: 'Signalling & Telecom' },
  { id: 'traction', name: 'Traction Officer', shortName: 'Sr. DEE (TRD)', badge: 'T', dept: 'Traction / OHE' },
];

export default function Header({ selectedDivision, selectedRole, onDivisionChange, onRoleChange, onLogout }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const weekdayStr = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const currentRole = selectedRole || roles[0];
  const currentDivision = selectedDivision?.name || 'Pune Division (CR)';

  return (
    <header className="sticky top-0 z-50 select-none shadow-[0_3px_12px_rgba(2,20,50,0.45)]">
      <div className="relative flex h-[70px] w-full items-center justify-between border-b border-[#062e66] bg-gradient-to-r from-[#06377b] via-[#083e8f] to-[#063375] px-3 sm:px-4 lg:px-6 text-white">

        {/* ================= LEFT: High-Precision Vector Ribbon Separation with Bottom Flare ================= */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[300px] overflow-hidden">
          <svg
            className="h-full w-full"
            viewBox="0 0 300 70"
            fill="none"
          >
            <defs>
              {/* Vibrant Indian Railways Blue Ribbon Gradient */}
              <linearGradient id="vibrantRibbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#115ec8" />
                <stop offset="65%" stopColor="#1770da" />
                <stop offset="100%" stopColor="#1d82e8" />
              </linearGradient>

              {/* Edge Drop Shadow for the diagonal separation */}
              <filter id="ribbonEdgeShadow" x="-10%" y="-10%" width="135%" height="135%">
                <feDropShadow dx="3.5" dy="0" stdDeviation="3.5" floodColor="#011838" floodOpacity="0.45" />
              </filter>

              {/* Soft glow for the white bottom swoop */}
              <filter id="whiteAccentGlow" x="-15%" y="-15%" width="140%" height="140%">
                <feDropShadow dx="1" dy="-1" stdDeviation="2.5" floodColor="#021b3d" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Main Vibrant Blue Ribbon with precise diagonal slant */}
            <path
              d="M 0 0 L 265 0 L 222 54 C 217 61, 210 70, 196 70 L 0 70 Z"
              fill="url(#vibrantRibbonGrad)"
              filter="url(#ribbonEdgeShadow)"
            />

            {/* Crisp 1px white highlight line along the diagonal seam */}
            <line
              x1="265"
              y1="0"
              x2="222"
              y2="54"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.2"
            />

            {/* Polished White Curved Swoop at the bottom edge */}
            <path
              d="M 188 70 C 200 62, 218 52, 235 56 C 248 60, 258 68, 274 70 L 188 70 Z"
              fill="#FFFFFF"
              filter="url(#whiteAccentGlow)"
            />
          </svg>
        </div>

        {/* ================= LEFT CONTENT: Indian Railways Circular Logo & Typography ================= */}
        <div className="relative z-10 flex items-center">
          <Link to="/" className="flex items-center gap-3 pr-6 sm:pr-8 group">
            {/* Indian Railways Circular Emblem */}
            <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full border border-white/40 bg-[#073677] p-0.5 shadow-sm transition-transform duration-200 group-hover:scale-105">
              <BrandAsset
                name="indian_railways_logo.png"
                alt="Indian Railways Logo"
                className="h-full w-full object-contain"
                fallback={<span className="text-[12px] font-black text-white">IR</span>}
              />
            </div>

            {/* Typography */}
            <div className="leading-tight">
              <div className="text-[15.5px] font-bold tracking-wide text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
                भारतीय रेल
              </div>
              <div className="text-[13px] font-black tracking-wider text-white">
                INDIAN RAILWAYS
              </div>

            </div>
          </Link>
        </div>

        {/* ================= CENTER: Stylized Train, MARS 2.0 & Slogan ================= */}
        <div className="relative z-10 hidden md:flex items-center">
          <Link to="/" className="flex items-center gap-3.5 group">
            {/* Front locomotive icon with tracks and sleepers */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center text-white transition-transform duration-200 group-hover:scale-105">
              <svg
                viewBox="0 0 44 44"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9"
              >
                {/* Roof Pantograph */}
                <path d="M16 6h12M22 6v3" strokeWidth="2.2" />
                {/* Train Cab */}
                <path d="M12 12c0-2.5 2.5-3 10-3s10 0.5 10 3l2 15c0 2-2 3-3.5 3h-17c-1.5 0-3.5-1-3.5-3l2-15z" strokeWidth="2.3" />
                {/* Dual Windshields */}
                <rect x="15" y="13" width="5.5" height="6.5" rx="1.2" strokeWidth="1.8" fill="white" fillOpacity="0.15" />
                <rect x="23.5" y="13" width="5.5" height="6.5" rx="1.2" strokeWidth="1.8" fill="white" fillOpacity="0.15" />
                {/* Headlights */}
                <circle cx="16.5" cy="24" r="1.6" fill="white" strokeWidth="0" />
                <circle cx="27.5" cy="24" r="1.6" fill="white" strokeWidth="0" />
                {/* Bumper */}
                <path d="M10.5 30h23" strokeWidth="2.2" />
                {/* Rails and Cross-Ties */}
                <line x1="14.5" y1="30" x2="11.5" y2="38" strokeWidth="2.2" />
                <line x1="29.5" y1="30" x2="32.5" y2="38" strokeWidth="2.2" />
                <line x1="9" y1="34" x2="35" y2="34" strokeWidth="2" />
                <line x1="8" y1="38" x2="36" y2="38" strokeWidth="2" />
              </svg>
            </div>

            {/* MARS 2.0 Typography */}
            <div className="text-left">
              <div className="text-[30px] font-black tracking-tight leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                MARS 2.0
              </div>
              <div className="mt-1 text-[11px] font-medium tracking-normal text-white/90 leading-none">
                Maintenance Allocation & Routing System
              </div>
            </div>
          </Link>

          {/* Thin Vertical Separator */}
          <div className="mx-5 lg:mx-6 h-7 w-[1px] bg-white/30" />

          {/* Slogan */}
          <div className="text-left">
            <div className="text-[11.5px] font-black italic tracking-wide text-white uppercase leading-tight">
              OPTIMIZING TODAY
            </div>
            <div className="text-[11.5px] font-black italic tracking-wide text-white uppercase leading-tight mt-0.5">
              FOR A RELIABLE TOMORROW
            </div>
          </div>
        </div>

        {/* ================= RIGHT: Date/Time, Alerts, User Profile ================= */}
        <div className="relative z-10 flex items-center gap-3 sm:gap-4">
          {/* Calendar & Time Widget */}
          <div className="hidden sm:flex items-center gap-2.5">
            <CalendarDays className="h-[20px] w-[20px] text-white shrink-0" strokeWidth={1.8} />
            <div className="text-left leading-tight">
              <div className="text-[12px] font-bold text-white">{dateStr}</div>
              <div className="text-[10.5px] text-white/80 mt-0.5">{weekdayStr}, {timeStr}</div>
            </div>
          </div>

          {/* Thin Vertical Divider */}
          <div className="hidden sm:block h-6 w-[1px] bg-white/30 mx-1" />

          {/* Notification Bell with Badge */}
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            title="3 Operational alerts"
            aria-label="Operational alerts"
          >
            <Bell className="h-5 w-5 text-white" strokeWidth={1.9} />
            <span className="absolute top-1 right-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#E5252A] px-1 text-[8.5px] font-black text-white shadow-sm ring-1 ring-white/50">
              3
            </span>
          </button>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 rounded-full py-1 px-1.5 hover:bg-white/10 transition-colors focus:outline-none"
            >
              {/* Circular Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D1E3F8] text-[#0A3E87] font-black text-sm shadow-sm">
                {currentRole?.badge || 'P'}
              </div>

              {/* User Identity Stack */}
              <div className="hidden md:block text-left leading-tight">
                <div className="text-[12.5px] font-bold text-white">
                  {currentRole?.shortName || currentRole?.name || 'Planner'}
                </div>
                <div className="flex items-center gap-1 text-[10.5px] text-white/80 mt-0.5">
                  <span>{currentDivision}</span>
                  <ChevronDown className="h-3 w-3 text-white/70" />
                </div>
              </div>
            </button>

            {/* Dropdown displaying only the logged-in user role & logout */}
            {userMenuOpen && (
              <div
                className="absolute right-0 top-12 z-[100] w-72 overflow-hidden rounded-lg border border-[#CAD4DF] bg-white text-[#17345C] shadow-2xl animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Active Session Header */}
                <div className="border-b border-[#E3E9F0] bg-[#F4F7FB] px-3.5 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6E82]">
                    Authorised Official Session
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#15803d]">
                    <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" />
                    ACTIVE
                  </span>
                </div>

                {/* Current Logged-in User Profile Card */}
                <div className="p-4 bg-gradient-to-b from-[#F8FAFD] to-white border-b border-[#E3E9F0]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D1E3F8] text-[#0A3E87] font-black text-base shadow-sm ring-2 ring-[#0A3E87]/20">
                      {currentRole?.badge || 'P'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-bold text-[#0F2942] truncate leading-tight">
                        {currentRole?.name || 'Sr. DOM Pune'}
                      </div>
                      <div className="text-[11.5px] font-semibold text-[#0A4EA3] mt-0.5">
                        {currentRole?.dept || 'Operations Department'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10.5px] text-[#64748B] mt-1">
                        <span>Division:</span>
                        <span className="font-semibold text-[#1E293B]">{currentDivision} (CR)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sign Out / Logout Option */}
                {onLogout && (
                  <div className="p-2.5 bg-[#FAFBFD]">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-md py-2 px-3 text-xs font-bold text-[#C92A2A] bg-[#FEF2F2] border border-[#FEE2E2] hover:bg-[#FEE2E2] hover:border-[#FECACA] transition-all shadow-sm"
                    >
                      <span>Sign Out to Official Login</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
