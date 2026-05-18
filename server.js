const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const BINANCE_API = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
const FIATS = ['VES', 'COP', 'CLP'];
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'reservations.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || crypto.randomBytes(32).toString('hex');
const ACTIVE_STATUSES = ['pending', 'partial', 'second_pending', 'paid'];
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 6;
const loginAttempts = new Map();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    })
  : null;

let dbReady = false;

app.use(express.json({ limit: '20mb' }));

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        return [
          decodeURIComponent(part.slice(0, index).trim()),
          decodeURIComponent(part.slice(index + 1).trim())
        ];
      })
  );
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Date.now() + 6 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(12).toString('hex')
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!crypto.timingSafeEqual(Buffer.from(sign(payload)), Buffer.from(signature))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.role === 'admin' && Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

function isAdmin(req) {
  return verifyToken(parseCookies(req).jj_admin_session);
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'No autorizado.' });
  next();
}

function loginAllowed(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0];
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter(time => now - time < LOGIN_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(ip, recent);
  return recent.length <= MAX_LOGIN_ATTEMPTS;
}

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

function cleanText(value, max = 120) {
  return String(value || '').replace(/[<>]/g, '').slice(0, max).trim();
}

function cleanReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  const type = cleanText(receipt.type, 50);
  const name = cleanText(receipt.name, 120);
  const data = String(receipt.data || '');
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/jpg'];
  if (!allowed.includes(type)) return null;
  if (!data.startsWith('data:')) return null;
  if (data.length > 16 * 1024 * 1024) return null;
  return { name, type, data };
}

function cleanReservation(r) {
  const paymentType = cleanText(r.paymentType, 30);
  return {
    ...r,
    id: cleanText(r.id, 80) || `${Date.now()}${Math.random().toString(16).slice(2)}`,
    createdAt: r.createdAt || new Date().toISOString(),
    status: cleanText(r.status, 30) || 'pending',
    paymentType,
    numbers: (Array.isArray(r.numbers) ? r.numbers : [])
      .map(n => String(n).padStart(2, '0'))
      .filter(n => /^\d{2}$/.test(n)),
    ticketTotal: Number(r.ticketTotal) || 0,
    amount: Number(r.amount) || 0,
    amountPaid: Number(r.amountPaid) || 0,
    name: cleanText(r.name, 120),
    document: cleanText(r.document, 30),
    phone: cleanText(r.phone, 30),
    paymentRef: cleanText(r.paymentRef, 40),
    secondPaymentRef: cleanText(r.secondPaymentRef, 40),
    receipt: cleanReceipt(r.receipt),
    secondReceipt: cleanReceipt(r.secondReceipt)
  };
}

function activeNumbers(list) {
  return new Set(list.filter(item => ACTIVE_STATUSES.includes(item.status)).flatMap(item => item.numbers || []));
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
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
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
  const body = { asset: 'USDT', fiat, merchantCheck: false, page: 1, payTypes: [], publisherType: null, rows: 20, tradeType: 'BUY' };
  const response = await fetch(BINANCE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 JJRifas Railway Server' },
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

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD no está configurada en Railway.' });
  if (!loginAllowed(req)) return res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera unos minutos.' });
  if (req.body?.password !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, error: 'Clave incorrecta.' });

  res.cookie('jj_admin_session', createToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 6 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('jj_admin_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ ok: true, admin: isAdmin(req) });
});

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

app.get('/api/admin/reservations', requireAdmin, async (_req, res) => {
  try {
    const reservations = await readReservations();
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, reservations, storage: pool ? 'postgres' : 'file' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error leyendo comprobantes.' });
  }
});

app.post('/api/reservations/create', async (req, res) => {
  try {
    const reservation = cleanReservation(req.body?.reservation || {});
    if (!reservation.numbers.length) return res.status(400).json({ ok: false, error: 'Selecciona números válidos.' });
    if (!['full', 'partial'].includes(reservation.paymentType)) return res.status(400).json({ ok: false, error: 'Modalidad inválida.' });
    if (!reservation.name || !reservation.document || !reservation.phone || !reservation.paymentRef || !reservation.receipt) {
      return res.status(400).json({ ok: false, error: 'Faltan datos o comprobante inválido.' });
    }

    const list = await readReservations();
    const busy = activeNumbers(list);
    const unavailable = reservation.numbers.filter(number => busy.has(number));
    if (unavailable.length) return res.status(409).json({ ok: false, error: `Números no disponibles: ${unavailable.join(', ')}` });

    list.unshift(reservation);
    await writeReservations(list);
    res.json({ ok: true, reservation: publicReservation(reservation), reservations: list.map(publicReservation) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error creando reserva.' });
  }
});

app.post('/api/reservations/second-payment', async (req, res) => {
  try {
    const { numbers, paymentRef, receipt } = req.body || {};
    const secondReceipt = cleanReceipt(receipt);
    if (!Array.isArray(numbers) || !numbers.length || !secondReceipt) return res.status(400).json({ ok: false, error: 'Segundo pago inválido.' });

    const list = await readReservations();
    const updated = [];
    for (const number of numbers.map(n => String(n).padStart(2, '0'))) {
      const item = list.find(r => Array.isArray(r.numbers) && r.numbers.includes(number) && r.status === 'partial');
      if (item) {
        item.status = 'second_pending';
        item.secondPaymentRef = cleanText(paymentRef, 40);
        item.secondReceipt = secondReceipt;
        item.secondReportedAt = new Date().toISOString();
        item.amount = (item.amount || 10) + 10;
        updated.push(number);
      }
    }

    if (!updated.length) return res.status(404).json({ ok: false, error: 'No se encontraron números con pago parcial aprobado.' });
    await writeReservations(list);
    res.json({ ok: true, updated, reservations: list.map(publicReservation) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error reportando segundo pago.' });
  }
});

app.post('/api/admin/action', requireAdmin, async (req, res) => {
  try {
    const { action, id } = req.body || {};
    let list = await readReservations();

    if (action === 'reset') {
      await writeReservations([]);
      return res.json({ ok: true, reservations: [] });
    }

    const item = list.find(r => r.id === id);
    if (!item) return res.status(404).json({ ok: false, error: 'Registro no encontrado.' });

    if (action === 'approve') {
      if (item.paymentType === 'partial') {
        item.status = 'partial';
        item.amountPaid = (item.numbers || []).length * 10;
      } else {
        item.status = 'paid';
        item.amountPaid = (item.numbers || []).length * 20;
      }
    } else if (action === 'approveSecond') {
      item.status = 'paid';
      item.amountPaid = (item.numbers || []).length * 20;
      item.completedAt = new Date().toISOString();
    } else if (action === 'reject') {
      item.status = 'rejected';
    } else {
      return res.status(400).json({ ok: false, error: 'Acción inválida.' });
    }

    await writeReservations(list);
    res.json({ ok: true, reservations: list });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'Error ejecutando acción.' });
  }
});

app.put('/api/reservations', requireAdmin, async (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : req.body?.reservations;
    if (!Array.isArray(incoming)) return res.status(400).json({ ok: false, error: 'Formato inválido.' });

    const existing = await readReservations();
    const byId = new Map(existing.map(item => [item.id, item]));
    const reservations = incoming.map(item => ({ ...(byId.get(item.id) || {}), ...cleanReservation(item) }));

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

app.get('/app-v2.js', async (_req, res) => {
  let js = await fs.readFile(path.join(__dirname, 'app-v2.js'), 'utf8');
  js = js.replace(/const ADMIN\s*=\s*\[[\s\S]*?;\n/, 'const ADMIN = "__SERVER_AUTH__";\n');
  res.type('application/javascript').send(js);
});

app.use(express.static(__dirname, {
  index: false,
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  }
}));

app.get('/.netlify/functions/binance-rate', (req, res) => {
  req.url = '/api/binance-rate';
  app._router.handle(req, res);
});

app.get('*', async (_req, res) => {
  let html = await fs.readFile(path.join(__dirname, 'index.html'), 'utf8');
  if (!html.includes('secure-admin.js')) html = html.replace('</body>', '<script src="secure-admin.js"></script></body>');
  res.type('html').send(html);
});

app.listen(PORT, () => {
  console.log(`JJRifas secure server running on port ${PORT}`);
  console.log(`Storage: ${pool ? 'PostgreSQL' : 'local file fallback'}`);
});
