require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ SEGURIDAD: Helmet para headers HTTP
app.use(helmet());

// ✅ SEGURIDAD: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes'
});
app.use(limiter);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rutas
app.get('/', (req, res) => {
  try {
    res.render('index', {
      title: 'Inicio',
      description: 'Tu plataforma de gestión empresarial'
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).send('Error interno del servidor');
  }
});

// Manejo de errores
app.use((req, res) => {
  res.status(404).json({ error: 'Página no encontrada' });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor en http://localhost:${PORT}`);
});