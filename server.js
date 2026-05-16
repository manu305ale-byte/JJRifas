const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const BINANCE_API = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const FIATS = ['VES', 'COP', 'CLP'];
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reservations.json');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    })
  : null;

let dbReady = false;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname, {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  }
}));

function publicReservation(r) {
  return {
    id: r.id,
    status: r.status,
    paymentType: r.paymentType,
    numbers: Array.isArray(r.numbers) ? r.numbers : [],
    ticketTotal: r.ticketTotal,
    amount: r.amount,
    amountPaid: r.amountPaid || 0,
    createdAt: r.createdAt,
    completedAt: r.completedAt || null,
    secondReportedAt: r.secondReportedAt || null
  };
}

async function initDatabase() {
  if (!pool || dbReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    INSERT INTO app_state (key, value)
    VALUES ('reservations', '[]'::jsonb)
    ON CONFLICT (key) DO NOTHING
  `);

  dbReady = true;
}

async function readReservationsFromFile() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeReservationsToFile(reservations) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(reservations, null, 2), 'utf8');
}

async function readReservations() {
  if (pool) {
    await initDatabase();
    const result = await pool.query("SELECT value FROM app_state WHERE key = 'reservations' LIMIT 1");
    const value = result.rows[0]?.value;
    return Array.isArray(value) ? value : [];
  }
  return readReservationsFromFile();
}

async function writeReservations(reservations) {
  if (pool) {
    await initDatabase();
    await pool.query(
      `UPDATE app_state SET value = $1::jsonb, updated_at = NOW() WHERE key = 'reservations'`,
      [JSON.stringify(reservations)]
    );
    return;
  }
  await writeReservationsToFile(reservations);
}

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

  if (!response.ok) throw new Error(`Binance ${fiat} HTTP ${response.status}`);

  const data = await response.json();
  const prices = (data?.data || [])
    .map(item => Number(String(item?.adv?.price || '').replace(',', '.')))
    .filter(price => Number.isFinite(price) && price > 0);

  if (!prices.length) throw new Error(`No se pudo detectar la tasa USDT/${fiat}.`);

  return { fiat, rate: Math.max(...prices), sampledAds: prices.length };
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
      platform: pool ? 'railway-postgres' : 'railway-file',
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error consultando Binance P2P.' });
  }
});

app.get('/api/reservations', async (_req, res) => {
  try {
    const reservations = await readReservations();
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, reservations: reservations.map(publicReservation), storage: pool ? 'postgres' : 'file' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error leyendo reservas.' });
  }
});

app.put('/api/reservations', async (req, res) => {
  try {
    const reservations = Array.isArray(req.body) ? req.body : req.body?.reservations;
    if (!Array.isArray(reservations)) {
      return res.status(400).json({ ok: false, error: 'Formato inválido. Se esperaba un arreglo de reservas.' });
    }
    await writeReservations(reservations);
    res.json({ ok: true, reservations: reservations.map(publicReservation), storage: pool ? 'postgres' : 'file' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error guardando reservas.' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    if (pool) await initDatabase();
    res.json({ ok: true, storage: pool ? 'postgres' : 'file', dbReady: Boolean(dbReady), timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ ok: false, storage: 'postgres-error', error: error.message });
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
  console.log(`Storage: ${pool ? 'PostgreSQL' : 'local file fallback'}`);
});
