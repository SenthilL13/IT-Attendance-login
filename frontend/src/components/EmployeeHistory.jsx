import { useState, useEffect } from 'react';
import { getMyAttendance } from '../api';
import { Clock, Calendar } from 'lucide-react';

export default function EmployeeHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyAttendance().then(res => {
       setRecords(res.data);
    }).catch(console.error).finally(()=>setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-5 h-5 text-emerald-600" />
        <h2 className="text-xl font-bold text-gray-800">My Attendance History</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
         {loading ? (
             <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : records.length === 0 ? (
             <div className="p-10 text-center text-gray-400">
               <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
               <p>No attendance history found.</p>
             </div>
          ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-center">
                      <th className="px-4 py-3 font-semibold text-gray-600 text-left">Date</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Shift In</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Shift Out</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Lunch Out</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Lunch In</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Net Hrs</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 text-center">
                        <td className="px-4 py-3 font-medium text-gray-700 text-left">{r.date}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{r.shift_in || '—'}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{r.shift_out || '—'}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{r.lunch_out || '—'}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{r.lunch_in || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-700">{r.net_hours ? r.net_hours.toFixed(2) : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          )}
      </div>
    </div>
  )
}
