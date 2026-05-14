(() => {
  const API_URL = '/.netlify/functions/binance-rate';
  const REFRESH_MINUTES = 10;
  const CACHE_KEY = 'jjrifas_binance_p2p_ves_rate_cache';

  function fallbackRate() {
    const configRate = Number(window.JJRIFAS_RATE_CONFIG?.fallbackRateVES);
    return Number.isFinite(configRate) && configRate > 0 ? configRate : null;
  }

  function formatBs(value) {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value).replace('VES', 'Bs');
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
      span.textContent = 'Consultando tasa...';
      ticketPrice.appendChild(span);
    }

    document.querySelectorAll('.payment-option small, .payment-box p').forEach(element => {
      const text = element.textContent || '';
      const amount = text.includes('$10') ? 10 : text.includes('$20') ? 20 : null;
      if (!amount || element.querySelector('[data-bs-equivalent]')) return;
      const span = document.createElement('span');
      span.dataset.bsEquivalent = String(amount);
      span.className = 'bs-equivalent';
      span.textContent = ' · Consultando tasa...';
      element.appendChild(span);
    });
  }

  function updateEquivalentElements(rate, isFallback = false) {
    document.querySelectorAll('[data-bs-equivalent]').forEach(element => {
      const usd = Number(element.dataset.bsEquivalent || 0);
      if (!rate || !usd) {
        element.textContent = element.classList.contains('bs-equivalent-main')
          ? 'Tasa API no disponible'
          : ' · Tasa API no disponible';
        return;
      }
      const text = `≈ ${formatBs(usd * rate)}${isFallback ? ' ref.' : ''}`;
      element.textContent = element.classList.contains('bs-equivalent-main') ? text : ` · ${text}`;
    });
  }

  async function loadRate() {
    ensureEquivalentElements();

    const cachedRate = getCachedRate();
    if (cachedRate) updateEquivalentElements(cachedRate);

    try {
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const rate = Number(data?.rate);
      if (!data?.ok || !Number.isFinite(rate) || rate <= 0) throw new Error(data?.error || 'Tasa no disponible.');
      setCachedRate(rate);
      updateEquivalentElements(rate);
    } catch (error) {
      console.warn('No se pudo cargar la tasa USDT/VES desde la API:', error);
      if (!cachedRate) updateEquivalentElements(fallbackRate(), Boolean(fallbackRate()));
    }
  }

  window.addEventListener('load', loadRate);
})();
