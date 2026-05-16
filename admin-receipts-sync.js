window.addEventListener('load',function(){
  var KEY='jjrifas_v6_final_00_99';
  function adminOpen(){try{return typeof isAdminActive==='function'&&isAdminActive()}catch(e){return false}}
  function apply(list){
    if(!Array.isArray(list))return;
    try{reservations=list}catch(e){}
    localStorage.setItem(KEY,JSON.stringify(list));
    if(typeof render==='function')render();
    if(typeof renderAdmin==='function')renderAdmin();
  }
  async function loadAdmin(){
    if(!adminOpen())return;
    try{
      var r=await fetch('/api/admin/reservations',{cache:'no-store'});
      var d=await r.json();
      if(d&&d.ok&&Array.isArray(d.reservations))apply(d.reservations);
    }catch(e){console.warn('admin receipts sync',e)}
  }
  async function saveCurrent(){
    try{
      var list=JSON.parse(localStorage.getItem(KEY)||'[]');
      await fetch('/api/reservations',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({reservations:list})});
    }catch(e){console.warn('admin save sync',e)}
  }
  document.getElementById('loginAdminBtn')?.addEventListener('click',function(){setTimeout(loadAdmin,500)});
  document.getElementById('openAdminBtn')?.addEventListener('click',function(){setTimeout(loadAdmin,500)});
  document.getElementById('adminPanel')?.addEventListener('click',function(){setTimeout(saveCurrent,1000);setTimeout(loadAdmin,1800)});
  setInterval(function(){if(adminOpen())loadAdmin()},6000);
  window.refreshAdminReceipts=loadAdmin;
});
