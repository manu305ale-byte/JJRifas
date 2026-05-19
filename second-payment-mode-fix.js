(() => {
  function selectedButtons() {
    return Array.from(document.querySelectorAll('.number-btn.selected'));
  }

  function isSecondPaymentModeUi() {
    const selected = selectedButtons();
    return selected.length > 0 && selected.every(button => button.classList.contains('partial'));
  }

  function getCheckoutTitle() {
    return document.querySelector('.checkout-header h2');
  }

  function ensureNotice() {
    let notice = document.getElementById('secondPaymentNotice');
    if (notice) return notice;
    const form = document.getElementById('reservationForm');
    notice = document.createElement('div');
    notice.id = 'secondPaymentNotice';
    notice.className = 'second-payment-notice hidden';
    notice.innerHTML = '<strong>Terminar de pagar la totalidad</strong><span>Este número ya tiene un pago parcial aprobado. Solo debes cargar el comprobante del pago restante de $10 para completar la totalidad.</span>';
    form?.prepend(notice);
    return notice;
  }

  function ensureSecondPaymentOnlyOption() {
    let box = document.getElementById('secondPaymentOnlyOption');
    if (box) return box;
    const options = document.querySelector('.payment-options');
    box = document.createElement('div');
    box.id = 'secondPaymentOnlyOption';
    box.className = 'second-payment-only-option hidden';
    box.innerHTML = '<div><strong>Segundo pago parcial</strong><small>Pago restante habilitado: $10 por número</small></div>';
    options?.insertAdjacentElement('afterend', box);
    return box;
  }

  function setParticipantFieldsRequired(required) {
    ['customerName', 'customerId', 'customerPhone'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      if (required) input.setAttribute('required', 'required');
      else input.removeAttribute('required');
    });
  }

  function lockNormalPaymentOptions(mode) {
    const full = document.querySelector('input[name="paymentType"][value="full"]');
    const partial = document.querySelector('input[name="paymentType"][value="partial"]');
    const labels = Array.from(document.querySelectorAll('.payment-option'));
    const onlySecond = ensureSecondPaymentOnlyOption();

    if (mode) {
      if (full) {
        full.checked = false;
        full.disabled = true;
      }
      if (partial) {
        partial.checked = false;
        partial.disabled = true;
      }
      labels.forEach(label => {
        label.classList.add('payment-option-disabled');
        label.setAttribute('aria-disabled', 'true');
      });
      onlySecond.classList.remove('hidden');
    } else {
      if (full) {
        full.disabled = false;
        if (!partial?.checked) full.checked = true;
      }
      if (partial) partial.disabled = false;
      labels.forEach(label => {
        label.classList.remove('payment-option-disabled');
        label.removeAttribute('aria-disabled');
      });
      onlySecond.classList.add('hidden');
    }
  }

  function applySecondPaymentUi() {
    const mode = isSecondPaymentModeUi();
    const title = getCheckoutTitle();
    const notice = ensureNotice();
    const paymentOptions = document.querySelector('.payment-options');
    const formRows = Array.from(document.querySelectorAll('#reservationForm .form-row'));

    if (title) title.textContent = mode ? 'Terminar de pagar la totalidad' : 'Datos del participante';
    notice.classList.toggle('hidden', !mode);
    paymentOptions?.classList.toggle('second-payment-mode-hidden', mode);
    formRows.forEach(row => row.classList.toggle('second-payment-mode-hidden', mode));
    setParticipantFieldsRequired(!mode);
    lockNormalPaymentOptions(mode);

    if (typeof updateTotalReportedRates === 'function') setTimeout(updateTotalReportedRates, 30);
  }

  function prepareSecondPaymentSubmit() {
    if (!isSecondPaymentModeUi()) return;
    const name = document.getElementById('customerName');
    const doc = document.getElementById('customerId');
    const phone = document.getElementById('customerPhone');
    if (name && !name.value.trim()) name.value = 'Segundo Pago';
    if (doc && !doc.value.trim()) doc.value = 'V-0000';
    if (phone && !phone.value.trim()) phone.value = '+580000000000';
  }

  document.addEventListener('click', event => {
    if (event.target.closest('.number-btn') || event.target.closest('#clearSelectionBtn') || event.target.closest('#selectRandomBtn')) {
      setTimeout(applySecondPaymentUi, 0);
      setTimeout(applySecondPaymentUi, 80);
    }
  });

  document.addEventListener('change', event => {
    if (event.target && event.target.name === 'paymentType') setTimeout(applySecondPaymentUi, 0);
  });

  document.addEventListener('submit', event => {
    if (event.target && event.target.id === 'reservationForm') prepareSecondPaymentSubmit();
  }, true);

  const observer = new MutationObserver(applySecondPaymentUi);
  window.addEventListener('load', () => {
    const grid = document.getElementById('numbersGrid');
    if (grid) observer.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    ensureSecondPaymentOnlyOption();
    applySecondPaymentUi();
  });

  setInterval(applySecondPaymentUi, 700);
})();
