window.addEventListener('load', function () {
  var KEY = 'jjrifas_v6_final_00_99';
  var busy = false;

  function panelOpen() {
    var modal = document.getElementById('adminModal');
    var panel = document.getElementById('adminPanel');
    return !!(modal && panel && modal.classList.contains('is-open') && !panel.classList.contains('hidden'));
  }

  function looksIncomplete(list) {
    return Array.isArray(list) && list.length && list.some(function (r) {
      return r && !r.receipt && !r.secondReceipt && !r.name && !r.document && !r.phone && !r.paymentRef;
    });
  }

  function apply(list) {
    if (!Array.isArray(list)) return;
    try { reservations = list; } catch (_) {}
    window.reservations = list;
    localStorage.setItem(KEY, JSON.stringify(list));
    if (typeof render === 'function') render();
    if (typeof renderAdmin === 'function') renderAdmin();
  }

  async function loadFullAdmin() {
    if (busy) return;
    busy = true;
    var box = document.getElementById('adminList');
    if (panelOpen() && box) box.innerHTML = '<p class="form-note">Cargando comprobantes completos...</p>';
    try {
      var response = await fetch('/api/admin/reservations', { cache: 'no-store', credentials: 'same-origin' });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) throw new Error(data.error || 'No autorizado');
      apply(data.reservations || []);
    } catch (error) {
      if (panelOpen() && box) box.innerHTML = '<p class="form-note">No se pudieron cargar los comprobantes completos. Cierra sesión, vuelve a entrar y presiona Ctrl + F5.</p>';
      console.warn('admin full load pc:', error);
    } finally {
      busy = false;
    }
  }

  window.loadFullAdminReceipts = loadFullAdmin;

  var originalRenderAdmin = window.renderAdmin;
  if (typeof originalRenderAdmin === 'function') {
    window.renderAdmin = function () {
      var list = [];
      try { list = Array.isArray(reservations) ? reservations : []; } catch (_) {}
      if (panelOpen() && looksIncomplete(list)) {
        setTimeout(loadFullAdmin, 50);
        return;
      }
      return originalRenderAdmin.apply(this, arguments);
    };
  }

  ['openAdminBtn', 'loginAdminBtn'].forEach(function (buttonId) {
    var button = document.getElementById(buttonId);
    if (button) {
      button.addEventListener('click', function () {
        setTimeout(loadFullAdmin, 700);
        setTimeout(loadFullAdmin, 1600);
      });
    }
  });

  document.querySelectorAll('[data-admin-filter]').forEach(function (button) {
    button.addEventListener('click', function () { setTimeout(loadFullAdmin, 250); });
  });
});
