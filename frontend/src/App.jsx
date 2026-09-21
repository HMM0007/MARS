import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Header from './components/Header';
import OperationalStrip from './components/OperationalStrip';
import Sidebar from './components/Sidebar';
import OperationalWorkflowBridge from './components/OperationalWorkflowBridge';
import MARSHomePage from './pages/MARSHomePage';
import PlannerDashboard from './pages/PlannerDashboard';
import WeeklyPlanPage from './pages/WeeklyPlanPage';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import JobsPage from './pages/JobsPage';
import PriorityRiskPage from './pages/PriorityRiskPage';
import DepartmentWorkCentrePage from './pages/DepartmentWorkCentrePage';
import SNTDashboardPage from './pages/SNTDashboardPage';
import DeptDashboard from './pages/DeptDashboard';
import IntegrationStatusPage from './pages/IntegrationStatusPage';
import CorridorMapPage from './pages/CorridorMapPage';
import WhatIfScenarioPage from './pages/WhatIfScenarioPage';
import ComplianceSafetyPage from './pages/ComplianceSafetyPage';
import LoginPage from './pages/LoginPage';
import SanctionMemoModal from './components/SanctionMemoModal';
import { fetchMonthlyPlan, fetchWeeklyPlan } from './services/api';
const roleHomePaths = { planner: '/', engineering: '/dept/engineering', snt: '/dept/snt', traction: '/dept/traction' };
function AppContent() {
  const location = useLocation(); const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('mars_authenticated') === 'true');
  const isLoginPage = location.pathname === '/login' || !isAuthenticated;
  const [selectedDivision, setSelectedDivision] = useState({ id: 'pune-cr', name: 'Pune Division (CR)', code: 'PUNE-CR' });
  const [selectedRole, setSelectedRole] = useState(() => { const saved = localStorage.getItem('mars_user'); if (saved) { try { return JSON.parse(saved); } catch (e) { } } return { id: 'planner', name: 'Planner (Sr. DOM)', shortName: 'Sr. DOM Pune', badge: 'D', dept: 'Operations' }; });
  const [weeklyPlan, setWeeklyPlan] = useState(null); const [monthlyPlan, setMonthlyPlan] = useState(null);
  useEffect(() => { Promise.all([fetchWeeklyPlan().catch((err) => { console.warn('Shell weekly plan fetch error:', err); return null; }), fetchMonthlyPlan().catch((err) => { console.warn('Shell monthly plan fetch error:', err); return null; })]).then(([weekly, monthly]) => { setWeeklyPlan(weekly); setMonthlyPlan(monthly); }); }, []);
  const handleRoleChange = (role) => { if (!role) return; setSelectedRole(role); localStorage.setItem('mars_user', JSON.stringify(role)); navigate(roleHomePaths[role.id] || '/', { replace: true }); };
  const handleLoginSuccess = (role) => { setIsAuthenticated(true); sessionStorage.setItem('mars_authenticated', 'true'); handleRoleChange(role); };
  const handleLogout = () => { setIsAuthenticated(false); sessionStorage.removeItem('mars_authenticated'); navigate('/login'); };
  if (isLoginPage) return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  return <div className="min-h-screen bg-[#EEF2F6] font-sans text-[#17345C]"><Header selectedDivision={selectedDivision} selectedRole={selectedRole} onDivisionChange={setSelectedDivision} onRoleChange={handleRoleChange} onLogout={handleLogout} /><OperationalStrip planData={weeklyPlan} monthlyData={monthlyPlan} selectedDivision={selectedDivision.name} /><OperationalWorkflowBridge /><div className="flex min-h-[calc(100vh-118px)]"><Sidebar currentRole={selectedRole} /><div className="min-w-0 flex-1 overflow-y-auto"><Routes>
    <Route path="/" element={<MARSHomePage currentRole={selectedRole} />} /><Route path="/command-center" element={<PlannerDashboard currentRole={selectedRole} />} /><Route path="/corridor" element={<CorridorMapPage currentRole={selectedRole} />} /><Route path="/what-if" element={<WhatIfScenarioPage currentRole={selectedRole} />} /><Route path="/compliance" element={<ComplianceSafetyPage currentRole={selectedRole} />} /><Route path="/weekly" element={<WeeklyPlanPage currentRole={selectedRole} />} /><Route path="/monthly" element={<MonthlyPlanPage currentRole={selectedRole} />} /><Route path="/jobs" element={<JobsPage currentRole={selectedRole} />} /><Route path="/jobs/priority-risk" element={<PriorityRiskPage currentRole={selectedRole} />} /><Route path="/jobs/department/engineering" element={<DepartmentWorkCentrePage department="Engineering" currentRole={selectedRole} />} /><Route path="/jobs/department/snt" element={<DepartmentWorkCentrePage department="S&T" currentRole={selectedRole} />} /><Route path="/jobs/department/traction" element={<DepartmentWorkCentrePage department="Traction" currentRole={selectedRole} />} /><Route path="/jobs/department" element={<DepartmentWorkCentrePage department="Engineering" currentRole={selectedRole} />} />
    <Route path="/dept/engineering" element={<DeptDashboard department="Engineering" themeColor="#3B6EA5" deptIcon="Wrench" currentRole={selectedRole} />} />
    <Route path="/dept/engineering/*" element={<DeptDashboard department="Engineering" themeColor="#3B6EA5" deptIcon="Wrench" currentRole={selectedRole} />} />
    <Route path="/dept/snt" element={<DeptDashboard department="S&T" themeColor="#2F8F6B" deptIcon="Radio" currentRole={selectedRole} />} />
    <Route path="/dept/snt/*" element={<DeptDashboard department="S&T" themeColor="#2F8F6B" deptIcon="Radio" currentRole={selectedRole} />} />
    <Route path="/dept/traction" element={<DeptDashboard department="Traction" themeColor="#C9842A" deptIcon="Zap" currentRole={selectedRole} />} />
    <Route path="/dept/traction/*" element={<DeptDashboard department="Traction" themeColor="#C9842A" deptIcon="Zap" currentRole={selectedRole} />} />
    <Route path="/preview-sanction-memo" element={<SanctionMemoModal isOpen={true} onClose={() => window.history.back()} department="Engineering" />} />
    <Route path="/impact" element={<Navigate to="/compliance" replace />} /><Route path="/integration" element={<IntegrationStatusPage currentRole={selectedRole} />} />
  </Routes><footer className="border-t border-[#D6DEE6] bg-white px-5 py-2"><div className="flex flex-col justify-between gap-1 text-[10px] text-[#66788A] sm:flex-row"><div><strong className="text-[#123C70]">MARS</strong> &nbsp;|&nbsp; Ministry of Railways, Government of India &nbsp;•&nbsp; Central Railway (Pune Division)</div><div className="font-mono font-bold"> &nbsp;•&nbsp; <span className="text-[#16865F]">RAILWAY RULES AUDITED</span> &nbsp;•&nbsp; ROLE: {selectedRole?.name}</div></div></footer></div></div></div>;
}
export default function App() { return <Router><AppContent /></Router>; }
