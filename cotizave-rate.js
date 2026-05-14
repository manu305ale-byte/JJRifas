(() => {
  const API_URL = '/.netlify/functions/binance-rate';
  const REFRESH_MINUTES = 10;
  const CACHE_KEY = 'jjrifas_binance_p2p_multi_rate_cache';

  const CURRENCIES = {
    VES: { label: 'Bs', locale: 'es-VE', decimals: 2 },
    COP: { label: 'COP', locale: 'es-CO', decimals: 0 },
    CLP: { label: 'CLP', locale: 'es-CL', decimals: 0 }
  };

  function fallbackRate() {
    const configRate = Number(window.JJRIFAS_RATE_CONFIG?.fallbackRateVES);
    return Number.isFinite(configRate) && configRate > 0 ? configRate : null;
  }

  function formatMoney(value, currency) {
    const config = CURRENCIES[currency] || CURRENCIES.VES;
    const formatted = new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    }).format(value);
    return `${config.label} ${formatted}`;
  }

  function getCachedRates() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached) return null;
      if (Date.now() - cached.savedAt > REFRESH_MINUTES * 60 * 1000) return null;
      return cached.rates;
    } catch {
      return null;
    }
  }

  function setCachedRates(rates) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, savedAt: Date.now() }));
  }

  function ensureEquivalentElements() {
    const ticketPrice = document.getElementById('ticketPrice');
    if (ticketPrice && !ticketPrice.querySelector('[data-usd-equivalent]')) {
      const box = document.createElement('span');
      box.dataset.usdEquivalent = '20';
      box.className = 'currency-equivalents currency-equivalents-main';
      box.textContent = 'Consultando tasas...';
      ticketPrice.appendChild(box);
    }

    document.querySelectorAll('.payment-option small, .payment-box p').forEach(element => {
      const text = element.textContent || '';
      const amount = text.includes('$10') ? 10 : text.includes('$20') ? 20 : null;
      if (!amount || element.querySelector('[data-usd-equivalent]')) return;
      const box = document.createElement('span');
      box.dataset.usdEquivalent = String(amount);
      box.className = 'currency-equivalents';
      box.textContent = ' · Consultando tasas...';
      element.appendChild(box);
    });
  }

  function buildLines(usd, rates) {
    if (!rates) return [];
    return ['VES', 'COP', 'CLP']
      .filter(currency => Number.isFinite(Number(rates[currency])) && Number(rates[currency]) > 0)
      .map(currency => `≈ ${formatMoney(usd * Number(rates[currency]), currency)}`);
  }

  function updateEquivalentElements(rates, isFallback = false) {
    document.querySelectorAll('[data-usd-equivalent]').forEach(element => {
      const usd = Number(element.dataset.usdEquivalent || 0);
      let finalRates = rates;

      if (!finalRates && fallbackRate()) {
        finalRates = { VES: fallbackRate() };
        isFallback = true;
      }

      const lines = buildLines(usd, finalRates);
      if (!usd || !lines.length) {
        element.innerHTML = element.classList.contains('currency-equivalents-main')
          ? '<span>Tasa API no disponible</span>'
          : '<span> · Tasa API no disponible</span>';
        return;
      }

      element.innerHTML = lines.map((line, index) => {
        const suffix = isFallback && index === 0 ? ' ref.' : '';
        return `<span>${line}${suffix}</span>`;
      }).join('');
    });
  }

  async function loadRate() {
    ensureEquivalentElements();

    const cachedRates = getCachedRates();
    if (cachedRates) updateEquivalentElements(cachedRates);

    try {
      const response = await fetch(API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const rates = data?.rates || (data?.rate ? { VES: data.rate } : null);
      if (!data?.ok || !rates || !Number.isFinite(Number(rates.VES))) throw new Error(data?.error || 'Tasas no disponibles.');
      setCachedRates(rates);
      updateEquivalentElements(rates);
    } catch (error) {
      console.warn('No se pudieron cargar las tasas USDT desde la API:', error);
      if (!cachedRates) updateEquivalentElements(null);
    }
  }

  window.addEventListener('load', loadRate);
})();
