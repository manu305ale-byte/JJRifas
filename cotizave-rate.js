(() => {
  const API_URLS = ['/api/binance-rate', '/.netlify/functions/binance-rate'];
  const REFRESH_MINUTES = 10;
  const CACHE_KEY = 'jjrifas_binance_p2p_multi_rate_cache';
  const CURRENCIES = { VES:{label:'Bs',locale:'es-VE',decimals:2}, COP:{label:'COP',locale:'es-CO',decimals:0}, CLP:{label:'CLP',locale:'es-CL',decimals:0} };
  function fallbackRate(){const r=Number(window.JJRIFAS_RATE_CONFIG?.fallbackRateVES);return Number.isFinite(r)&&r>0?r:null}
  function formatMoney(value,currency){const c=CURRENCIES[currency]||CURRENCIES.VES;return `${c.label} ${new Intl.NumberFormat(c.locale,{minimumFractionDigits:c.decimals,maximumFractionDigits:c.decimals}).format(value)}`}
  function getCachedRates(){try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!c)return null;if(Date.now()-c.savedAt>REFRESH_MINUTES*60*1000)return null;return c.rates}catch{return null}}
  function setCachedRates(rates){localStorage.setItem(CACHE_KEY,JSON.stringify({rates,savedAt:Date.now()}))}
  function ensureEquivalentElements(){const t=document.getElementById('ticketPrice');if(t&&!t.querySelector('[data-usd-equivalent]')){const b=document.createElement('span');b.dataset.usdEquivalent='20';b.className='currency-equivalents currency-equivalents-main';b.textContent='Consultando tasas...';t.appendChild(b)}document.querySelectorAll('.payment-option small, .payment-box p').forEach(e=>{const x=e.textContent||'';const a=x.includes('$10')?10:x.includes('$20')?20:null;if(!a||e.querySelector('[data-usd-equivalent]'))return;const b=document.createElement('span');b.dataset.usdEquivalent=String(a);b.className='currency-equivalents';b.textContent=' · Consultando tasas...';e.appendChild(b)})}
  function buildLines(usd,rates){if(!rates)return[];return['VES','COP','CLP'].filter(c=>Number.isFinite(Number(rates[c]))&&Number(rates[c])>0).map(c=>`≈ ${formatMoney(usd*Number(rates[c]),c)}`)}
  function updateEquivalentElements(rates,isFallback=false){document.querySelectorAll('[data-usd-equivalent]').forEach(e=>{const usd=Number(e.dataset.usdEquivalent||0);let finalRates=rates;if(!finalRates&&fallbackRate()){finalRates={VES:fallbackRate()};isFallback=true}const lines=buildLines(usd,finalRates);if(!usd||!lines.length){e.innerHTML=e.classList.contains('currency-equivalents-main')?'<span>Tasa API no disponible</span>':'<span> · Tasa API no disponible</span>';return}e.innerHTML=lines.map((line,i)=>`<span>${line}${isFallback&&i===0?' ref.':''}</span>`).join('')})}
  async function requestRates(){let lastError;for(const url of API_URLS){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url} HTTP ${r.status}`);const d=await r.json();const rates=d?.rates||(d?.rate?{VES:d.rate}:null);if(!d?.ok||!rates||!Number.isFinite(Number(rates.VES)))throw new Error(d?.error||`Tasas no disponibles en ${url}`);return rates}catch(e){lastError=e}}throw lastError||new Error('Tasas no disponibles.')}
  async function loadRate(){ensureEquivalentElements();const cached=getCachedRates();if(cached)updateEquivalentElements(cached);try{const rates=await requestRates();setCachedRates(rates);updateEquivalentElements(rates)}catch(e){console.warn('No se pudieron cargar las tasas USDT desde la API:',e);if(!cached)updateEquivalentElements(null)}}
  window.addEventListener('load',loadRate);
})();

window.addEventListener('load',function(){
  var KEY='jjrifas_v6_final_00_99';
  function adminOpen(){var m=document.getElementById('adminModal'),p=document.getElementById('adminPanel');return !!(m&&p&&m.classList.contains('is-open')&&!p.classList.contains('hidden'))}
  function apply(list){if(!Array.isArray(list))return;try{reservations=list}catch(e){}localStorage.setItem(KEY,JSON.stringify(list));if(typeof render==='function')render();if(typeof renderAdmin==='function')renderAdmin()}
  async function loadAdmin(){if(!adminOpen())return;try{var r=await fetch('/api/admin/reservations',{cache:'no-store'});var d=await r.json();if(d&&d.ok&&Array.isArray(d.reservations))apply(d.reservations)}catch(e){console.warn('admin receipts sync',e)}}
  document.getElementById('loginAdminBtn')?.addEventListener('click',function(){setTimeout(loadAdmin,700)});
  document.getElementById('openAdminBtn')?.addEventListener('click',function(){setTimeout(loadAdmin,700)});
  document.querySelectorAll('[data-admin-filter]').forEach(function(b){b.addEventListener('click',function(){setTimeout(loadAdmin,250)})});
  setInterval(function(){if(adminOpen())loadAdmin()},5000);
  window.refreshAdminReceipts=loadAdmin;
});
