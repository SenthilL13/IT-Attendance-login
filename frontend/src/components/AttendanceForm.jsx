import { useState, useEffect } from 'react';
import { getEmployees, createAttendance, updateAttendance } from '../api';
import { Save, X, Clock, CalendarDays, AlertCircle, CheckCircle } from 'lucide-react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDayName(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return '';
  }
}

export default function AttendanceForm({ editingRecord, onDone }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    date: todayStr(),
    employee_id: '',
    shift_in: '',
    shift_out: '',
    lunch_out: '',
    lunch_in: '',
    status: '',
    remark: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmployees().then((res) => setEmployees(res.data));
  }, []);

  useEffect(() => {
    if (editingRecord) {
      setForm({
        date: editingRecord.date || todayStr(),
        employee_id: editingRecord.employee_id || '',
        shift_in: editingRecord.shift_in || '',
        shift_out: editingRecord.shift_out || '',
        lunch_out: editingRecord.lunch_out || '',
        lunch_in: editingRecord.lunch_in || '',
        status: editingRecord.status || '',
        remark: editingRecord.remark || '',
      });
    }
  }, [editingRecord]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const validateTime = (val) => {
    if (!val) return true;
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.date || !form.employee_id) {
      setError('Date and Employee are required.');
      return;
    }

    const timeFields = ['shift_in', 'shift_out', 'lunch_out', 'lunch_in'];
    for (const f of timeFields) {
      if (form[f] && !validateTime(form[f])) {
        setError(`Invalid time format for ${f.replace('_', ' ')}. Use HH:MM.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (editingRecord) {
        await updateAttendance(editingRecord.id, payload);
        setSuccess('Record updated successfully!');
      } else {
        await createAttendance(payload);
        setSuccess('Record created successfully!');
        // Reset form but keep date
        setForm({
          date: form.date,
          employee_id: '',
          shift_in: '',
          shift_out: '',
          lunch_out: '',
          lunch_in: '',
          status: '',
          remark: '',
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                {editingRecord ? 'Edit Attendance' : 'New Attendance Entry'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {getDayName(form.date) || 'Select a date'}
              </p>
            </div>
            {editingRecord && (
              <button
                onClick={onDone}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          {/* Date & Employee row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
                Date
              </label>
              <input
                id="form-date"
                type="date"
                value={form.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition outline-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee</label>
              <select
                id="form-employee"
                value={form.employee_id}
                onChange={(e) => handleChange('employee_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition outline-none text-sm bg-white"
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time inputs row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'shift_in', label: 'Shift In' },
              { key: 'shift_out', label: 'Shift Out' },
              { key: 'lunch_out', label: 'Lunch Out' },
              { key: 'lunch_in', label: 'Lunch In' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <input
                  id={`form-${key}`}
                  type="time"
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition outline-none text-sm font-mono"
                />
              </div>
            ))}
          </div>

          {/* Status & Remark */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status Override</label>
              <select
                id="form-status"
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition outline-none text-sm bg-white"
              >
                <option value="">Auto-detect</option>
                <option value="Present">Present</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Remark</label>
              <input
                id="form-remark"
                type="text"
                placeholder="Optional note..."
                value={form.remark}
                onChange={(e) => handleChange('remark', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition outline-none text-sm"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              id="form-submit"
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-lg shadow hover:shadow-md hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : editingRecord ? 'Update Record' : 'Save Record'}
            </button>
            {editingRecord && (
              <button
                type="button"
                onClick={onDone}
                className="px-6 py-2.5 text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
