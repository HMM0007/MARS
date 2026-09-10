/**
 * MARS 2.0 Main Application
 * Professional Government Railway Application
 * Railway Blue Theme - No Neon Colors
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PlannerDashboard from './pages/PlannerDashboard';

// Placeholder pages (will be built next)
const WeeklyPlanPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Weekly Plan</h2>
      <p className="text-[#52606D]">Interactive Gantt Timeline coming soon...</p>
    </div>
  </main>
);

const MonthlyPlanPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Monthly Plan</h2>
      <p className="text-[#52606D]">Section-wise allocation view coming soon...</p>
    </div>
  </main>
);

const EngineeringPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Engineering Department</h2>
      <p className="text-[#52606D]">Department dashboard with ghost blocks coming soon...</p>
    </div>
  </main>
);

const SNTPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">S&T Department</h2>
      <p className="text-[#52606D]">Department dashboard with ghost blocks coming soon...</p>
    </div>
  </main>
);

const TractionPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Traction Department</h2>
      <p className="text-[#52606D]">Department dashboard with ghost blocks coming soon...</p>
    </div>
  </main>
);

const ImpactReportsPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Impact Reports</h2>
      <p className="text-[#52606D]">Analytics and impact analysis coming soon...</p>
    </div>
  </main>
);

const IntegrationStatusPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Integration Status</h2>
      <p className="text-[#52606D]">Live adapter health monitoring coming soon...</p>
    </div>
  </main>
);

const SettingsPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Settings</h2>
      <p className="text-[#52606D]">System configuration coming soon...</p>
    </div>
  </main>
);

const HelpPage = () => (
  <main className="flex-1 bg-[#F4F6F8] p-6">
    <div className="bg-white border border-[#D6DEE6] rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-medium text-[#1F2933] mb-4">Help</h2>
      <p className="text-[#52606D]">Documentation and support coming soon...</p>
    </div>
  </main>
);

function App() {
  const [currentDivision, setCurrentDivision] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);

  return (
    <Router>
      <div className="min-h-screen bg-[#F4F6F8] flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <Header 
            onDivisionChange={setCurrentDivision}
            onRoleChange={setCurrentRole}
          />

          {/* Page Content */}
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<PlannerDashboard />} />
              <Route path="/weekly-plan" element={<WeeklyPlanPage />} />
              <Route path="/monthly-plan" element={<MonthlyPlanPage />} />
              <Route path="/engineering" element={<EngineeringPage />} />
              <Route path="/snt" element={<SNTPage />} />
              <Route path="/traction" element={<TractionPage />} />
              <Route path="/impact-reports" element={<ImpactReportsPage />} />
              <Route path="/integration-status" element={<IntegrationStatusPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Routes>
          </div>

          {/* Footer */}
          <footer className="bg-white border-t border-[#D6DEE6] py-3 px-6">
            <p className="text-xs text-[#52606D] text-center">
              MARS 2.0 | Ministry of Railways, Government of India | Pune Division (CR)
            </p>
          </footer>
        </div>
      </div>
    </Router>
  );
}

export default App;
