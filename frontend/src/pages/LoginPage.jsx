/**
 * MARS 2.0 Role-Based Authentication Portal
 * Indian Railways Divisional Control Room Enterprise Login
 * Ministry of Railways | Problem Statement 26027
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  UserCheck,
  Wrench,
  Radio,
  Zap,
  Lock,
  ArrowRight,
  CheckCircle2,
  Building2,
} from 'lucide-react';

const OFFICIAL_ROLES = [
  {
    id: 'planner',
    login_id: 'planner',
    name: 'Sr. DOM Pune',
    title: 'Senior Divisional Operations Manager',
    department: 'Operations (Divisional Control)',
    badge: 'DOM',
    color: '#1E3A5F',
    icon: ShieldCheck,
    permissions: 'Full Planning, CP-SAT Solver Execution, BDMS Outbound Sanctions',
    defaultRoute: '/',
  },
  {
    id: 'engineering',
    login_id: 'engg',
    name: 'Sr. DEN (Civil)',
    title: 'Senior Divisional Engineer (P.Way)',
    department: 'Engineering (Civil Track)',
    badge: 'ENG',
    color: '#3B6EA5',
    icon: Wrench,
    permissions: 'Track Maintenance Demands, Machine Blocks, TMS Jobs',
    defaultRoute: '/dept/engineering',
  },
  {
    id: 'snt',
    login_id: 'snt',
    name: 'Sr. DSTE (Signals)',
    title: 'Senior Divisional Signal & Telecom Engineer',
    department: 'S&T (Signals & Interlocking)',
    badge: 'S&T',
    color: '#2F8F6B',
    icon: Radio,
    permissions: 'Signal Head Replacement, Point Machines, SMMS Sync',
    defaultRoute: '/dept/snt',
  },
  {
    id: 'traction',
    login_id: 'trac',
    name: 'Sr. DEE (TRD)',
    title: 'Senior Divisional Electrical Engineer',
    department: 'Traction Distribution (25kV OHE)',
    badge: 'TRD',
    color: '#C9842A',
    icon: Zap,
    permissions: 'OHE Power Isolation Permits, Wire Replacement, TDMS Jobs',
    defaultRoute: '/dept/traction',
  },
];

const LoginPage = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(OFFICIAL_ROLES[0]);
  const [password, setPassword] = useState('ir-pune-2026');
  const [loggingIn, setLoggingIn] = useState(false);

  const handleLogin = (e) => {
    e?.preventDefault();
    setLoggingIn(true);
    setTimeout(() => {
      localStorage.setItem('mars_user', JSON.stringify(selectedRole));
      onLoginSuccess?.(selectedRole);
      navigate(selectedRole.defaultRoute);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col justify-between font-sans select-none">
      {/* Institutional Top Header */}
      <header className="bg-[#1E3A5F] text-white px-6 py-3 border-b border-[#13263E] shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-white rounded flex items-center justify-center shadow-xs">
            <span className="text-[#1E3A5F] font-bold text-sm tracking-wider">IR</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-wide">MARS 2.0</span>
              <span className="text-[#D6DEE6] text-xs">|</span>
              <span className="text-xs text-[#D6DEE6] font-medium tracking-wide">
                Automatic Block Planning System
              </span>
            </div>
            <p className="text-[11px] text-[#D6DEE6]/80">
              Ministry of Railways, Government of India • Central Railway, Pune Division
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono bg-[#13263E] px-3 py-1.5 rounded border border-white/10">
          <Building2 className="w-3.5 h-3.5 text-[#2F6F7E]" />
          <span>Divisional Control Office (DCO) Portal</span>
        </div>
      </header>

      {/* Main Login Interface */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl bg-white border border-[#D6DEE6] rounded-md shadow-lg overflow-hidden flex flex-col md:flex-row">
          {/* Left Column: Role Selector & System Identity */}
          <div className="md:w-3/5 p-6 bg-[#F4F6F8] border-b md:border-b-0 md:border-r border-[#D6DEE6] flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#1E3A5F] uppercase tracking-wider bg-[#1E3A5F]/10 px-2 py-0.5 rounded">
                Operational Access Protocol
              </span>
              <h2 className="text-xl font-black text-[#1F2933] uppercase mt-2 tracking-tight">
                Select Operational Role
              </h2>
              <p className="text-xs text-[#52606D] mt-1">
                Choose your divisional authority persona to load departmental job queues,
                safety clearance thresholds, and sanction powers.
              </p>

              {/* 4 Interactive Persona Cards */}
              <div className="mt-4 space-y-2.5">
                {OFFICIAL_ROLES.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole.id === role.id;

                  return (
                    <div
                      key={role.id}
                      onClick={() => setSelectedRole(role)}
                      className={`p-3 rounded border transition-all cursor-pointer flex items-start space-x-3 ${
                        isSelected
                          ? 'bg-white border-[#1E3A5F] shadow-sm ring-1 ring-[#1E3A5F]'
                          : 'bg-white/60 border-[#D6DEE6] hover:bg-white hover:border-[#52606D]'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: role.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1F2933]">
                            {role.name}
                          </span>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#D6DEE6] text-[#1F2933]">
                            {role.badge}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-[#52606D] truncate">
                          {role.title}
                        </p>
                        <p className="text-[10px] text-[#2F6F7E] font-mono mt-0.5 truncate">
                          {role.permissions}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#D6DEE6] text-[10px] text-[#52606D] flex items-center justify-between">
              <span>Security Level: Divisional Authorized User</span>
              <span className="font-mono font-bold text-[#2F9E44]">● 256-BIT ENCRYPTION</span>
            </div>
          </div>

          {/* Right Column: Authentication Form */}
          <div className="md:w-2/5 p-6 flex flex-col justify-between bg-white">
            <div>
              <div className="flex items-center space-x-2 text-[#1E3A5F] mb-4">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Secure Sign-In
                </h3>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {/* Active Role Indicator */}
                <div className="bg-[#F4F6F8] p-2.5 rounded border border-[#D6DEE6]">
                  <span className="text-[10px] font-bold text-[#52606D] uppercase">
                    Active Operational Identity
                  </span>
                  <p className="text-xs font-bold text-[#1E3A5F] mt-0.5">
                    {selectedRole.name}
                  </p>
                  <p className="text-[10px] text-[#52606D]">
                    {selectedRole.department}
                  </p>
                </div>

                {/* Login ID Input */}
                <div>
                  <label className="block text-[11px] font-bold text-[#52606D] uppercase mb-1">
                    Railway Employee / Login ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={selectedRole.login_id}
                    className="w-full text-xs font-mono bg-[#F4F6F8] border border-[#D6DEE6] rounded px-3 py-2 text-[#1F2933] cursor-not-allowed focus:outline-none"
                  />
                </div>

                {/* Access PIN / Passcode Input */}
                <div>
                  <label className="block text-[11px] font-bold text-[#52606D] uppercase mb-1">
                    Passcode / Divisional Token
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-[#D6DEE6] rounded px-3 py-2 text-[#1F2933] focus:outline-none focus:border-[#1E3A5F]"
                    />
                    <Lock className="w-3.5 h-3.5 text-[#52606D] absolute right-3 top-2.5" />
                  </div>
                  <span className="text-[10px] text-[#52606D] mt-1 block font-mono">
                    Default token: ir-pune-2026
                  </span>
                </div>

                {/* Submit Sign-In Button */}
                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 bg-[#1E3A5F] hover:bg-[#2F6F7E] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-xs disabled:opacity-60"
                >
                  <span>{loggingIn ? 'Authenticating...' : 'Enter Control Room'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-[#D6DEE6] text-center text-[10px] text-[#52606D]">
              <p>Indian Railways CRIS Network Access</p>
              <p className="font-mono mt-0.5">Central Railway • Pune Division Control</p>
            </div>
          </div>
        </div>
      </main>

      {/* Institutional Footer */}
      <footer className="bg-white border-t border-[#D6DEE6] py-2.5 px-6 text-center text-[11px] text-[#52606D]">
        MARS 2.0 • Ministry of Railways, Government of India • Smart India Hackathon 2026 (Problem Statement 26027)
      </footer>
    </div>
  );
};

export default LoginPage;
