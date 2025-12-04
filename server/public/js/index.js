/**
 * ✅ Validación segura de entrada
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
}

/**
 * ✅ Manejadores de eventos seguros
 */
function handleStart() {
  try {
    const message = 'Iniciando...';
    console.log(sanitizeInput(message));
    window.location.href = '/componentes';
  } catch (error) {
    console.error('Error en handleStart:', error.message);
  }
}

function handleSignUp() {
  try {
    console.log('Abriendo formulario de registro');
    alert('Formulario de registro');
  } catch (error) {
    console.error('Error en handleSignUp:', error.message);
  }
}

function handleDemo() {
  try {
    console.log('Iniciando demostración');
    alert('Iniciando demostración interactiva...');
  } catch (error) {
    console.error('Error en handleDemo:', error.message);
  }
}

/**
 * ✅ Inicialización de navegación
 */
function initNavigation() {
  try {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
      item.addEventListener('click', function(e) {
        // Obtener ruta del item
        const route = this.getAttribute('data-route');
        
        // Si es home o logout, permitir navegación normal
        if (route === 'home' || route === 'logout') {
          return true;
        }
        
        // Para otras rutas, actualizar estado activo
        menuItems.forEach(m => m.classList.remove('active'));
        this.classList.add('active');
      });
    });

    // Establecer item activo basado en URL actual
    const currentPath = window.location.pathname;
    menuItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href === currentPath) {
        menuItems.forEach(m => m.classList.remove('active'));
        item.classList.add('active');
      }
    });

  } catch (error) {
    console.error('Error en initNavigation:', error.message);
  }
}

/**
 * ✅ Inicialización al cargar DOM
 */
document.addEventListener('DOMContentLoaded', function() {
  try {
    initNavigation();
    console.log('✅ Página de inicio cargada correctamente');
  } catch (error) {
    console.error('Error durante la inicialización:', error.message);
  }
});

/**
 * ✅ Manejo de errores global
 */
window.addEventListener('error', function(event) {
  console.error('Error no controlado:', event.error);
});