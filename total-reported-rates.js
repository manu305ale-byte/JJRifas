window.addEventListener('load',function(){
  var CACHE_KEY='jjrifas_binance_p2p_multi_rate_cache';
  var API_URL='/api/binance-rate';
  var PRICE=20;
  var HALF=10;
  var rates=null;

  function money(value,currency){
    var cfg={VES:['Bs','es-VE',2],COP:['COP','es-CO',0],CLP:['CLP','es-CL',0]}[currency]||['','es-VE',2];
    return cfg[0]+' '+new Intl.NumberFormat(cfg[1],{minimumFractionDigits:cfg[2],maximumFractionDigits:cfg[2]}).format(value);
  }
  function getSelectedCount(){try{return Array.from(selected).length}catch(e){return 0}}
  function secondPaymentMode(){try{return Array.from(selected).length>0&&Array.from(selected).every(function(n){return statusOfNumber(n)==='partial'})}catch(e){return false}}
  function paymentType(){return document.querySelector('input[name="paymentType"]:checked')?.value||'full'}
  function usdTotal(){
    var count=getSelectedCount();
    if(!count)return 0;
    var unit=secondPaymentMode()?HALF:(paymentType()==='partial'?HALF:PRICE);
    return count*unit;
  }
  function loadCache(){try{var c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return c&&c.rates?c.rates:null}catch(e){return null}}
  async function loadRates(){
    rates=loadCache();
    updateTotal();
    try{
      var r=await fetch(API_URL,{cache:'no-store'});
      var d=await r.json();
      if(d&&d.ok&&d.rates){rates=d.rates;localStorage.setItem(CACHE_KEY,JSON.stringify({rates:rates,savedAt:Date.now()}));updateTotal();}
    }catch(e){console.warn('No se pudo actualizar total reportado con Binance:',e)}
  }
  function renderLines(usd){
    if(!rates||!usd)return '';
    return '<span>'+money(usd*Number(rates.VES||0),'VES')+'</span><span>'+money(usd*Number(rates.COP||0),'COP')+'</span><span>'+money(usd*Number(rates.CLP||0),'CLP')+'</span>';
  }
  function ensureBox(){
    var amount=document.getElementById('totalAmount');
    if(!amount)return null;
    var box=document.getElementById('totalCurrencyEquivalents');
    if(!box){box=document.createElement('small');box.id='totalCurrencyEquivalents';box.className='currency-equivalents total-currency-equivalents';amount.parentElement.appendChild(box)}
    return box;
  }
  function updateTotal(){
    var amount=document.getElementById('totalAmount');
    if(!amount)return;
    var usd=usdTotal();
    amount.textContent='$'+usd;
    var box=ensureBox();
    if(!box)return;
    if(!usd){box.innerHTML='<span>Selecciona números para calcular equivalentes</span>';return;}
    if(!rates){box.innerHTML='<span>Consultando tasa Binance...</span>';return;}
    box.innerHTML=renderLines(usd)+'<span class="rate-note">Tasa Binance P2P USDT actualizada</span>';
  }
  window.updateTotalReportedRates=updateTotal;
  document.addEventListener('click',function(e){
    if(e.target.closest('.number-btn')||e.target.closest('#clearSelectionBtn')||e.target.closest('#selectRandomBtn'))setTimeout(updateTotal,80);
  });
  document.querySelectorAll('input[name="paymentType"]').forEach(function(input){input.addEventListener('change',function(){setTimeout(updateTotal,80)})});
  var oldRender=window.render;
  if(typeof oldRender==='function'){
    window.render=function(){var out=oldRender.apply(this,arguments);setTimeout(updateTotal,40);return out;}
  }
  loadRates();
  setInterval(loadRates,10*60*1000);
});
