exports.handler = async function () {
  const API_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  const FIATS = ['VES', 'COP', 'CLP'];

  async function getHighestRate(fiat) {
    const body = {
      asset: 'USDT',
      fiat,
      merchantCheck: false,
      page: 1,
      payTypes: [],
      publisherType: null,
      rows: 20,
      tradeType: 'BUY'
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 JJRifas Netlify Function'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Binance ${fiat} HTTP ${response.status}`);

    const data = await response.json();
    const prices = (data?.data || [])
      .map(item => Number(String(item?.adv?.price || '').replace(',', '.')))
      .filter(price => Number.isFinite(price) && price > 0);

    if (!prices.length) throw new Error(`No se pudo detectar la tasa USDT/${fiat}.`);

    return {
      fiat,
      rate: Math.max(...prices),
      sampledAds: prices.length
    };
  }

  try {
    const results = await Promise.all(FIATS.map(getHighestRate));
    const rates = Object.fromEntries(results.map(item => [item.fiat, item.rate]));
    const sampledAds = Object.fromEntries(results.map(item => [item.fiat, item.sampledAds]));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        rate: rates.VES,
        rates,
        source: 'binance-p2p-usdt-multi-fiat-highest-buy-page-1',
        mode: 'highest-rate',
        sampledAds,
        updatedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ok: false, error: error.message || 'Error consultando Binance P2P.' })
    };
  }
};
