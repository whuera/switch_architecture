require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ SEGURIDAD: Helmet para headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
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