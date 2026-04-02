import { useState, useEffect } from 'react';
import { getTodayAttendance, attendanceAction } from '../api';
import { Clock, Coffee, LogIn, LogOut, CheckCircle } from 'lucide-react';

export default function EmployeeCheckIn() {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Clock tick
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchToday = async () => {
    try {
      const res = await getTodayAttendance();
      if(res.data.id) {
        setRecord(res.data);
      } else {
        setRecord(null);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToday();
  }, []);

  const handleAction = async (action) => {
    try {
      await attendanceAction(action);
      fetchToday();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record action');
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = currentTime.toLocaleTimeString('en-US', { hour12: false });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Current Time Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl p-8 text-white text-center shadow-lg relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <h2 className="text-lg opacity-80 mb-2">{dateStr}</h2>
        <div className="text-6xl font-bold font-mono tracking-wider drop-shadow-md">
           {timeStr}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          onClick={() => handleAction('check_in')} 
          disabled={record?.shift_in}
          className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${record?.shift_in ? 'bg-emerald-100 text-emerald-500' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'}`}>
            {record?.shift_in ? <CheckCircle className="w-6 h-6" /> : <LogIn className="w-6 h-6 ml-1" />}
          </div>
          <span className="font-semibold text-gray-700 text-sm">Check In</span>
        </button>

        <button 
          onClick={() => handleAction('lunch_out')} 
          disabled={!record?.shift_in || record?.lunch_out}
          className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${record?.lunch_out ? 'bg-amber-100 text-amber-500' : 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'}`}>
             {record?.lunch_out ? <CheckCircle className="w-6 h-6" /> : <Coffee className="w-6 h-6" />}
          </div>
          <span className="font-semibold text-gray-700 text-sm">Lunch Out</span>
        </button>

        <button 
          onClick={() => handleAction('lunch_in')} 
          disabled={!record?.lunch_out || record?.lunch_in}
          className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${record?.lunch_in ? 'bg-blue-100 text-blue-500' : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'}`}>
             {record?.lunch_in ? <CheckCircle className="w-6 h-6" /> : <Coffee className="w-6 h-6" />}
          </div>
          <span className="font-semibold text-gray-700 text-sm">Lunch In</span>
        </button>

        <button 
          onClick={() => handleAction('check_out')} 
          disabled={!record?.shift_in || record?.shift_out}
          className="flex flex-col items-center justify-center gap-3 p-6 bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${record?.shift_out ? 'bg-rose-100 text-rose-500' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'}`}>
             {record?.shift_out ? <CheckCircle className="w-6 h-6" /> : <LogOut className="w-6 h-6 mr-1" />}
          </div>
          <span className="font-semibold text-gray-700 text-sm">Check Out</span>
        </button>
      </div>

      {/* Today's Log */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 overflow-hidden">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-gray-400" /> Today's Log</h3>
        
        {!record ? (
           <p className="text-gray-500 text-sm text-center py-4">You have not checked in today. Please check in when you start your shift.</p>
        ) : (
           <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-700">
             <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
               <span className="block text-xs text-gray-400 mb-1">Shift In</span>
               <span className="font-mono font-medium">{record.shift_in || '--:--:--'}</span>
             </div>
             <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
               <span className="block text-xs text-gray-400 mb-1">Lunch Out</span>
               <span className="font-mono font-medium">{record.lunch_out || '--:--:--'}</span>
             </div>
             <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
               <span className="block text-xs text-gray-400 mb-1">Lunch In</span>
               <span className="font-mono font-medium">{record.lunch_in || '--:--:--'}</span>
             </div>
             <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
               <span className="block text-xs text-gray-400 mb-1">Shift Out</span>
               <span className="font-mono font-medium">{record.shift_out || '--:--:--'}</span>
             </div>
           </div>
        )}

        {record?.net_hours != null && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
             <span className="text-gray-500 text-sm">Working Hours Today: </span>
             <span className="text-xl font-bold text-emerald-600 ml-2">{record.net_hours} hrs</span>
          </div>
        )}
      </div>

    </div>
  )
}
