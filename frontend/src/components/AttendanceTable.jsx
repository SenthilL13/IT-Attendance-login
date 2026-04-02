import { useState, useEffect, useCallback } from 'react';
import { getAttendance, exportCSV } from '../api';
import { Search, Filter, Download, ChevronLeft, ChevronRight, Calendar, Users, Clock } from 'lucide-react';

function getDayName(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  } catch {
    return '';
  }
}

export default function AttendanceTable() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simply fetch all attendance (since we are doing it simply for the admin)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAttendance();
      setRecords(res.data.records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      const res = await exportCSV({});
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attendance.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const grouped = {};
  records.forEach((r) => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Company Attendance Log
          </h2>
          <p className="text-sm text-gray-500 mt-1">Global view of all employee check-ins</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium rounded-lg shadow hover:shadow-md hover:from-purple-600 hover:to-purple-700 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Day</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Employee</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Shift In</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Shift Out</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Lunch Out</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Lunch In</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Net Hrs</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([date, dateRecords]) => (
                  dateRecords.map((r, idx) => (
                    <tr
                      key={r.id}
                      className={`border-b border-gray-100 hover:bg-gray-50/80 transition ${
                        r.status === 'Present' ? 'bg-emerald-50/30' : 'bg-red-50/30'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{idx === 0 ? date : ''}</td>
                      <td className="px-4 py-3 text-gray-500">{idx === 0 ? getDayName(date) : ''}</td>
                      <td className="px-4 py-3 font-medium text-gray-700">{r.user_name}</td>
                      <td className="px-4 py-3 text-center font-mono text-gray-600">{r.shift_in || '—'}</td>
                      <td className="px-4 py-3 text-center font-mono text-gray-600">{r.shift_out || '—'}</td>
                      <td className="px-4 py-3 text-center font-mono text-gray-600">{r.lunch_out || '—'}</td>
                      <td className="px-4 py-3 text-center font-mono text-gray-600">{r.lunch_in || '—'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-700">
                        {r.net_hours != null ? r.net_hours.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            r.status === 'Present'
                              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-red-100 text-red-700 ring-1 ring-red-200'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
