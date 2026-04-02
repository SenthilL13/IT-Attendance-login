// ─── IT Attendance System — Cloudflare Worker ───────────────────────────────
// Full rewrite of Flask/Python backend in JS with Cloudflare D1 + WebCrypto

const JWT_SECRET = 'super-secret-attendance-key-2026';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

// ─── Utilities ───────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

// ─── JWT (HS256 via WebCrypto) ────────────────────────────────────────────────

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

async function jwtSign(payload) {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

async function jwtVerify(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const data = `${parts[0]}.${parts[1]}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sig = Uint8Array.from(b64urlDecode(parts[2]), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(data));
    if (!valid) return null;
    return JSON.parse(b64urlDecode(parts[1]));
  } catch { return null; }
}

// ─── Password Hashing (PBKDF2) ────────────────────────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = [...salt].map(b => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const hash = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hash}`;
}

async function verifyPassword(password, stored) {
  try {
    // Support both PBKDF2 (new) and werkzeug-style hashes (legacy — always fail safe)
    if (!stored.startsWith('pbkdf2:')) return false;
    const [, saltHex, storedHash] = stored.split(':');
    const salt = Uint8Array.from(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
    const hash = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hash === storedHash;
  } catch { return false; }
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

async function requireAuth(request) {
  const header = request.headers.get('Authorization') || '';
  const token = header.replace('Bearer ', '');
  if (!token) return null;
  return await jwtVerify(token);
}

async function getUser(db, userId) {
  return await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
}

function userToDict(u) {
  return {
    id: u.id, username: u.username, full_name: u.full_name,
    email: u.email, role: u.role, department: u.department,
    shift: u.shift, is_active: u.is_active === 1,
    created_at: u.created_at,
  };
}

function attToDict(r, user) {
  return {
    id: r.id, user_id: r.user_id,
    user_name: user?.full_name || null,
    department: user?.department || null,
    date: r.date,
    check_in: r.check_in ? fmtTime(r.check_in) : null,
    lunch_out: r.lunch_out ? fmtTime(r.lunch_out) : null,
    lunch_in: r.lunch_in ? fmtTime(r.lunch_in) : null,
    check_out: r.check_out ? fmtTime(r.check_out) : null,
    status: r.status,
    net_hours: r.net_hours || 0,
    notes: r.notes,
  };
}

function fmtTime(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    let h = d.getUTCHours(), m = d.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch { return isoStr; }
}

function nowISO() { return new Date().toISOString(); }
function todayISO() { return new Date().toISOString().split('T')[0]; }

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Seed endpoint (only once, idempotent)
    if (path === '/api/seed' && method === 'POST') {
      return handleSeed(env.DB);
    }

    // Route matching
    try {
      // Auth routes
      if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, env.DB);
      if (path === '/api/auth/me' && method === 'GET') return handleMe(request, env.DB);
      if (path === '/api/auth/change-password' && method === 'POST') return handleChangePassword(request, env.DB);

      // Attendance routes
      if (path === '/api/attendance/today' && method === 'GET') return handleAttToday(request, env.DB);
      if (path === '/api/attendance/check-in' && method === 'POST') return handleCheckIn(request, env.DB);
      if (path === '/api/attendance/lunch-out' && method === 'POST') return handleLunchOut(request, env.DB);
      if (path === '/api/attendance/lunch-in' && method === 'POST') return handleLunchIn(request, env.DB);
      if (path === '/api/attendance/check-out' && method === 'POST') return handleCheckOut(request, env.DB);
      if (path === '/api/attendance/history' && method === 'GET') return handleAttHistory(request, env.DB, url);
      if (path === '/api/attendance/all' && method === 'GET') return handleAttAll(request, env.DB, url);

      // Admin routes
      if (path === '/api/admin/users' && method === 'GET') return handleAdminUsers(request, env.DB);
      if (path === '/api/admin/users' && method === 'POST') return handleAdminCreateUser(request, env.DB);
      if (path.match(/^\/api\/admin\/users\/\d+$/) && method === 'PUT') {
        return handleAdminUpdateUser(request, env.DB, path.split('/').pop());
      }
      if (path.match(/^\/api\/admin\/users\/\d+$/) && method === 'DELETE') {
        return handleAdminDeleteUser(request, env.DB, path.split('/').pop());
      }
      if (path === '/api/admin/departments' && method === 'GET') return handleGetDepts(request, env.DB);
      if (path === '/api/admin/departments' && method === 'POST') return handleCreateDept(request, env.DB);
      if (path.match(/^\/api\/admin\/departments\/\d+$/) && method === 'DELETE') {
        return handleDeleteDept(request, env.DB, path.split('/').pop());
      }
      if (path === '/api/admin/holidays' && method === 'GET') return handleGetHolidays(request, env.DB);
      if (path === '/api/admin/holidays' && method === 'POST') return handleCreateHoliday(request, env.DB);
      if (path.match(/^\/api\/admin\/holidays\/\d+$/) && method === 'DELETE') {
        return handleDeleteHoliday(request, env.DB, path.split('/').pop());
      }
      if (path === '/api/admin/stats' && method === 'GET') return handleAdminStats(request, env.DB);

      // Employee routes
      if (path === '/api/employee/profile' && method === 'GET') return handleEmpProfile(request, env.DB);
      if (path === '/api/employee/leaves' && method === 'GET') return handleEmpLeaves(request, env.DB);
      if (path === '/api/employee/leaves' && method === 'POST') return handleEmpCreateLeave(request, env.DB);
      if (path.match(/^\/api\/employee\/leaves\/\d+$/) && method === 'DELETE') {
        return handleEmpCancelLeave(request, env.DB, path.split('/').pop());
      }

      // Manager routes
      if (path === '/api/manager/team' && method === 'GET') return handleMgrTeam(request, env.DB);
      if (path === '/api/manager/pending-leaves' && method === 'GET') return handleMgrPendingLeaves(request, env.DB);
      if (path.match(/^\/api\/manager\/leaves\/\d+\/approve$/) && method === 'POST') {
        return handleMgrApproveLeave(request, env.DB, path.split('/')[4]);
      }
      if (path.match(/^\/api\/manager\/leaves\/\d+\/reject$/) && method === 'POST') {
        return handleMgrRejectLeave(request, env.DB, path.split('/')[4]);
      }
      if (path === '/api/manager/stats' && method === 'GET') return handleMgrStats(request, env.DB);

      // Reports routes
      if (path === '/api/reports/monthly' && method === 'GET') return handleReportsMonthly(request, env.DB, url);
      if (path === '/api/reports/trends' && method === 'GET') return handleReportsTrends(request, env.DB, url);
      if (path === '/api/reports/export-csv' && method === 'GET') return handleExportCsv(request, env.DB, url);

      // Health check
      if (path === '/api/health') return json({ status: 'ok', message: 'IT Attendance API Running' });

      return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'Internal server error', details: e.message }, 500);
    }
  }
};

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function handleSeed(db) {
  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      department TEXT DEFAULT 'General',
      shift TEXT DEFAULT '9:00 AM - 6:00 PM',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      check_in TEXT,
      lunch_out TEXT,
      lunch_in TEXT,
      check_out TEXT,
      status TEXT DEFAULT 'present',
      net_hours REAL DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT
    );
  `);

  // Check if already seeded
  const existing = await db.prepare('SELECT COUNT(*) as c FROM users').first();
  if (existing.c > 0) {
    return json({ message: 'Already seeded', users: existing.c });
  }

  // Seed departments
  const depts = ['Engineering', 'Human Resources', 'Marketing', 'Finance', 'Operations'];
  for (const d of depts) {
    await db.prepare('INSERT OR IGNORE INTO departments (name, description) VALUES (?, ?)').bind(d, `${d} department`).run();
  }

  // Seed users
  const users = [
    { username: 'admin', password: 'admin123', full_name: 'Admin User', email: 'admin@company.com', role: 'admin', department: 'Engineering' },
    { username: 'manager', password: 'manager123', full_name: 'Sarah Manager', email: 'manager@company.com', role: 'manager', department: 'Engineering' },
    { username: 'employee', password: 'employee123', full_name: 'John Employee', email: 'employee@company.com', role: 'employee', department: 'Engineering' },
    { username: 'jane', password: 'jane123', full_name: 'Jane Smith', email: 'jane@company.com', role: 'employee', department: 'Marketing' },
    { username: 'mike', password: 'mike123', full_name: 'Mike Johnson', email: 'mike@company.com', role: 'employee', department: 'Finance' },
  ];

  const insertedIds = [];
  for (const u of users) {
    const ph = await hashPassword(u.password);
    const res = await db.prepare(
      'INSERT INTO users (username, password_hash, full_name, email, role, department, shift) VALUES (?,?,?,?,?,?,?)'
    ).bind(u.username, ph, u.full_name, u.email, u.role, u.department, '9:00 AM - 6:00 PM').run();
    insertedIds.push({ id: res.meta.last_row_id, role: u.role });
  }

  // Seed holidays
  await db.prepare('INSERT OR IGNORE INTO holidays (name, date, description) VALUES (?,?,?)').bind('New Year', '2026-01-01', "New Year's Day").run();
  await db.prepare('INSERT OR IGNORE INTO holidays (name, date, description) VALUES (?,?,?)').bind('Republic Day', '2026-01-26', 'Republic Day').run();
  await db.prepare('INSERT OR IGNORE INTO holidays (name, date, description) VALUES (?,?,?)').bind('Independence Day', '2026-08-15', 'Independence Day').run();
  await db.prepare('INSERT OR IGNORE INTO holidays (name, date, description) VALUES (?,?,?)').bind('Christmas', '2026-12-25', 'Christmas Day').run();

  // Seed sample attendance for last 7 days for employees
  const empIds = insertedIds.filter(u => u.role === 'employee').map(u => u.id);
  const today = new Date();
  for (const uid of empIds) {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
      const dateStr = d.toISOString().split('T')[0];
      const checkIn = `${dateStr}T09:05:00.000Z`;
      const lunchOut = `${dateStr}T13:00:00.000Z`;
      const lunchIn = `${dateStr}T13:45:00.000Z`;
      const checkOut = `${dateStr}T18:10:00.000Z`;
      const net = ((18 * 60 + 10) - (9 * 60 + 5) - 45) / 60;
      const status = (i % 3 === 0) ? 'late' : 'present';
      await db.prepare(
        'INSERT OR IGNORE INTO attendance (user_id, date, check_in, lunch_out, lunch_in, check_out, status, net_hours) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(uid, dateStr, checkIn, lunchOut, lunchIn, checkOut, status, Math.round(net * 100) / 100).run();
    }
  }

  return json({
    message: 'Database seeded successfully!',
    accounts: { admin: 'admin/admin123', manager: 'manager/manager123', employee: 'employee/employee123' }
  });
}

// ─── Auth Handlers ────────────────────────────────────────────────────────────

async function handleLogin(request, db) {
  const { username, password } = await request.json();
  if (!username || !password) return err('Username and password are required');

  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username.trim()).first();
  if (!user) return err('Invalid credentials', 401);
  if (!user.is_active) return err('Account is deactivated', 403);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return err('Invalid credentials', 401);

  const token = await jwtSign({ sub: String(user.id), role: user.role });
  return json({ token, user: userToDict(user) });
}

async function handleMe(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const user = await getUser(db, payload.sub);
  if (!user) return err('User not found', 404);
  return json({ user: userToDict(user) });
}

async function handleChangePassword(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const user = await getUser(db, payload.sub);
  const { current_password, new_password } = await request.json();
  if (!await verifyPassword(current_password, user.password_hash)) return err('Current password is incorrect');
  if (!new_password || new_password.length < 6) return err('New password must be at least 6 characters');
  const ph = await hashPassword(new_password);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(ph, user.id).run();
  return json({ message: 'Password changed successfully' });
}

// ─── Attendance Handlers ──────────────────────────────────────────────────────

async function handleAttToday(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const today = todayISO();
  const record = await db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').bind(payload.sub, today).first();
  const user = await getUser(db, payload.sub);
  return json({ attendance: record ? attToDict(record, user) : null });
}

async function handleCheckIn(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const today = todayISO();
  const now = nowISO();
  const existing = await db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').bind(payload.sub, today).first();
  if (existing && existing.check_in) return err('Already checked in today');

  const hour = new Date().getUTCHours();
  const minute = new Date().getUTCMinutes();
  const status = (hour > 9 || (hour === 9 && minute > 15)) ? 'late' : 'present';

  let record;
  if (existing) {
    await db.prepare('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?').bind(now, status, existing.id).run();
    record = await db.prepare('SELECT * FROM attendance WHERE id = ?').bind(existing.id).first();
  } else {
    const res = await db.prepare('INSERT INTO attendance (user_id, date, check_in, status) VALUES (?,?,?,?)').bind(payload.sub, today, now, status).run();
    record = await db.prepare('SELECT * FROM attendance WHERE id = ?').bind(res.meta.last_row_id).first();
  }
  const user = await getUser(db, payload.sub);
  return json({ message: `Checked in at ${fmtTime(now)}`, attendance: attToDict(record, user) });
}

async function handleLunchOut(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const today = todayISO();
  const record = await db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').bind(payload.sub, today).first();
  if (!record || !record.check_in) return err('Please check in first');
  if (record.lunch_out) return err('Already marked lunch out');
  const now = nowISO();
  await db.prepare('UPDATE attendance SET lunch_out = ? WHERE id = ?').bind(now, record.id).run();
  const updated = await db.prepare('SELECT * FROM attendance WHERE id = ?').bind(record.id).first();
  const user = await getUser(db, payload.sub);
  return json({ message: 'Lunch break started', attendance: attToDict(updated, user) });
}

async function handleLunchIn(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const today = todayISO();
  const record = await db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').bind(payload.sub, today).first();
  if (!record || !record.lunch_out) return err('Please mark lunch out first');
  if (record.lunch_in) return err('Already returned from lunch');
  const now = nowISO();
  await db.prepare('UPDATE attendance SET lunch_in = ? WHERE id = ?').bind(now, record.id).run();
  const updated = await db.prepare('SELECT * FROM attendance WHERE id = ?').bind(record.id).first();
  const user = await getUser(db, payload.sub);
  return json({ message: 'Lunch break ended', attendance: attToDict(updated, user) });
}

async function handleCheckOut(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const today = todayISO();
  const record = await db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').bind(payload.sub, today).first();
  if (!record || !record.check_in) return err('Please check in first');
  if (record.check_out) return err('Already checked out');
  const now = nowISO();
  const checkInMs = new Date(record.check_in).getTime();
  let total = (new Date(now).getTime() - checkInMs) / 3600000;
  if (record.lunch_out && record.lunch_in) {
    total -= (new Date(record.lunch_in).getTime() - new Date(record.lunch_out).getTime()) / 3600000;
  }
  const net = Math.round(total * 100) / 100;
  const status = total < 4 ? 'half-day' : record.status;
  await db.prepare('UPDATE attendance SET check_out = ?, net_hours = ?, status = ? WHERE id = ?').bind(now, net, status, record.id).run();
  const updated = await db.prepare('SELECT * FROM attendance WHERE id = ?').bind(record.id).first();
  const user = await getUser(db, payload.sub);
  return json({ message: `Checked out. Total: ${net}h`, attendance: attToDict(updated, user) });
}

async function handleAttHistory(request, db, url) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const page = parseInt(url.searchParams.get('page') || '1');
  const perPage = parseInt(url.searchParams.get('per_page') || '20');
  const offset = (page - 1) * perPage;
  const records = await db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT ? OFFSET ?').bind(payload.sub, perPage, offset).all();
  const total = (await db.prepare('SELECT COUNT(*) as c FROM attendance WHERE user_id = ?').bind(payload.sub).first()).c;
  const user = await getUser(db, payload.sub);
  return json({ records: records.results.map(r => attToDict(r, user)), total, pages: Math.ceil(total / perPage), current_page: page });
}

async function handleAttAll(request, db, url) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const user = await getUser(db, payload.sub);
  if (!['admin', 'manager'].includes(user.role)) return err('Unauthorized', 403);
  const dateStr = url.searchParams.get('date') || todayISO();
  const records = await db.prepare('SELECT * FROM attendance WHERE date = ?').bind(dateStr).all();
  const userIds = [...new Set(records.results.map(r => r.user_id))];
  const users = {};
  for (const uid of userIds) {
    users[uid] = await getUser(db, uid);
  }
  return json({ records: records.results.map(r => attToDict(r, users[r.user_id])), date: dateStr });
}

// ─── Admin Handlers ───────────────────────────────────────────────────────────

async function requireAdmin(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return null;
  const user = await getUser(db, payload.sub);
  return (user && user.role === 'admin') ? user : null;
}

async function requireManagerOrAdmin(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return null;
  const user = await getUser(db, payload.sub);
  return (user && ['admin', 'manager'].includes(user.role)) ? user : null;
}

async function handleAdminUsers(request, db) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const users = await db.prepare('SELECT * FROM users').all();
  return json({ users: users.results.map(userToDict) });
}

async function handleAdminCreateUser(request, db) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const data = await request.json();
  for (const f of ['username', 'password', 'full_name', 'email']) {
    if (!data[f]) return err(`${f} is required`);
  }
  const existU = await db.prepare('SELECT id FROM users WHERE username = ?').bind(data.username).first();
  if (existU) return err('Username already exists');
  const existE = await db.prepare('SELECT id FROM users WHERE email = ?').bind(data.email).first();
  if (existE) return err('Email already exists');
  const ph = await hashPassword(data.password);
  const res = await db.prepare(
    'INSERT INTO users (username, password_hash, full_name, email, role, department, shift) VALUES (?,?,?,?,?,?,?)'
  ).bind(data.username, ph, data.full_name, data.email, data.role || 'employee', data.department || 'General', data.shift || '9:00 AM - 6:00 PM').run();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(res.meta.last_row_id).first();
  return json({ message: 'User created', user: userToDict(user) }, 201);
}

async function handleAdminUpdateUser(request, db, uid) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const user = await getUser(db, uid);
  if (!user) return err('User not found', 404);
  const data = await request.json();
  const updates = [];
  const vals = [];
  if (data.full_name !== undefined) { updates.push('full_name = ?'); vals.push(data.full_name); }
  if (data.email !== undefined) { updates.push('email = ?'); vals.push(data.email); }
  if (data.role !== undefined) { updates.push('role = ?'); vals.push(data.role); }
  if (data.department !== undefined) { updates.push('department = ?'); vals.push(data.department); }
  if (data.shift !== undefined) { updates.push('shift = ?'); vals.push(data.shift); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); vals.push(data.is_active ? 1 : 0); }
  if (data.password) { updates.push('password_hash = ?'); vals.push(await hashPassword(data.password)); }
  if (updates.length) {
    vals.push(uid);
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
  }
  const updated = await getUser(db, uid);
  return json({ message: 'User updated', user: userToDict(updated) });
}

async function handleAdminDeleteUser(request, db, uid) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const user = await getUser(db, uid);
  if (!user) return err('User not found', 404);
  await db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(uid).run();
  return json({ message: 'User deactivated' });
}

async function handleGetDepts(request, db) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const depts = await db.prepare('SELECT * FROM departments').all();
  return json({ departments: depts.results });
}

async function handleCreateDept(request, db) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const { name, description } = await request.json();
  if (!name) return err('Department name is required');
  const existing = await db.prepare('SELECT id FROM departments WHERE name = ?').bind(name).first();
  if (existing) return err('Department already exists');
  const res = await db.prepare('INSERT INTO departments (name, description) VALUES (?,?)').bind(name, description || '').run();
  const dept = await db.prepare('SELECT * FROM departments WHERE id = ?').bind(res.meta.last_row_id).first();
  return json({ message: 'Department created', department: dept }, 201);
}

async function handleDeleteDept(request, db, did) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const dept = await db.prepare('SELECT * FROM departments WHERE id = ?').bind(did).first();
  if (!dept) return err('Department not found', 404);
  await db.prepare('DELETE FROM departments WHERE id = ?').bind(did).run();
  return json({ message: 'Department deleted' });
}

async function handleGetHolidays(request, db) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const h = await db.prepare('SELECT * FROM holidays ORDER BY date').all();
  return json({ holidays: h.results });
}

async function handleCreateHoliday(request, db) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const { name, date, description } = await request.json();
  if (!name || !date) return err('Name and date are required');
  const res = await db.prepare('INSERT INTO holidays (name, date, description) VALUES (?,?,?)').bind(name, date, description || '').run();
  const holiday = await db.prepare('SELECT * FROM holidays WHERE id = ?').bind(res.meta.last_row_id).first();
  return json({ message: 'Holiday created', holiday }, 201);
}

async function handleDeleteHoliday(request, db, hid) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const h = await db.prepare('SELECT * FROM holidays WHERE id = ?').bind(hid).first();
  if (!h) return err('Holiday not found', 404);
  await db.prepare('DELETE FROM holidays WHERE id = ?').bind(hid).run();
  return json({ message: 'Holiday deleted' });
}

async function handleAdminStats(request, db) {
  if (!await requireAdmin(request, db)) return err('Admin access required', 403);
  const today = todayISO();
  const totalEmp = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE is_active=1 AND role!='admin'").first()).c;
  const presentToday = (await db.prepare('SELECT COUNT(*) as c FROM attendance WHERE date=? AND check_in IS NOT NULL').bind(today).first()).c;
  const onLeave = (await db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status='approved' AND start_date<=? AND end_date>=?").bind(today, today).first()).c;
  const pendingLeaves = (await db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status='pending'").first()).c;
  return json({ total_employees: totalEmp, present_today: presentToday, on_leave: onLeave, absent: totalEmp - presentToday - onLeave, pending_leaves: pendingLeaves });
}

// ─── Employee Handlers ────────────────────────────────────────────────────────

async function handleEmpProfile(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const user = await getUser(db, payload.sub);
  if (!user) return err('User not found', 404);
  const today = todayISO();
  const monthStart = today.substring(0, 7) + '-01';
  const monthAtt = (await db.prepare('SELECT COUNT(*) as c FROM attendance WHERE user_id=? AND date>=? AND date<=? AND check_in IS NOT NULL').bind(payload.sub, monthStart, today).first()).c;
  const lateCount = (await db.prepare("SELECT COUNT(*) as c FROM attendance WHERE user_id=? AND date>=? AND status='late'").bind(payload.sub, monthStart).first()).c;
  const pendingLeaves = (await db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE user_id=? AND status='pending'").bind(payload.sub).first()).c;
  return json({ user: userToDict(user), stats: { month_attendance: monthAtt, late_count: lateCount, pending_leaves: pendingLeaves } });
}

async function handleEmpLeaves(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const leaves = await db.prepare('SELECT * FROM leave_requests WHERE user_id=? ORDER BY created_at DESC').bind(payload.sub).all();
  const user = await getUser(db, payload.sub);
  return json({ leaves: leaves.results.map(l => leaveToDict(l, user)) });
}

async function handleEmpCreateLeave(request, db) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const data = await request.json();
  for (const f of ['leave_type', 'start_date', 'end_date', 'reason']) {
    if (!data[f]) return err(`${f} is required`);
  }
  if (data.end_date < data.start_date) return err('End date cannot be before start date');
  const res = await db.prepare(
    'INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason) VALUES (?,?,?,?,?)'
  ).bind(payload.sub, data.leave_type, data.start_date, data.end_date, data.reason).run();
  const leave = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(res.meta.last_row_id).first();
  const user = await getUser(db, payload.sub);
  return json({ message: 'Leave request submitted', leave: leaveToDict(leave, user) }, 201);
}

async function handleEmpCancelLeave(request, db, lid) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const leave = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(lid).first();
  if (!leave || String(leave.user_id) !== String(payload.sub)) return err('Leave request not found', 404);
  if (leave.status !== 'pending') return err('Can only cancel pending requests');
  await db.prepare('DELETE FROM leave_requests WHERE id = ?').bind(lid).run();
  return json({ message: 'Leave request cancelled' });
}

// ─── Manager Handlers ─────────────────────────────────────────────────────────

async function handleMgrTeam(request, db) {
  const mgr = await requireManagerOrAdmin(request, db);
  if (!mgr) return err('Manager access required', 403);
  const employees = await db.prepare("SELECT * FROM users WHERE is_active=1 AND role='employee'").all();
  const today = todayISO();
  const team = [];
  for (const emp of employees.results) {
    const att = await db.prepare('SELECT * FROM attendance WHERE user_id=? AND date=?').bind(emp.id, today).first();
    team.push({ user: userToDict(emp), today_attendance: att ? attToDict(att, emp) : null });
  }
  return json({ team });
}

async function handleMgrPendingLeaves(request, db) {
  const mgr = await requireManagerOrAdmin(request, db);
  if (!mgr) return err('Manager access required', 403);
  const leaves = await db.prepare("SELECT * FROM leave_requests WHERE status='pending' ORDER BY created_at DESC").all();
  const result = await Promise.all(leaves.results.map(async l => {
    const u = await getUser(db, l.user_id);
    return leaveToDict(l, u);
  }));
  return json({ leaves: result });
}

async function handleMgrApproveLeave(request, db, lid) {
  const mgr = await requireManagerOrAdmin(request, db);
  if (!mgr) return err('Manager access required', 403);
  const leave = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(lid).first();
  if (!leave) return err('Leave request not found', 404);
  await db.prepare("UPDATE leave_requests SET status='approved', reviewed_by=?, reviewed_at=? WHERE id=?").bind(mgr.id, nowISO(), lid).run();
  const updated = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(lid).first();
  const user = await getUser(db, updated.user_id);
  return json({ message: 'Leave approved', leave: leaveToDict(updated, user) });
}

async function handleMgrRejectLeave(request, db, lid) {
  const mgr = await requireManagerOrAdmin(request, db);
  if (!mgr) return err('Manager access required', 403);
  const leave = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(lid).first();
  if (!leave) return err('Leave request not found', 404);
  await db.prepare("UPDATE leave_requests SET status='rejected', reviewed_by=?, reviewed_at=? WHERE id=?").bind(mgr.id, nowISO(), lid).run();
  const updated = await db.prepare('SELECT * FROM leave_requests WHERE id = ?').bind(lid).first();
  const user = await getUser(db, updated.user_id);
  return json({ message: 'Leave rejected', leave: leaveToDict(updated, user) });
}

async function handleMgrStats(request, db) {
  const mgr = await requireManagerOrAdmin(request, db);
  if (!mgr) return err('Manager access required', 403);
  const today = todayISO();
  const totalEmp = (await db.prepare("SELECT COUNT(*) as c FROM users WHERE is_active=1 AND role='employee'").first()).c;
  const present = (await db.prepare('SELECT COUNT(*) as c FROM attendance WHERE date=? AND check_in IS NOT NULL').bind(today).first()).c;
  const pendingLeaves = (await db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status='pending'").first()).c;
  return json({ total_employees: totalEmp, present_today: present, absent_today: totalEmp - present, pending_leaves: pendingLeaves });
}

// ─── Reports Handlers ─────────────────────────────────────────────────────────

async function handleReportsMonthly(request, db, url) {
  const mgr = await requireManagerOrAdmin(request, db);
  if (!mgr) return err('Access denied', 403);
  const year = parseInt(url.searchParams.get('year') || new Date().getUTCFullYear());
  const month = parseInt(url.searchParams.get('month') || (new Date().getUTCMonth() + 1));
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = new Date(endYear, endMonth - 1, 0);
  const end = `${endYear}-${String(endMonth - 1 || 12).padStart(2, '0')}-${endDate.getDate()}`;

  const records = await db.prepare('SELECT * FROM attendance WHERE date>=? AND date<=? ORDER BY date').bind(start, end).all();
  const userData = {};
  for (const r of records.results) {
    if (!userData[r.user_id]) {
      const u = await getUser(db, r.user_id);
      userData[r.user_id] = { user_name: u?.full_name, department: u?.department, present: 0, late: 0, half_day: 0, total_hours: 0 };
    }
    userData[r.user_id].present++;
    if (r.status === 'late') userData[r.user_id].late++;
    if (r.status === 'half-day') userData[r.user_id].half_day++;
    userData[r.user_id].total_hours += r.net_hours || 0;
  }
  const result = Object.values(userData).map(d => ({
    ...d,
    total_hours: Math.round(d.total_hours * 100) / 100,
    avg_hours: Math.round((d.total_hours / Math.max(d.present, 1)) * 100) / 100,
  }));
  return json({ report: result, month, year });
}

async function handleReportsTrends(request, db, url) {
  const payload = await requireAuth(request);
  if (!payload) return err('Unauthorized', 401);
  const user = await getUser(db, payload.sub);
  const days = parseInt(url.searchParams.get('days') || '30');
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().split('T')[0];

  let records;
  if (['admin', 'manager'].includes(user.role)) {
    records = await db.prepare('SELECT * FROM attendance WHERE date>=?').bind(startStr).all();
  } else {
    records = await db.prepare('SELECT * FROM attendance WHERE user_id=? AND date>=?').bind(payload.sub, startStr).all();
  }

  const daily = {};
  for (const r of records.results) {
    if (!daily[r.date]) daily[r.date] = { date: r.date, present: 0, late: 0, absent: 0, total_hours: 0 };
    daily[r.date].present++;
    if (r.status === 'late') daily[r.date].late++;
    daily[r.date].total_hours += r.net_hours || 0;
  }
  const trends = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({ ...d, total_hours: Math.round(d.total_hours * 100) / 100 }));
  return json({ trends });
}

async function handleExportCsv(request, db, url) {
  const mgr = await requireManagerOrAdmin(request, db);
  if (!mgr) return err('Access denied', 403);
  const year = parseInt(url.searchParams.get('year') || new Date().getUTCFullYear());
  const month = parseInt(url.searchParams.get('month') || (new Date().getUTCMonth() + 1));
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const records = await db.prepare('SELECT * FROM attendance WHERE date>=? AND date<=? ORDER BY date').bind(start, end).all();
  const rows = ['Employee,Department,Date,Check In,Lunch Out,Lunch In,Check Out,Status,Net Hours'];
  for (const r of records.results) {
    const u = await getUser(db, r.user_id);
    rows.push([
      u?.full_name || '', u?.department || '', r.date,
      r.check_in ? fmtTime(r.check_in) : '',
      r.lunch_out ? fmtTime(r.lunch_out) : '',
      r.lunch_in ? fmtTime(r.lunch_in) : '',
      r.check_out ? fmtTime(r.check_out) : '',
      r.status, r.net_hours || 0
    ].join(','));
  }

  return new Response(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=attendance_${year}_${String(month).padStart(2, '0')}.csv`,
      ...CORS_HEADERS,
    }
  });
}

// ─── Leave helper ─────────────────────────────────────────────────────────────

function leaveToDict(l, user) {
  return {
    id: l.id, user_id: l.user_id,
    user_name: user?.full_name || null,
    department: user?.department || null,
    leave_type: l.leave_type,
    start_date: l.start_date, end_date: l.end_date,
    reason: l.reason, status: l.status,
    reviewed_by: l.reviewed_by || null,
    reviewed_at: l.reviewed_at || null,
    created_at: l.created_at,
  };
}
