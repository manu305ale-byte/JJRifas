(() => {
  const API_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  const REFRESH_MINUTES = 10;
  const CACHE_KEY = 'jjrifas_binance_p2p_ves_rate_cache';

  const REQUEST_BODY = {
    asset: 'USDT',
    fiat: 'VES',
    merchantCheck: false,
    page: 1,
    payTypes: [],
    publisherType: null,
    rows: 1,
    tradeType: 'BUY'
  };

  function formatBs(value) {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value).replace('VES', 'Bs');
  }

  function extractRate(data) {
    const price = data?.data?.[0]?.adv?.price;
    const rate = Number(String(price || '').replace(',', '.'));
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  function getCachedRate() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached) return null;
      if (Date.now() - cached.savedAt > REFRESH_MINUTES * 60 * 1000) return null;
      return cached.rate;
    } catch {
      return null;
    }
  }

  function setCachedRate(rate) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, savedAt: Date.now() }));
  }

  function ensureEquivalentElements() {
    const ticketPrice = document.getElementById('ticketPrice');
    if (ticketPrice && !ticketPrice.querySelector('[data-bs-equivalent]')) {
      const span = document.createElement('span');
      span.dataset.bsEquivalent = '20';
      span.className = 'bs-equivalent bs-equivalent-main';
      span.textContent = 'Calculando Bs...';
      ticketPrice.appendChild(span);
    }

    document.querySelectorAll('.payment-option small, .payment-box p').forEach(element => {
      const text = element.textContent || '';
      const amount = text.includes('$10') ? 10 : text.includes('$20') ? 20 : null;
      if (!amount || element.querySelector('[data-bs-equivalent]')) return;
      const span = document.createElement('span');
      span.dataset.bsEquivalent = String(amount);
      span.className = 'bs-equivalent';
      span.textContent = ' · Calculando Bs...';
      element.appendChild(span);
    });
  }

  function updateEquivalentElements(rate) {
    document.querySelectorAll('[data-bs-equivalent]').forEach(element => {
      const usd = Number(element.dataset.bsEquivalent || 0);
      if (!rate || !usd) {
        element.textContent = element.classList.contains('bs-equivalent-main') ? 'Bs no disponible' : ' · Bs no disponible';
        return;
      }
      const text = `≈ ${formatBs(usd * rate)}`;
      element.textContent = element.classList.contains('bs-equivalent-main') ? text : ` · ${text}`;
    });
  }

  async function loadRate() {
    ensureEquivalentElements();

    const cachedRate = getCachedRate();
    if (cachedRate) updateEquivalentElements(cachedRate);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(REQUEST_BODY),
        cache: 'no-store'
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const rate = extractRate(data);
      if (!rate) throw new Error('No se pudo detectar la tasa USDT/VES en Binance P2P.');

      setCachedRate(rate);
      updateEquivalentElements(rate);
    } catch (error) {
      console.warn('No se pudo cargar la tasa Binance P2P:', error);
      if (!cachedRate) updateEquivalentElements(null);
    }
  }

  window.addEventListener('load', loadRate);
})();
