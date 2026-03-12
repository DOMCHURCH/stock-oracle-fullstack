const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const path = require('path');

// Load environment variables from .env file with absolute path
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// ========== STARTUP ENVIRONMENT CHECK ==========
console.log('========== STOCK ORACLE BACKEND STARTUP ==========');
console.log('Node environment:', process.env.NODE_ENV || 'development');
console.log('Current directory:', __dirname);
console.log('.env path:', path.join(__dirname, '.env'));

// Check each required key
const requiredKeys = [
  'GROQ_KEY',
  'TWELVEDATA_KEY',
  'FINNHUB_KEY',
  'NEWSAPI_KEY',
  'ALPHAVANTAGE_KEY'
];

requiredKeys.forEach(key => {
  const exists = !!process.env[key];
  console.log(`${key}: ${exists ? '✅ Found' : '❌ MISSING'}`);
  if (exists && key === 'GROQ_KEY') {
    console.log(`GROQ_KEY preview: ${process.env.GROQ_KEY.substring(0, 8)}...`);
  }
});
console.log('================================================\n');

// Helper function to delay requests (SEC rate limiting)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ========== DEBUG ENDPOINT - Check environment variables ==========
app.get('/api/debug-env', (req, res) => {
  const envStatus = {};
  requiredKeys.forEach(key => {
    envStatus[key] = !!process.env[key];
  });
  envStatus.GROQ_KEY_PREVIEW = process.env.GROQ_KEY ? process.env.GROQ_KEY.substring(0, 8) + '...' : null;
  envStatus.ALL_KEYS = Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('_KEY'));
  res.json({
    status: 'debug',
    message: 'Environment variables check',
    environment: envStatus,
    timestamp: new Date().toISOString()
  });
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
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// ========== FINNHUB PROXIES ==========
app.get('/api/finnhub/news', async (req, res) => {
  try {
    const { symbol, from, to } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${process.env.FINNHUB_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Finnhub news error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finnhub/recommendation', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Finnhub recommendation error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finnhub/metric', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${process.env.FINNHUB_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Finnhub metric error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finnhub/insider', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Finnhub insider error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finnhub/earnings', async (req, res) => {
  try {
    const { symbol, limit } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=${limit}&token=${process.env.FINNHUB_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Finnhub earnings error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finnhub/profile', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.FINNHUB_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Finnhub profile error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finnhub/earnings-calendar', async (req, res) => {
  try {
    const { symbol, from, to } = req.query;
    if (!process.env.FINNHUB_KEY) throw new Error('FINNHUB_KEY not configured');
    const response = await axios.get(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${symbol}&token=${process.env.FINNHUB_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('Finnhub earnings calendar error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========== NEWSAPI PROXY ==========
app.get('/api/news', async (req, res) => {
  try {
    const { q, pageSize } = req.query;
    if (!process.env.NEWSAPI_KEY) throw new Error('NEWSAPI_KEY not configured');
    const response = await axios.get(
      `https://newsapi.org/v2/everything?q=${q}&sortBy=publishedAt&pageSize=${pageSize}&language=en&apiKey=${process.env.NEWSAPI_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    console.error('NewsAPI error:', error.message);
    res.status(500).json({ error: error.message });
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
    res.status(500).json({ error: error.message });
  }
});

// ========== GROQ PROXY ==========
app.post('/api/groq/analyse', async (req, res) => {
  try {
    if (!process.env.GROQ_KEY) throw new Error('GROQ_KEY not configured');
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_KEY}`
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Groq error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ========== SEC EDGAR PROXY ==========
app.get('/api/sec/filings/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    console.log(`Fetching SEC filings for ${ticker}...`);
    
    const headers = { 
      'User-Agent': 'StockOracleApp contact@stockoracle.com' 
    };
    
    await delay(200);
    const tickerMapRes = await axios.get('https://www.sec.gov/files/company_tickers.json', { headers });
    
    const tickerMap = tickerMapRes.data;
    let cik = null;
    let companyName = '';
    
    for (const entry of Object.values(tickerMap)) {
      if (entry.ticker?.toLowerCase() === ticker.toLowerCase()) {
        cik = String(entry.cik_str).padStart(10, '0');
        companyName = entry.name;
        break;
      }
    }
    
    if (!cik) {
      return res.json({ filings: [], companyName: null });
    }
    
    await delay(200);
    const filingsRes = await axios.get(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers });
    
    const filings = filingsRes.data?.filings?.recent;
    if (!filings) {
      return res.json({ filings: [], companyName });
    }
    
    const form4s = [];
    const form8Ks = [];
    const form10Qs = [];
    const form10Ks = [];
    
    filings.form.forEach((form, i) => {
      const filingDate = filings.filingDate?.[i];
      const accession = filings.accessionNumber?.[i];
      
      if (!filingDate) return;
      
      const filing = {
        form,
        date: filingDate,
        description: `Filed on ${filingDate}`,
        url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession?.replace(/-/g, '') || ''}/${accession || ''}.txt`,
        transactionType: 'unknown',
        isCompensatory: false
      };
      
      if (form === '4') {
        form4s.push(filing);
      } else if (form === '8-K') {
        form8Ks.push(filing);
      } else if (form === '10-Q') {
        form10Qs.push(filing);
      } else if (form === '10-K') {
        form10Ks.push(filing);
      }
    });
    
    const allFilings = [
      ...form4s.slice(0, 8),
      ...form8Ks.slice(0, 3),
      ...form10Qs.slice(0, 2),
      ...form10Ks.slice(0, 1)
    ].slice(0, 12);
    
    res.json({ 
      filings: allFilings,
      companyName,
      cik,
      counts: {
        form4: form4s.length,
        form8K: form8Ks.length,
        form10Q: form10Qs.length,
        form10K: form10Ks.length
      }
    });
    
  } catch (error) {
    console.error('SEC EDGAR error:', error.message);
    res.status(500).json({ error: 'Failed to fetch SEC data', details: error.message });
  }
});

// ========== HEALTH CHECK ==========
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Stock Oracle Backend is running',
    time: new Date().toISOString()
  });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 SEC filings: http://localhost:${PORT}/api/sec/filings/AAPL`);
  console.log(`❤️ Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Debug env: http://localhost:${PORT}/api/debug-env`);
});
