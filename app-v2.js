const PRICE = 20;
const HALF = 10;
const KEY = 'jjrifas_v4';
const ADMIN = ['jairolagloriosa789', '.'].join('');
let selected = new Set();
let reservations = JSON.parse(localStorage.getItem(KEY) || '[]');
const $ = (id) => document.getElementById(id);

function save(){ localStorage.setItem(KEY, JSON.stringify(reservations)); }
function label(n){ return String(n).padStart(2,'0'); }
function statusOf(num){
  const n = label(num);
  const r = reservations.find(x => x.numbers.includes(n) && ['pending','partial','second_pending','paid'].includes(x.status));
  return r ? r.status : 'available';
}
function holderOf(n){ return reservations.find(x => x.numbers.includes(n) && ['partial','second_pending','paid','pending'].includes(x.status)); }
function currentType(){ return document.querySelector('input[name="paymentType"]:checked')?.value || 'full'; }
function selectedStatuses(){ return [...selected].map(n => statusOf(Number(n))); }
function isSecondPaymentMode(){ const s = selectedStatuses(); return s.length && s.every(x => x === 'partial'); }
function unit(){ return isSecondPaymentMode() ? HALF : (currentType() === 'partial' ? HALF : PRICE); }

function render(){
  const grid = $('numbersGrid');
  grid.innerHTML = '';
  for(let i=1;i<=100;i++){
    const n = label(i);
    const st = statusOf(i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `number-btn ${st}`;
    if(selected.has(n)) b.classList.add('selected');
    b.textContent = n;
    b.disabled = !['available','partial'].includes(st);
    b.onclick = () => {
      const candidate = st;
      const current = selectedStatuses();
      if(!selected.has(n) && current.length){
        const hasPartial = current.some(x => x === 'partial');
        const hasAvailable = current.some(x => x === 'available');
        if((hasPartial && candidate === 'available') || (hasAvailable && candidate === 'partial')){
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
  const active = new Map();
  reservations.forEach(r => { if(['pending','partial','second_pending','paid'].includes(r.status)) r.numbers.forEach(n => active.set(n,r.status)); });
  const yellow = [...active.values()].filter(s => ['pending','partial','second_pending'].includes(s)).length;
  const red = [...active.values()].filter(s => s === 'paid').length;
  $('availableCount').textContent = 100 - yellow - red;
  $('pendingCount').textContent = yellow;
  $('soldCount').textContent = red;
  const note = document.querySelector('.form-note');
  if(note){
    note.textContent = isSecondPaymentMode()
      ? 'Estás reportando el segundo pago parcial. Al enviarlo quedará amarillo hasta que el administrador lo apruebe.'
      : 'El pago parcial bloquea el número en amarillo. Cuando el administrador confirme el pago restante, el número pasará a rojo.';
  }
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
        r.amount = (r.amount || 0) + HALF;
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
  const free = [];
  for(let i=1;i<=100;i++) if(statusOf(i)==='available') free.push(label(i));
  if(!free.length) return alert('No quedan números disponibles.');
  selected.add(free[Math.floor(Math.random()*free.length)]);
  render();
};
$('clearSelectionBtn').onclick = () => { selected.clear(); render(); };
document.querySelectorAll('input[name="paymentType"]').forEach(i => i.onchange = render);

$('openAdminBtn').onclick = () => { $('adminModal').classList.add('is-open'); renderAdmin(); };
document.querySelectorAll('[data-close-admin]').forEach(x => x.onclick = () => $('adminModal').classList.remove('is-open'));
$('loginAdminBtn').onclick = () => {
  if($('adminPassword').value !== ADMIN) return alert('Clave incorrecta.');
  $('adminLogin').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  renderAdmin();
};

function stText(s){ return ({pending:'Por verificar',partial:'Pago parcial aprobado',second_pending:'Segundo pago por verificar',paid:'Pago completo aprobado',rejected:'Rechazado'})[s] || s; }
function safe(v){ return String(v || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function receiptPreview(file, labelText='Comprobante'){
  if(!file) return '<p class="form-note">Sin comprobante</p>';
  if((file.type || '').includes('image')) return `<p class="form-note">${labelText}</p><a href="${file.data}" target="_blank"><img class="receipt-preview" src="${file.data}" alt="${labelText}"></a>`;
  return `<a class="btn btn-small" href="${file.data}" download="${safe(file.name)}">Descargar ${labelText}</a>`;
}
function renderAdmin(){
  const list = $('adminList');
  if(!reservations.length){ list.innerHTML = '<p class="form-note">Todavía no hay comprobantes cargados.</p>'; return; }
  list.innerHTML = reservations.map(r => `
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
$('exportDataBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(reservations,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `jjrifas-reservas-${Date.now()}.json`; a.click();
};
$('resetDataBtn').onclick = () => { if(confirm('¿Borrar todas las reservas?')){ reservations = []; save(); render(); renderAdmin(); } };
$('ticketPrice').textContent = '$20';
$('year').textContent = new Date().getFullYear();
render();
