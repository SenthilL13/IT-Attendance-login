import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  withCredentials: true,
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const logout = () => api.post('/auth/logout');

export const checkAuth = () => api.get('/auth/me');

// ── Admin: Employees ────────────────────────────────────────────────────────
export const getEmployees = () => api.get('/employees');

export const createEmployee = (employee) => api.post('/employees', employee);

export const deleteEmployee = (id) => api.delete(`/employees/${id}`);

// ── General / Employee: Attendance ──────────────────────────────────────────
export const getMyAttendance = () => api.get('/attendance/me');

export const getTodayAttendance = () => api.get('/attendance/today');

export const attendanceAction = (action) => api.post('/attendance/action', { action });

// ── Admin: Attendance & Dashboard ───────────────────────────────────────────
export const getAttendance = (params) => api.get('/attendance', { params });

export const getSummary = (month) =>
  api.get('/attendance/summary', { params: { month } });

export const exportCSV = (params) =>
  api.get('/attendance/export', { params, responseType: 'blob' });

export default api;
