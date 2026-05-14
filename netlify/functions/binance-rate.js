exports.handler = async function () {
  const API_URL = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

  const body = {
    asset: 'USDT',
    fiat: 'VES',
    merchantCheck: false,
    page: 1,
    payTypes: [],
    publisherType: null,
    rows: 1,
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
    const price = data?.data?.[0]?.adv?.price;
    const rate = Number(String(price || '').replace(',', '.'));

    if (!Number.isFinite(rate) || rate <= 0) {
      return {
        statusCode: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ok: false, error: 'No se pudo detectar la tasa USDT/VES.' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ok: true, rate, source: 'binance-p2p-usdt-ves', updatedAt: new Date().toISOString() })
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
