window.addEventListener('load', function () {
  function esc(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char];
    });
  }

  function textStatus(status) {
    return ({
      available: 'Disponible',
      pending: 'Por verificar',
      partial: 'Pago parcial aprobado',
      second_pending: 'Segundo pago por verificar',
      paid: 'Pago completo aprobado',
      rejected: 'Rechazado'
    })[status] || status;
  }

  function preview(file, label) {
    if (!file) return '<p class="form-note">Sin comprobante</p>';
    if ((file.type || '').includes('image')) {
      return '<p class="form-note">' + esc(label) + '</p>' +
        '<button type="button" class="receipt-preview-button" onclick="openReceiptZoom(\'' + file.data + '\',\'' + esc(label) + '\')">' +
        '<img class="receipt-preview" src="' + file.data + '" alt="' + esc(label) + '">' +
        '<span>Haz clic para ampliar</span></button>';
    }
    return '<a class="btn btn-small" href="' + file.data + '" download="' + esc(file.name) + '">Descargar ' + esc(label) + '</a>';
  }

  function receiptInfo(title, ref, amount, date) {
    return '<div class="admin-receipt-info">' +
      '<h4>' + esc(title) + '</h4>' +
      '<p><strong>Monto reportado:</strong> $' + esc(amount || 0) + '</p>' +
      '<p><strong>Referencia:</strong> ' + esc(ref || 'Sin referencia') + '</p>' +
      (date ? '<p><strong>Fecha de reporte:</strong> ' + esc(new Date(date).toLocaleString()) + '</p>' : '') +
    '</div>';
  }

  function currentFilteredReservations() {
    if (typeof filteredReservations === 'function') return filteredReservations();
    return Array.isArray(reservations) ? reservations : [];
  }

  window.deleteReceipt = async function (id) {
    var item = (Array.isArray(reservations) ? reservations : []).find(function (entry) { return entry.id === id; });
    var numbers = item && item.numbers ? item.numbers.join(', ') : '';
    var ok = confirm('¿Eliminar este comprobante' + (numbers ? ' de los números ' + numbers : '') + '? Esta acción liberará los números asociados.');
    if (!ok) return;

    try {
      var adminResponse = await fetch('/api/admin/reservations', { cache: 'no-store' });
      var adminData = await adminResponse.json();
      if (!adminResponse.ok || !adminData.ok) throw new Error(adminData.error || 'No se pudo leer la lista completa.');

      var cleaned = (adminData.reservations || []).filter(function (entry) { return entry.id !== id; });
      var saveResponse = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservations: cleaned })
      });
      var saveData = await saveResponse.json();
      if (!saveResponse.ok || !saveData.ok) throw new Error(saveData.error || 'No se pudo eliminar el comprobante.');

      try { reservations = cleaned; } catch (_) {}
      localStorage.setItem('jjrifas_v6_final_00_99', JSON.stringify(cleaned));
      if (typeof render === 'function') render();
      if (typeof renderAdmin === 'function') renderAdmin();
      alert('Comprobante eliminado correctamente.');
    } catch (error) {
      alert(error.message || 'No se pudo eliminar el comprobante.');
    }
  };

  window.renderAdmin = function () {
    if (typeof isAdminActive === 'function' && !isAdminActive()) return;
    if (typeof refreshAdminSession === 'function') refreshAdminSession();
    var list = document.getElementById('adminList');
    if (!list) return;
    var data = currentFilteredReservations();
    if (!data.length) {
      list.innerHTML = '<p class="form-note">No hay registros para este filtro.</p>';
      return;
    }

    list.innerHTML = data.map(function (r) {
      var numbersCount = (r.numbers || []).length || 1;
      var initialAmount = r.paymentType === 'partial' ? numbersCount * 10 : numbersCount * 20;
      var secondAmount = r.secondReceipt ? numbersCount * 10 : 0;
      var secondRef = r.secondPaymentRef ? '<p><strong>Referencia segundo pago:</strong> ' + esc(r.secondPaymentRef) + '</p>' : '';
      var approveButton = r.status === 'pending' ? '<button class="btn btn-small btn-primary" onclick="approve(\'' + r.id + '\')">' + (r.paymentType === 'partial' ? 'Aprobar parcial' : 'Aprobar completo') + '</button>' : '';
      var approveSecond = r.status === 'second_pending' ? '<button class="btn btn-small btn-primary" onclick="approveSecond(\'' + r.id + '\')">Aprobar segundo pago</button>' : '';
      var rejectButton = ['pending', 'partial', 'second_pending'].includes(r.status) ? '<button class="btn btn-small btn-danger" onclick="reject(\'' + r.id + '\')">Rechazar y liberar</button>' : '';
      var releaseButton = r.status === 'paid' ? '<button class="btn btn-small btn-danger" onclick="reject(\'' + r.id + '\')">Liberar números</button>' : '';
      var deleteButton = '<button class="btn btn-small btn-danger" onclick="deleteReceipt(\'' + r.id + '\')">Eliminar comprobante</button>';
      var receiptDetails = receiptInfo('Información del comprobante inicial', r.paymentRef, initialAmount, r.createdAt) +
        (r.secondReceipt ? receiptInfo('Información del segundo comprobante', r.secondPaymentRef, secondAmount, r.secondReportedAt) : '');

      return '<article class="admin-item"><div>' +
        '<span class="status-pill status-' + esc(r.status) + '">' + textStatus(r.status) + '</span>' +
        '<h3>' + esc(r.name) + '</h3>' +
        '<p><strong>Números:</strong> ' + (r.numbers || []).join(', ') + '</p>' +
        '<p><strong>Modalidad:</strong> ' + (r.paymentType === 'partial' ? 'Pago parcial $10 + $10' : 'Pago completo $20') + '</p>' +
        '<p><strong>Total:</strong> $' + esc(r.ticketTotal) + '</p>' +
        '<p><strong>Reportado:</strong> $' + esc(r.amount) + '</p>' +
        '<p><strong>Aprobado:</strong> $' + esc(r.amountPaid || 0) + '</p>' +
        '<p><strong>Documento:</strong> ' + esc(r.document) + '</p>' +
        '<p><strong>Teléfono:</strong> ' + esc(r.phone) + '</p>' +
        '<p><strong>Referencia inicial:</strong> ' + esc(r.paymentRef) + '</p>' + secondRef +
        '<p><strong>Fecha:</strong> ' + new Date(r.createdAt).toLocaleString() + '</p>' +
        '</div><div>' + receiptDetails + preview(r.receipt, 'Comprobante inicial') + (r.secondReceipt ? preview(r.secondReceipt, 'Segundo comprobante') : '') +
        '<div class="admin-buttons">' + approveButton + approveSecond + rejectButton + releaseButton + deleteButton + '</div></div></article>';
    }).join('');
  };

  setTimeout(function () {
    if (typeof renderAdmin === 'function') renderAdmin();
  }, 500);
});
