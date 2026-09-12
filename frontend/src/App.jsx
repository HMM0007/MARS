import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import OperationalStrip from './components/OperationalStrip';
import Sidebar from './components/Sidebar';
import OperationalWorkflowBridge from './components/OperationalWorkflowBridge';
import MARSHomePage from './pages/MARSHomePage';
import WeeklyPlanPage from './pages/WeeklyPlanPage';
import MonthlyPlanPage from './pages/MonthlyPlanPage';
import DepartmentPage from './pages/DepartmentPage';
import SNTDashboardPage from './pages/SNTDashboardPage';
import EngineeringDashboardPage from './pages/EngineeringDashboardPage';
import TractionDashboardPage from './pages/TractionDashboardPage';
import ImpactReportsPage from './pages/ImpactReportsPage';
import IntegrationStatusPage from './pages/IntegrationStatusPage';
import CorridorMapPage from './pages/CorridorMapPage';
import LoginPage from './pages/LoginPage';
import { fetchMonthlyPlan, fetchWeeklyPlan } from './services/api';

const roleHomePaths = {
  planner: '/',
  engineering: '/dept/engineering',
  snt: '/dept/snt',
  traction: '/dept/traction',
};

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === '/login';
  const [selectedDivision, setSelectedDivision] = useState({ id: 'pune-cr', name: 'Pune Division (CR)', code: 'PUNE-CR' });
  const [selectedRole, setSelectedRole] = useState(() => {
    const saved = localStorage.getItem('mars_user');
    if (saved) { try { return JSON.parse(saved); } catch (e) {} }
    return { id: 'planner', name: 'Planner (Sr. DOM)', shortName: 'Sr. DOM Pune', badge: 'D', dept: 'Operations' };
  });
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [monthlyPlan, setMonthlyPlan] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchWeeklyPlan().catch((err) => { console.warn('Shell weekly plan fetch error:', err); return null; }),
      fetchMonthlyPlan().catch((err) => { console.warn('Shell monthly plan fetch error:', err); return null; }),
    ]).then(([weekly, monthly]) => { setWeeklyPlan(weekly); setMonthlyPlan(monthly); });
  }, []);

  const handleRoleChange = (role) => {
    if (!role) return;
    setSelectedRole(role);
    localStorage.setItem('mars_user', JSON.stringify(role));

    // Role switching is also a navigation event: always land on that role's Home tab.
    const homePath = roleHomePaths[role.id] || '/';
    navigate(homePath, { replace: true });
  };

  if (isLoginPage) return <LoginPage onLoginSuccess={handleRoleChange} />;

  return <div className="min-h-screen bg-[#EEF2F6] font-sans text-[#17345C]">
    <Header selectedDivision={selectedDivision} selectedRole={selectedRole} onDivisionChange={setSelectedDivision} onRoleChange={handleRoleChange} />
    <OperationalStrip planData={weeklyPlan} monthlyData={monthlyPlan} selectedDivision={selectedDivision.name} />
    <OperationalWorkflowBridge />
    <div className="flex min-h-[calc(100vh-118px)]"><Sidebar currentRole={selectedRole}/><div className="min-w-0 flex-1 overflow-y-auto">
      <Routes>
        <Route path="/" element={<MARSHomePage currentRole={selectedRole}/>}/>
        <Route path="/corridor" element={<CorridorMapPage currentRole={selectedRole}/>}/>
        <Route path="/weekly" element={<WeeklyPlanPage currentRole={selectedRole}/>}/>
        <Route path="/monthly" element={<MonthlyPlanPage currentRole={selectedRole}/>}/>
        <Route path="/dept/engineering" element={<EngineeringDashboardPage currentRole={selectedRole}/>}/>
        <Route path="/dept/engineering/*" element={<EngineeringDashboardPage currentRole={selectedRole}/>}/>
        <Route path="/dept/snt" element={<SNTDashboardPage currentRole={selectedRole}/>}/>
        <Route path="/dept/snt/*" element={<SNTDashboardPage currentRole={selectedRole}/>}/>
        <Route path="/dept/traction" element={<TractionDashboardPage currentRole={selectedRole}/>}/>
        <Route path="/dept/traction/*" element={<TractionDashboardPage currentRole={selectedRole}/>}/>
        <Route path="/impact" element={<ImpactReportsPage currentRole={selectedRole}/>}/>
        <Route path="/integration" element={<IntegrationStatusPage currentRole={selectedRole}/>}/>
      </Routes>
      <footer className="border-t border-[#D6DEE6] bg-white px-5 py-2"><div className="flex flex-col justify-between gap-1 text-[10px] text-[#66788A] sm:flex-row"><div><strong className="text-[#123C70]">MARS 2.0</strong> &nbsp;|&nbsp; Ministry of Railways, Government of India &nbsp;•&nbsp; Central Railway (Pune Division)</div><div className="font-mono font-bold">PS 26027 &nbsp;•&nbsp; <span className="text-[#16865F]">RAILWAY RULES AUDITED</span> &nbsp;•&nbsp; ROLE: {selectedRole?.name}</div></div></footer>
    </div></div>
  </div>;
}

export default function App() { return <Router><AppContent /></Router>; }
