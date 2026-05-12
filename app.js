const CONFIG = {
  ticketPrice: 5,
  currency: '$',
  adminPassword: 'admin123',
  totalNumbers: 100,
  storageKey: 'jjrifas_v1'
};

const state = {
  selected: new Set(),
  reservations: loadData()
};

const $ = (id) => document.getElementById(id);
const grid = $('numbersGrid');
const selectedLabel = $('selectedNumbersLabel');
const totalAmount = $('totalAmount');

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.storageKey)) || [];
  } catch {
    return [];
  }
}

function saveData() {
  localStorage.setItem(CONFIG.storageKey, JSON.stringify(state.reservations));
}

function numberLabel(n) {
  return String(n).padStart(2, '0');
}

function getNumberStatus(n) {
  const label = numberLabel(n);
  const found = state.reservations.find(r => r.numbers.includes(label) && ['pending', 'paid'].includes(r.status));
  return found?.status || 'available';
}

function renderNumbers() {
  grid.innerHTML = '';
  for (let i = 1; i <= CONFIG.totalNumbers; i++) {
    const label = numberLabel(i);
    const status = getNumberStatus(i);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `number-btn ${status}`;
    btn.textContent = label;
    btn.setAttribute('aria-label', `Número ${label}`);
    if (state.selected.has(label)) btn.classList.add('selected');
    if (status !== 'available') btn.disabled = true;
    btn.addEventListener('click', () => toggleNumber(label));
    grid.appendChild(btn);
  }
  renderSummary();
}

function toggleNumber(label) {
  if (state.selected.has(label)) state.selected.delete(label);
  else state.selected.add(label);
  renderNumbers();
}

function renderSummary() {
  const selected = Array.from(state.selected).sort();
  selectedLabel.textContent = selected.length ? selected.join(', ') : 'Ninguno';
  totalAmount.textContent = `${CONFIG.currency}${selected.length * CONFIG.ticketPrice}`;

  const activeNumbers = new Map();
  state.reservations.forEach(r => {
    if (['pending', 'paid'].includes(r.status)) r.numbers.forEach(n => activeNumbers.set(n, r.status));
  });
  const pending = [...activeNumbers.values()].filter(s => s === 'pending').length;
  const sold = [...activeNumbers.values()].filter(s => s === 'paid').length;
  $('availableCount').textContent = CONFIG.totalNumbers - pending - sold;
  $('pendingCount').textContent = pending;
  $('soldCount').textContent = sold;
}

function readReceipt(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

$('reservationForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const numbers = Array.from(state.selected).sort();
  if (!numbers.length) {
    alert('Selecciona al menos un número disponible.');
    return;
  }

  const file = $('receiptFile').files[0];
  if (!file) {
    alert('Carga el comprobante de pago.');
    return;
  }

  const unavailable = numbers.filter(n => getNumberStatus(Number(n)) !== 'available');
  if (unavailable.length) {
    alert(`Estos números ya no están disponibles: ${unavailable.join(', ')}`);
    state.selected.clear();
    renderNumbers();
    return;
  }

  const receipt = await readReceipt(file);
  const reservation = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    status: 'pending',
    numbers,
    amount: numbers.length * CONFIG.ticketPrice,
    name: $('customerName').value.trim(),
    document: $('customerId').value.trim(),
    phone: $('customerPhone').value.trim(),
    paymentRef: $('paymentRef').value.trim(),
    receipt
  };

  state.reservations.unshift(reservation);
  saveData();
  state.selected.clear();
  event.target.reset();
  renderNumbers();
  alert('Comprobante enviado. Tus números quedaron por verificar.');
});

$('selectRandomBtn').addEventListener('click', () => {
  const available = [];
  for (let i = 1; i <= CONFIG.totalNumbers; i++) {
    if (getNumberStatus(i) === 'available') available.push(numberLabel(i));
  }
  if (!available.length) return alert('No quedan números disponibles.');
  const random = available[Math.floor(Math.random() * available.length)];
  state.selected.add(random);
  renderNumbers();
});

$('clearSelectionBtn').addEventListener('click', () => {
  state.selected.clear();
  renderNumbers();
});

function openAdmin() {
  $('adminModal').classList.add('is-open');
  $('adminModal').setAttribute('aria-hidden', 'false');
  renderAdminList();
}

function closeAdmin() {
  $('adminModal').classList.remove('is-open');
  $('adminModal').setAttribute('aria-hidden', 'true');
}

$('openAdminBtn').addEventListener('click', openAdmin);
document.querySelectorAll('[data-close-admin]').forEach(el => el.addEventListener('click', closeAdmin));

$('loginAdminBtn').addEventListener('click', () => {
  if ($('adminPassword').value !== CONFIG.adminPassword) {
    alert('Clave incorrecta.');
    return;
  }
  $('adminLogin').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  renderAdminList();
});

function statusText(status) {
  return { pending: 'Por aprobar', paid: 'Aprobado con comprobante', rejected: 'Rechazado' }[status] || status;
}

function renderAdminList() {
  const list = $('adminList');
  if (!list) return;
  if (!state.reservations.length) {
    list.innerHTML = '<p class="form-note">Todavía no hay comprobantes cargados.</p>';
    return;
  }

  list.innerHTML = state.reservations.map(r => `
    <article class="admin-item">
      <div>
        <span class="status-pill status-${r.status}">${statusText(r.status)}</span>
        <h3>${escapeHtml(r.name)}</h3>
        <p><strong>Números:</strong> ${r.numbers.join(', ')}</p>
        <p><strong>Monto:</strong> ${CONFIG.currency}${r.amount}</p>
        <p><strong>Documento:</strong> ${escapeHtml(r.document)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(r.phone)}</p>
        <p><strong>Referencia:</strong> ${escapeHtml(r.paymentRef)}</p>
        <p><strong>Fecha:</strong> ${new Date(r.createdAt).toLocaleString()}</p>
      </div>
      <div>
        ${renderReceipt(r)}
        <div class="admin-buttons">
          ${r.status === 'pending' ? `<button class="btn btn-small btn-primary" onclick="approveReservation('${r.id}')">Aprobar pago</button>` : ''}
          ${r.status === 'pending' ? `<button class="btn btn-small btn-danger" onclick="rejectReservation('${r.id}')">Rechazar y liberar</button>` : ''}
          ${r.status === 'paid' ? `<button class="btn btn-small btn-danger" onclick="releaseReservation('${r.id}')">Liberar números</button>` : ''}
        </div>
      </div>
    </article>
  `).join('');
}

function renderReceipt(r) {
  if (!r.receipt) return '<p class="form-note">Sin comprobante</p>';
  if (r.receipt.type && r.receipt.type.includes('image')) {
    return `<a href="${r.receipt.data}" target="_blank" rel="noopener"><img class="receipt-preview" src="${r.receipt.data}" alt="Comprobante" /></a>`;
  }
  return `<a class="btn btn-small" href="${r.receipt.data}" download="${escapeHtml(r.receipt.name)}">Descargar comprobante</a>`;
}

window.approveReservation = function(id) {
  const r = state.reservations.find(item => item.id === id);
  if (!r) return;
  r.status = 'paid';
  saveData();
  renderNumbers();
  renderAdminList();
};

window.rejectReservation = function(id) {
  const r = state.reservations.find(item => item.id === id);
  if (!r) return;
  r.status = 'rejected';
  saveData();
  renderNumbers();
  renderAdminList();
};

window.releaseReservation = function(id) {
  if (!confirm('¿Seguro que quieres liberar estos números?')) return;
  const r = state.reservations.find(item => item.id === id);
  if (!r) return;
  r.status = 'rejected';
  saveData();
  renderNumbers();
  renderAdminList();
};

$('exportDataBtn').addEventListener('click', () => {
  const data = JSON.stringify(state.reservations, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jjrifas-reservas-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('resetDataBtn').addEventListener('click', () => {
  if (!confirm('Esto borrará todas las reservas guardadas en este navegador. ¿Continuar?')) return;
  state.reservations = [];
  saveData();
  renderNumbers();
  renderAdminList();
});

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));
}

$('ticketPrice').textContent = `${CONFIG.currency}${CONFIG.ticketPrice}`;
$('year').textContent = new Date().getFullYear();
renderNumbers();
