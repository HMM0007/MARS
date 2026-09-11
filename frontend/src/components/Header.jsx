/**
 * MARS 2.0 Header Component
 * Multi-department AI-based Railway Scheduling System 2.0
 * Professional Government Enterprise Institutional Header with Role Switching & Login Link
 */

import { useState, useEffect } from 'react';
import { ChevronDown, Bell, User, Clock, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

const Header = ({ onDivisionChange, onRoleChange, selectedDivision, selectedRole }) => {
  const [divisionOpen, setDivisionOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Division Options
  const divisions = [
    { id: 'pune-cr', name: 'Pune Division (CR)', code: 'PUNE-CR' },
    { id: 'mumbai-cr', name: 'Mumbai Division (CR)', code: 'BB-CR' },
    { id: 'delhi-nr', name: 'Delhi Division (NR)', code: 'DLI-NR' },
  ];

  // Role Options
  const roles = [
    { id: 'planner', name: 'Planner (Sr. DOM)', badge: 'DOM', dept: 'Operations' },
    { id: 'engineering', name: 'Sr. DEN (Civil)', badge: 'ENG', dept: 'Civil Track' },
    { id: 'snt', name: 'Sr. DSTE (Signals)', badge: 'S&T', dept: 'Signals' },
    { id: 'traction', name: 'Sr. DEE (TRD)', badge: 'TRD', dept: 'Traction OHE' },
  ];

  const currentDiv = selectedDivision || divisions[0];
  const currentR = selectedRole || roles[0];

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDivisionSelect = (division) => {
    setDivisionOpen(false);
    onDivisionChange?.(division);
  };

  const handleRoleSelect = (role) => {
    setRoleOpen(false);
    onRoleChange?.(role);
  };

  return (
    <header className="bg-[#1E3A5F] text-white select-none border-b border-[#13263E] shadow-sm z-40">
      <div className="flex items-center justify-between px-4 py-2">
        {/* LEFT: Institutional Emblem & System Title */}
        <div className="flex items-center space-x-3">
          {/* Indian Railways Emblem Crest */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-white rounded border border-[#D6DEE6] flex items-center justify-center shadow-inner flex-shrink-0">
              <div className="w-8 h-8 rounded-full border border-[#1E3A5F] flex flex-col items-center justify-center leading-none">
                <span className="text-[#1E3A5F] font-extrabold text-[10px] tracking-tight">IR</span>
                <span className="text-[7px] text-[#2F6F7E] font-bold uppercase">भा.रे.</span>
              </div>
            </div>

            <div>
              <div className="flex items-baseline space-x-2">
                <span className="font-bold text-base tracking-wide text-white group-hover:text-[#D6DEE6] transition-colors">
                  MARS 2.0
                </span>
                <span className="text-[#D6DEE6] text-xs font-light">|</span>
                <span className="text-xs font-semibold text-[#D6DEE6] tracking-wide">
                  Automatic Block Planning System
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-[#D6DEE6]/85">
                <span>Ministry of Railways, Government of India</span>
                <span>•</span>
                <span className="font-medium text-white/90">Divisional Control Office</span>
              </div>
            </div>
          </Link>
        </div>

        {/* CENTER: Division Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setDivisionOpen(!divisionOpen);
              setRoleOpen(false);
            }}
            className="flex items-center space-x-2 text-xs font-medium bg-[#13263E] hover:bg-[#2F6F7E] px-3 py-1.5 rounded border border-[#2F6F7E] transition-colors shadow-inner"
          >
            <span className="text-[#D6DEE6] text-[11px] uppercase tracking-wider">Division:</span>
            <span className="text-white font-bold">{currentDiv.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-white/80" />
          </button>

          {divisionOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-60 bg-white rounded shadow-xl border border-[#D6DEE6] py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6] bg-[#F4F6F8]">
                Select Operating Division
              </div>
              {divisions.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleDivisionSelect(d)}
                  className={`w-full text-left px-3 py-2 text-xs text-[#1F2933] hover:bg-[#F4F6F8] flex items-center justify-between ${
                    currentDiv.id === d.id ? 'bg-[#F4F6F8] font-bold text-[#1E3A5F]' : ''
                  }`}
                >
                  <span>{d.name}</span>
                  <span className="text-[10px] font-mono text-[#52606D] bg-[#D6DEE6]/60 px-1 py-0.5 rounded">
                    {d.code}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Clock, Notifications, Role Switcher & Login Link */}
        <div className="flex items-center space-x-3">
          {/* Live Operational Clock */}
          <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 bg-[#13263E] rounded border border-white/10 text-[11px] font-mono text-[#D6DEE6]">
            <Clock className="w-3.5 h-3.5 text-[#2F6F7E]" />
            <span>{currentTime || '12:00:00 IST'}</span>
          </div>

          {/* Operational Notifications */}
          <button
            type="button"
            title="Operational System Alerts"
            className="relative p-1.5 rounded hover:bg-white/10 transition-colors text-white"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#C92A2A] rounded-full ring-2 ring-[#1E3A5F]" />
          </button>

          {/* Active User Role Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setRoleOpen(!roleOpen);
                setDivisionOpen(false);
              }}
              className="flex items-center space-x-2 text-xs font-medium bg-[#13263E] hover:bg-[#2F6F7E] px-3 py-1.5 rounded border border-[#2F6F7E] transition-colors shadow-inner"
            >
              <User className="w-3.5 h-3.5 text-[#D6DEE6]" />
              <span className="text-white font-semibold">{currentR.name}</span>
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded font-mono font-bold">
                {currentR.badge}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-white/80" />
            </button>

            {roleOpen && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded shadow-xl border border-[#D6DEE6] py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6] bg-[#F4F6F8]">
                  Switch Operating User Role
                </div>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRoleSelect(r)}
                    className={`w-full text-left px-3 py-2 text-xs text-[#1F2933] hover:bg-[#F4F6F8] flex items-center justify-between ${
                      currentR.id === r.id ? 'bg-[#F4F6F8] font-bold text-[#1E3A5F]' : ''
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-xs text-[#1F2933]">{r.name}</p>
                      <p className="text-[10px] text-[#52606D]">{r.dept}</p>
                    </div>
                    <span className="text-[10px] bg-[#D6DEE6] text-[#1F2933] px-1.5 py-0.5 rounded font-mono font-bold">
                      {r.badge}
                    </span>
                  </button>
                ))}
                <div className="p-2 border-t border-[#D6DEE6] bg-[#F4F6F8]">
                  <Link
                    to="/login"
                    onClick={() => setRoleOpen(false)}
                    className="w-full flex items-center justify-center space-x-1.5 py-1 text-[11px] font-bold text-[#1E3A5F] hover:underline"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Open Full Login Portal</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
