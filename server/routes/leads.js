const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');
const { pool, countAttempts, recordAttempt } = require('../db');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const OTP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BCRYPT_ROUNDS = 10;
const OTP_TTL_MINUTES = 15;

// Rate limit: 3 register requests per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Demasiados intentos. Intenta en 1 hora.' }
});

// Rate limit: 5 magic link verifications per hour per IP
const magicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: { success: false, error: 'Demasiados intentos. Intenta en 1 hora.' }
});

function generateOTP() {
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += OTP_ALPHABET[bytes[i] % OTP_ALPHABET.length];
  }
  return code;
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  const masked = local[0] + '***';
  return masked + '@' + domain;
}

async function createAndSendVerification(lead, req) {
  const otp = generateOTP();
  const magicToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const [otpHash, magicHash] = await Promise.all([
    bcrypt.hash(otp, BCRYPT_ROUNDS),
    bcrypt.hash(magicToken, BCRYPT_ROUNDS),
  ]);

  // Invalidate previous tokens
  await pool.query(
    `UPDATE tokens SET used_at = NOW()
     WHERE lead_id = $1 AND used_at IS NULL`,
    [lead.id]
  );

  // Create new token
  await pool.query(
    `INSERT INTO tokens (lead_id, otp_hash, magic_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [lead.id, otpHash, magicHash, expiresAt]
  );

  // Build magic link
  const host = process.env.APP_URL ||
    (req.protocol + '://' + req.get('host'));
  const magicLink = `${host}/api/leads/verify-magic?t=${magicToken}`;

  // Send email
  const { error: emailError } = await resend.emails.send({
    from: 'B24-eps & UPF Consulting <info@mobilpymes.cl>',
    to: lead.email,
    subject: 'Tu código de verificación — Asistente Virtual',
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;color:#c9d1d9;border-radius:12px;overflow:hidden;border:1px solid #21262d;">
        <div style="background:linear-gradient(135deg,#1a1f2e,#0d1117);padding:28px 32px;border-bottom:1px solid #21262d;">
          <h2 style="margin:0;color:#58a6ff;font-size:20px;">Verifica tu acceso</h2>
          <p style="margin:8px 0 0;color:#8b949e;font-size:13px;">Asistente Virtual — William Huera</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#e6edf3;font-size:15px;margin:0 0 24px;">Hola <strong>${lead.name.split(' ')[0]}</strong>, usa el código de abajo para acceder a tus 3 consultas gratuitas.</p>
          <div style="text-align:center;margin:0 0 28px;">
            <div style="display:inline-block;background:rgba(99,102,241,0.12);border:2px solid rgba(99,102,241,0.35);border-radius:12px;padding:20px 36px;">
              <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;color:#818cf8;letter-spacing:0.25em;">${otp}</span>
            </div>
            <p style="color:#8b949e;font-size:12px;margin:12px 0 0;">Expira en ${OTP_TTL_MINUTES} minutos · Un solo uso</p>
          </div>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${magicLink}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Verificar con un clic →</a>
          </div>
          <div style="background:rgba(255,255,255,0.03);border:1px solid #21262d;border-radius:8px;padding:14px 16px;">
            <p style="margin:0;font-size:12px;color:#8b949e;line-height:1.6;">Si no solicitaste este código, ignora este correo. Nadie más puede usar tu código.</p>
          </div>
        </div>
        <div style="padding:16px 32px;border-top:1px solid #21262d;text-align:center;">
          <p style="margin:0;font-size:11px;color:#484f58;">&#128231; info@mobilpymes.cl &nbsp;·&nbsp; &#128222; +56 985689661</p>
        </div>
      </div>
    `
  });

  if (emailError) {
    console.error('Resend error:', emailError);
    throw new Error(`Error al enviar email: ${emailError.message}`);
  }

  return { otp, magicToken };
}

async function createSession(leadId, res) {
  const sessionToken = crypto.randomBytes(32).toString('hex');

  // Mark lead as verified
  await pool.query(
    `UPDATE leads SET status = 'VERIFIED', verified_at = NOW() WHERE id = $1`,
    [leadId]
  );

  // Create session
  await pool.query(
    `INSERT INTO demo_sessions (lead_id, session_token) VALUES ($1, $2)`,
    [leadId, sessionToken]
  );

  // Set cookie
  res.cookie('demo_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sessionToken;
}

// POST /api/leads/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, company, phone, dataConsent, _hp } = req.body;

    // Honeypot
    if (_hp !== undefined && _hp !== '') {
      return res.json({ success: true, maskedEmail: '' });
    }

    // Validate
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Nombre requerido' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }
    if (dataConsent !== true && dataConsent !== 'true') {
      return res.status(400).json({ success: false, error: 'Debes aceptar la política de datos' });
    }

    const cleanName = name.trim().substring(0, 100);
    const cleanEmail = email.toLowerCase().trim().substring(0, 200);
    const cleanCompany = company ? company.trim().substring(0, 100) : null;
    const cleanPhone = phone ? phone.trim().substring(0, 30) : null;

    // Upsert lead
    const result = await pool.query(
      `INSERT INTO leads (email, name, company, phone, data_consent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             company = EXCLUDED.company,
             phone = EXCLUDED.phone
       RETURNING id, name, email`,
      [cleanEmail, cleanName, cleanCompany, cleanPhone, true]
    );
    const lead = result.rows[0];

    await createAndSendVerification(lead, req);

    // Notificación interna de trazabilidad (fire-and-forget)
    resend.emails.send({
      from: 'B24-eps & UPF Consulting <info@mobilpymes.cl>',
      to: 'info@mobilpymes.com',
      subject: `Nuevo lead: ${cleanName}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;color:#c9d1d9;border-radius:12px;overflow:hidden;border:1px solid #21262d;">
          <div style="background:linear-gradient(135deg,#1a1f2e,#0d1117);padding:24px 28px;border-bottom:1px solid #21262d;">
            <h2 style="margin:0;color:#58a6ff;font-size:18px;">Nuevo Lead — Asistente Virtual</h2>
          </div>
          <div style="padding:24px 28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:8px 0;color:#8b949e;font-weight:600;width:120px;">Nombre</td><td style="padding:8px 0;color:#e6edf3;">${cleanName}</td></tr>
              <tr><td style="padding:8px 0;color:#8b949e;font-weight:600;">Email</td><td style="padding:8px 0;"><a href="mailto:${cleanEmail}" style="color:#58a6ff;text-decoration:none;">${cleanEmail}</a></td></tr>
              ${cleanCompany ? `<tr><td style="padding:8px 0;color:#8b949e;font-weight:600;">Empresa</td><td style="padding:8px 0;color:#e6edf3;">${cleanCompany}</td></tr>` : ''}
              ${cleanPhone ? `<tr><td style="padding:8px 0;color:#8b949e;font-weight:600;">Teléfono</td><td style="padding:8px 0;color:#e6edf3;">${cleanPhone}</td></tr>` : ''}
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#484f58;">Registro vía Asistente Virtual · ${new Date().toISOString()}</p>
          </div>
        </div>
      `
    }).catch(err => console.error('Error notificación lead:', err.message));

    return res.json({ success: true, maskedEmail: maskEmail(cleanEmail) });
  } catch (err) {
    console.error('Error en /api/leads/register:', err.message);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST /api/leads/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = String(code).toUpperCase().trim();

    // Rate limit by IP and email (DB-based)
    const ip = req.ip;
    const ipCount = await countAttempts(ip, 'VALIDATE_OTP', 1);
    const emailCount = await countAttempts(cleanEmail, 'VALIDATE_OTP', 1);

    if (ipCount >= 5 || emailCount >= 5) {
      return res.status(429).json({ success: false, error: 'Demasiados intentos. Intenta en 1 hora.' });
    }

    await recordAttempt(ip, 'VALIDATE_OTP');
    await recordAttempt(cleanEmail, 'VALIDATE_OTP');

    // Find lead
    const leadResult = await pool.query(
      'SELECT id FROM leads WHERE email = $1',
      [cleanEmail]
    );
    if (!leadResult.rows.length) {
      return res.json({ success: false, error: 'Código inválido o expirado' });
    }
    const lead = leadResult.rows[0];

    // Find active token
    const tokenResult = await pool.query(
      `SELECT id, otp_hash FROM tokens
       WHERE lead_id = $1 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [lead.id]
    );
    if (!tokenResult.rows.length) {
      return res.json({ success: false, error: 'Código inválido o expirado' });
    }
    const token = tokenResult.rows[0];

    const valid = await bcrypt.compare(cleanCode, token.otp_hash);
    if (!valid) {
      return res.json({ success: false, error: 'Código inválido o expirado' });
    }

    // Mark token used
    await pool.query('UPDATE tokens SET used_at = NOW() WHERE id = $1', [token.id]);

    await createSession(lead.id, res);

    return res.json({ success: true, queriesRemaining: 3 });
  } catch (err) {
    console.error('Error en /api/leads/verify-otp:', err.message);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET /api/leads/verify-magic?t=TOKEN
router.get('/verify-magic', magicLimiter, async (req, res) => {
  try {
    const { t } = req.query;
    if (!t || t.length !== 64) {
      return res.redirect('/interview?error=invalid_token');
    }

    // Find all non-expired, unused tokens (process in batches ordered by newest)
    const tokensResult = await pool.query(
      `SELECT id, lead_id, magic_hash FROM tokens
       WHERE used_at IS NULL AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 20`
    );

    let matched = null;
    for (const token of tokensResult.rows) {
      const ok = await bcrypt.compare(t, token.magic_hash);
      if (ok) {
        matched = token;
        break;
      }
    }

    if (!matched) {
      return res.redirect('/interview?error=invalid_token');
    }

    // Mark token used
    await pool.query('UPDATE tokens SET used_at = NOW() WHERE id = $1', [matched.id]);

    await createSession(matched.lead_id, res);

    return res.redirect('/interview');
  } catch (err) {
    console.error('Error en /api/leads/verify-magic:', err.message);
    return res.redirect('/interview?error=server_error');
  }
});

// POST /api/leads/resend-code
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email requerido' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Rate limit: 3 resends per hour per email
    const count = await countAttempts(cleanEmail, 'RESEND', 1);
    if (count >= 3) {
      return res.status(429).json({ success: false, error: 'Límite de reenvíos alcanzado. Intenta en 1 hora.' });
    }

    // Check 60s cooldown on last token
    const lastToken = await pool.query(
      `SELECT t.created_at FROM tokens t
       JOIN leads l ON l.id = t.lead_id
       WHERE l.email = $1
       ORDER BY t.created_at DESC LIMIT 1`,
      [cleanEmail]
    );

    if (lastToken.rows.length) {
      const elapsed = (Date.now() - new Date(lastToken.rows[0].created_at).getTime()) / 1000;
      if (elapsed < 60) {
        const waitSeconds = Math.ceil(60 - elapsed);
        return res.json({ success: false, error: `Espera ${waitSeconds}s antes de reenviar`, waitSeconds });
      }
    }

    // Find lead
    const leadResult = await pool.query(
      'SELECT id, name, email FROM leads WHERE email = $1',
      [cleanEmail]
    );
    if (!leadResult.rows.length) {
      // Silent — don't reveal if email exists
      return res.json({ success: true });
    }
    const lead = leadResult.rows[0];

    await recordAttempt(cleanEmail, 'RESEND');
    await createAndSendVerification(lead, req);

    return res.json({ success: true });
  } catch (err) {
    console.error('Error en /api/leads/resend-code:', err.message);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

module.exports = router;
