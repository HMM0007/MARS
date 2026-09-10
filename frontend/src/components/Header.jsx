/**
 * MARS 2.0 Header Component
 * Professional Government Railway Application Header
 * Railway Blue Theme - No Neon Colors
 */

import { useState } from 'react';
import { ChevronDown, Bell, User } from 'lucide-react';

const Header = ({ onDivisionChange, onRoleChange }) => {
  const [divisionOpen, setDivisionOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const divisions = [
    { id: 'pune-cr', name: 'Pune Division (CR)' },
    { id: 'mumbai-cr', name: 'Mumbai Division (CR)' },
    { id: 'nagpur-cr', name: 'Nagpur Division (CR)' },
  ];

  const roles = [
    { id: 'planner', name: 'Planner', badge: 'DCO' },
    { id: 'engineering', name: 'Engineering', badge: 'ENG' },
    { id: 'snt', name: 'S&T', badge: 'S&T' },
    { id: 'traction', name: 'Traction', badge: 'TRD' },
  ];

  const [selectedDivision, setSelectedDivision] = useState(divisions[0]);
  const [selectedRole, setSelectedRole] = useState(roles[0]);

  const handleDivisionSelect = (division) => {
    setSelectedDivision(division);
    setDivisionOpen(false);
    onDivisionChange?.(division);
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setRoleOpen(false);
    onRoleChange?.(role);
  };

  return (
    <header className="bg-[#1E3A5F] text-white shadow-md">
      <div className="flex items-center justify-between px-6 py-3">
        {/* LEFT: Logo and System Name */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#1E3A5F] font-bold text-lg">IR</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide">MARS 2.0</h1>
              <p className="text-xs text-[#D6DEE6] tracking-wider">
                Divisional Control Office
              </p>
            </div>
          </div>
          
          {/* Division Switcher */}
          <div className="relative">
            <button
              onClick={() => setDivisionOpen(!divisionOpen)}
              className="flex items-center space-x-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-md transition-colors"
            >
              <span>{selectedDivision.name}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {divisionOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-[#D6DEE6] z-50">
                {divisions.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => handleDivisionSelect(d)}
                    className={`w-full text-left px-4 py-2 text-sm text-[#1F2933] hover:bg-[#F4F6F8] ${
                      selectedDivision.id === d.id ? 'bg-[#F4F6F8]' : ''
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: User Role and Notifications */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="relative p-2 rounded-md hover:bg-white/10 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#B42318] rounded-full" />
          </button>

          {/* User Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setRoleOpen(!roleOpen)}
              className="flex items-center space-x-2 text-sm bg-white/10 hover:bg-white/20 px-3 py-2 rounded-md transition-colors"
            >
              <User className="w-4 h-4" />
              <span>{selectedRole.badge}</span>
              <span className="hidden md:inline">{selectedRole.name}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {roleOpen && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-[#D6DEE6] z-50">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleRoleSelect(r)}
                    className={`w-full text-left px-4 py-2 text-sm text-[#1F2933] hover:bg-[#F4F6F8] flex items-center space-x-2 ${
                      selectedRole.id === r.id ? 'bg-[#F4F6F8]' : ''
                    }`}
                  >
                    <span className="text-xs text-[#52606D] w-8">{r.badge}</span>
                    <span>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
