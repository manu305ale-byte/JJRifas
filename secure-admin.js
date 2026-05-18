window.addEventListener('load', function () {
  var adminLogin = document.getElementById('adminLogin');
  var adminPanel = document.getElementById('adminPanel');
  var passwordInput = document.getElementById('adminPassword');
  var loginButton = document.getElementById('loginAdminBtn');
  var logoutButton = document.getElementById('logoutAdminBtn');
  var adminModal = document.getElementById('adminModal');

  function setAdminVisible(value) {
    if (!adminLogin || !adminPanel) return;
    if (value) {
      sessionStorage.setItem('jjrifas_admin_session', String(Date.now() + 20 * 60 * 1000));
      adminLogin.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      if (typeof refreshAdminReceipts === 'function') setTimeout(refreshAdminReceipts, 300);
      else if (typeof renderAdmin === 'function') renderAdmin();
    } else {
      sessionStorage.removeItem('jjrifas_admin_session');
      adminLogin.classList.remove('hidden');
      adminPanel.classList.add('hidden');
    }
  }

  async function login() {
    var password = passwordInput ? passwordInput.value : '';
    try {
      var response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
      });
      var data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo iniciar sesión.');
      if (passwordInput) passwordInput.value = '';
      setAdminVisible(true);
      if (window.jjToast) jjToast('Sesión de administrador iniciada.', 'success');
    } catch (error) {
      if (window.jjToast) jjToast(error.message || 'Clave incorrecta.', 'error');
      else alert(error.message || 'Clave incorrecta.');
    }
  }

  async function logout() {
    try { await fetch('/api/admin/logout', { method: 'POST' }); } catch (_) {}
    setAdminVisible(false);
    if (adminModal) adminModal.classList.remove('is-open');
    if (window.jjToast) jjToast('Sesión cerrada.', 'success');
  }

  async function checkSession() {
    try {
      var response = await fetch('/api/admin/me', { cache: 'no-store' });
      var data = await response.json();
      if (data && data.admin) setAdminVisible(true);
    } catch (_) {}
  }

  if (loginButton) {
    loginButton.onclick = login;
    loginButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      login();
    }, true);
  }
  if (passwordInput) {
    passwordInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        login();
      }
    });
  }
  if (logoutButton) {
    logoutButton.onclick = logout;
    logoutButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      logout();
    }, true);
  }

  window.secureAdminLogin = login;
  window.secureAdminLogout = logout;
  checkSession();
});
