exports.handler = async function () {
  const API_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

  const body = {
    asset: 'USDT',
    fiat: 'VES',
    merchantCheck: false,
    page: 1,
    payTypes: [],
    publisherType: null,
    rows: 20,
    tradeType: 'BUY'
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 JJRifas Netlify Function'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ok: false, error: `Binance HTTP ${response.status}` })
      };
    }

    const data = await response.json();
    const prices = (data?.data || [])
      .map(item => Number(String(item?.adv?.price || '').replace(',', '.')))
      .filter(price => Number.isFinite(price) && price > 0);

    if (!prices.length) {
      return {
        statusCode: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ok: false, error: 'No se pudo detectar la tasa USDT/VES.' })
      };
    }

    const rate = Math.max(...prices);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        rate,
        source: 'binance-p2p-usdt-ves-highest-buy-page-1',
        mode: 'highest-rate',
        sampledAds: prices.length,
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
