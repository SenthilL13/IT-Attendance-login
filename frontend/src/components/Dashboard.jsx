import { useState, useEffect } from 'react';
import { getSummary } from '../api';
import { BarChart3, UserCheck, UserX, Clock, TrendingUp } from 'lucide-react';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, avg_hours: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSummary(month)
      .then((res) => setSummary(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month]);

  const presentPct = summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(1) : 0;
  const absentPct = summary.total > 0 ? ((summary.absent / summary.total) * 100).toFixed(1) : 0;

  const cards = [
    {
      label: 'Total Records',
      value: summary.total,
      icon: BarChart3,
      color: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      label: 'Present',
      value: `${summary.present} (${presentPct}%)`,
      icon: UserCheck,
      color: 'from-emerald-500 to-emerald-600',
      bgLight: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      label: 'Absent',
      value: `${summary.absent} (${absentPct}%)`,
      icon: UserX,
      color: 'from-red-500 to-red-600',
      bgLight: 'bg-red-50',
      textColor: 'text-red-600',
    },
    {
      label: 'Avg Hours/Day',
      value: `${summary.avg_hours} hrs`,
      icon: Clock,
      color: 'from-amber-500 to-amber-600',
      bgLight: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Monthly Dashboard
          </h2>
          <p className="text-sm text-gray-500 mt-1">Overview of attendance for the selected month</p>
        </div>
        <input
          id="dashboard-month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition outline-none"
        />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.textColor}`}>{card.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Visual bar chart */}
      {!loading && summary.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Attendance Breakdown</h3>
          <div className="space-y-4">
            {/* Present bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 font-medium">Present</span>
                <span className="text-emerald-600 font-semibold">{summary.present} ({presentPct}%)</span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${presentPct}%` }}
                />
              </div>
            </div>
            {/* Absent bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 font-medium">Absent</span>
                <span className="text-red-600 font-semibold">{summary.absent} ({absentPct}%)</span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-700"
                  style={{ width: `${absentPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
