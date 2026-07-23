const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const N8N_WEBHOOK = 'https://whuera.app.n8n.cloud/webhook/rag-query';

const SOFT_CTA = '\n\n---\n💡 *¿Te sirve lo que ves? Podemos hacer mucho más con acceso completo →* Escríbenos a info@mobilpymes.cl';

// GET /api/chat/session
router.get('/session', async (req, res) => {
  try {
    const token = req.cookies && req.cookies.demo_session;
    if (!token) {
      return res.json({ status: 'UNVERIFIED', queriesRemaining: 0 });
    }

    const result = await pool.query(
      `SELECT query_count, max_queries, status FROM demo_sessions
       WHERE session_token = $1 LIMIT 1`,
      [token]
    );

    if (!result.rows.length) {
      return res.json({ status: 'UNVERIFIED', queriesRemaining: 0 });
    }

    const session = result.rows[0];
    const remaining = Math.max(0, session.max_queries - session.query_count);

    return res.json({
      status: session.status,
      queriesRemaining: remaining,
    });
  } catch (err) {
    console.error('Error en /api/chat/session:', err.message);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST /api/chat/query
router.post('/query', async (req, res) => {
  try {
    const token = req.cookies && req.cookies.demo_session;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No autorizado', requiresVerification: true });
    }

    const sessionResult = await pool.query(
      `SELECT id, query_count, max_queries, status FROM demo_sessions
       WHERE session_token = $1 LIMIT 1`,
      [token]
    );

    if (!sessionResult.rows.length) {
      return res.status(401).json({ success: false, error: 'Sesión no encontrada', requiresVerification: true });
    }

    const session = sessionResult.rows[0];

    if (session.status === 'EXHAUSTED' || session.query_count >= session.max_queries) {
      return res.json({
        success: false,
        error: 'Has agotado tus consultas de demo',
        exhausted: true,
        queriesRemaining: 0,
      });
    }

    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, error: 'Consulta vacía' });
    }

    const cleanQuery = query.trim().substring(0, 1000);
    const newCount = session.query_count + 1;
    const isExhausted = newCount >= session.max_queries;

    // Increment counter and mark exhausted if needed (atomic)
    await pool.query(
      `UPDATE demo_sessions
       SET query_count = $1,
           last_query_at = NOW(),
           status = $2
       WHERE id = $3`,
      [newCount, isExhausted ? 'EXHAUSTED' : 'ACTIVE', session.id]
    );

    // Proxy to n8n
    const n8nRes = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: cleanQuery, chatInput: cleanQuery }),
    });

    if (!n8nRes.ok) {
      throw new Error(`n8n responded with ${n8nRes.status}`);
    }

    const data = await n8nRes.json();
    let response = Array.isArray(data)
      ? (data[0].output || data[0].response || JSON.stringify(data[0]))
      : (data.output || data.response || String(data));

    const queriesRemaining = Math.max(0, session.max_queries - newCount);

    // Add soft CTA on the 2nd query (index 1)
    if (newCount === 2) {
      response += SOFT_CTA;
    }

    return res.json({
      success: true,
      response,
      queriesRemaining,
      exhausted: isExhausted,
    });
  } catch (err) {
    console.error('Error en /api/chat/query:', err.message);
    return res.status(500).json({ success: false, error: 'Error de conexión con el asistente' });
  }
});

module.exports = router;
