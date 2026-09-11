/**
 * MARS 2.0 Sidebar Component
 * Professional Government Railway Application Navigation
 * Railway Blue Theme - No Neon Colors
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
  Settings,
  HelpCircle
} from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Command Center', badge: 'DCO' },
    { to: '/weekly-plan', icon: Calendar, label: 'Weekly Plan', badge: 'L2' },
    { to: '/monthly-plan', icon: CalendarDays, label: 'Monthly Plan', badge: 'L1' },
    { to: '/engineering', icon: Wrench, label: 'Engineering', badge: 'ENG' },
    { to: '/snt', icon: Radio, label: 'S&T', badge: 'S&T' },
    { to: '/traction', icon: Zap, label: 'Traction', badge: 'TRD' },
    { to: '/impact-reports', icon: BarChart3, label: 'Impact Reports' },
    { to: '/integration-status', icon: Network, label: 'Integration Status' },
  ];

  const bottomItems = [
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/help', icon: HelpCircle, label: 'Help' },
  ];

  return (
    <aside className="w-64 bg-[#F4F6F8] border-r border-[#D6DEE6] min-h-screen">
      <div className="p-4 border-b border-[#D6DEE6]">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">IR</span>
          </div>
          <div>
            <p className="font-semibold text-[#1F2933] text-sm">MARS 2.0</p>
            <p className="text-xs text-[#52606D]">Pune Division</p>
          </div>
        </div>
      </div>

      <nav className="p-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink to={item.to}>
                  {({ isActive }) => (
                    <div className={`flex items-center space-x-3 px-4 py-3 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-[#1E3A5F] text-white' : 'text-[#1F2933] hover:bg-white hover:shadow-sm'
                    }`}>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          isActive ? 'bg-white/20 text-white' : 'bg-[#D6DEE6] text-[#52606D]'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-[#D6DEE6] bg-[#F4F6F8]">
        <ul className="space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink to={item.to}>
                  {({ isActive }) => (
                    <div className={`flex items-center space-x-3 px-4 py-2 rounded-md text-sm transition-colors ${
                      isActive ? 'bg-[#1E3A5F] text-white' : 'text-[#52606D] hover:bg-white hover:shadow-sm'
                    }`}>
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;