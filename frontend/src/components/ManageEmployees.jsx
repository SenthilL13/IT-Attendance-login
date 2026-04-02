import { useState, useEffect } from 'react';
import { getEmployees, createEmployee, deleteEmployee } from '../api';
import { Users, UserPlus, Trash2, Shield } from 'lucide-react';

export default function ManageEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({ name: '', username: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await getEmployees();
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await createEmployee(form);
      setSuccess('Employee created successfully');
      setForm({ name: '', username: '', password: '' });
      fetchEmployees();
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating employee');
    }
  };

  const handleDelete = async (id) => {
    if(!confirm('Are you sure you want to delete this employee?')) return;
    try {
      await deleteEmployee(id);
      fetchEmployees();
    } catch(err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <Users className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-800">Employee Directory</h2>
          </div>
          {loading ? (
             <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
             <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-5 py-3 font-semibold text-gray-600">Name</th>
                      <th className="px-5 py-3 font-semibold text-gray-600">Username</th>
                      <th className="px-5 py-3 font-semibold text-gray-600 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-700">{emp.name}</td>
                        <td className="px-5 py-3 text-gray-500 font-mono text-xs">{emp.username}</td>
                        <td className="px-5 py-3 text-center">
                          <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {employees.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-5 py-8 text-center text-gray-400">No employees found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          )}
        </div>
      </div>

      {/* Add Form */}
      <div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden sticky top-24">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r from-purple-50 to-white">
            <UserPlus className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-800">Create Account</h2>
          </div>
          <form className="p-5 space-y-4" onSubmit={handleSubmit}>
            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            {success && <div className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded">{success}</div>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border-gray-200 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full border-gray-200 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 outline-none font-mono" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passowrd</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border-gray-200 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 outline-none" required />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium py-2 rounded-lg cursor-pointer hover:shadow-md transition">Add Employee</button>
            <p className="text-xs text-center text-gray-400 mt-2 flex items-center justify-center gap-1"><Shield className="w-3 h-3"/> Passwords are securely hashed</p>
          </form>
        </div>
      </div>
    </div>
  )
}
