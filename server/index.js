require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ SEGURIDAD: Helmet para headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://vercel.live"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://azure-app-shopping-cart-reload-225fb76523b0.herokuapp.com", "http://localhost:3000", "https://vercel.live", "https://whuera.app.n8n.cloud"],
      imgSrc: ["'self'", "data:", "https:*"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: [],
    }
  }
}));

// ✅ SEGURIDAD: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP'
});
app.use(limiter);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ✅ Validación y sanitización de entrada
function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, 100).replace(/[<>'"]/g, '');
}

// ✅ Base de datos de componentes (simulada)
const componentesDB = {
  botones: {
    nombre: 'Botones',
    descripcion: 'Componentes de botones interactivos con diferentes estilos y estados',
    codigo: `<button class="btn btn-primary">Primario</button>
<button class="btn btn-secondary">Secundario</button>
<button class="btn" disabled>Deshabilitado</button>`
  },
  cards: {
    nombre: 'Cards',
    descripcion: 'Tarjetas versátiles para mostrar contenido',
    codigo: `<div class="card">
  <div class="card-header">Título</div>
  <div class="card-body">
    <p>Contenido de la tarjeta</p>
  </div>
  <div class="card-footer">Pie</div>
</div>`
  },
  graficos: {
    nombre: 'Gráficos',
    descripcion: 'Visualización de datos con Chart.js',
    codigo: `<canvas id="myChart"></canvas>
<script>
  new Chart(ctx, {
    type: 'bar',
    data: { labels: [...], datasets: [...] }
  });
</script>`
  },
  formularios: {
    nombre: 'Formularios',
    descripcion: 'Campos y controles de formularios',
    codigo: `<form>
  <input type="text" placeholder="Nombre">
  <textarea placeholder="Mensaje"></textarea>
  <button type="submit">Enviar</button>
</form>`
  },
  badges: {
    nombre: 'Badges',
    descripcion: 'Etiquetas y distintivos',
    codigo: `<span class="badge">Nuevo</span>
<span class="badge badge-success">Completado</span>
<span class="badge badge-danger">Error</span>`
  },
  modales: {
    nombre: 'Modales',
    descripcion: 'Diálogos y ventanas emergentes',
    codigo: `<div class="modal">
  <div class="modal-content">
    <button class="btn-close">×</button>
    <h2>Título del Modal</h2>
    <p>Contenido</p>
  </div>
</div>`
  }
};

// Ruta: Home
app.get('/', (req, res) => {
  try {
    res.render('index', {
      title: 'Inicio',
      description: 'Tu plataforma de gestión empresarial'
    });
  } catch (error) {
    console.error('Error en /:', error.message);
    res.status(500).send('Error al cargar la página');
  }
});

// Ruta: Componentes
app.get('/componentes', (req, res) => {
  try {
    res.render('componentes', {
      title: 'Componentes'
    });
  } catch (error) {
    console.error('Error en /componentes:', error.message);
    res.status(500).send('Error al cargar componentes');
  }
});

// ✅ API: Obtener detalles de componente
app.get('/api/componente/:id', (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validación de entrada
    if (typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ID de componente inválido'
      });
    }

    const sanitizedId = sanitizeString(id).toLowerCase();

    if (!sanitizedId || sanitizedId.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ID de componente vacío'
      });
    }

    // ✅ Obtener componente
    const componente = componentesDB[sanitizedId];

    if (!componente) {
      return res.status(404).json({
        success: false,
        error: 'Componente no encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        nombre: componente.nombre,
        descripcion: componente.descripcion,
        codigo: componente.codigo
      }
    });

  } catch (error) {
    console.error('Error en /api/componente/:id:', error.message);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// API: Listar PDFs disponibles
const fs = require('fs');
app.get('/api/docs', (req, res) => {
  try {
    const resourcesDir = path.join(__dirname, 'resources');
    const files = fs.readdirSync(resourcesDir)
      .filter(f => f.endsWith('.pdf'))
      .sort()
      .map(f => ({ filename: f, name: f.replace('.pdf', '') }));
    res.json({ success: true, data: files });
  } catch (error) {
    console.error('Error en /api/docs:', error.message);
    res.status(500).json({ success: false, error: 'Error al listar documentos' });
  }
});

// Servir PDFs solo en modo inline (sin descarga)
app.get('/docs/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename.endsWith('.pdf') || filename.includes('..')) {
      return res.status(400).send('Archivo no válido');
    }
    const filePath = path.join(__dirname, 'resources', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Documento no encontrado');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error en /docs/:filename:', error.message);
    res.status(500).send('Error al cargar documento');
  }
});

// API: Enviar correo de contacto
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, documentId, phone, comment } = req.body;

    if (!name || !email || !comment) {
      return res.status(400).json({ success: false, error: 'Campos requeridos: nombre, correo y comentario' });
    }

    // 1. Notificación interna a info@mobilpymes.cl
    await resend.emails.send({
      from: 'B24-eps & UPF Consulting <info@mobilpymes.cl>',
      to: 'info@mobilpymes.cl',
      subject: `Nuevo contacto: ${sanitizeString(name)}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1117;color:#c9d1d9;border-radius:12px;overflow:hidden;border:1px solid #21262d;">
          <div style="background:linear-gradient(135deg,#1a1f2e,#0d1117);padding:28px 32px;border-bottom:1px solid #21262d;">
            <h2 style="margin:0;color:#58a6ff;font-size:20px;">Nuevo Mensaje de Contacto</h2>
          </div>
          <div style="padding:28px 32px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;color:#8b949e;font-weight:600;width:140px;">Nombre</td><td style="padding:10px 0;color:#e6edf3;">${sanitizeString(name)}</td></tr>
              <tr><td style="padding:10px 0;color:#8b949e;font-weight:600;">Correo</td><td style="padding:10px 0;"><a href="mailto:${sanitizeString(email)}" style="color:#58a6ff;text-decoration:none;">${sanitizeString(email)}</a></td></tr>
              <tr><td style="padding:10px 0;color:#8b949e;font-weight:600;">Documento ID</td><td style="padding:10px 0;color:#e6edf3;">${sanitizeString(documentId || 'No proporcionado')}</td></tr>
              <tr><td style="padding:10px 0;color:#8b949e;font-weight:600;">Teléfono</td><td style="padding:10px 0;color:#e6edf3;">${sanitizeString(phone || 'No proporcionado')}</td></tr>
            </table>
            <div style="margin-top:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid #21262d;border-radius:8px;">
              <p style="margin:0 0 8px;color:#8b949e;font-weight:600;font-size:13px;">COMENTARIO</p>
              <p style="margin:0;color:#e6edf3;line-height:1.6;">${sanitizeString(comment)}</p>
            </div>
          </div>
        </div>
      `
    });

    // 2. Respuesta automática al remitente
    const firstName = sanitizeString(name).split(' ')[0];
    await resend.emails.send({
      from: 'B24-eps & UPF Consulting <info@mobilpymes.cl>',
      to: sanitizeString(email),
      subject: 'Gracias por contactarnos — B24-eps & UPF Consulting',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#1a1a2e;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:linear-gradient(135deg,#0d1117,#1a1f2e);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">B24-eps & UPF Consulting</h1>
            <p style="margin:8px 0 0;color:#8b949e;font-size:13px;">Consultoría Especializada en Medios de Pago</p>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;color:#1a1a2e;margin:0 0 16px;">Estimado/a <strong>${firstName}</strong>,</p>
            <p style="font-size:14px;color:#4a4a6a;line-height:1.7;margin:0 0 16px;">
              Agradecemos sinceramente su interés en nuestros servicios de consultoría especializada en ACI BASE24-eps y Universal Payments Framework (UPF).
            </p>
            <p style="font-size:14px;color:#4a4a6a;line-height:1.7;margin:0 0 16px;">
              Hemos recibido su mensaje correctamente y nuestro equipo de especialistas lo revisará a la brevedad. Nos pondremos en contacto con usted dentro de las próximas <strong>24 horas hábiles</strong> para atender su consulta de manera personalizada.
            </p>
            <div style="margin:24px 0;padding:20px;background:#f0f9ff;border-left:4px solid #58a6ff;border-radius:0 8px 8px 0;">
              <p style="margin:0 0 8px;font-size:13px;color:#0369a1;font-weight:700;">SU MENSAJE</p>
              <p style="margin:0;font-size:13px;color:#4a4a6a;line-height:1.6;font-style:italic;">"${sanitizeString(comment)}"</p>
            </div>
            <p style="font-size:14px;color:#4a4a6a;line-height:1.7;margin:0 0 16px;">
              Mientras tanto, lo invitamos a conocer más sobre nuestras soluciones y casos de éxito en nuestra plataforma web.
            </p>
            <p style="font-size:14px;color:#4a4a6a;line-height:1.7;margin:0 0 8px;">Cordialmente,</p>
            <p style="font-size:14px;color:#1a1a2e;font-weight:700;margin:0;">Equipo B24-eps & UPF Consulting</p>
          </div>
          <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#8b949e;">&#128231; info@mobilpymes.cl &nbsp;·&nbsp; &#128222; +56 985689661</p>
            <p style="margin:0;font-size:11px;color:#b0b8c4;">Presencia en Chile, Ecuador, Colombia, Panamá, Costa Rica, Argentina y España</p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Mensaje enviado correctamente' });
  } catch (error) {
    console.error('Error en /api/contact:', error.message);
    res.status(500).json({ success: false, error: 'Error al enviar el mensaje' });
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// ✅ Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err.message,
      status
    }
  });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor ejecutándose en http://localhost:${PORT}`);
});