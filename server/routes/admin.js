'use strict';
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

// ── Stateless HMAC-signed token (works on Vercel serverless — no shared memory) ─
function signKey() {
  return process.env.ADMIN_COOKIE_SECRET || process.env.ADMIN_PASS || 'default-secret';
}

function createToken() {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', signKey()).update(ts).digest('hex');
  return `${ts}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const ts = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const tsNum = Number(ts);
  if (!tsNum || Date.now() - tsNum > SESSION_TTL_MS) return false;
  const expected = crypto.createHmac('sha256', signKey()).update(ts).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch (_) {
    return false;
  }
}

// ── Middleware: verify signed cookie ──────────────────────────────────────────
function isAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_session;
  if (!verifyToken(token)) {
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

    const token = createToken();
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
  res.json({ valid: verifyToken(token) });
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
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
