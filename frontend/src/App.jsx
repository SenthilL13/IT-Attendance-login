import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Navbar from './components/Navbar';
import AttendanceTable from './components/AttendanceTable';
import Dashboard from './components/Dashboard';
import ManageEmployees from './components/ManageEmployees';
import EmployeeCheckIn from './components/EmployeeCheckIn';
import EmployeeHistory from './components/EmployeeHistory';
import { checkAuth, logout as apiLogout } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkAuth()
      .then((res) => {
        setUser(res.data.user.name);
        setRole(res.data.user.role);
        setActiveTab(res.data.user.role === 'admin' ? 'dashboard' : 'checkin');
      })
      .catch(() => {
        setUser(null);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (name, r) => {
    setUser(name);
    setRole(r);
    setActiveTab(r === 'admin' ? 'dashboard' : 'checkin');
  };

  const handleLogout = async () => {
    await apiLogout();
    setUser(null);
    setRole(null);
    setActiveTab('attendance');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 pb-12">
      <Navbar
        user={user}
        role={role}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Admin Views */}
        {role === 'admin' && activeTab === 'dashboard' && <Dashboard />}
        {role === 'admin' && activeTab === 'attendance' && <AttendanceTable />}
        {role === 'admin' && activeTab === 'employees' && <ManageEmployees />}

        {/* Employee Views */}
        {role === 'employee' && activeTab === 'checkin' && <EmployeeCheckIn />}
        {role === 'employee' && activeTab === 'history' && <EmployeeHistory />}
      </main>
    </div>
  );
}
