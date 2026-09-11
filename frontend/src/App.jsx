/**
 * MARS 2.0 Main Application Shell
 * Multi-department AI-based Railway Scheduling System 2.0
 * Modernized Indian Railways Enterprise Software Architecture
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import OperationalStrip from './components/OperationalStrip';
import Sidebar from './components/Sidebar';
import PlannerDashboard from './pages/PlannerDashboard';
import WeeklyPlanPage from './pages/WeeklyPlanPage';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import DepartmentPage from './pages/DepartmentPage';
import ImpactReportsPage from './pages/ImpactReportsPage';
import IntegrationStatusPage from './pages/IntegrationStatusPage';
import CorridorMapPage from './pages/CorridorMapPage';
import LoginPage from './pages/LoginPage';
import { fetchWeeklyPlan } from './services/api';

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const [selectedDivision, setSelectedDivision] = useState({
    id: 'pune-cr',
    name: 'Pune Division (CR)',
    code: 'PUNE-CR',
  });

  const [selectedRole, setSelectedRole] = useState(() => {
    const saved = localStorage.getItem('mars_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      id: 'planner',
      name: 'Planner (Sr. DOM)',
      badge: 'DOM',
      dept: 'Operations',
    };
  });

  const [weeklyPlan, setWeeklyPlan] = useState(null);

  useEffect(() => {
    fetchWeeklyPlan()
      .then((data) => setWeeklyPlan(data))
      .catch((err) => console.warn('Shell weekly plan fetch error:', err));
  }, []);

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    localStorage.setItem('mars_user', JSON.stringify(role));
  };

  if (isLoginPage) {
    return <LoginPage onLoginSuccess={handleRoleChange} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col font-sans text-[#1F2933]">
      {/* TIER 1: Institutional Railway Header */}
      <Header
        selectedDivision={selectedDivision}
        selectedRole={selectedRole}
        onDivisionChange={setSelectedDivision}
        onRoleChange={handleRoleChange}
      />

      {/* TIER 2: SMMS-Inspired Operational Status Ticker Strip */}
      <OperationalStrip
        planData={weeklyPlan}
        selectedDivision={selectedDivision.name}
      />

      {/* THREE-ZONE APPLICATION BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Rail (240px) - Role Adaptive */}
        <Sidebar currentRole={selectedRole} />

        {/* Main Operational Viewport */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-[#F4F6F8]">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<PlannerDashboard currentRole={selectedRole} />} />
              <Route path="/corridor" element={<CorridorMapPage currentRole={selectedRole} />} />
              <Route path="/weekly" element={<WeeklyPlanPage currentRole={selectedRole} />} />
              <Route path="/monthly" element={<MonthlyPlanPage currentRole={selectedRole} />} />
              <Route
                path="/dept/engineering"
                element={<DepartmentPage deptKey="Engineering" currentRole={selectedRole} />}
              />
              <Route
                path="/dept/snt"
                element={<DepartmentPage deptKey="S&T" currentRole={selectedRole} />}
              />
              <Route
                path="/dept/traction"
                element={<DepartmentPage deptKey="Traction" currentRole={selectedRole} />}
              />
              <Route path="/impact" element={<ImpactReportsPage currentRole={selectedRole} />} />
              <Route path="/integration" element={<IntegrationStatusPage currentRole={selectedRole} />} />
            </Routes>
          </div>

          {/* Institutional Enterprise Footer */}
          <footer className="bg-white border-t border-[#D6DEE6] py-2 px-4 select-none">
            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#52606D]">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-[#1E3A5F]">MARS 2.0</span>
                <span>|</span>
                <span>Ministry of Railways, Government of India</span>
                <span>•</span>
                <span>Central Railway (Pune Division)</span>
              </div>
              <div className="flex items-center space-x-2 mt-1 sm:mt-0 font-mono text-[10px]">
                <span>PS 26027</span>
                <span>•</span>
                <span className="text-[#2F9E44] font-bold">12/12 RULES AUDITED</span>
                <span>•</span>
                <span className="uppercase text-[#1E3A5F] font-bold">
                  ROLE: {selectedRole?.name}
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
