window.addEventListener('load', function () {
  var KEY = 'jjrifas_v6_final_00_99';
  var PRICE = 20;
  var HALF = 10;
  var MAX_IMAGE_WIDTH = 1400;
  var MAX_IMAGE_HEIGHT = 1400;
  var IMAGE_QUALITY = 0.72;

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
  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  function loadImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }
  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }
  async function compressImage(file) {
    var originalData = await readAsDataUrl(file);
    var img = await loadImage(originalData);
    var width = img.naturalWidth || img.width;
    var height = img.naturalHeight || img.height;
    var scale = Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);
    var targetWidth = Math.max(1, Math.round(width * scale));
    var targetHeight = Math.max(1, Math.round(height * scale));
    var canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    var blob = await canvasToBlob(canvas, 'image/jpeg', IMAGE_QUALITY);
    if (!blob) return { name: file.name, type: file.type, data: originalData };
    var compressedData = await readAsDataUrl(blob);
    if (compressedData.length >= originalData.length) return { name: file.name, type: file.type, data: originalData };
    var cleanName = String(file.name || 'comprobante').replace(/\.[^.]+$/, '') + '-comprimido.jpg';
    return { name: cleanName, type: 'image/jpeg', data: compressedData };
  }
  async function readFile(file) {
    if ((file.type || '').startsWith('image/')) return compressImage(file);
    var data = await readAsDataUrl(file);
    return { name: file.name, type: file.type, data: data };
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

      var submitButton = form ? form.querySelector('button[type="submit"]') : null;
      var oldButtonText = submitButton ? submitButton.textContent : '';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Comprimiendo y enviando...';
      }

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
    } finally {
      var form2 = byId('reservationForm');
      var submitButton2 = form2 ? form2.querySelector('button[type="submit"]') : null;
      if (submitButton2) {
        submitButton2.disabled = false;
        submitButton2.textContent = 'Enviar comprobante para verificar';
      }
    }
  }

  var form = byId('reservationForm');
  if (form) {
    form.onsubmit = submitToBackend;
    form.addEventListener('submit', submitToBackend, true);
  }
  window.submitReservationToBackend = submitToBackend;
});
