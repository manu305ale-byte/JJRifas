window.addEventListener('load',function(){
var K='jjrifas_v6_final_00_99';
function apply(list){try{reservations=list}catch(e){};localStorage.setItem(K,JSON.stringify(list||[]));if(typeof render==='function')render();if(typeof renderAdmin==='function')renderAdmin();}
async function act(a,id){var r=await fetch('/api/admin/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a,id:id})});var d=await r.json().catch(function(){return{}});if(!r.ok||!d.ok)throw new Error(d.error||'No se pudo actualizar.');apply(d.reservations||[]);return d;}
window.approve=async function(id){try{await act('approve',id);alert('Comprobante aprobado.')}catch(e){alert(e.message)}};
window.approveSecond=async function(id){try{await act('approveSecond',id);alert('Segundo pago aprobado.')}catch(e){alert(e.message)}};
window.reject=async function(id){if(!confirm('¿Confirmas liberar estos números?'))return;try{await act('reject',id);alert('Números liberados.')}catch(e){alert(e.message)}};
var b=document.getElementById('resetDataBtn');if(b)b.onclick=async function(){if(!confirm('¿Confirmas reiniciar la rifa?'))return;try{await act('reset');alert('Rifa reiniciada.')}catch(e){alert(e.message)}};
});
