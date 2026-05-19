window.addEventListener('load', function () {
  var KEY = 'jjrifas_v6_final_00_99';
  var loading = false;

  function adminPanelVisible() {
    var modal = document.getElementById('adminModal');
    var panel = document.getElementById('adminPanel');
    return !!(modal && panel && modal.classList.contains('is-open') && !panel.classList.contains('hidden'));
  }

  function applyReservations(list) {
    if (!Array.isArray(list)) return;
    try { reservations = list; } catch (_) {}
    window.reservations = list;
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof render === 'function') render();
    if (typeof renderAdmin === 'function') renderAdmin();
  }

  async function loadAdminReceipts() {
    if (loading) return;
    loading = true;
    try {
      var response = await fetch('/api/admin/reservations', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar los comprobantes.');
      applyReservations(data.reservations || []);
    } catch (error) {
      console.warn('Carga admin comprobantes:', error);
      var list = document.getElementById('adminList');
      if (adminPanelVisible() && list && (!list.innerHTML || list.innerHTML.indexOf('admin-item') === -1)) {
        list.innerHTML = '<p class="form-note">No se pudieron cargar los comprobantes. Cierra sesión, vuelve a entrar y verifica tu conexión.</p>';
      }
    } finally {
      loading = false;
    }
  }

  window.refreshAdminReceipts = loadAdminReceipts;

  var openBtn = document.getElementById('openAdminBtn');
  if (openBtn) {
    openBtn.addEventListener('click', function () {
      setTimeout(loadAdminReceipts, 900);
      setTimeout(loadAdminReceipts, 1800);
    });
  }

  var loginBtn = document.getElementById('loginAdminBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', function () {
      setTimeout(loadAdminReceipts, 900);
      setTimeout(loadAdminReceipts, 1800);
    });
  }

  document.querySelectorAll('[data-admin-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      setTimeout(loadAdminReceipts, 250);
    });
  });
});
