window.addEventListener('load',function(){
  var SESSION_KEY='jjrifas_admin_session';
  var MINUTES=20;
  function id(x){return document.getElementById(x)}
  function activeUntil(){sessionStorage.setItem(SESSION_KEY,String(Date.now()+MINUTES*60*1000))}
  function clearSession(){sessionStorage.removeItem(SESSION_KEY)}
  function showPanel(){
    activeUntil();
    if(id('adminLogin'))id('adminLogin').classList.add('hidden');
    if(id('adminPanel'))id('adminPanel').classList.remove('hidden');
    if(typeof renderAdmin==='function')renderAdmin();
    if(typeof refreshAdminReceipts==='function')setTimeout(refreshAdminReceipts,400);
  }
  function hidePanel(){
    clearSession();
    if(id('adminLogin'))id('adminLogin').classList.remove('hidden');
    if(id('adminPanel'))id('adminPanel').classList.add('hidden');
  }
  async function check(){
    try{var r=await fetch('/api/admin/me',{cache:'no-store'});var d=await r.json();return !!(d&&d.ok&&d.admin)}catch(e){return false}
  }
  async function login(){
    try{
      var pass=id('adminPassword')?id('adminPassword').value:'';
      var r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pass})});
      var d=await r.json().catch(function(){return{}});
      if(!r.ok||!d.ok)throw new Error(d.error||'Clave incorrecta.');
      if(id('adminPassword'))id('adminPassword').value='';
      showPanel();
    }catch(e){alert(e.message||'Clave incorrecta.')}
  }
  async function logout(){
    try{await fetch('/api/admin/logout',{method:'POST'})}catch(e){}
    hidePanel();
    if(id('adminModal'))id('adminModal').classList.remove('is-open');
    alert('Sesión de administrador cerrada.');
  }
  if(id('loginAdminBtn')){
    id('loginAdminBtn').onclick=function(e){if(e){e.preventDefault();e.stopImmediatePropagation&&e.stopImmediatePropagation()}login()};
  }
  if(id('adminPassword')){
    id('adminPassword').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();login()}});
  }
  if(id('logoutAdminBtn')){
    id('logoutAdminBtn').onclick=function(e){if(e){e.preventDefault();e.stopImmediatePropagation&&e.stopImmediatePropagation()}logout()};
  }
  if(id('openAdminBtn')){
    var oldOpen=id('openAdminBtn').onclick;
    id('openAdminBtn').onclick=async function(e){
      if(e)e.preventDefault();
      if(id('adminModal'))id('adminModal').classList.add('is-open');
      if(await check())showPanel();else hidePanel();
    };
  }
  window.backendAdminLogin=login;
  window.backendAdminLogout=logout;
  check().then(function(ok){if(ok)showPanel()});
});
