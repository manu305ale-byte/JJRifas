window.addEventListener('load',function(){
  function toast(msg,type){
    var host=document.querySelector('.toast-stack');
    if(!host){host=document.createElement('div');host.className='toast-stack';document.body.appendChild(host)}
    var item=document.createElement('div');item.className='app-toast app-toast-'+(type||'info');item.textContent=msg;host.appendChild(item);
    setTimeout(function(){item.classList.add('is-visible')},20);
    setTimeout(function(){item.classList.remove('is-visible');setTimeout(function(){item.remove()},250)},4200);
  }
  function busy(msg){
    var o=document.querySelector('.sync-overlay');
    if(!o){o=document.createElement('div');o.className='sync-overlay';o.innerHTML='<div><span class="loader-dot"></span><p></p></div>';document.body.appendChild(o)}
    o.querySelector('p').textContent=msg||'Procesando...';o.classList.add('is-visible');
  }
  function done(){document.querySelector('.sync-overlay')?.classList.remove('is-visible')}
  function result(nums,status){
    var m=document.querySelector('.result-modal');
    if(!m){m=document.createElement('div');m.className='result-modal';m.innerHTML='<div class="result-card"><button type="button" class="result-close">×</button><p class="eyebrow">Comprobante recibido</p><h3>¡Reserva enviada correctamente!</h3><p class="result-numbers"></p><p class="result-status"></p><small>El administrador verificará el comprobante.</small></div>';document.body.appendChild(m);m.querySelector('.result-close').onclick=function(){m.classList.remove('is-open')};m.onclick=function(e){if(e.target===m)m.classList.remove('is-open')}}
    m.querySelector('.result-numbers').textContent='Tus números: '+nums;
    m.querySelector('.result-status').textContent=status||'Queda por verificar.';
    m.classList.add('is-open');
  }
  window.jjToast=toast;window.jjBusy=busy;window.jjDone=done;window.jjResult=result;
  var input=document.getElementById('receiptFile');
  if(input){input.addEventListener('change',function(){var f=input.files&&input.files[0];if(!f)return;var ok=['image/jpeg','image/png','image/webp','application/pdf'].indexOf(f.type)>-1;if(!ok){input.value='';toast('Solo se permiten JPG, PNG, WEBP o PDF.','error');return}if(f.size>6*1024*1024){input.value='';toast('El comprobante supera 6 MB. Comprime la imagen.','error');return}toast('Comprobante listo para enviar.','success')})}
  var form=document.getElementById('reservationForm');
  if(form){form.addEventListener('submit',function(){busy('Guardando comprobante...');setTimeout(function(){done();try{var nums=document.getElementById('selectedNumbersLabel').textContent;result(nums,'Comprobante enviado. Estado: por verificar.')}catch(e){}},2800)},true)}
});
