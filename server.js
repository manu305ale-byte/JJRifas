const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BINANCE_API = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const FIATS = ['VES', 'COP', 'CLP'];

app.use(express.json());
app.use(express.static(__dirname, {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

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

  const response = await fetch(BINANCE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 JJRifas Railway Server'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Binance ${fiat} HTTP ${response.status}`);
  }

  const data = await response.json();
  const prices = (data?.data || [])
    .map(item => Number(String(item?.adv?.price || '').replace(',', '.')))
    .filter(price => Number.isFinite(price) && price > 0);

  if (!prices.length) {
    throw new Error(`No se pudo detectar la tasa USDT/${fiat}.`);
  }

  return {
    fiat,
    rate: Math.max(...prices),
    sampledAds: prices.length
  };
}

app.get('/api/binance-rate', async (_req, res) => {
  try {
    const results = await Promise.all(FIATS.map(getHighestRate));
    const rates = Object.fromEntries(results.map(item => [item.fiat, item.rate]));
    const sampledAds = Object.fromEntries(results.map(item => [item.fiat, item.sampledAds]));

    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      ok: true,
      rate: rates.VES,
      rates,
      source: 'binance-p2p-usdt-multi-fiat-highest-buy-page-1',
      mode: 'highest-rate',
      sampledAds,
      platform: 'railway',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'Error consultando Binance P2P.'
    });
  }
});

app.get('/.netlify/functions/binance-rate', (req, res) => {
  req.url = '/api/binance-rate';
  app._router.handle(req, res);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`JJRifas running on port ${PORT}`);
});
