// TASA MANUAL DESACTIVADA
window.JJRIFAS_RATE_CONFIG = {
  fallbackRateVES: null,
  fallbackLabel: 'api requerida'
};

// Railway: sincroniza números apartados/vendidos entre dispositivos.
(() => {
  const KEY = 'jjrifas_v6_final_00_99';
  let pushing = false;

  function readLocalReservations() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function pushToServer(value) {
    if (pushing) return;
    try {
      const reservations = typeof value === 'string' ? JSON.parse(value || '[]') : value;
      if (!Array.isArray(reservations)) return;
      pushing = true;
      fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservations })
      })
        .catch(error => console.warn('No se pudieron guardar reservas en Railway:', error))
        .finally(() => { pushing = false; });
    } catch (error) {
      console.warn('Reservas inválidas para sincronizar:', error);
    }
  }

  async function syncFromServer() {
    try {
      const response = await fetch('/api/reservations', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data?.ok || !Array.isArray(data.reservations)) return;

      const local = readLocalReservations();
      const server = data.reservations;

      if (!server.length && local.length) {
        pushToServer(local);
        return;
      }

      const incoming = JSON.stringify(server);
      if (incoming !== localStorage.getItem(KEY)) {
        localStorage.setItem(KEY, incoming);
        setTimeout(() => location.reload(), 250);
      }
    } catch (error) {
      console.warn('No se pudieron cargar reservas compartidas:', error);
    }
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (key, value) => {
    originalSetItem(key, value);
    if (key === KEY) pushToServer(value);
  };

  window.addEventListener('load', syncFromServer);
  setInterval(syncFromServer, 15000);
})();

// Fuerza logos SVG y evita que scripts anteriores rompan las imágenes.
window.addEventListener('load', () => {
  document.querySelectorAll('img[alt="JJRifas"]').forEach(img => {
    img.removeAttribute('data-original-logo');
    img.src = 'assets/rifas-jj.svg';
  });
  document.querySelectorAll('img[alt*="Manuel"], img.creator-logo').forEach(img => {
    img.src = 'assets/manuel-pinango.svg';
  });
});
