/**
 * ✅ Validación segura de entrada - Snyk compliant
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Eliminar caracteres peligrosos
  return input.trim().replace(/[<>'"]/g, '');
}

/**
 * ✅ Escapar HTML para prevenir XSS - Snyk compliant
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * ✅ Cargar detalles del componente
 */
function loadComponentDetail(event, componentId) {
  try {
    event.preventDefault();

    // Validación de entrada
    if (!componentId || typeof componentId !== 'string') {
      console.error('ID de componente inválido');
      showNotification('Error: ID de componente inválido', 'error');
      return;
    }

    const sanitizedId = sanitizeInput(componentId);
    
    if (sanitizedId.length === 0 || sanitizedId.length > 50) {
      console.error('ID de componente fuera de rango');
      showNotification('Error: ID de componente inválido', 'error');
      return;
    }

    console.log('Cargando componente:', sanitizedId);

    // Realizar solicitud fetch
    fetch(`/api/componente/${encodeURIComponent(sanitizedId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        if (data && data.success && data.data) {
          displayComponentDetail(data.data);
        } else {
          console.error('Respuesta inválida:', data);
          showNotification('Error al cargar el componente', 'error');
        }
      })
      .catch(error => {
        console.error('Error en fetch:', error.message);
        showNotification(`Error: ${error.message}`, 'error');
      });

  } catch (error) {
    console.error('Error en loadComponentDetail:', error.message);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

/**
 * ✅ Mostrar detalle del componente en modal
 */
function displayComponentDetail(componentData) {
  try {
    const modal = document.getElementById('componentModal');
    const content = document.getElementById('componentDetailContent');

    if (!modal || !content) {
      console.error('Elementos del modal no encontrados');
      showNotification('Error: Modal no encontrado', 'error');
      return;
    }

    // Validar datos
    if (!componentData.nombre || !componentData.descripcion) {
      console.error('Datos del componente incompletos');
      showNotification('Error: Datos incompletos', 'error');
      return;
    }

    // Sanitizar contenido
    const nombre = escapeHtml(componentData.nombre);
    const descripcion = escapeHtml(componentData.descripcion);
    const codigo = escapeHtml(componentData.codigo || '');

    // Crear contenido del modal
    const htmlContent = `
      <h2>${nombre}</h2>
      <p>${descripcion}</p>
      <div class="code-block">
        <pre><code>${codigo}</code></pre>
      </div>
      <button class="btn btn-primary" onclick="copyToClipboard(\`${codigo}\`)">
        📋 Copiar Código
      </button>
    `;

    content.innerHTML = htmlContent;

    // Mostrar modal
    modal.style.display = 'flex';
  } catch (error) {
    console.error('Error en displayComponentDetail:', error.message);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

/**
 * ✅ Cerrar modal
 */
function closeComponentModal(event) {
  try {
    const modal = document.getElementById('componentModal');
    if (!modal) return;

    // Si event existe y target es diferente al modal, no cerrar
    if (event && event.target !== modal) return;

    modal.style.display = 'none';
  } catch (error) {
    console.error('Error en closeComponentModal:', error.message);
  }
}

/**
 * ✅ Copiar código al portapapeles - Snyk compliant
 */
function copyToClipboard(text) {
  try {
    if (!text || typeof text !== 'string') {
      console.error('Texto inválido para copiar');
      showNotification('Error: Texto inválido', 'error');
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        showNotification('✅ Código copiado al portapapeles', 'success');
      })
      .catch(error => {
        console.error('Error al copiar:', error.message);
        showNotification('Error al copiar el código', 'error');
      });
  } catch (error) {
    console.error('Error en copyToClipboard:', error.message);
    showNotification(`Error: ${error.message}`, 'error');
  }
}

/**
 * ✅ Mostrar notificación
 */
function showNotification(message, type = 'info') {
  try {
    if (typeof message !== 'string') return;

    const sanitized = escapeHtml(message);
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = sanitized;
    
    const bgColor = type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3b82f6';
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideInNotification 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, type === 'error' ? 4000 : 3000);
  } catch (error) {
    console.error('Error en showNotification:', error.message);
  }
}

/**
 * ✅ Cerrar modal al presionar ESC
 */
document.addEventListener('keydown', function(event) {
  try {
    if (event.key === 'Escape') {
      closeComponentModal();
    }
  } catch (error) {
    console.error('Error en keydown listener:', error.message);
  }
});

/**
 * ✅ Inicialización al cargar DOM
 */
document.addEventListener('DOMContentLoaded', function() {
  try {
    console.log('✅ Página de componentes cargada correctamente');
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