// TASA MANUAL DESACTIVADA
window.JJRIFAS_RATE_CONFIG = {
  fallbackRateVES: null,
  fallbackLabel: 'api requerida'
};

// Sincronización Railway: carga reservas compartidas y sube cambios de este navegador.
(() => {
  const KEY = 'jjrifas_v6_final_00_99';

  async function syncFromServer() {
    try {
      const response = await fetch('/api/reservations', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.ok && Array.isArray(data.reservations)) {
        const incoming = JSON.stringify(data.reservations);
        if (incoming !== localStorage.getItem(KEY)) {
          localStorage.setItem(KEY, incoming);
          setTimeout(() => location.reload(), 250);
        }
      }
    } catch (error) {
      console.warn('No se pudieron cargar reservas compartidas:', error);
    }
  }

  function pushToServer(value) {
    try {
      const reservations = JSON.parse(value || '[]');
      if (!Array.isArray(reservations)) return;
      fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservations })
      }).catch(error => console.warn('No se pudieron guardar reservas en Railway:', error));
    } catch (error) {
      console.warn('Reservas inválidas para sincronizar:', error);
    }
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    originalSetItem(key, value);
    if (key === KEY) pushToServer(value);
  };

  window.addEventListener('load', syncFromServer);
})();

// Asegura que los logos SVG se mantengan aunque exista caché o scripts anteriores.
window.addEventListener('load', () => {
  document.querySelectorAll('img[alt="JJRifas"]').forEach(img => {
    img.removeAttribute('data-original-logo');
    img.src = 'assets/logo.svg';
  });
  document.querySelectorAll('img[alt*="Manuel"], img.creator-logo').forEach(img => {
    img.src = 'assets/firma-manuel.svg';
  });
});
