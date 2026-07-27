'use strict';
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// ── In-memory sessions ────────────────────────────────────────────────────────
const sessions = new Map(); // token → { expires: Date }
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

// Clean up expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of sessions) {
    if (data.expires <= now) sessions.delete(token);
  }
}, 60 * 60 * 1000);

// ── Middleware: verify session cookie ─────────────────────────────────────────
function isAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_session;
  if (!token) return res.redirect('/?admin_login=1');
  const session = sessions.get(token);
  if (!session || session.expires <= Date.now()) {
    sessions.delete(token);
    res.clearCookie('admin_session');
    return res.redirect('/?admin_login=1');
  }
  next();
}

// ── POST /login ───────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    const envUser = process.env.ADMIN_USER || '';
    const envPass = process.env.ADMIN_PASS || '';

    // Constant-time comparison for username
    let userOk = false;
    try {
      userOk = typeof username === 'string' &&
        username.length === envUser.length &&
        envUser.length > 0 &&
        crypto.timingSafeEqual(Buffer.from(username), Buffer.from(envUser));
    } catch (_) {
      userOk = false;
    }

    const passOk = typeof password === 'string' && password === envPass;

    if (!userOk || !passOk) {
      await new Promise(r => setTimeout(r, 400));
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { expires: Date.now() + SESSION_TTL_MS });

    res.cookie('admin_session', token, {
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: SESSION_TTL_MS,
      secure: process.env.NODE_ENV === 'production'
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error en POST /api/admin/login:', err.message);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// ── GET /session ──────────────────────────────────────────────────────────────
router.get('/session', (req, res) => {
  const token = req.cookies && req.cookies.admin_session;
  const session = token && sessions.get(token);
  const valid = !!(session && session.expires > Date.now());
  res.json({ valid });
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const token = req.cookies && req.cookies.admin_session;
  if (token) sessions.delete(token);
  res.clearCookie('admin_session');
  res.json({ success: true });
});

// ── GET /customers ────────────────────────────────────────────────────────────
const WORKER_URL = 'https://shopping-cart-gateway.whuera.workers.dev/api/customer/customers';

router.get('/customers', isAdmin, async (req, res) => {
  try {
    const r = await fetch(WORKER_URL);
    if (!r.ok) throw new Error(`Worker respondió ${r.status}`);
    const data = await r.json();
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error en /api/admin/customers:', err.message);
    res.status(502).json({ success: false, error: 'No se pudo obtener customers: ' + err.message });
  }
});

// ── GET /leads ────────────────────────────────────────────────────────────────
router.get('/leads', isAdmin, async (req, res) => {
  try {
    const { pool } = require('../db');
    const result = await pool.query(
      'SELECT id, name, email, company, phone, status, data_consent, created_at, verified_at FROM leads ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error en /api/admin/leads:', err.message);
    res.status(500).json({ success: false, error: 'Error al obtener leads' });
  }
});

module.exports = { router, isAdmin };
