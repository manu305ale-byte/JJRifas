(() => {
  const KEY = 'jjrifas_v6_final_00_99';

  function adminPanelVisible() {
    const modal = document.getElementById('adminModal');
    const panel = document.getElementById('adminPanel');
    return Boolean(modal?.classList.contains('is-open') && panel && !panel.classList.contains('hidden'));
  }

  function applyFullReservations(list) {
    if (!Array.isArray(list)) return;
    try { reservations = list; } catch (_) {}
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof render === 'function') render();
    if (typeof renderAdmin === 'function') renderAdmin();
  }

  async function loadFullAdminReservations() {
    if (!adminPanelVisible()) return;
    const response = await fetch('/api/admin/reservations', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.reservations)) {
      throw new Error(data.error || 'No se pudieron cargar los comprobantes completos.');
    }
    applyFullReservations(data.reservations);
    return data.reservations;
  }

  function hookAdminEvents() {
    const login = document.getElementById('loginAdminBtn');
    const open = document.getElementById('openAdminBtn');
    const panel = document.getElementById('adminPanel');

    if (login) login.addEventListener('click', () => setTimeout(() => loadFullAdminReservations().catch(console.warn), 700));
    if (open) open.addEventListener('click', () => setTimeout(() => loadFullAdminReservations().catch(console.warn), 700));
    if (panel) panel.addEventListener('click', () => setTimeout(() => loadFullAdminReservations().catch(console.warn), 1300));

    document.querySelectorAll('[data-admin-filter]').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(() => loadFullAdminReservations().catch(console.warn), 250));
    });
  }

  window.refreshAdminReceipts = loadFullAdminReservations;

  window.addEventListener('load', () => {
    hookAdminEvents();
    setInterval(() => {
      if (adminPanelVisible()) loadFullAdminReservations().catch(() => {});
    }, 5000);
  });
})();
