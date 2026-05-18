window.addEventListener('load', function () {
  var KEY = 'jjrifas_v6_final_00_99';
  var PRICE = 20;
  var HALF = 10;

  function byId(id) { return document.getElementById(id); }
  function selectedNumbers() {
    try { return Array.from(selected).sort(); } catch (_) { return []; }
  }
  function currentPaymentType() {
    return document.querySelector('input[name="paymentType"]:checked')?.value || 'full';
  }
  function selectedIsSecondPayment() {
    try {
      var nums = selectedNumbers();
      return nums.length > 0 && nums.every(function (n) { return statusOfNumber(n) === 'partial'; });
    } catch (_) {
      return false;
    }
  }
  function selectedMixesModes() {
    try {
      var nums = selectedNumbers();
      var hasPartial = nums.some(function (n) { return statusOfNumber(n) === 'partial'; });
      var hasAvailable = nums.some(function (n) { return statusOfNumber(n) === 'available'; });
      return hasPartial && hasAvailable;
    } catch (_) {
      return false;
    }
  }
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve({ name: file.name, type: file.type, data: reader.result }); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  function validateUpload(file) {
    if (!file) throw new Error('Carga el comprobante.');
    var allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/jpg'];
    if (allowed.indexOf(file.type) === -1) throw new Error('Solo se permiten JPG, PNG, WEBP o PDF.');
    if (file.size > 8 * 1024 * 1024) throw new Error('El comprobante supera 8 MB. Comprime la imagen e intenta de nuevo.');
  }
  async function api(url, payload) {
    var response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar el comprobante.');
    return data;
  }
  function applyPublicList(list) {
    if (!Array.isArray(list)) return;
    try { reservations = list; } catch (_) {}
    localStorage.setItem(KEY, JSON.stringify(list));
    try { selected.clear(); } catch (_) {}
    if (typeof render === 'function') render();
  }
  function resetForm(form) {
    if (form) form.reset();
    var full = document.querySelector('input[name="paymentType"][value="full"]');
    if (full) full.checked = true;
  }

  async function submitToBackend(event) {
    if (event) {
      event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }

    try {
      var form = byId('reservationForm');
      var nums = selectedNumbers();
      if (!nums.length) throw new Error('Selecciona al menos un número.');
      if (selectedMixesModes()) throw new Error('No mezcles números disponibles con números de segundo pago. Haz una operación a la vez.');

      var file = byId('receiptFile')?.files?.[0];
      validateUpload(file);
      var receipt = await readFile(file);
      var paymentRef = byId('paymentRef')?.value.trim() || '';
      if (!/^[0-9]{4,20}$/.test(paymentRef)) throw new Error('La referencia de pago debe contener solo números.');

      if (selectedIsSecondPayment()) {
        var secondData = await api('/api/reservations/second-payment', {
          numbers: nums,
          paymentRef: paymentRef,
          receipt: receipt
        });
        applyPublicList(secondData.reservations || []);
        resetForm(form);
        alert('Segundo pago reportado. El número seguirá amarillo hasta que el administrador lo apruebe.');
        return;
      }

      if (typeof validateFormFields === 'function') {
        var error = validateFormFields();
        if (error) throw new Error(error);
      }

      var type = currentPaymentType();
      var reservation = {
        id: String(Date.now()) + Math.random().toString(16).slice(2),
        createdAt: new Date().toISOString(),
        status: 'pending',
        paymentType: type,
        numbers: nums,
        ticketTotal: nums.length * PRICE,
        amount: nums.length * (type === 'partial' ? HALF : PRICE),
        amountPaid: 0,
        name: byId('customerName')?.value.trim() || '',
        document: byId('customerId')?.value.trim() || '',
        phone: byId('customerPhone')?.value.trim() || '',
        paymentRef: paymentRef,
        receipt: receipt
      };

      var data = await api('/api/reservations/create', { reservation: reservation });
      applyPublicList(data.reservations || []);
      resetForm(form);
      alert('Comprobante enviado. El número queda amarillo hasta verificación o pago completo.');
    } catch (error) {
      alert(error.message || 'No se pudo guardar el comprobante.');
    }
  }

  var form = byId('reservationForm');
  if (form) {
    form.onsubmit = submitToBackend;
    form.addEventListener('submit', submitToBackend, true);
  }
  window.submitReservationToBackend = submitToBackend;
});
