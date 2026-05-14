(() => {
  const API_URL = 'https://cotizave.com/api-p2p-venezuela';
  const REFRESH_MINUTES = 10;
  const CACHE_KEY = 'jjrifas_cotizave_rate_cache';

  function formatBs(value) {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value).replace('VES', 'Bs');
  }

  function looksLikeRate(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 20 && n < 10000;
  }

  function extractRate(data) {
    const priorityKeys = [
      'promedio', 'average', 'avg', 'precio', 'price', 'rate', 'tasa',
      'cotizacion', 'cotización', 'venta', 'sell', 'p2p', 'usdt', 'usd', 'bs', 'ves'
    ];

    const candidates = [];

    function walk(value, path = '') {
      if (looksLikeRate(value)) {
        const lowerPath = path.toLowerCase();
        const score = priorityKeys.reduce((sum, key) => sum + (lowerPath.includes(key) ? 10 : 0), 0);
        candidates.push({ value: Number(value), score, path });
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, `${path}.${index}`));
        return;
      }

      if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, item]) => walk(item, path ? `${path}.${key}` : key));
      }
    }

    walk(data);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || b.value - a.value);
    return candidates[0].value;
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
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const rate = extractRate(data);
      if (!rate) throw new Error('No se pudo detectar la tasa en la respuesta de Cotizave.');
      setCachedRate(rate);
      updateEquivalentElements(rate);
    } catch (error) {
      console.warn('No se pudo cargar la tasa de Cotizave:', error);
      if (!cachedRate) updateEquivalentElements(null);
    }
  }

  window.addEventListener('load', loadRate);
})();
