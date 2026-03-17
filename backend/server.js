const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const cookieParser = require('cookie-parser');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'stock-oracle-dev-secret-change-in-prod';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ========== DATABASE SETUP ==========
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'stockoracle.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    name TEXT,
    avatar TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    company TEXT,
    signal TEXT,
    confidence INTEGER,
    price REAL,
    result_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TEXT NOT NULL
  );
`);

// Prepared statements
const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (github_id, username, name, avatar)
    VALUES (@github_id, @username, @name, @avatar)
    ON CONFLICT(github_id) DO UPDATE SET
      username = excluded.username,
      name = excluded.name,
      avatar = excluded.avatar
  `),
  getUserByGithubId: db.prepare('SELECT * FROM users WHERE github_id = ?'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertHistory: db.prepare(`
    INSERT INTO history (user_id, ticker, company, signal, confidence, price, result_json)
    VALUES (@user_id, @ticker, @company, @signal, @confidence, @price, @result_json)
  `),
  getHistory: db.prepare(`
    SELECT id, ticker, company, signal, confidence, price, created_at
    FROM history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `),
  getHistoryEntry: db.prepare('SELECT * FROM history WHERE id = ? AND user_id = ?'),
  deleteHistoryEntry: db.prepare('DELETE FROM history WHERE id = ? AND user_id = ?'),
  getRateLimit: db.prepare('SELECT * FROM rate_limits WHERE key = ?'),
  upsertRateLimit: db.prepare(`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (@key, @count, @window_start)
    ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start
  `),
};

// ========== CUSTOM GROQ RATE LIMITER ==========
// Per-user (JWT) when logged in, per-cookie (anonymous ID) when not.
// Cookie persists 365 days so it works across mobile/desktop sessions.

function getRateLimitKey(req, res) {
  // If logged in, use user ID
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), JWT_SECRET);
      return { key: `user:${payload.userId}`, scope: 'account' };
    } catch {}
  }
  // Use persistent anonymous cookie ID
  let anonId = req.cookies?.so_anon_id;
  if (!anonId) {
    anonId = crypto.randomUUID();
    res.cookie('so_anon_id', anonId, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });
  }
  return { key: `anon:${anonId}`, scope: 'device' };
}

function getTodayWindowStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function groqRateLimit(req, res, next) {
  const { key } = getRateLimitKey(req, res);
  const windowStr = getTodayWindowStart();
  const row = stmts.getRateLimit.get(key);

  if (row && row.window_start === windowStr) {
    if (row.count >= 3) {
      const resetTime = new Date(windowStr);
      resetTime.setDate(resetTime.getDate() + 1);
      return res.status(429).json({
        error: 'Daily analysis limit reached (3 per day). Please try again tomorrow.',
        resetsAt: resetTime.toISOString(),
      });
    }
    stmts.upsertRateLimit.run({ key, count: row.count + 1, window_start: windowStr });
  } else {
    stmts.upsertRateLimit.run({ key, count: 1, window_start: windowStr });
  }
  next();
}

function groqRateLimitStatus(req, res) {
  const { key, scope } = getRateLimitKey(req, res);
  const windowStr = getTodayWindowStart();
  const row = stmts.getRateLimit.get(key);
  const count = (row && row.window_start === windowStr) ? row.count : 0;
  const resetTime = new Date(windowStr);
  resetTime.setDate(resetTime.getDate() + 1);

  res.json({
    used: count,
    limit: 3,
    remaining: Math.max(0, 3 - count),
    resetsAt: resetTime.toISOString(),
    scope,
    isLoggedIn: scope === 'account',
  });
}

// ========== MIDDLEWARE ==========
app.set('trust proxy', 1);

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ========== AUTH MIDDLEWARE ==========
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ========== RATE LIMITING ==========
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Only rate-limit the expensive external proxy routes, not auth/history
app.use('/api/twelve/', apiLimiter);
app.use('/api/finnhub/', apiLimiter);
app.use('/api/news', apiLimiter);
app.use('/api/alpha/', apiLimiter);
app.use('/api/sec/', apiLimiter);

// ========== STARTUP CHECK ==========
console.log('========== STOCK ORACLE BACKEND STARTUP ==========');
console.log('Node environment:', process.env.NODE_ENV || 'development');
const requiredKeys = ['GROQ_KEY', 'TWELVEDATA_KEY', 'FINNHUB_KEY', 'NEWSAPI_KEY', 'ALPHAVANTAGE_KEY'];
requiredKeys.forEach(key => {
  console.log(`${key}: ${process.env[key] ? '✅ Found' : '❌ MISSING'}`);
});
console.log(`GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID ? '✅ Found' : '❌ MISSING'}`);
console.log('================================================\n');

// ========== GITHUB OAUTH ==========
app.get('/api/auth/github', (req, res) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.BACKEND_URL || `https://${req.get('host')}`}/api/auth/github/callback`,
    scope: 'read:user',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get('/api/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${FRONTEND_URL}?auth=error`);

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code },
      { headers: { Accept: 'application/json' } }
    );
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('No access token');

    // Fetch GitHub user profile
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    const ghUser = userRes.data;

    // Upsert user in DB
    stmts.upsertUser.run({
      github_id: String(ghUser.id),
      username: ghUser.login,
      name: ghUser.name || ghUser.login,
      avatar: ghUser.avatar_url,
    });
    const user = stmts.getUserByGithubId.get(String(ghUser.id));

    // Issue JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    // Redirect to frontend with token
    res.redirect(`${FRONTEND_URL}?token=${token}`);
  } catch (err) {
    console.error('GitHub OAuth error:', err.message);
    res.redirect(`${FRONTEND_URL}?auth=error`);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = stmts.getUserById.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, name: user.name, avatar: user.avatar });
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true });
});

// ========== HISTORY ENDPOINTS ==========
app.get('/api/history', requireAuth, (req, res) => {
  const rows = stmts.getHistory.all(req.userId);
  res.json(rows);
});

app.post('/api/history', requireAuth, (req, res) => {
  const { ticker, company, signal, confidence, price, result } = req.body;
  if (!ticker || !result) return res.status(400).json({ error: 'Missing ticker or result' });
  stmts.insertHistory.run({
    user_id: req.userId,
    ticker: ticker.toUpperCase(),
    company: company || ticker,
    signal: signal || 'HOLD',
    confidence: confidence || 0,
    price: price || 0,
    result_json: JSON.stringify(result),
  });
  res.json({ ok: true });
});

app.get('/api/history/:id', requireAuth, (req, res) => {
  const row = stmts.getHistoryEntry.get(parseInt(req.params.id), req.userId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, result: JSON.parse(row.result_json) });
});

app.delete('/api/history/:id', requireAuth, (req, res) => {
  stmts.deleteHistoryEntry.run(parseInt(req.params.id), req.userId);
  res.json({ ok: true });
});

// ========== HELPER ==========
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ========== DEBUG ==========
app.get('/api/debug-env', (req, res) => {
  const envStatus = {};
  requiredKeys.forEach(key => { envStatus[key] = !!process.env[key]; });
  res.json({ status: 'debug', environment: envStatus, timestamp: new Date().toISOString() });
});

// ========== TWELVE DATA PROXIES ==========
app.get('/api/twelve/quote', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.TWELVEDATA_KEY) throw new Error('TWELVEDATA_KEY not configured');
    const response = await axios.get(
      `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVEDATA_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Twelve Data quote error:', error.message);
    if (error.response) return res.status(error.response.status).json({ error: error.response.data?.message || 'Twelve Data API error' });
    if (error.request) return res.status(503).json({ error: 'Twelve Data service unavailable' });
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/twelve/time-series', async (req, res) => {
  try {
    const { symbol, interval, outputsize } = req.query;
    if (!process.env.TWELVEDATA_KEY) throw new Error('TWELVEDATA_KEY not configured');
    const response = await axios.get(
      `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${process.env.TWELVEDATA_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Twelve Data time-series error:', error.message);
    if (error.response) return res.status(error.response.status).json({ error: error.response.data?.message || 'Twelve Data API error' });
    if (error.request) return res.status(503).json({ error: 'Twelve Data service unavailable' });
    return res.status(500).json({ error: error.message });
  }
});

// ========== FINNHUB PROXIES ==========
const handleFinnhubError = (error, res) => {
  console.error('Finnhub error:', error.message);
  if (error.response) {
    if (error.response.status === 429) return res.status(429).json({ error: 'Finnhub API rate limit reached.' });
    return res.status(error.response.status).json({ error: error.response.data?.error || 'Finnhub API error' });
  }
  if (error.request) return res.status(503).json({ error: 'Finnhub service unavailable' });
  return res.status(500).json({ error: error.message });
};

app.get('/api/finnhub/news', async (req, res) => {
  try {
    const { symbol, from, to } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${process.env.FINNHUB_KEY}`);
    res.json(response.data);
  } catch (error) { handleFinnhubError(error, res); }
});

app.get('/api/finnhub/recommendation', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`);
    res.json(response.data);
  } catch (error) { handleFinnhubError(error, res); }
});

app.get('/api/finnhub/metric', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${process.env.FINNHUB_KEY}`);
    res.json(response.data);
  } catch (error) { handleFinnhubError(error, res); }
});

app.get('/api/finnhub/insider', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`);
    res.json(response.data);
  } catch (error) { handleFinnhubError(error, res); }
});

app.get('/api/finnhub/earnings', async (req, res) => {
  try {
    const { symbol, limit } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=${limit}&token=${process.env.FINNHUB_KEY}`);
    res.json(response.data);
  } catch (error) { handleFinnhubError(error, res); }
});

app.get('/api/finnhub/profile', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`);
    res.json(response.data);
  } catch (error) { handleFinnhubError(error, res); }
});

app.get('/api/finnhub/earnings-calendar', async (req, res) => {
  try {
    const { symbol, from, to } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${process.env.FINNHUB_KEY}`);
    res.json(response.data);
  } catch (error) { handleFinnhubError(error, res); }
});

// ========== NEWSAPI PROXY ==========
app.get('/api/news', async (req, res) => {
  try {
    const { q, pageSize } = req.query;
    if (!process.env.NEWSAPI_KEY) throw new Error('NEWSAPI_KEY not configured');
    const response = await axios.get(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&sortBy=publishedAt&pageSize=${pageSize}&language=en&apiKey=${process.env.NEWSAPI_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('NewsAPI error:', error.message);
    if (error.response) {
      if (error.response.status === 429) return res.status(429).json({ error: 'NewsAPI rate limit reached.' });
      return res.status(error.response.status).json({ error: error.response.data?.message || 'NewsAPI error' });
    }
    if (error.request) return res.status(503).json({ error: 'NewsAPI service unavailable' });
    return res.status(500).json({ error: error.message });
  }
});

// ========== ALPHA VANTAGE PROXY ==========
app.get('/api/alpha/sentiment', async (req, res) => {
  try {
    const { tickers, limit } = req.query;
    if (!process.env.ALPHAVANTAGE_KEY) throw new Error('ALPHAVANTAGE_KEY not configured');
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${tickers}&limit=${limit}&apikey=${process.env.ALPHAVANTAGE_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Alpha Vantage error:', error.message);
    if (error.response) {
      if (error.response.status === 429) return res.status(429).json({ error: 'Alpha Vantage rate limit reached.' });
      return res.status(error.response.status).json({ error: error.response.data?.Note || 'Alpha Vantage error' });
    }
    if (error.request) return res.status(503).json({ error: 'Alpha Vantage service unavailable' });
    return res.status(500).json({ error: error.message });
  }
});

// ========== GROQ PROXY ==========
app.get('/api/groq/limit', groqRateLimitStatus);

app.post('/api/groq/analyse', groqRateLimit, async (req, res) => {
  try {
    if (!process.env.GROQ_KEY) throw new Error('GROQ_KEY not configured');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      req.body,
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_KEY}` } }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Groq error:', error.message);
    if (error.response && error.response.status === 429) return res.status(429).json({ error: 'Groq API rate limit reached.' });
    if (error.response) return res.status(error.response.status).json({ error: error.response.data?.error?.message || 'Groq API error' });
    if (error.request) return res.status(503).json({ error: 'Groq service unavailable' });
    return res.status(500).json({ error: error.message });
  }
});

// ========== SEC EDGAR PROXY ==========
app.get('/api/sec/filings/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const headers = { 'User-Agent': 'StockOracleApp (contact@stockoracle.com)' };

    await delay(200);
    const tickerMapRes = await axios.get('https://www.sec.gov/files/company_tickers.json', { headers });
    const tickerMap = tickerMapRes.data;
    let cik = null, companyName = '';

    for (const entry of Object.values(tickerMap)) {
      if (entry.ticker?.toLowerCase() === ticker.toLowerCase()) {
        cik = String(entry.cik_str).padStart(10, '0');
        companyName = entry.name;
        break;
      }
    }

    if (!cik) return res.json({ filings: [], companyName: null });

    await delay(200);
    const filingsRes = await axios.get(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers });
    const filings = filingsRes.data?.filings?.recent;
    if (!filings) return res.json({ filings: [], companyName });

    const form4s = [], form8Ks = [], form10Qs = [], form10Ks = [];
    filings.form.forEach((form, i) => {
      const filingDate = filings.filingDate?.[i];
      const accession = filings.accessionNumber?.[i];
      if (!filingDate) return;
      const filing = { form, date: filingDate, description: `Filed on ${filingDate}`, url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession?.replace(/-/g, '') || ''}/${accession || ''}.txt`, transactionType: 'unknown', isCompensatory: false };
      if (form === '4') form4s.push(filing);
      else if (form === '8-K') form8Ks.push(filing);
      else if (form === '10-Q') form10Qs.push(filing);
      else if (form === '10-K') form10Ks.push(filing);
    });

    const allFilings = [...form4s.slice(0, 8), ...form8Ks.slice(0, 3), ...form10Qs.slice(0, 2), ...form10Ks.slice(0, 1)].slice(0, 12);
    res.json({ filings: allFilings, companyName, cik, counts: { form4: form4s.length, form8K: form8Ks.length, form10Q: form10Qs.length, form10K: form10Ks.length } });
  } catch (error) {
    console.error('SEC EDGAR error:', error.message);
    if (error.response) {
      if (error.response.status === 429) return res.status(429).json({ error: 'SEC EDGAR rate limit reached.' });
      return res.status(error.response.status).json({ error: 'Failed to fetch SEC data' });
    }
    if (error.request) return res.status(503).json({ error: 'SEC EDGAR service unavailable' });
    return res.status(500).json({ error: 'Failed to fetch SEC data', details: error.message });
  }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Stock Oracle Backend is running', time: new Date().toISOString() });
});

// ========== SERVE FRONTEND ==========
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ========== START ==========
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔐 GitHub OAuth: http://localhost:${PORT}/api/auth/github`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
});
