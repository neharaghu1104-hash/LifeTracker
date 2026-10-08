require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT);
if (!process.env.PORT || !Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
  throw new Error('Missing or invalid PORT in server/.env');
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in server/.env');
}

const DB_PATH = process.env.DB_PATH;
if (!DB_PATH) {
  throw new Error('Missing DB_PATH in server/.env');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_data (
  user_id INTEGER PRIMARY KEY,
  data_json TEXT NOT NULL,
  recovery_wrapped_key TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reset_codes (
  user_id INTEGER PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

try {
  db.prepare("ALTER TABLE user_data ADD COLUMN recovery_wrapped_key TEXT NOT NULL DEFAULT ''").run();
} catch (error) {
  if (!String(error.message || '').includes('duplicate column name')) throw error;
}

app.use(helmet());
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '2mb' }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: true, legacyHeaders: false });

function now() { return new Date().toISOString(); }
function normalizeEmail(v) { return String(v || '').trim().toLowerCase(); }
function safeUser(row) { return { id: row.id, username: row.username, email: row.email, createdAt: row.created_at }; }
function tokenFor(user) { return jwt.sign({ sub: String(user.id), username: user.username }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }); }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try { const decoded = jwt.verify(token, JWT_SECRET); req.userId = Number(decoded.sub); next(); }
  catch { return res.status(401).json({ message: 'Session expired. Please sign in again.' }); }
}

async function sendResetEmail(user, code) {
  if (!process.env.SMTP_HOST) {
    console.log(`[DEV] Password reset code for ${user.email}: ${code}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Your LifeTracker reset code',
    text: `Your LifeTracker password reset code is ${code}\n\nOpen the app, enter this code and choose a new password. The code expires in 15 minutes. If you did not ask for this, ignore this email.`,
    html: `<p>Your LifeTracker password reset code is:</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px">${code}</p><p>Open the app, enter this code and choose a new password. The code expires in 15 minutes.</p><p>If you did not ask for this, ignore this email.</p>`
  });
}

app.get('/health', (req, res) => res.json({ ok: true, service: 'LifeTracker API', time: now() }));

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) return res.status(400).json({ message: 'Username must be 3-30 characters and use letters, numbers, _, ., or -.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) return res.status(409).json({ message: 'Username or email is already registered.' });
  const hash = await bcrypt.hash(password, 12);
  const timestamp = now();
  const info = db.prepare('INSERT INTO users(username,email,password_hash,created_at,updated_at) VALUES(?,?,?,?,?)').run(username, email, hash, timestamp, timestamp);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: tokenFor(user), user: safeUser(user), hasCloudData: false });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(identifier, normalizeEmail(identifier));
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid username/email or password.' });
  const cloud = db.prepare('SELECT updated_at FROM user_data WHERE user_id = ?').get(user.id);
  res.json({ token: tokenFor(user), user: safeUser(user), hasCloudData: !!cloud });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(401).json({ message: 'Account not found.' });
  res.json({ user: safeUser(user) });
});
app.post('/api/auth/logout', auth, (req, res) => res.json({ ok: true }));
app.delete('/api/auth/account', auth, async (req, res) => {
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Password is wrong.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
  res.json({ ok: true });
});


app.post('/api/auth/change-password', auth, async (req, res) => {
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (next.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user || !(await bcrypt.compare(current, user.password_hash))) return res.status(401).json({ message: 'Current account password is wrong.' });
  const hash = await bcrypt.hash(next, 12);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now(), req.userId);
  res.json({ message: 'Account password changed successfully.' });
});



app.post('/api/auth/forgot-password', forgotLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const generic = { message: 'If that email belongs to an account, a 6-digit reset code has been sent.' };
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.json(generic);
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare('INSERT OR REPLACE INTO reset_codes(user_id,code_hash,expires_at,attempts) VALUES(?,?,?,0)')
    .run(user.id, hashToken(code), Date.now() + 15 * 60 * 1000);
  try { await sendResetEmail(user, code); } catch (e) { console.error('Reset email failed:', e.message); }
  res.json(generic);
});

app.post('/api/auth/reset-password', resetLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const password = String(req.body.password || '');
  const invalid = { message: 'That code is wrong or has expired. Ask for a new one.' };
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const row = user && db.prepare('SELECT * FROM reset_codes WHERE user_id = ?').get(user.id);
  if (!row || row.expires_at < Date.now() || row.attempts >= 5) {
    if (row) db.prepare('DELETE FROM reset_codes WHERE user_id = ?').run(user.id);
    return res.status(400).json(invalid);
  }
  const given = Buffer.from(hashToken(code), 'hex');
  const saved = Buffer.from(row.code_hash, 'hex');
  if (!crypto.timingSafeEqual(given, saved)) {
    db.prepare('UPDATE reset_codes SET attempts = attempts + 1 WHERE user_id = ?').run(user.id);
    return res.status(400).json(invalid);
  }
  const hash = await bcrypt.hash(password, 12);
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, now(), user.id);
    db.prepare('DELETE FROM reset_codes WHERE user_id = ?').run(user.id);
  });
  tx();
  res.json({ message: 'Password changed. You can now sign in.' });
});

app.delete('/api/sync', auth, (req, res) => {
  db.prepare('DELETE FROM user_data WHERE user_id = ?').run(req.userId);
  res.json({ ok: true });
});

app.get('/api/sync', auth, (req, res) => {
  const row = db.prepare('SELECT data_json, recovery_wrapped_key, updated_at FROM user_data WHERE user_id = ?').get(req.userId);
  if (!row) return res.json({ data: null, recoveryWrappedKey: null, updatedAt: null });
  try {
    return res.json({
      data: JSON.parse(row.data_json),
      recoveryWrappedKey: row.recovery_wrapped_key,
      updatedAt: row.updated_at,
    });
  } catch {
    return res.status(500).json({ message: 'Stored private data is corrupted.' });
  }
});

app.put('/api/sync', auth, (req, res) => {
  const data = req.body.data;
  const recoveryWrappedKey = String(req.body.recoveryWrappedKey || '');
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ message: 'Invalid encrypted data payload.' });
  if (data.version !== 2 || data.algorithm !== 'AES-256-GCM' || typeof data.ciphertext !== 'string') {
    return res.status(400).json({ message: 'Invalid private encryption payload.' });
  }
  if (!recoveryWrappedKey) return res.status(400).json({ message: 'Recovery key wrapper is required.' });

  const serialized = JSON.stringify(data);
  const wrapperBytes = Buffer.byteLength(recoveryWrappedKey, 'utf8');
  const totalBytes = Buffer.byteLength(serialized, 'utf8') + wrapperBytes;
  if (totalBytes > 1.5 * 1024 * 1024) return res.status(413).json({ message: 'Your LifeTracker data is too large for one sync payload.' });

  const timestamp = now();
  db.prepare(`INSERT INTO user_data(user_id,data_json,recovery_wrapped_key,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET data_json=excluded.data_json, recovery_wrapped_key=excluded.recovery_wrapped_key, updated_at=excluded.updated_at`)
    .run(req.userId, serialized, recoveryWrappedKey, timestamp);
  db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').run(timestamp, req.userId);
  res.json({ ok: true, updatedAt: timestamp });
});

app.listen(PORT, '0.0.0.0', () => console.log(`LifeTracker API running on http://0.0.0.0:${PORT}`));