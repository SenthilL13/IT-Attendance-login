import { ClipboardList, PlusCircle, BarChart3, LogOut, User, Users } from 'lucide-react';

export default function Navbar({ user, role, onLogout, activeTab, onTabChange }) {
  const adminTabs = [
    { key: 'dashboard', label: 'Summary Dashboard', icon: BarChart3 },
    { key: 'attendance', label: 'All Attendance', icon: ClipboardList },
    { key: 'employees', label: 'Manage Employees', icon: Users },
  ];

  const employeeTabs = [
    { key: 'checkin', label: 'Today Action', icon: PlusCircle },
    { key: 'history', label: 'My History', icon: ClipboardList },
  ];

  const tabs = role === 'admin' ? adminTabs : employeeTabs;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-200/60 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-md ${role === 'admin' ? 'from-purple-500 to-purple-700 shadow-purple-500/20' : 'from-emerald-500 to-emerald-700 shadow-emerald-500/20'}`}>
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {role === 'admin' ? 'Admin Portal' : 'Employee Portal'}
            </h1>
          </div>

          {/* Tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === key
                    ? `bg-white shadow-sm ${role === 'admin' ? 'text-purple-700' : 'text-emerald-700'}`
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
              <User className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{user} ({role})</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
