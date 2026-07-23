const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id           SERIAL PRIMARY KEY,
        email        TEXT UNIQUE NOT NULL,
        name         TEXT NOT NULL,
        company      TEXT,
        phone        TEXT,
        data_consent BOOLEAN NOT NULL DEFAULT FALSE,
        status       TEXT NOT NULL DEFAULT 'PENDING',
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        verified_at  TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS tokens (
        id          SERIAL PRIMARY KEY,
        lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        otp_hash    TEXT NOT NULL,
        magic_hash  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        used_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS demo_sessions (
        id            SERIAL PRIMARY KEY,
        lead_id       INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        session_token TEXT UNIQUE NOT NULL,
        query_count   INTEGER NOT NULL DEFAULT 0,
        max_queries   INTEGER NOT NULL DEFAULT 3,
        status        TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        last_query_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS rate_attempts (
        id           SERIAL PRIMARY KEY,
        identifier   TEXT NOT NULL,
        action       TEXT NOT NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tokens_lead_id ON tokens(lead_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON demo_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_rate_identifier ON rate_attempts(identifier, action, created_at);
    `);
    console.log('✅ DB: tablas verificadas/creadas correctamente');
  } finally {
    client.release();
  }
}

// Count recent attempts for rate limiting
async function countAttempts(identifier, action, windowHours) {
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM rate_attempts
     WHERE identifier = $1 AND action = $2
       AND created_at > NOW() - INTERVAL '${windowHours} hours'`,
    [identifier, action]
  );
  return parseInt(result.rows[0].cnt, 10);
}

async function recordAttempt(identifier, action) {
  await pool.query(
    'INSERT INTO rate_attempts (identifier, action) VALUES ($1, $2)',
    [identifier, action]
  );
}

module.exports = { pool, initDB, countAttempts, recordAttempt };
