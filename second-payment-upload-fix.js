(() => {
  function activeSecondPay() {
    const picked = Array.from(document.querySelectorAll('.number-btn.selected'));
    return picked.length > 0 && picked.every(btn => btn.classList.contains('partial'));
  }

  function closestLabel(id) {
    const input = document.getElementById(id);
    return input ? input.closest('label') : null;
  }

  function noticeBox() {
    let box = document.getElementById('secondPaymentNotice');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'secondPaymentNotice';
    box.className = 'second-payment-notice hidden';
    box.innerHTML = '<strong>Terminar de pagar la totalidad</strong><span>Carga la referencia y el comprobante del segundo pago para que el administrador lo apruebe.</span>';
    document.getElementById('reservationForm')?.prepend(box);
    return box;
  }

  function setRequired(id, required) {
    const input = document.getElementById(id);
    if (!input) return;
    if (required) input.setAttribute('required', 'required');
    else input.removeAttribute('required');
  }

  function fillHiddenParticipantFields() {
    if (!activeSecondPay()) return;
    const values = {
      customerName: 'Segundo Pago',
      customerId: 'V-0000',
      customerPhone: '+580000000000'
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input && !input.value.trim()) input.value = value;
    });
  }

  function refreshSecondPayUi() {
    const mode = activeSecondPay();
    const title = document.querySelector('.checkout-header h2');
    const paymentOptions = document.querySelector('.payment-options');
    const card = document.querySelector('.checkout-card');
    const notice = noticeBox();

    if (title) title.textContent = mode ? 'Terminar de pagar la totalidad' : 'Datos del participante';
    notice.classList.toggle('hidden', !mode);
    paymentOptions?.classList.toggle('second-payment-mode-hidden', mode);
    card?.classList.toggle('second-mode', mode);

    ['customerName', 'customerId', 'customerPhone'].forEach(id => {
      closestLabel(id)?.classList.toggle('second-payment-mode-hidden', mode);
      setRequired(id, !mode);
    });

    closestLabel('paymentRef')?.classList.remove('second-payment-mode-hidden');
    closestLabel('receiptFile')?.classList.remove('second-payment-mode-hidden');
    setRequired('paymentRef', true);
    setRequired('receiptFile', true);

    document.querySelectorAll('#reservationForm .form-row').forEach(row => {
      const visible = Array.from(row.querySelectorAll('label')).filter(label => !label.classList.contains('second-payment-mode-hidden'));
      row.classList.toggle('second-payment-single-column', mode && visible.length === 1);
      row.classList.toggle('second-payment-mode-hidden', mode && visible.length === 0);
    });
  }

  document.addEventListener('click', e => {
    if (e.target.closest('.number-btn') || e.target.closest('#clearSelectionBtn') || e.target.closest('#selectRandomBtn')) {
      setTimeout(refreshSecondPayUi, 0);
      setTimeout(refreshSecondPayUi, 100);
    }
  });

  document.addEventListener('submit', e => {
    if (e.target?.id === 'reservationForm') fillHiddenParticipantFields();
  }, true);

  window.addEventListener('load', () => {
    refreshSecondPayUi();
    const grid = document.getElementById('numbersGrid');
    if (grid) new MutationObserver(refreshSecondPayUi).observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });

  setInterval(refreshSecondPayUi, 700);
})();
