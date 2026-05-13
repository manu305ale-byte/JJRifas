const PRICE = 20;
const HALF = 10;
const KEY = 'jjrifas_v5_numbers_00_99';
const ADMIN = ['jairolagloriosa789', '.'].join('');
const ADMIN_SESSION_KEY = 'jjrifas_admin_session';
const ADMIN_SESSION_MINUTES = 20;

let selected = new Set();
let reservations = JSON.parse(localStorage.getItem(KEY) || '[]');
let adminFilter = 'all';
const $ = (id) => document.getElementById(id);

function save(){ localStorage.setItem(KEY, JSON.stringify(reservations)); }
function label(n){ return String(n).padStart(2,'0'); }
function allNumbers(){ return Array.from({length:100}, (_, i) => label(i)); }
function isAdminActive(){
  const expires = Number(sessionStorage.getItem(ADMIN_SESSION_KEY) || 0);
  return expires && Date.now() < expires;
}
function refreshAdminSession(){ sessionStorage.setItem(ADMIN_SESSION_KEY, String(Date.now() + ADMIN_SESSION_MINUTES * 60 * 1000)); }
function clearAdminSession(){ sessionStorage.removeItem(ADMIN_SESSION_KEY); }
function activeStatuses(){ return ['pending','partial','second_pending','paid']; }
function statusOfNumber(n){
  const number = typeof n === 'number' ? label(n) : n;
  const r = reservations.find(x => x.numbers.includes(number) && activeStatuses().includes(x.status));
  return r ? r.status : 'available';
}
function holderOf(n){ return reservations.find(x => x.numbers.includes(n) && activeStatuses().includes(x.status)); }
function currentType(){ return document.querySelector('input[name="paymentType"]:checked')?.value || 'full'; }
function selectedStatuses(){ return [...selected].map(n => statusOfNumber(n)); }
function isSecondPaymentMode(){ const s = selectedStatuses(); return s.length && s.every(x => x === 'partial'); }
function unit(){ return isSecondPaymentMode() ? HALF : (currentType() === 'partial' ? HALF : PRICE); }
function safe(v){ return String(v || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function stText(s){ return ({available:'Disponible',pending:'Por verificar',partial:'Pago parcial aprobado',second_pending:'Segundo pago por verificar',paid:'Pago completo aprobado',rejected:'Rechazado'})[s] || s; }
function isPartialLike(s){ return ['pending','partial','second_pending'].includes(s); }

function render(){
  const grid = $('numbersGrid');
  grid.innerHTML = '';
  for(let i = 0; i <= 99; i++){
    const n = label(i);
    const st = statusOfNumber(n);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `number-btn ${st}`;
    if(selected.has(n)) b.classList.add('selected');
    b.textContent = n;
    b.disabled = !['available','partial'].includes(st);
    b.onclick = () => {
      const current = selectedStatuses();
      if(!selected.has(n) && current.length){
        const hasPartial = current.some(x => x === 'partial');
        const hasAvailable = current.some(x => x === 'available');
        if((hasPartial && st === 'available') || (hasAvailable && st === 'partial')){
          alert('No mezcles números disponibles con números de segundo pago. Haz una operación a la vez.');
          return;
        }
      }
      selected.has(n) ? selected.delete(n) : selected.add(n);
      render();
    };
    grid.appendChild(b);
  }
  const nums = [...selected].sort();
  $('selectedNumbersLabel').textContent = nums.length ? nums.join(', ') : 'Ninguno';
  $('totalAmount').textContent = `$${nums.length * unit()}`;

  const statuses = allNumbers().map(n => statusOfNumber(n));
  const yellow = statuses.filter(isPartialLike).length;
  const red = statuses.filter(s => s === 'paid').length;
  $('availableCount').textContent = 100 - yellow - red;
  $('pendingCount').textContent = yellow;
  $('soldCount').textContent = red;

  const note = document.querySelector('.form-note');
  if(note){
    note.textContent = isSecondPaymentMode()
      ? 'Estás reportando el segundo pago parcial. Al enviarlo quedará amarillo hasta que el administrador lo apruebe.'
      : 'El pago parcial bloquea el número en amarillo. Cuando el administrador confirme el pago restante, el número pasará a rojo.';
  }
  if(isAdminActive()) renderAdmin();
}

function readFile(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve({name:file.name,type:file.type,data:reader.result});
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$('reservationForm').onsubmit = async (e) => {
  e.preventDefault();
  const nums = [...selected].sort();
  if(!nums.length) return alert('Selecciona al menos un número.');
  const file = $('receiptFile').files[0];
  if(!file) return alert('Carga el comprobante.');
  const statuses = selectedStatuses();
  const hasPartial = statuses.some(x => x === 'partial');
  const hasAvailable = statuses.some(x => x === 'available');
  if(hasPartial && hasAvailable) return alert('No mezcles números disponibles con números de segundo pago.');
  const receipt = await readFile(file);

  if(hasPartial){
    nums.forEach(n => {
      const r = holderOf(n);
      if(r && r.status === 'partial'){
        r.status = 'second_pending';
        r.secondPaymentRef = $('paymentRef').value.trim();
        r.secondReceipt = receipt;
        r.secondReportedAt = new Date().toISOString();
        r.amount = (r.amount || HALF) + HALF;
      }
    });
    save();
    selected.clear();
    e.target.reset();
    document.querySelector('input[name="paymentType"][value="full"]').checked = true;
    render();
    alert('Segundo pago reportado. El número seguirá amarillo hasta que el administrador lo apruebe.');
    return;
  }

  const type = currentType();
  reservations.unshift({
    id: String(Date.now()) + Math.random().toString(16).slice(2),
    createdAt: new Date().toISOString(),
    status: 'pending',
    paymentType: type,
    numbers: nums,
    ticketTotal: nums.length * PRICE,
    amount: nums.length * (type === 'partial' ? HALF : PRICE),
    amountPaid: 0,
    name: $('customerName').value.trim(),
    document: $('customerId').value.trim(),
    phone: $('customerPhone').value.trim(),
    paymentRef: $('paymentRef').value.trim(),
    receipt
  });
  save();
  selected.clear();
  e.target.reset();
  document.querySelector('input[name="paymentType"][value="full"]').checked = true;
  render();
  alert('Comprobante enviado. El número queda amarillo hasta verificación o pago completo.');
};

$('selectRandomBtn').onclick = () => {
  const free = allNumbers().filter(n => statusOfNumber(n) === 'available');
  if(!free.length) return alert('No quedan números disponibles.');
  selected.add(free[Math.floor(Math.random()*free.length)]);
  render();
};
$('clearSelectionBtn').onclick = () => { selected.clear(); render(); };
document.querySelectorAll('input[name="paymentType"]').forEach(i => i.onchange = render);

function openAdmin(){
  $('adminModal').classList.add('is-open');
  if(isAdminActive()){
    refreshAdminSession();
    $('adminLogin').classList.add('hidden');
    $('adminPanel').classList.remove('hidden');
  }
  renderAdmin();
}
function closeAdmin(){ $('adminModal').classList.remove('is-open'); }
function logoutAdmin(){
  clearAdminSession();
  $('adminPassword').value = '';
  $('adminLogin').classList.remove('hidden');
  $('adminPanel').classList.add('hidden');
  renderAdmin();
  alert('Sesión de administrador cerrada.');
}
$('openAdminBtn').onclick = openAdmin;
document.querySelectorAll('[data-close-admin]').forEach(x => x.onclick = closeAdmin);
$('loginAdminBtn').onclick = () => {
  if($('adminPassword').value !== ADMIN) return alert('Clave incorrecta.');
  refreshAdminSession();
  $('adminLogin').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  renderAdmin();
};
if($('logoutAdminBtn')) $('logoutAdminBtn').onclick = logoutAdmin;

function receiptPreview(file, labelText='Comprobante'){
  if(!file) return '<p class="form-note">Sin comprobante</p>';
  if((file.type || '').includes('image')) return `<p class="form-note">${labelText}</p><a href="${file.data}" target="_blank"><img class="receipt-preview" src="${file.data}" alt="${labelText}"></a>`;
  return `<a class="btn btn-small" href="${file.data}" download="${safe(file.name)}">Descargar ${labelText}</a>`;
}

function filteredReservations(){
  if(adminFilter === 'all') return reservations;
  if(adminFilter === 'rejected') return reservations.filter(r => r.status === 'rejected');
  if(adminFilter === 'partial') return reservations.filter(r => ['pending','partial','second_pending'].includes(r.status));
  if(adminFilter === 'paid') return reservations.filter(r => r.status === 'paid');
  return reservations;
}

function renderAdminNumbers(){
  const box = $('adminNumbersGrid');
  if(!box) return;
  box.innerHTML = allNumbers().map(n => {
    const st = statusOfNumber(n);
    const r = holderOf(n);
    const title = r ? `${safe(r.name)} - ${stText(st)}` : 'Disponible';
    return `<button type="button" class="admin-number ${st}" title="${title}">${n}</button>`;
  }).join('');
}

function renderAdminSummary(){
  const box = $('adminSummary');
  if(!box) return;
  const statuses = allNumbers().map(n => statusOfNumber(n));
  const available = statuses.filter(s => s === 'available').length;
  const partial = statuses.filter(isPartialLike).length;
  const paid = statuses.filter(s => s === 'paid').length;
  const rejected = reservations.filter(r => r.status === 'rejected').reduce((acc, r) => acc + r.numbers.length, 0);
  box.innerHTML = `
    <div><strong>${available}</strong><small>Disponibles</small></div>
    <div><strong>${partial}</strong><small>Parciales / por verificar</small></div>
    <div><strong>${paid}</strong><small>Pagos completos</small></div>
    <div><strong>${rejected}</strong><small>Rechazados</small></div>
  `;
}

function renderAdmin(){
  if(!isAdminActive()) return;
  refreshAdminSession();
  renderAdminSummary();
  renderAdminNumbers();
  const list = $('adminList');
  if(!list) return;
  const data = filteredReservations();
  if(!data.length){ list.innerHTML = '<p class="form-note">No hay registros para este filtro.</p>'; return; }
  list.innerHTML = data.map(r => `
    <article class="admin-item">
      <div>
        <span class="status-pill status-${r.status}">${stText(r.status)}</span>
        <h3>${safe(r.name)}</h3>
        <p><strong>Números:</strong> ${r.numbers.join(', ')}</p>
        <p><strong>Modalidad:</strong> ${r.paymentType === 'partial' ? 'Pago parcial $10 + $10' : 'Pago completo $20'}</p>
        <p><strong>Total:</strong> $${r.ticketTotal}</p>
        <p><strong>Reportado:</strong> $${r.amount}</p>
        <p><strong>Aprobado:</strong> $${r.amountPaid || 0}</p>
        <p><strong>Documento:</strong> ${safe(r.document)}</p>
        <p><strong>Teléfono:</strong> ${safe(r.phone)}</p>
        <p><strong>Referencia inicial:</strong> ${safe(r.paymentRef)}</p>
        ${r.secondPaymentRef ? `<p><strong>Referencia segundo pago:</strong> ${safe(r.secondPaymentRef)}</p>` : ''}
        <p><strong>Fecha:</strong> ${new Date(r.createdAt).toLocaleString()}</p>
      </div>
      <div>
        ${receiptPreview(r.receipt, 'Comprobante inicial')}
        ${r.secondReceipt ? receiptPreview(r.secondReceipt, 'Segundo comprobante') : ''}
        <div class="admin-buttons">
          ${r.status === 'pending' ? `<button class="btn btn-small btn-primary" onclick="approve('${r.id}')">${r.paymentType === 'partial' ? 'Aprobar parcial' : 'Aprobar completo'}</button>` : ''}
          ${r.status === 'second_pending' ? `<button class="btn btn-small btn-primary" onclick="approveSecond('${r.id}')">Aprobar segundo pago</button>` : ''}
          ${['pending','partial','second_pending'].includes(r.status) ? `<button class="btn btn-small btn-danger" onclick="reject('${r.id}')">Rechazar y liberar</button>` : ''}
          ${r.status === 'paid' ? `<button class="btn btn-small btn-danger" onclick="reject('${r.id}')">Liberar números</button>` : ''}
        </div>
      </div>
    </article>`).join('');
}

window.approve = id => { const r = reservations.find(x=>x.id===id); if(!r) return; if(r.paymentType==='partial'){r.status='partial'; r.amountPaid=r.numbers.length*HALF;} else {r.status='paid'; r.amountPaid=r.numbers.length*PRICE;} save(); render(); renderAdmin(); };
window.approveSecond = id => { const r = reservations.find(x=>x.id===id); if(!r) return; r.status='paid'; r.amountPaid=r.numbers.length*PRICE; r.completedAt = new Date().toISOString(); save(); render(); renderAdmin(); };
window.reject = id => { const r = reservations.find(x=>x.id===id); if(!r) return; r.status='rejected'; save(); render(); renderAdmin(); };

document.querySelectorAll('[data-admin-filter]').forEach(btn => {
  btn.onclick = () => {
    adminFilter = btn.dataset.adminFilter;
    document.querySelectorAll('[data-admin-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAdmin();
  };
});

function exportAdminImage(){
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#050505';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#d6b448';
  ctx.font = 'bold 54px Arial';
  ctx.fillText('JJRIFAS - REPORTE DE NÚMEROS', 70, 90);
  ctx.fillStyle = '#fff8d6';
  ctx.font = '26px Arial';
  ctx.fillText(`Fecha: ${new Date().toLocaleString()}`, 70, 135);
  ctx.fillText(`Filtro: ${stText(adminFilter) || adminFilter}`, 70, 172);

  const statuses = allNumbers().map(n => statusOfNumber(n));
  const available = statuses.filter(s => s === 'available').length;
  const partial = statuses.filter(isPartialLike).length;
  const paid = statuses.filter(s => s === 'paid').length;
  const rejected = reservations.filter(r => r.status === 'rejected').reduce((acc, r) => acc + r.numbers.length, 0);
  const cards = [['DISPONIBLES', available, '#0bbf5a'], ['PARCIALES', partial, '#ffd54a'], ['PAGADOS', paid, '#e53333'], ['RECHAZADOS', rejected, '#8f8f8f']];
  cards.forEach((c, i) => {
    const x = 70 + i * 320;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, 220, 280, 120);
    ctx.strokeStyle = '#d6b448'; ctx.strokeRect(x, 220, 280, 120);
    ctx.fillStyle = c[2]; ctx.font = 'bold 44px Arial'; ctx.fillText(String(c[1]), x+24, 275);
    ctx.fillStyle = '#fff8d6'; ctx.font = 'bold 20px Arial'; ctx.fillText(c[0], x+24, 315);
  });

  let y = 410;
  ctx.font = 'bold 24px Arial';
  allNumbers().forEach((n, i) => {
    const st = statusOfNumber(n);
    const x = 70 + (i % 10) * 126;
    y = 410 + Math.floor(i / 10) * 64;
    ctx.fillStyle = st === 'available' ? '#0bbf5a' : (st === 'paid' ? '#e53333' : '#ffd54a');
    ctx.fillRect(x, y, 92, 46);
    ctx.fillStyle = st === 'pending' || st === 'partial' || st === 'second_pending' ? '#050505' : '#ffffff';
    ctx.fillText(n, x + 28, y + 31);
  });

  y += 110;
  ctx.fillStyle = '#d6b448'; ctx.font = 'bold 30px Arial'; ctx.fillText('REGISTROS', 70, y);
  y += 45;
  ctx.fillStyle = '#fff8d6'; ctx.font = '22px Arial';
  filteredReservations().slice(0, 24).forEach(r => {
    ctx.fillText(`${r.numbers.join(', ')} | ${r.name || 'Sin nombre'} | ${stText(r.status)} | $${r.amountPaid || 0}/$${r.ticketTotal}`, 70, y);
    y += 34;
  });

  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `jjrifas-reporte-${Date.now()}.png`;
  a.click();
}
if($('exportDataBtn')) $('exportDataBtn').onclick = exportAdminImage;
$('resetDataBtn').onclick = () => { if(confirm('¿Borrar todas las reservas guardadas en este navegador?')){ reservations = []; save(); render(); renderAdmin(); } };
$('ticketPrice').textContent = '$20';
$('year').textContent = new Date().getFullYear();
render();
