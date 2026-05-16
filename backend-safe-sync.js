(() => {
  const KEY = 'jjrifas_v6_final_00_99';
  let syncing = false;

  async function getPublicReservations() {
    const response = await fetch('/api/reservations', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar las reservas.');
    return Array.isArray(data.reservations) ? data.reservations : [];
  }

  async function putReservations(list) {
    const response = await fetch('/api/reservations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservations: Array.isArray(list) ? list : [] })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudieron guardar las reservas.');
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
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    const saved = await putReservations(list);
    applyReservations(saved);
  };

  window.removeNumberFromBackend = async function (number) {
    const n = String(number).padStart(2, '0');
    const current = await getPublicReservations();
    const cleaned = current
      .map(item => ({ ...item, numbers: (item.numbers || []).filter(x => x !== n) }))
      .filter(item => (item.numbers || []).length);
    const saved = await putReservations(cleaned);
    applyReservations(saved);
    return saved;
  };

  window.addEventListener('load', () => {
    refreshFromBackend();
    setInterval(() => {
      if (typeof isAdminActive === 'function' && isAdminActive()) return;
      refreshFromBackend();
    }, 8000);

    const resetButton = document.getElementById('resetDataBtn');
    if (resetButton) {
      resetButton.addEventListener('click', async () => {
        setTimeout(async () => {
          try { await putReservations([]); applyReservations([]); }
          catch (error) { alert(error.message || 'No se pudo reiniciar la rifa en backend.'); }
        }, 50);
      });
    }
  });
})();
