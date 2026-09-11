/**
 * MARS 2.0 Role-Adaptive Sidebar Navigation Component
 * Adapts navigation items, permissions, and operational scope based on active user role.
 * Planner (Sr. DOM) vs. Department (Engineering / S&T / Traction)
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Wrench,
  Radio,
  Zap,
  BarChart3,
  Network,
  Compass,
  ChevronRight,
  PlusCircle,
  Ghost,
  ShieldCheck,
  Lock,
} from 'lucide-react';

const Sidebar = ({ currentRole }) => {
  const roleId = currentRole?.id || 'planner';
  const isPlanner = roleId === 'planner';

  // Planner (Sr. DOM) has full institutional control
  const plannerNavGroups = [
    {
      groupTitle: 'Core Planning (Sr. DOM)',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Command Center', badge: 'DCO', end: true },
        { to: '/corridor', icon: Compass, label: 'Corridor Map (Satellite)', badge: 'GIS' },
        { to: '/weekly', icon: Calendar, label: 'Weekly Block Plan', badge: 'L2 CP-SAT' },
        { to: '/monthly', icon: CalendarDays, label: 'Monthly Strategic Plan', badge: 'L1 BIN' },
      ],
    },
    {
      groupTitle: 'Department Consoles',
      items: [
        { to: '/dept/engineering', icon: Wrench, label: 'Engineering (Civil)', badge: 'ENG', color: 'text-[#3B6EA5]' },
        { to: '/dept/snt', icon: Radio, label: 'S&T (Signals/Telecom)', badge: 'S&T', color: 'text-[#2F8F6B]' },
        { to: '/dept/traction', icon: Zap, label: 'Traction (OHE/TRD)', badge: 'TRD', color: 'text-[#C9842A]' },
      ],
    },
    {
      groupTitle: 'Divisional Authority',
      items: [
        { to: '/impact', icon: BarChart3, label: 'Impact & Compliance', badge: 'AUDIT' },
        { to: '/integration', icon: Network, label: 'CRIS Live Status', badge: 'CRIS' },
      ],
    },
  ];

  // Department-specific navigation (Engineering, S&T, or Traction)
  const getDeptNavGroups = () => {
    let myDeptRoute = '/dept/engineering';
    let myDeptLabel = 'Engineering Workspace';
    let MyIcon = Wrench;
    let deptBadge = 'ENG';
    let deptColor = 'text-[#3B6EA5]';
    let sourceSystem = 'TMS';

    if (roleId === 'snt') {
      myDeptRoute = '/dept/snt';
      myDeptLabel = 'S&T Signals Workspace';
      MyIcon = Radio;
      deptBadge = 'S&T';
      deptColor = 'text-[#2F8F6B]';
      sourceSystem = 'SMMS';
    } else if (roleId === 'traction') {
      myDeptRoute = '/dept/traction';
      myDeptLabel = 'Traction (OHE) Workspace';
      MyIcon = Zap;
      deptBadge = 'TRD';
      deptColor = 'text-[#C9842A]';
      sourceSystem = 'TDMS';
    }

    return [
      {
        groupTitle: `My Department (${deptBadge})`,
        items: [
          { to: myDeptRoute, icon: MyIcon, label: myDeptLabel, badge: deptBadge, color: deptColor, end: true },
          { to: '/corridor', icon: Compass, label: 'Corridor Satellite Map', badge: 'GIS' },
          { to: '/weekly', icon: Calendar, label: 'Corridor Timeline & Ghost Blocks', badge: 'CORRIDOR' },
        ],
      },
      {
        groupTitle: 'Cross-Dept Awareness',
        items: [
          { to: myDeptRoute, icon: Ghost, label: 'Ghost Block Co-Scheduling', badge: 'PIGGYBACK' },
          { to: '/impact', icon: BarChart3, label: 'Department Audit History', badge: sourceSystem },
        ],
      },
      {
        groupTitle: 'Divisional View (Read-Only)',
        items: [
          { to: '/', icon: LayoutDashboard, label: 'Planner Overview (Summary)', badge: 'READ-ONLY' },
        ],
      },
    ];
  };

  const navGroups = isPlanner ? plannerNavGroups : getDeptNavGroups();

  return (
    <aside className="w-[240px] flex-shrink-0 bg-white border-r border-[#D6DEE6] min-h-screen flex flex-col justify-between select-none">
      <div>
        {/* Institutional Rail Header */}
        <div className="p-3 border-b border-[#D6DEE6] bg-[#F4F6F8]">
          <div className="flex items-center space-x-2.5">
            <div
              className="w-8 h-8 rounded flex items-center justify-center text-white font-black text-xs shadow-xs"
              style={{
                backgroundColor: isPlanner
                  ? '#1E3A5F'
                  : roleId === 'engineering'
                  ? '#3B6EA5'
                  : roleId === 'snt'
                  ? '#2F8F6B'
                  : '#C9842A',
              }}
            >
              {currentRole?.badge || 'IR'}
            </div>
            <div>
              <p className="text-xs font-bold text-[#1F2933] uppercase tracking-wide truncate max-w-[150px]">
                {currentRole?.name || 'Central Railway'}
              </p>
              <p className="text-[10px] text-[#52606D] font-mono">
                {isPlanner ? 'Divisional Operations' : currentRole?.department || 'Department Console'}
              </p>
            </div>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="p-2 space-y-3.5">
          {navGroups.map((group) => (
            <div key={group.groupTitle}>
              <div className="px-2 pb-1 pt-1 text-[10px] font-bold text-[#52606D] uppercase tracking-wider border-b border-[#D6DEE6]/40 flex items-center justify-between">
                <span>{group.groupTitle}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to + item.label}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) => `
                          flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium transition-all group
                          ${
                            isActive
                              ? 'bg-[#1E3A5F] text-white font-semibold shadow-xs'
                              : 'text-[#1F2933] hover:bg-[#F4F6F8] hover:text-[#1E3A5F]'
                          }
                        `}
                      >
                        {({ isActive }) => (
                          <>
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <Icon
                                className={`w-3.5 h-3.5 flex-shrink-0 ${
                                  isActive ? 'text-white' : item.color || 'text-[#52606D]'
                                }`}
                              />
                              <span className="truncate text-[11px]">{item.label}</span>
                            </div>
                            <div className="flex items-center space-x-1 flex-shrink-0 ml-1">
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[#D6DEE6] text-[#52606D] group-hover:bg-[#1E3A5F]/10 group-hover:text-[#1E3A5F]'
                                }`}
                              >
                                {item.badge}
                              </span>
                              <ChevronRight
                                className={`w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                                  isActive ? 'opacity-100 text-white' : 'text-[#52606D]'
                                }`}
                              />
                            </div>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Role Authority Indicator Footer */}
      <div className="p-3 border-t border-[#D6DEE6] bg-[#F4F6F8]">
        <div className="border border-[#D6DEE6] rounded p-2 bg-white shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase text-[#52606D] tracking-wider">
              {isPlanner ? 'Authority Status' : 'Department Scope'}
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2F9E44] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2F9E44]" />
            </span>
          </div>
          <p className="text-[11px] font-semibold text-[#1F2933] truncate">
            {isPlanner ? 'Sr. DOM Sanction Rights' : `${currentRole?.badge} Local Demand Pool`}
          </p>
          <div className="flex items-center justify-between text-[10px] text-[#52606D] mt-0.5 font-mono">
            <span>{isPlanner ? 'BDMS: OUTBOUND READY' : 'BDMS: READ-ONLY'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
