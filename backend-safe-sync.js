(() => {
  const KEY = 'jjrifas_v6_final_00_99';
  let syncing = false;

  async function getPublicReservations() {
    const response = await fetch('/api/reservations', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar las reservas.');
    return Array.isArray(data.reservations) ? data.reservations : [];
  }

  function applyReservations(list) {
    if (!Array.isArray(list)) return;
    window.reservations = list;
    try { reservations = list; } catch (_) {}
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof render === 'function') render();
    if (typeof renderAdmin === 'function' && typeof isAdminActive === 'function' && isAdminActive()) renderAdmin();
  }

  async function refreshFromBackend() {
    if (syncing) return;
    if (typeof isAdminActive === 'function' && isAdminActive()) return;
    syncing = true;
    try {
      const list = await getPublicReservations();
      const current = localStorage.getItem(KEY) || '[]';
      const incoming = JSON.stringify(list);
      if (incoming !== current) applyReservations(list);
    } catch (error) {
      console.warn('Sync backend:', error);
    } finally {
      syncing = false;
    }
  }

  window.forceBackendSave = async function () {
    console.warn('forceBackendSave está desactivado. Usa acciones específicas del backend.');
  };

  window.removeNumberFromBackend = async function () {
    console.warn('removeNumberFromBackend está desactivado. Usa acciones específicas del backend.');
  };

  window.addEventListener('load', () => {
    refreshFromBackend();
    setInterval(refreshFromBackend, 8000);
  });
})();
