// Stock Oracle v3.1

import { useState, useRef, useEffect, useCallback } from "react";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const FEARGREED_URL = "https://api.alternative.me/fng/"; // Fear & Greed has no CORS issue — direct call ok

const TICKERS = ["AAPL","NVDA","TSLA","MSFT","GOOGL","AMZN","META","AMD","JPM","NFLX"];

const safeStr = (v) => v == null ? "" : String(v);

const SECTOR_COLORS = {
  tech: "#38bdf8", finance: "#f59e0b", energy: "#10b981",
  health: "#c084fc", etf: "#fb923c", crypto: "#f472b6", auto: "#34d399",
};

function Orb({ x, y, color, size }) {
  return (
    <div style={{
      position: "absolute", left: x, top: y,
      width: size, height: size, borderRadius: "50%",
      background: color, filter: "blur(80px)",
      opacity: 0.12, pointerEvents: "none",
    }} />
  );
}

function Ticker({ text, color }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 100,
      background: color + "18", border: `1px solid ${color}35`,
      fontSize: 10, fontWeight: 700, color, letterSpacing: "0.08em",
      textTransform: "uppercase",
    }}>{text}</span>
  );
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      transition: "border-color 0.2s",
    }}>
      <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function PredBar({ label, pct, horizon }) {
  const positive = (pct || 0) >= 0;
  const color = positive ? "#10b981" : "#ef4444";
  const width = Math.min(Math.abs(pct || 0) / 20 * 100, 100);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 100); }, []);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "baseline" }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>{horizon}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#334155" }}>{label}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>
            {positive ? "+" : ""}{(pct || 0).toFixed(2)}%
          </span>
        </div>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 100, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 100,
          background: `linear-gradient(90deg, ${color}90, ${color})`,
          width: animated ? `${width}%` : "0%",
          transition: "width 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          boxShadow: `0 0 12px ${color}60`,
        }} />
      </div>
    </div>
  );
}

function NewsCard({ item, delay }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), delay); }, [delay]);
  const sColor = { bullish: "#10b981", bearish: "#ef4444", neutral: "#f59e0b" }[safeStr(item.sentiment).toLowerCase()] || "#64748b";
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 10, marginBottom: 8,
      background: "rgba(255,255,255,0.025)",
      borderLeft: `3px solid ${sColor}`,
      border: `1px solid rgba(255,255,255,0.05)`,
      borderLeftColor: sColor,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(-16px)",
      transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.5, flex: 1, fontWeight: 500 }}>{item.headline}</div>
        <span style={{
          fontSize: 9, fontWeight: 800, color: sColor,
          background: sColor + "18", padding: "3px 8px", borderRadius: 100,
          letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0, alignSelf: "flex-start",
        }}>{item.sentiment}</span>
      </div>
      {item.source && <div style={{ fontSize: 10, color: "#334155", marginBottom: 5 }}>via {item.source}</div>}
      <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>{item.impact}</div>
    </div>
  );
}

function SignalRing({ signal, confidence }) {
  const cfg = {
    STRONG_BUY:  { label: "STRONG BUY",  color: "#10b981", icon: "▲▲", glow: "#10b98140" },
    BUY:         { label: "BUY",          color: "#34d399", icon: "▲",  glow: "#34d39930" },
    HOLD:        { label: "HOLD",         color: "#f59e0b", icon: "◆",  glow: "#f59e0b30" },
    SELL:        { label: "SELL",         color: "#f87171", icon: "▼",  glow: "#f8717130" },
    STRONG_SELL: { label: "STRONG SELL",  color: "#ef4444", icon: "▼▼", glow: "#ef444430" },
  }[signal] || { label: "HOLD", color: "#f59e0b", icon: "◆", glow: "#f59e0b30" };
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (confidence / 100) * circumference;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 110, height: 110 }}>
        <svg width="110" height="110" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="55" cy="55" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle cx="55" cy="55" r="40" fill="none"
            stroke={cfg.color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.5s ease", filter: `drop-shadow(0 0 8px ${cfg.color})` }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 18, lineHeight: 1 }}>{cfg.icon}</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: cfg.color, letterSpacing: "0.05em", marginTop: 2 }}>{confidence}%</div>
        </div>
      </div>
      <div style={{ padding: "6px 16px", borderRadius: 100, background: cfg.glow, border: `1px solid ${cfg.color}40`, fontSize: 11, fontWeight: 900, color: cfg.color, letterSpacing: "0.12em" }}>{cfg.label}</div>
    </div>
  );
}

function MiniChart({ prices }) {
  const canvasRef = useRef(null);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !prices?.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement?.offsetWidth || 300;
    const H = 80;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);
    const min = Math.min(...prices), max = Math.max(...prices), rng = max - min || 1;
    const pts = prices.map((v, i) => ({ x: (i / (prices.length - 1)) * W, y: H - 8 - ((v - min) / rng) * (H - 16) }));
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(56,189,248,0.3)"); grad.addColorStop(1, "rgba(56,189,248,0)");
    ctx.beginPath(); ctx.moveTo(pts[0].x, H);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  }, [prices]);
  useEffect(() => {
    if (!canvasRef.current) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvasRef.current.parentElement || canvasRef.current);
    draw();
    return () => ro.disconnect();
  }, [draw]);
  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}

export default function StockOracle() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const inputRef = useRef(null);

  // Check if user was rate limited in a previous session
  useEffect(() => {
    const limited = localStorage.getItem('stockOracleRateLimited');
    const limitExpiry = localStorage.getItem('stockOracleRateLimitExpiry');
    
    if (limited === 'true' && limitExpiry) {
      const expiryTime = parseInt(limitExpiry);
      const now = Date.now();
      
      if (now < expiryTime) {
        setRateLimited(true);
        const hoursLeft = Math.ceil((expiryTime - now) / (1000 * 60 * 60));
        setRateLimitMessage(`You have used all 3 analyses for today. ${hoursLeft} hours remaining until reset.`);
      } else {
        // Expired, clear it
        localStorage.removeItem('stockOracleRateLimited');
        localStorage.removeItem('stockOracleRateLimitExpiry');
      }
    }
  }, []);

  const PHASES = [
    "Connecting to market data feeds...",
    "Pulling 5-year price history...",
    "Loading fundamentals & analyst ratings...",
    "Scanning live news & global events...",
    "Analysing political & macro factors...",
    "Running technical indicator models...",
    "Generating prediction signals...",
    "Compiling intelligence report...",
  ];

  const analyse = useCallback(async (ticker) => {
    const t = (ticker || query).toUpperCase().trim();
    if (!t) return;
    setLoading(true); setResult(null); setError(null);
    let pi = 0; setPhase(PHASES[0]);
    const pt = setInterval(() => { pi = Math.min(pi + 1, PHASES.length - 1); setPhase(PHASES[pi]); }, 2000);
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const API_BASE = "https://stock-oracle-fullstack.onrender.com/api"; 

    try {
      // ── STEP 1: Twelve Data — live price + 5yr monthly history ──────────
      setPhase("Fetching live market data...");
      let livePrice = null, priceChange = null, priceChangePct = null;
      let week52High = null, week52Low = null, priceHistory = null;
      let rawPrices = [];
      try {
        const tdRes = await fetch(`${API_BASE}/twelve/quote?symbol=${t}`);
        if (tdRes.ok) {
          const td = await tdRes.json();
          if (td?.close && !td.code) {
            livePrice = parseFloat(td.close);
            priceChange = parseFloat(td.change);
            priceChangePct = parseFloat(td.percent_change);
            week52High = parseFloat(td.fifty_two_week?.high);
            week52Low = parseFloat(td.fifty_two_week?.low);
          }
        }
        const tsRes = await fetch(`${API_BASE}/twelve/time-series?symbol=${t}&interval=1month&outputsize=60`);
        if (tsRes.ok) {
          const ts = await tsRes.json();
          if (ts?.values?.length) {
            const vals = ts.values.reverse();
            rawPrices = vals.map(v => parseFloat(v.close));
            const years = ["2020","2021","2022","2023","2024","Now"];
            const indices = [0, 11, 23, 35, 47, vals.length - 1];
            priceHistory = years.map((yr, i) => {
              const v = vals[Math.min(indices[i], vals.length - 1)];
              const price = parseFloat(v?.close || 0);
              const prev = i > 0 ? parseFloat(vals[Math.min(indices[i-1], vals.length-1)]?.close || price) : price;
              const chg = prev ? (((price - prev) / prev) * 100).toFixed(0) : 0;
              return { year: yr, price, change: (chg >= 0 ? "+" : "") + chg + "%" };
            });
          }
        }
      } catch(e) { /* Twelve Data failed */ }

      // ── STEP 2: Calculate REAL indicators from price history ─────────────
      setPhase("Calculating real technical indicators...");
      let realTechnicals = null;
      if (rawPrices.length >= 14) {
        const calcRSI = (prices, period = 14) => {
          const changes = prices.slice(1).map((p, i) => p - prices[i]);
          const gains = changes.map(c => c > 0 ? c : 0);
          const losses = changes.map(c => c < 0 ? -c : 0);
          const avgGain = gains.slice(-period).reduce((a,b) => a+b, 0) / period;
          const avgLoss = losses.slice(-period).reduce((a,b) => a+b, 0) / period;
          if (avgLoss === 0) return 100;
          return Math.round(100 - (100 / (1 + avgGain / avgLoss)));
        };
        const calcEMA = (prices, period) => {
          const k = 2 / (period + 1);
          let ema = prices.slice(0, period).reduce((a,b) => a+b, 0) / period;
          for (let i = period; i < prices.length; i++) ema = prices[i]*k + ema*(1-k);
          return ema;
        };
        const calcSMA = (prices, period) => prices.slice(-period).reduce((a,b) => a+b, 0) / period;
        const rsi = calcRSI(rawPrices);
        const rsiLabel = rsi >= 65 ? "Overbought" : rsi <= 35 ? "Oversold" : "Neutral";
        const ema12 = calcEMA(rawPrices, Math.min(12, rawPrices.length));
        const ema26 = calcEMA(rawPrices, Math.min(26, rawPrices.length));
        const macdVal = ema12 - ema26;
        const macdStr = macdVal > 0 ? "Bullish \u2014 EMA12 above EMA26" : "Bearish \u2014 EMA12 below EMA26";
        const ma50 = calcSMA(rawPrices, Math.min(50, rawPrices.length));
        const ma200 = calcSMA(rawPrices, Math.min(200, rawPrices.length));
        const currentP = livePrice || rawPrices[rawPrices.length - 1];
        const aboveMa200 = currentP > ma200;
        const trend = currentP > ma50 && currentP > ma200 ? "Bullish" : currentP < ma50 && currentP < ma200 ? "Bearish" : "Neutral";
        const recent12 = rawPrices.slice(-12);
        const support = parseFloat(Math.min(...recent12).toFixed(2));
        const resistance = parseFloat(Math.max(...recent12).toFixed(2));
        realTechnicals = { rsi, rsiLabel, macd: macdStr, ma50: parseFloat(ma50.toFixed(2)), ma200: parseFloat(ma200.toFixed(2)), aboveMa200, trend, support, resistance };
      }

      // ── STEP 2b: Historical Volatility — real probability ranges ─────────
      let volatilityData = null;
      if (rawPrices.length >= 12) {
        // Monthly log returns
        const logReturns = rawPrices.slice(1).map((p, i) => Math.log(p / rawPrices[i]));
        const meanReturn = logReturns.reduce((a,b) => a+b, 0) / logReturns.length;
        const variance = logReturns.map(r => Math.pow(r - meanReturn, 2)).reduce((a,b) => a+b, 0) / logReturns.length;
        const monthlyVol = Math.sqrt(variance); // monthly std dev
        const annualVol = monthlyVol * Math.sqrt(12); // annualised

        // Scale to daily and weekly using square root of time
        const dailyVol = monthlyVol / Math.sqrt(21);   // ~21 trading days/month
        const weeklyVol = monthlyVol / Math.sqrt(4.3); // ~4.3 weeks/month
        const yearlyVol = annualVol;

        const cp = livePrice || rawPrices[rawPrices.length - 1];

        // 1 std dev = 68% probability range, 1.645 std dev = 90%
        const mkRange = (vol) => ({
          low68: parseFloat((cp * (1 - vol)).toFixed(2)),
          high68: parseFloat((cp * (1 + vol)).toFixed(2)),
          low90: parseFloat((cp * (1 - vol * 1.645)).toFixed(2)),
          high90: parseFloat((cp * (1 + vol * 1.645)).toFixed(2)),
          pct68: parseFloat((vol * 100).toFixed(1)),
          pct90: parseFloat((vol * 1.645 * 100).toFixed(1)),
        });

        volatilityData = {
          daily: mkRange(dailyVol),
          weekly: mkRange(weeklyVol),
          monthly: mkRange(monthlyVol),
          yearly: mkRange(yearlyVol),
          annualVolPct: parseFloat((annualVol * 100).toFixed(1)),
          monthlyVolPct: parseFloat((monthlyVol * 100).toFixed(1)),
        };
      }

      // ── STEP 3: Finnhub — news, analyst ratings, price targets, fundamentals, SEC filings ──
      setPhase("Loading analyst ratings & fundamentals...");
      let newsData = [], analystRatings = null, fundamentals = null, secFilings = [];
      let insiderTransactions = [], earningsSurprises = [], companyProfile = null;
      try {
        const now2 = new Date();
        const fromN = new Date(now2 - 7*24*60*60*1000).toISOString().split("T")[0];
        const toN = now2.toISOString().split("T")[0];
        const [nRes, recRes, metricRes, insiderRes, surprisesRes, profileRes] = await Promise.all([
          fetch(`${API_BASE}/finnhub/news?symbol=${t}&from=${fromN}&to=${toN}`),
          fetch(`${API_BASE}/finnhub/recommendation?symbol=${t}`),
          fetch(`${API_BASE}/finnhub/metric?symbol=${t}`),
          fetch(`${API_BASE}/finnhub/insider?symbol=${t}`),
          fetch(`${API_BASE}/finnhub/earnings?symbol=${t}&limit=4`),
          fetch(`${API_BASE}/finnhub/profile?symbol=${t}`),
        ]);
        try { if (nRes.ok) { const nJson = await nRes.json(); newsData = (nJson||[]).slice(0,10).map(n => ({ headline: n.headline, source: n.source, date: new Date(n.datetime*1000).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}), summary: n.summary?.slice(0,200) })); } } catch(e) {}
        try { if (recRes.ok) { const recJson = await recRes.json(); const latest = recJson?.[0]; if (latest) analystRatings = { strongBuy: latest.strongBuy||0, buy: latest.buy||0, hold: latest.hold||0, sell: latest.sell||0, strongSell: latest.strongSell||0, period: latest.period, total: (latest.strongBuy||0)+(latest.buy||0)+(latest.hold||0)+(latest.sell||0)+(latest.strongSell||0) }; } } catch(e) {}
        try { if (metricRes.ok) { const m = (await metricRes.json())?.metric || {}; fundamentals = { peRatio: m["peBasicExclExtraTTM"]||m["peTTM"], eps: m["epsTTM"], beta: m["beta"], revenueGrowth: m["revenueGrowthTTMYoy"], grossMargin: m["grossMarginTTM"], roe: m["roeTTM"] }; if (!week52High && m["52WeekHigh"]) week52High = m["52WeekHigh"]; if (!week52Low && m["52WeekLow"]) week52Low = m["52WeekLow"]; } } catch(e) {}
        // SEC filings now handled via backend proxy (Step 3b below)
        try { if (insiderRes.ok) { const insJson = await insiderRes.json(); const txns = insJson?.data||[]; const cutoff = new Date(Date.now()-90*24*60*60*1000).toISOString().split("T")[0]; const recent = txns.filter(tx => (tx.transactionDate||"") >= cutoff); const byPerson = {}; recent.forEach(tx => { const name = tx.name||"Unknown"; if (!byPerson[name]) byPerson[name]={name,buyVal:0,sellVal:0}; const val=Math.abs(tx.value||0); const isBuy = tx.transactionCode==="P" || tx.transactionCode==="A" || (tx.change!=null && tx.change>0); if(isBuy) byPerson[name].buyVal+=val; else byPerson[name].sellVal+=val; }); insiderTransactions = Object.values(byPerson).slice(0,6).map(p => ({ name:p.name, action:p.buyVal>=p.sellVal?"BUY":"SELL", buyVal:p.buyVal, sellVal:p.sellVal, summary: p.buyVal>0&&p.sellVal>0?`Bought $${(p.buyVal/1000).toFixed(0)}K, Sold $${(p.sellVal/1000).toFixed(0)}K`:p.buyVal>0?`Bought $${(p.buyVal/1000).toFixed(0)}K`:`Sold $${(p.sellVal/1000).toFixed(0)}K` })); } } catch(e) {}
        try { if (surprisesRes.ok) { const surJson = await surprisesRes.json(); earningsSurprises = (surJson||[]).slice(0,4).map(e => ({ period:e.period, actual:e.actual, estimate:e.estimate, surprisePct:e.surprisePercent?.toFixed(1), beat:e.actual>=e.estimate })); } } catch(e) {}
        try { if (profileRes.ok) { const profJson = await profileRes.json(); if (profJson?.name) companyProfile = { name:profJson.name, sector:profJson.finnhubIndustry, country:profJson.country, exchange:profJson.exchange, marketCap:profJson.marketCapitalization, employees:profJson.employeeTotal, ipo:profJson.ipo }; } } catch(e) {}
      } catch(e) { /* Finnhub batch failed */ }

      // ── STEP 3b: SEC EDGAR via backend proxy ────────────────────────────
      setPhase("Checking SEC filings...");
      let secCompanyName = '';
      try {
        const secRes = await fetch(`${API_BASE}/sec/filings/${t}`);
        if (secRes.ok) {
          const secData = await secRes.json();
          secFilings = secData.filings || [];
          secCompanyName = secData.companyName || '';
          console.log(`SEC: ${secFilings.length} filings for ${t}`);
        }
      } catch(e) {
        console.log('SEC backend unavailable:', e.message);
        // silently fall back — UI will show "No recent filings found"
      }

      // ── STEP 4: NewsAPI — world/macro events ─────────────────────────────
      setPhase("Scanning world events...");
      let worldNews = [];
      try {
        const wRes = await fetch(`${API_BASE}/news?q=${encodeURIComponent(`("${t}" stock OR earnings OR forecast OR product OR launch)`)}&pageSize=10`);
        if (wRes.ok) {
          const wJson = await wRes.json();
          worldNews = (wJson.articles||[]).slice(0,5).map(a => ({ headline: a.title, source: a.source?.name, date: new Date(a.publishedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}), summary: a.description?.slice(0,200) }));
        }
      } catch(e) { /* NewsAPI failed */ }

      // ── STEP 5: Fear & Greed ─────────────────────────────────────────────
      setPhase("Reading market sentiment...");
      let fearGreed = null;
      try {
        const fgRes = await fetch(`${FEARGREED_URL}?limit=1`);
        if (fgRes.ok) { const fg = (await fgRes.json())?.data?.[0]; if (fg) fearGreed = { score: parseInt(fg.value), label: fg.value_classification }; }
      } catch(e) { /* F&G failed */ }

      // ── STEP 6: Finnhub Earnings Calendar ────────────────────────────────
      setPhase("Checking earnings calendar...");
      let earningsData = null;
      try {
        const nowE = new Date();
        const earnRes = await fetch(`${API_BASE}/finnhub/earnings-calendar?symbol=${t}&from=${nowE.toISOString().split("T")[0]}&to=${new Date(nowE.getTime()+90*24*60*60*1000).toISOString().split("T")[0]}`);
        if (earnRes.ok) {
          const next = (await earnRes.json())?.earningsCalendar?.[0];
          if (next) earningsData = { date: next.date, daysUntil: Math.ceil((new Date(next.date)-nowE)/(1000*60*60*24)), epsEstimate: next.epsEstimate, revenueEstimate: next.revenueEstimate, quarter: next.quarter, year: next.year };
        }
      } catch(e) { /* Earnings failed */ }

      // ── STEP 7: Alpha Vantage — news sentiment ───────────────────────────
      setPhase("Scoring news sentiment...");
      let avSentiment = null;
      try {
        const avRes = await fetch(`${API_BASE}/alpha/sentiment?tickers=${t}&limit=10`);
        if (avRes.ok) {
          const feed = (await avRes.json())?.feed || [];
          if (feed.length) {
            let ts = 0, tw = 0;
            feed.forEach(a => { const ts2 = a.ticker_sentiment?.find(x => x.ticker===t); if (ts2) { const s=parseFloat(ts2.ticker_sentiment_score); const r=parseFloat(ts2.relevance_score); ts+=s*r; tw+=r; } });
            const avg = tw > 0 ? ts/tw : 0;
            avSentiment = { score: Math.round((avg+1)*50), label: avg>0.15?"Bullish":avg<-0.15?"Bearish":"Neutral", rawScore: avg.toFixed(3), articleCount: feed.length };
          }
        }
      } catch(e) { /* AV failed */ }

      // ── STEP 7b: Conviction Scoring — count proven bullish/bearish signals ─
      let convictionData = null;
      {
        const signals = [];
        // Signal 1: RSI mean reversion (oversold = bullish edge ~55-58%)
        if (realTechnicals) {
          if (realTechnicals.rsi <= 35) signals.push({ name: "RSI Oversold", direction: "bull", edge: 57, note: `RSI ${realTechnicals.rsi} — historically bounces ~57% of the time` });
          else if (realTechnicals.rsi >= 65) signals.push({ name: "RSI Nearing Overbought", direction: "bear", edge: 55, note: `RSI ${realTechnicals.rsi} — elevated, mean reversion risk ~55%` });
          else signals.push({ name: "RSI Neutral", direction: "neutral", edge: 50, note: `RSI ${realTechnicals.rsi} — no strong mean reversion signal` });
        }
        // Signal 2: Price vs MA200 (trend following ~54%)
        if (realTechnicals) {
          if (realTechnicals.aboveMa200) signals.push({ name: "Above MA200", direction: "bull", edge: 54, note: "Price above 200-day MA — trend continuation ~54% likely" });
          else signals.push({ name: "Below MA200", direction: "bear", edge: 54, note: "Price below 200-day MA — downtrend continuation ~54% likely" });
        }
        // Signal 3: MACD direction
        if (realTechnicals) {
          const bullMacd = realTechnicals.macd?.toLowerCase().includes("bull");
          signals.push({ name: bullMacd ? "MACD Bullish" : "MACD Bearish", direction: bullMacd ? "bull" : "bear", edge: 53, note: realTechnicals.macd });
        }
        // Signal 4: Insider buying (net buying = ~60% 12-month edge)
        const validInsiders = insiderTransactions?.filter(tx => tx.buyVal > 0 || tx.sellVal > 0) || [];
        if (validInsiders.length > 0) {
          const netBuy = validInsiders.filter(tx => tx.action === "BUY").length;
          const netSell = validInsiders.filter(tx => tx.action === "SELL").length;
          if (netBuy > netSell) signals.push({ name: "Insider Net Buying", direction: "bull", edge: 60, note: `${netBuy} insiders buying vs ${netSell} selling — strong signal` });
          else if (netSell > netBuy) signals.push({ name: "Insider Net Selling", direction: "bear", edge: 58, note: `${netSell} insiders selling vs ${netBuy} buying — caution` });
          else signals.push({ name: "Insider Neutral", direction: "neutral", edge: 50, note: "Balanced insider activity — no directional signal" });
        } else {
          signals.push({ name: "Insider Data N/A", direction: "neutral", edge: 50, note: "No insider transactions with dollar values in last 90 days — signal skipped" });
        }
        // Signal 5: Earnings surprise momentum (PEAD — 55-60% 30-day drift)
        if (earningsSurprises?.length >= 2) {
          const recentBeats = earningsSurprises.filter(e => e.beat).length;
          if (recentBeats >= 3) signals.push({ name: "Earnings Beat Streak", direction: "bull", edge: 58, note: `Beat estimates ${recentBeats}/4 quarters — PEAD drift ~58% bullish` });
          else if (recentBeats <= 1) signals.push({ name: "Earnings Miss Pattern", direction: "bear", edge: 56, note: `Only ${recentBeats}/4 quarters beat — negative surprise momentum` });
          else signals.push({ name: "Mixed Earnings", direction: "neutral", edge: 51, note: `${recentBeats}/4 quarters beat — no clear momentum edge` });
        }
        // Signal 6: Analyst consensus (upgrade momentum ~56%)
        if (analystRatings && analystRatings.total > 0) {
          const bullish = analystRatings.strongBuy + analystRatings.buy;
          const bearish = analystRatings.sell + analystRatings.strongSell;
          const bullPct = Math.round(bullish / analystRatings.total * 100);
          if (bullPct >= 65) signals.push({ name: "Strong Analyst Buy", direction: "bull", edge: 56, note: `${bullPct}% of ${analystRatings.total} analysts bullish — consensus positive` });
          else if (bullPct <= 35) signals.push({ name: "Analyst Bearish", direction: "bear", edge: 54, note: `Only ${bullPct}% analysts bullish — weak consensus` });
          else signals.push({ name: "Mixed Analyst View", direction: "neutral", edge: 51, note: `${bullPct}% analysts bullish — no strong consensus` });
        }

        const bullSignals = signals.filter(s => s.direction === "bull");
        const bearSignals = signals.filter(s => s.direction === "bear");
        const neutralSignals = signals.filter(s => s.direction === "neutral");
        const netBullScore = bullSignals.length - bearSignals.length;
        const avgEdge = signals.length > 0 ? Math.round(signals.reduce((a,s) => a + s.edge, 0) / signals.length) : 50;
        // Conviction label
        const convLabel = netBullScore >= 3 ? "STRONG BULL" : netBullScore === 2 ? "MODERATE BULL" : netBullScore === 1 ? "LEAN BULL" : netBullScore === -1 ? "LEAN BEAR" : netBullScore === -2 ? "MODERATE BEAR" : netBullScore <= -3 ? "STRONG BEAR" : "NEUTRAL";
        const convColor = netBullScore >= 2 ? "#10b981" : netBullScore === 1 ? "#34d399" : netBullScore === -1 ? "#f87171" : netBullScore <= -2 ? "#ef4444" : "#f59e0b";

        convictionData = { signals, bullCount: bullSignals.length, bearCount: bearSignals.length, neutralCount: neutralSignals.length, netBullScore, avgEdge, label: convLabel, color: convColor };
      }

      // ── STEP 8: Groq — interpret real data, do NOT invent numbers ────────
      setPhase("Running AI analysis...");
      const realDataBlock = `TICKER: ${t} | DATE: ${today}
LIVE PRICE: ${livePrice!=null?`$${parseFloat(livePrice).toFixed(2)} | Change: $${parseFloat(priceChange).toFixed(2)} (${parseFloat(priceChangePct).toFixed(2)}%) | 52W: $${week52Low}–$${week52High}`:"use knowledge"}
TECHNICALS (CALCULATED — do not change these numbers):
  RSI(14): ${realTechnicals?.rsi??"N/A"} — ${realTechnicals?.rsiLabel||""}
  MACD: ${realTechnicals?.macd||"N/A"}
  MA50: $${realTechnicals?.ma50??"N/A"} | MA200: $${realTechnicals?.ma200??"N/A"} | Above MA200: ${realTechnicals?.aboveMa200??"N/A"}
  Trend: ${realTechnicals?.trend||"N/A"} | Support: $${realTechnicals?.support??"N/A"} | Resistance: $${realTechnicals?.resistance??"N/A"}
ANALYST RATINGS (REAL): ${analystRatings?`Strong Buy:${analystRatings.strongBuy} Buy:${analystRatings.buy} Hold:${analystRatings.hold} Sell:${analystRatings.sell} StrongSell:${analystRatings.strongSell} (${analystRatings.total} analysts)`:"unavailable"}
FUNDAMENTALS (REAL): ${fundamentals?`P/E:${fundamentals.peRatio?.toFixed(2)||"N/A"} EPS:$${fundamentals.eps?.toFixed(2)||"N/A"} Beta:${fundamentals.beta?.toFixed(2)||"N/A"} RevGrowth:${fundamentals.revenueGrowth?(fundamentals.revenueGrowth*100).toFixed(1)+"%":"N/A"} GrossMargin:${fundamentals.grossMargin?(fundamentals.grossMargin*100).toFixed(1)+"%":"N/A"}`:"unavailable"}
SEC FILINGS: ${secFilings.length?secFilings.map(f=>`${f.type} ${f.date}`).join(", "):"none"}
INSIDER TRANSACTIONS (last 90 days): ${insiderTransactions.length?insiderTransactions.map(i=>`${i.name}: ${i.summary} (${i.action})`).join(" | "):"none found"}
EARNINGS SURPRISES (last 4 quarters): ${earningsSurprises.length?earningsSurprises.map(e=>`Q${e.period}: actual $${e.actual} vs est $${e.estimate} (${e.beat?"BEAT":"MISS"} ${e.surprisePct}%)`).join(", "):"unavailable"}
COMPANY PROFILE: ${companyProfile?`${companyProfile.name} | Sector: ${companyProfile.sector} | Employees: ${companyProfile.employees?.toLocaleString()||"N/A"} | Exchange: ${companyProfile.exchange} | IPO: ${companyProfile.ipo||"N/A"}`:"unavailable"}
FEAR & GREED: ${fearGreed?`${fearGreed.label} (${fearGreed.score}/100)`:"unavailable"}
EARNINGS: ${earningsData?`${earningsData.date} in ${earningsData.daysUntil} days — Q${earningsData.quarter} ${earningsData.year} | EPS est:${earningsData.epsEstimate||"N/A"} | Rev est:${earningsData.revenueEstimate?"$"+(earningsData.revenueEstimate/1e9).toFixed(2)+"B":"N/A"}`:"none in 90 days"}
NEWS SENTIMENT: ${avSentiment?`${avSentiment.label} score:${avSentiment.rawScore} (${avSentiment.articleCount} articles)`:"unavailable"}
NEWS: ${JSON.stringify(newsData.slice(0,8))}
WORLD NEWS: ${JSON.stringify(worldNews.slice(0,5))}`;

      const phStr = priceHistory ? JSON.stringify(priceHistory) : "[]";
      const consensusStr = analystRatings ? (analystRatings.strongBuy+analystRatings.buy > analystRatings.hold+analystRatings.sell+analystRatings.strongSell ? "BUY" : "HOLD") : "BUY";
      const analystSummaryStr = analystRatings ? (analystRatings.strongBuy+analystRatings.buy) + " bullish, " + analystRatings.hold + " hold, " + (analystRatings.sell+analystRatings.strongSell) + " bearish" : "N/A";
      const earningsDateStr = earningsData ? ", next earnings " + new Date(earningsData.date+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) + " in " + earningsData.daysUntil + " days" : "";
      const sectorStr = companyProfile?.sector || "Technology";
      const priceStr = parseFloat(livePrice||0).toFixed(2);
      const jsonTemplate = JSON.stringify({
        ticker: t, company: "full name", sector: sectorStr, industry: "specific industry",
        currentPrice: livePrice||0, priceChange: priceChange??0, priceChangePct: priceChangePct??0,
        week52High: week52High||0, week52Low: week52Low||0,
        marketCap: "derive from data", peRatio: fundamentals?.peRatio||"derive", eps: fundamentals?.eps||"derive", beta: fundamentals?.beta||"derive",
        dividendYield: "derive from knowledge", avgVolume: "derive from knowledge",
        signal: "YOU DECIDE: BUY or HOLD or SELL based on all data — do NOT default to BUY",
        confidence: "YOU DECIDE: integer 0-100 based on signal strength — do NOT default to 72",
        priceHistory: priceHistory||[],
        predictions: {
          tomorrow: { direction: "YOU DECIDE UP or DOWN", changePct: "realistic decimal based on RSI+MACD+trend", low: "calculate", high: "calculate", target: "calculate", reasoning: "cite specific RSI value, MACD status, and one real news headline" },
          week: { direction: "YOU DECIDE UP or DOWN", changePct: "realistic decimal based on technicals+catalysts", target: "calculate", reasoning: "cite specific MACD, catalyst, and earnings if relevant" },
          month: { direction: "YOU DECIDE UP or DOWN", changePct: "realistic decimal based on fundamentals+macro", target: "calculate", reasoning: "cite specific fundamental driver, macro factor, and earnings date if applicable" }
        },
        technicals: {
          trend: realTechnicals?.trend||"Neutral", rsi: realTechnicals?.rsi??50, rsiLabel: realTechnicals?.rsiLabel||"Neutral",
          macd: realTechnicals?.macd||"N/A", support: realTechnicals?.support??0, resistance: realTechnicals?.resistance??0,
          ma50: realTechnicals?.ma50??0, ma200: realTechnicals?.ma200??0, aboveMa200: realTechnicals?.aboveMa200??false, volumeTrend: "from news"
        },
        news: [{"headline":"headline 1 - use real headline from NEWS","source":"source","date":"date","sentiment":"bullish","impact":"Specific 2-3 sentences on direct stock impact."},{"headline":"headline 2","source":"source","date":"date","sentiment":"bearish","impact":"Specific 2-3 sentences on direct stock impact."},{"headline":"headline 3","source":"source","date":"date","sentiment":"neutral","impact":"Specific 2-3 sentences on direct stock impact."},{"headline":"headline 4","source":"source","date":"date","sentiment":"bullish","impact":"Specific 2-3 sentences on direct stock impact."},{"headline":"headline 5","source":"source","date":"date","sentiment":"neutral","impact":"Specific 2-3 sentences on direct stock impact."}],
        catalysts: { bull: ["Named catalyst with specific $ or % impact estimate","Second catalyst from real news with mechanism","Third catalyst"], bear: ["Named risk with specific downside scenario","Second risk with quantified impact"] },
        analysts: { consensus: consensusStr, avgTarget: "derive from training knowledge or news", high: "derive", low: "derive", count: analystRatings?.total||0, upside: "calculate from avgTarget and current price", recent: ["cite real analyst call from NEWS data if available","second real analyst note from NEWS if available"] },
        summary: "INSTITUTIONAL RESEARCH REPORT — 8 SECTIONS. Minimum 5 substantive sentences each with specific numbers, named companies, quantified impacts. S1: revenue segments, 3 named competitors, moat durability. S2: RSI RSI_VAL meaning, MACD MACD_VAL signal, specific entry and stop-loss prices. S3: P/E vs sector peers by name, implied growth rate, overvalued/undervalued verdict. S4: each news item dollar/pct impact, earnings beat/miss model. S5: F&G FG/100 FGLABEL historical returns, AV AVLABEL divergence. S6: insider data, earnings surprise pattern, guidance credibility. S7: ANALYSTS analysts ASUMMARY, named analyst calls, next upgrade triggers. S8: BUY/HOLD/SELL 12-month price target, 3 bull conditions, 3 bear risks, stop-loss price, conviction levelEARNINGSTR."
          .replace("RSI_VAL", String(realTechnicals?.rsi??50))
          .replace("MACD_VAL", realTechnicals?.macd||"N/A")
          .replace("FG", String(fearGreed?.score??0))
          .replace("FGLABEL", fearGreed?.label||"N/A")
          .replace("AVLABEL", avSentiment?.label||"N/A")
          .replace("ANALYSTS", String(analystRatings?.total||0))
          .replace("ASUMMARY", analystSummaryStr)
          .replace("EARNINGSTR", earningsDateStr)
      });
      const rsi = realTechnicals?.rsi ?? 50;
      const macd = realTechnicals?.macd || "N/A";
      const ma200 = realTechnicals?.ma200 ?? 0;
      const support = realTechnicals?.support ?? 0;
      const resistance = realTechnicals?.resistance ?? 0;
      const fgScore = fearGreed?.score ?? 0;
      const fgLabel = fearGreed?.label || "N/A";
      const avScore = avSentiment?.rawScore || "N/A";
      const avLabel = avSentiment?.label || "N/A";
      const totalAnalysts = analystRatings?.total || 0;
      const earningsStr = earningsData
        ? `on ${earningsData.date}: EPS consensus $${earningsData.epsEstimate}, rev est $${earningsData.revenueEstimate ? (earningsData.revenueEstimate/1e9).toFixed(1)+"B" : "N/A"}`
        : "date TBD";
      const insiderStr = insiderTransactions.length > 0
        ? insiderTransactions.map(i => `${i.name} ${i.action} ${i.summary}`).join("; ")
        : "none in 90 days — discuss what absence of insider buying means in this context";
      const surpriseStr = earningsSurprises.length > 0
        ? earningsSurprises.map(e => `${e.period}: ${e.beat?"BEAT":"MISS"} ${e.surprisePct}%`).join(", ")
        : "not available — use training knowledge of recent quarters";

      const prompt = `You are a senior equity research analyst at a top-tier investment bank. Produce a comprehensive institutional-grade stock research report. The data below is REAL — do NOT change, round, or invent any numbers. Return ONLY valid JSON, no markdown fences.

${realDataBlock}

MANDATORY RULES:
1. Copy RSI, MACD, MA50, MA200, support, resistance, trend EXACTLY from data above — do not alter.
2. Use the REAL analyst counts provided. Do not invent analyst figures.
3. Use the priceHistory array exactly as provided.
4. sector: use EXACTLY "${sectorStr}" — do NOT substitute a different classification.
5. news[]: return EXACTLY 5 items from the NEWS data. Real headlines, real sources, real dates. Each impact field: 2-3 specific sentences on the exact mechanism this news affects THIS company revenue, margins, or stock price.
6. summary: write ALL 8 sections below, each minimum 5 substantive sentences with specific numbers, named companies, and quantified impacts. Minimum 1000 words total. Sections separated by blank lines.

SUMMARY SECTIONS:

SECTION 1 — COMPANY OVERVIEW:
Name exact revenue segments with approximate pct breakdown. Name 3 specific competitors and explain this company edge over each. Current price $${priceStr}. If P/E or EPS are zero in data, use your training knowledge — these are public figures. Quantify the total addressable market. Explain what makes the competitive moat durable or fragile.

SECTION 2 — TECHNICAL ANALYSIS:
RSI ${rsi} — state specific historical forward-return statistics for stocks at this RSI level. MACD ${macd} — explain the exact signal for the next 2-4 weeks. Price vs MA200 $${ma200}: quantify the historical win rate of stocks in this position. Support $${support}: what a break below means technically and psychologically. Resistance $${resistance}: what a confirmed breakout above signals. State a specific entry price and stop-loss level for this trade.

SECTION 3 — FUNDAMENTAL ANALYSIS:
State the exact P/E ratio and compare it to named sector peers. Calculate the implied EPS growth rate needed to justify current valuation. Analyze earnings surprise trend quarter by quarter — improving or deteriorating? Name the fastest-growing revenue segment and why it matters to the thesis. State clearly: overvalued, fairly valued, or undervalued with a specific dollar justification.

SECTION 4 — CATALYST ANALYSIS:
For each real news headline in the data, explain the specific dollar or pct revenue impact if the scenario plays out. Earnings ${earningsStr} — model the likely stock price move for a 5pct EPS beat vs 5pct miss based on historical reactions. Name the single biggest macro risk right now specific to this sector.

SECTION 5 — SENTIMENT AND MARKET PSYCHOLOGY:
Fear and Greed at ${fgScore}/100 (${fgLabel}) — cite historical forward returns at similar readings (S&P 30-day and 90-day averages after similar levels). AV sentiment ${avScore} (${avLabel}) — does this diverge from price action and what does that divergence historically signal? At this Fear and Greed level, are institutional investors historically net buyers or sellers of this type of stock? State the specific sentiment shift that would change the investment view.

SECTION 6 — INSIDER AND INSTITUTIONAL ACTIVITY:
Insider data: ${insiderStr}. Cite the historical stat: when insiders of this company type buy, what is the typical forward 12-month outperformance vs market? Earnings surprise history: ${surpriseStr}. Calculate average surprise magnitude and what it implies about management guidance credibility and conservative vs aggressive guidance tendencies.

SECTION 7 — ANALYST CONSENSUS AND PRICE TARGETS:
${totalAnalysts} analysts covering: ${analystSummaryStr}. Discuss whether the hold count represents meaningful dissent or is typical for this stock. Name specific banks or analysts from the news data who recently upgraded or downgraded and what their reasoning was. Calculate the implied upside to mean target from current price $${priceStr}. At what specific price level or catalyst event would you expect the next wave of upgrades or downgrades?

SECTION 8 — INVESTMENT THESIS AND RECOMMENDATION:
State BUY or HOLD or SELL with a specific 12-month price target in dollars. Bull case: name the 3 exact conditions that must be true and what the stock is worth if they are. Bear case: name the 3 exact risks and what the stock is worth if they materialize. State the exact stop-loss price and the exact breakout confirmation price. Recommended time horizon in months. Conviction level: LOW or MEDIUM or HIGH, with one sentence explaining why${earningsDateStr}.

Return this exact JSON structure filled with real institutional-grade analysis:
${jsonTemplate}`;


      const res = await fetch(`${API_BASE}/groq/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL,
          max_tokens: 8000,
          temperature: 0.3,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      clearInterval(pt);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || `HTTP ${res.status}`); }
      const data = await res.json();
      const allText = data.choices?.[0]?.message?.content || "";
      const stripped = allText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      let depth = 0, start = -1, end = -1;
      for (let i = 0; i < stripped.length; i++) {
        if (stripped[i] === "{") { if (depth === 0) start = i; depth++; }
        else if (stripped[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
      }
      if (start === -1 || end === -1) throw new Error("Couldn't parse response — please try again");
      let jsonStr = stripped.slice(start, end + 1);
      // Repair common Groq JSON issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')          // trailing comma in object
        .replace(/,\s*]/g, ']')          // trailing comma in array
        .replace(/([{,]\s*)(\w+)\s*:/g, (m, p1, p2) => p1 + '"' + p2 + '":') // unquoted keys
        .replace(/:\s*'([^']*)'/g, ': "$1"') // single-quoted values
        .replace(/[\x00-\x1F\x7F]/g, ' '); // control characters
      // Try parsing, and if it fails truncate to last valid position
      console.log('Raw JSON string (first 500 chars):', jsonStr.substring(0, 500));
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch(parseErr) {

        // Try to find the last valid JSON by truncating at problem areas
        const summaryEnd = jsonStr.lastIndexOf('"summary"');
        if (summaryEnd > 0) {
          const shortened = jsonStr.slice(0, summaryEnd) + '"summary": "Analysis unavailable due to response formatting issue. Please try again."}';
          try { parsed = JSON.parse(shortened); } catch(e2) { throw new Error("AI response was malformed — please try again"); }
        } else {
          throw new Error("AI response was malformed — please try again");
        }
      }
      // Always override AI guesses with real data
      if (livePrice) {
        parsed.currentPrice = livePrice;
        // Recalculate prediction targets from Groq's changePct using real live price
        const livePriceNum = parseFloat(livePrice);
        if (parsed.predictions && livePriceNum > 0) {
          const recalcPred = (pred) => {
            if (!pred) return pred;
            const pct = parseFloat(pred.changePct);
            if (!isNaN(pct)) {
              pred.target = parseFloat((livePriceNum * (1 + pct/100)).toFixed(2));
              pred.low = parseFloat((livePriceNum * (1 + (pct - Math.abs(pct)*0.3)/100)).toFixed(2));
              pred.high = parseFloat((livePriceNum * (1 + (pct + Math.abs(pct)*0.3)/100)).toFixed(2));
            }
            return pred;
          };
          parsed.predictions.tomorrow = recalcPred(parsed.predictions.tomorrow);
          parsed.predictions.week = recalcPred(parsed.predictions.week);
          parsed.predictions.month = recalcPred(parsed.predictions.month);
        }
      }
      if (priceChange != null) parsed.priceChange = priceChange;
      if (priceChangePct != null) parsed.priceChangePct = priceChangePct;
      if (week52High) parsed.week52High = week52High;
      if (week52Low) parsed.week52Low = week52Low;
      if (priceHistory) parsed.priceHistory = priceHistory;
      if (realTechnicals) parsed.technicals = { ...parsed.technicals, ...realTechnicals };
      if (analystRatings) {
        parsed.analystRatings = analystRatings;
        // Sync parsed.analysts count from real data
        if (!parsed.analysts) parsed.analysts = {};
        parsed.analysts.count = analystRatings.total;
        // Recalculate consensus from real counts
        const bullishCount = analystRatings.strongBuy + analystRatings.buy;
        const bearishCount = analystRatings.sell + analystRatings.strongSell;
        parsed.analysts.consensus = bullishCount > analystRatings.hold + bearishCount ? "BUY" : bearishCount > bullishCount ? "SELL" : "HOLD";
        // If avgTarget came back as string placeholder or 0, mark as unavailable
        const tgt = parseFloat(parsed.analysts?.avgTarget);
        if (isNaN(tgt) || tgt === 0) parsed.analysts.avgTarget = 0;
        else {
          // Recalculate upside from real live price
          const livePriceNum = parseFloat(livePrice || 0);
          if (livePriceNum > 0) parsed.analysts.upside = ((tgt / livePriceNum - 1) * 100).toFixed(2);
        }
      }
      if (fundamentals) {
        if (fundamentals.peRatio != null && fundamentals.peRatio !== 0) parsed.peRatio = parseFloat(fundamentals.peRatio.toFixed(2));
        if (fundamentals.eps != null && fundamentals.eps !== 0) parsed.eps = parseFloat(fundamentals.eps.toFixed(2));
        if (fundamentals.beta != null && fundamentals.beta !== 0) parsed.beta = parseFloat(fundamentals.beta.toFixed(2));
        if (fundamentals.revenueGrowth != null) parsed.revenueGrowth = (fundamentals.revenueGrowth * 100).toFixed(1) + "%";
        if (fundamentals.grossMargin != null) parsed.grossMargin = (fundamentals.grossMargin * 100).toFixed(1) + "%";
      }
      // If Groq returned 0 or "N/A" for beta/PE/EPS but fundamentals had values, force them
      if (parsed.beta === 0 || parsed.beta === "N/A") parsed.beta = fundamentals?.beta ? parseFloat(fundamentals.beta.toFixed(2)) : null;
      if (parsed.peRatio === 0 || parsed.peRatio === "N/A") parsed.peRatio = fundamentals?.peRatio ? parseFloat(fundamentals.peRatio.toFixed(2)) : null;
      if (parsed.eps === 0 || parsed.eps === "N/A") parsed.eps = fundamentals?.eps ? parseFloat(fundamentals.eps.toFixed(2)) : null;
      if (fearGreed) parsed.fearGreed = fearGreed;
      if (earningsData) parsed.earningsData = earningsData;
      if (avSentiment) parsed.avSentiment = avSentiment;
      if (secFilings.length > 0) parsed.secFilings = secFilings;
      if (volatilityData) parsed.volatilityData = volatilityData;
      if (convictionData) parsed.convictionData = convictionData;
      if (insiderTransactions.length > 0) parsed.insiderTransactions = insiderTransactions;
      if (earningsSurprises.length > 0) parsed.earningsSurprises = earningsSurprises;
      if (companyProfile) {
        parsed.company = companyProfile.name;
        parsed.sector = companyProfile.sector;
        parsed.companyProfile = companyProfile;
        // Format market cap properly with $ sign
        if (companyProfile.marketCap) {
          const mc = parseFloat(companyProfile.marketCap);
          if (mc >= 1000000) parsed.marketCap = `$${(mc/1000000).toFixed(2)}T`;
          else if (mc >= 1000) parsed.marketCap = `$${(mc/1000).toFixed(2)}B`;
          else parsed.marketCap = `$${mc.toFixed(2)}M`;
        }
      }
      // Force clean formatting — never let Groq use "approximately X" verbose strings
      if (parsed.marketCap && (String(parsed.marketCap).toLowerCase().includes("approx") || String(parsed.marketCap).toLowerCase().includes("trillion") || String(parsed.marketCap).toLowerCase().includes("billion"))) {
        parsed.marketCap = null; // will show from companyProfile below or hide
      }
      if (parsed.avgVolume && (String(parsed.avgVolume).toLowerCase().includes("approx") || String(parsed.avgVolume).toLowerCase().includes("million") || String(parsed.avgVolume).toLowerCase().includes("shares"))) {
        parsed.avgVolume = null;
      }
      // Re-apply marketCap from companyProfile (already formatted above) or Twelve Data
      if (companyProfile?.marketCap) {
        const mc = parseFloat(companyProfile.marketCap);
        if (!isNaN(mc) && mc > 0) {
          if (mc >= 1000000) parsed.marketCap = "$" + (mc/1000000).toFixed(2) + "T";
          else if (mc >= 1000) parsed.marketCap = "$" + (mc/1000).toFixed(2) + "B";
          else parsed.marketCap = "$" + mc.toFixed(2) + "M";
        }
      } else if (parsed.marketCap && !String(parsed.marketCap).startsWith("$")) {
        parsed.marketCap = "$" + parsed.marketCap;
      }
      setResult(parsed);
      setScanHistory(prev => {
        const entry = { ticker: parsed.ticker, company: parsed.company, signal: parsed.signal, confidence: parsed.confidence, price: parsed.currentPrice, time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) };
        const filtered = prev.filter(h => h.ticker !== parsed.ticker);
        return [entry, ...filtered].slice(0, 10);
      });
    } catch (e) {
      clearInterval(pt);
      
      // Check if it's a rate limit error (429)
      if (e.message && (e.message.includes('429') || e.message.includes('limit reached'))) {
        setRateLimited(true);
        
        // Calculate expiry (24 hours from now)
        const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem('stockOracleRateLimited', 'true');
        localStorage.setItem('stockOracleRateLimitExpiry', expiryTime.toString());
        
        setRateLimitMessage('You have used all 3 analyses for today. Please try again tomorrow.');
        setError('Daily limit reached. Please upgrade for unlimited access.');
      } else {
        const msg = e.message || "Unknown error";
        setError(msg);
        console.error("Stock Oracle error:", msg);
      }
    } finally {
      clearInterval(pt); setLoading(false); setPhase("");
    }
  }, [query]);

  const fmtPrice = (n) => n == null ? "N/A" : "$" + parseFloat(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n) => n == null ? "N/A" : (n >= 0 ? "+" : "") + parseFloat(n).toFixed(2) + "%";
  const up = result ? (result.priceChangePct || 0) >= 0 : true;
  const priceColor = up ? "#10b981" : "#ef4444";
  const histPrices = result?.priceHistory?.map(p => p.price) || [];

  return (
    <div style={{ minHeight: "100vh", background: "#030b16", fontFamily: "'DM Mono', 'IBM Plex Mono', 'Courier New', monospace", color: "#e2e8f0", position: "relative", minWidth: "100vw" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500&display=swap');
        html, body, #root { margin: 0 !important; padding: 0 !important; min-height: 100vh !important; background: #030b16 !important; display: block !important; place-items: unset !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(56,189,248,0.15)} 50%{box-shadow:0 0 40px rgba(56,189,248,0.3)} }
        @keyframes scan { 0%{transform:translateY(-100vh)} 100%{transform:translateY(100vh)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        input:focus { outline: none; } button { cursor: pointer; } button:active { transform: scale(0.97); }
      `}</style>

      <Orb x="10%" y="5%" color="#38bdf8" size={400} />
      <Orb x="70%" y="20%" color="#6366f1" size={300} />
      <Orb x="20%" y="60%" color="#10b981" size={250} />

      <div style={{ position: "fixed", left: 0, right: 0, height: 1, zIndex: 99, pointerEvents: "none", background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.2),transparent)", animation: "scan 6s linear infinite" }} />

      <div style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(3,11,22,0.9)", backdropFilter: "blur(24px)", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#fff", boxShadow: "0 0 20px rgba(56,189,248,0.4)" }}>◈</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "0.12em" }}>STOCK ORACLE</div>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em" }}>AI MARKET INTELLIGENCE · v3.0</div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: "#1e3a5f" }}>{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 40px 80px" }}>
        {!result && !loading && (
          <div style={{ textAlign: "center", marginBottom: 52 }} className="fade-up">
            <div style={{ fontSize: 11, color: "#334155", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 16 }}>Real Data · Live News · AI Predictions</div>
            <h1 style={{ fontSize: "clamp(32px, 7vw, 60px)", fontWeight: 700, color: "#fff", lineHeight: 1.05, marginBottom: 10, letterSpacing: "-0.03em" }}>
              What should you<br />
              <span style={{ background: "linear-gradient(90deg, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>buy tomorrow?</span>
            </h1>
            <p style={{ color: "#334155", fontSize: 13, marginBottom: 36 }}>Type any stock, ETF, or crypto ticker below</p>
          </div>
        )}

        <div style={{ maxWidth: 540, margin: "0 auto 32px" }}>
          <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "8px 8px 8px 20px", animation: "glow 3s ease infinite" }}>
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && !rateLimited && analyse()} placeholder="Any ticker: AAPL, BRK-B, BTC-USD..." maxLength={20} disabled={loading || rateLimited}
              style={{ flex: 1, background: "none", border: "none", color: rateLimited ? "#334155" : "#38bdf8", fontSize: 22, fontWeight: 500, fontFamily: "inherit", letterSpacing: "0.1em", caretColor: rateLimited ? "transparent" : "#38bdf8", opacity: rateLimited ? 0.5 : 1 }} />
            <button onClick={() => analyse()} disabled={loading || !query.trim() || rateLimited}
              style={{ padding: "12px 24px", borderRadius: 11, border: "none", background: loading || rateLimited ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #38bdf8, #6366f1)", color: loading || rateLimited ? "#334155" : "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", fontFamily: "inherit", transition: "all 0.2s", boxShadow: loading || rateLimited ? "none" : "0 0 20px rgba(56,189,248,0.3)", cursor: rateLimited ? "not-allowed" : "pointer" }}>
              {loading ? "SCANNING" : rateLimited ? "LIMIT REACHED" : "ANALYSE →"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 14 }}>
            {!rateLimited && TICKERS.map(t => (
              <button key={t} onClick={() => { setQuery(t); analyse(t); }} disabled={loading || rateLimited}
                style={{ padding: "4px 12px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: rateLimited ? "#334155" : "#475569", fontSize: 10, fontFamily: "inherit", letterSpacing: "0.06em", cursor: rateLimited ? "not-allowed" : "pointer", opacity: rateLimited ? 0.5 : 1 }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {rateLimited && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(3,11,22,0.95)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ maxWidth: 400, background: "#0f172a", borderRadius: 24, padding: "32px", border: "1px solid #f59e0b40", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#f59e0b", marginBottom: 12 }}>Daily Limit Reached</h2>
              <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, marginBottom: 24 }}>
                {rateLimitMessage || "You have used all 3 free analyses for today."}
              </p>
              <div style={{ background: "#1e293b", borderRadius: 12, padding: "16px", marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Want unlimited access?</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", marginBottom: 4 }}>$9.99 / month</div>
                <div style={{ fontSize: 11, color: "#475569" }}>Unlimited analyses, priority support, and more</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => {
                  setRateLimited(false);
                }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "transparent", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Close
                </button>
                <button onClick={() => {
                  // Add your payment link here
                  window.open("https://buy.stripe.com/your-link", "_blank");
                }} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "linear-gradient(135deg, #f59e0b, #f97316)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Upgrade Now
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#334155", marginTop: 16 }}>
                Resets in 24 hours from first analysis
              </div>
            </div>
          </div>
        )}

        {scanHistory.length > 0 && !result && !loading && (
          <div style={{ maxWidth: 540, margin: "-16px auto 28px" }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>Recent Scans</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {scanHistory.map((h, i) => {
                const sigColor = { STRONG_BUY: "#10b981", BUY: "#34d399", HOLD: "#f59e0b", SELL: "#f87171", STRONG_SELL: "#ef4444" }[h.signal] || "#64748b";
                return (
                  <div key={i} onClick={() => { setQuery(h.ticker); analyse(h.ticker); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "background 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.06em", minWidth: 60 }}>{h.ticker}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{h.company}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>${parseFloat(h.price || 0).toFixed(2)}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, color: sigColor, background: sigColor + "18", padding: "3px 8px", borderRadius: 100, letterSpacing: "0.08em" }}>{h.signal?.replace("_", " ")}</span>
                      <span style={{ fontSize: 9, color: "#334155" }}>{h.confidence}%</span>
                      <span style={{ fontSize: 9, color: "#1e3a5f" }}>{h.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: 64, height: 64, margin: "0 auto 24px", border: "2px solid rgba(255,255,255,0.06)", borderTop: "2px solid #38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <div style={{ color: "#38bdf8", fontSize: 12, letterSpacing: "0.15em", marginBottom: 8, animation: "pulse 2s infinite" }}>{phase}</div>
            <div style={{ color: "#1e3a5f", fontSize: 11 }}>AI is searching live market data and global news...</div>
          </div>
        )}

        {error && <div style={{ padding: "20px 24px", borderRadius: 12, marginBottom: 20, background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.5)", color: "#ef4444", fontSize: 13, textAlign: "center", fontWeight: 600 }}>⚠ ERROR: {error}</div>}

        {result && !loading && (
          <div className="fade-up">
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center", padding: "24px 28px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 38, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{result.ticker}</span>
                  {result.sector && <Ticker text={result.sector} color="#38bdf8" />}
                  {result.industry && <Ticker text={result.industry} color="#818cf8" />}
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>{result.company}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{fmtPrice(result.currentPrice)}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: priceColor }}>{up ? "▲" : "▼"} {fmtPrice(Math.abs(result.priceChange || 0))} ({fmtPct(result.priceChangePct)})</span>
                </div>
                <div style={{ fontSize: 10, color: "#334155", marginTop: 8 }}>Beta: {result.beta && result.beta !== 0 ? result.beta : "N/A"} · P/E: {result.peRatio && result.peRatio !== 0 ? result.peRatio : "N/A"} · EPS: {result.eps && result.eps !== 0 ? `$${result.eps}` : "N/A"} · Div: {result.dividendYield && result.dividendYield !== "0%" && result.dividendYield !== "0" ? result.dividendYield : "N/A"}</div>
              </div>
              <SignalRing signal={result.signal} confidence={result.confidence} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              <StatBox label="52W High" value={fmtPrice(result.week52High)} />
              <StatBox label="52W Low" value={fmtPrice(result.week52Low)} />
              <StatBox label="Market Cap" value={result.marketCap || "N/A"} />
              {result.avgVolume && !String(result.avgVolume).toLowerCase().includes("approx") && !String(result.avgVolume).toLowerCase().includes("million") && !String(result.avgVolume).toLowerCase().includes("shares") && <StatBox label="Avg Volume" value={result.avgVolume} />}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 14 }}>5-Year Price History</div>
                <div style={{ height: 80, overflow: "hidden" }}><MiniChart prices={histPrices} /></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                  {result.priceHistory?.map((p, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#334155", marginBottom: 3 }}>{p.year}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{p.price >= 1000 ? `$${(p.price / 1000).toFixed(1)}k` : fmtPrice(p.price)}</div>
                      {p.change != null && <div style={{ fontSize: 9, color: String(p.change).startsWith("+") ? "#10b981" : "#ef4444" }}>{p.change}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase" }}>Probability Ranges</div>
                  <div style={{ fontSize: 8, color: "#1e3a5f", letterSpacing: "0.1em" }}>BASED ON REAL VOLATILITY</div>
                </div>
                {result.volatilityData ? (() => {
                  const vd = result.volatilityData;
                  const cp = result.currentPrice;
                  const rows = [
                    { label: "Tomorrow", d: vd.daily },
                    { label: "7 Days",   d: vd.weekly },
                    { label: "30 Days",  d: vd.monthly },
                    { label: "1 Year",   d: vd.yearly },
                  ];
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#334155", letterSpacing: "0.1em", marginBottom: 6, padding: "0 4px" }}>
                        <span>HORIZON</span><span>68% RANGE (1σ)</span><span>90% RANGE (1.6σ)</span><span>±%</span>
                      </div>
                      {rows.map(({ label, d }) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 8px", borderRadius: 7, marginBottom: 5, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize: 10, color: "#64748b", width: 52 }}>{label}</span>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>
                            <span style={{ color: "#ef4444" }}>{fmtPrice(d.low68)}</span>
                            <span style={{ color: "#334155", margin: "0 4px" }}>–</span>
                            <span style={{ color: "#10b981" }}>{fmtPrice(d.high68)}</span>
                          </span>
                          <span style={{ fontSize: 10, color: "#64748b" }}>
                            <span style={{ color: "#ef4444" }}>{fmtPrice(d.low90)}</span>
                            <span style={{ color: "#334155", margin: "0 4px" }}>–</span>
                            <span style={{ color: "#10b981" }}>{fmtPrice(d.high90)}</span>
                          </span>
                          <span style={{ fontSize: 10, color: "#f59e0b", width: 36, textAlign: "right" }}>±{d.pct68}%</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 9, color: "#334155" }}>ANNUAL VOLATILITY</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>{vd.annualVolPct}%</div>
                        <div style={{ fontSize: 9, color: "#1e3a5f" }}>68% of days within ±{vd.daily?.pct68}%</div>
                      </div>
                    </div>
                  );
                })() : (
                  <div>
                    <PredBar label={`→ ${fmtPrice(result.predictions?.tomorrow?.target)}`} pct={result.predictions?.tomorrow?.changePct} horizon="Tomorrow" />
                    <PredBar label={`→ ${fmtPrice(result.predictions?.week?.target)}`} pct={result.predictions?.week?.changePct} horizon="7 Days" />
                    <PredBar label={`→ ${fmtPrice(result.predictions?.month?.target)}`} pct={result.predictions?.month?.changePct} horizon="30 Days" />
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: "20px 22px", borderRadius: 16, marginBottom: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 16 }}>Technical Indicators</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {[
                  ["Trend", result.technicals?.trend, safeStr(result.technicals?.trend) === "Bullish" ? "#10b981" : safeStr(result.technicals?.trend) === "Bearish" ? "#ef4444" : "#f59e0b"],
                  ["RSI (14)", `${result.technicals?.rsi || "—"} · ${result.technicals?.rsiLabel || ""}`, result.technicals?.rsi > 70 ? "#ef4444" : result.technicals?.rsi < 30 ? "#10b981" : "#f59e0b"],
                  ["MACD", result.technicals?.macd, safeStr(result.technicals?.macd).toLowerCase().includes("bull") ? "#10b981" : "#ef4444"],
                  ["Support", fmtPrice(result.technicals?.support), "#64748b"],
                  ["Resistance", fmtPrice(result.technicals?.resistance), "#64748b"],
                  ["vs MA200", `${fmtPrice(result.technicals?.ma200)} ${result.technicals?.aboveMa200 ? "▲ above" : "▼ below"}`, result.technicals?.aboveMa200 ? "#10b981" : "#ef4444"],
                ].map(([label, val, color]) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: color || "#e2e8f0" }}>{val || "—"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>Live News & Market Events</div>
              {result.news?.map((item, i) => <NewsCard key={i} item={item} delay={i * 100} />)}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div style={{ fontSize: 9, color: "#10b981", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>▲ Bullish Catalysts</div>
                {result.catalysts?.bull?.map((c, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}><span style={{ color: "#10b981", flexShrink: 0 }}>+</span>{typeof c === "object" ? JSON.stringify(c) : c}</div>)}
              </div>
              <div style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ fontSize: 9, color: "#ef4444", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>▼ Bearish Risks</div>
                {result.catalysts?.bear?.map((c, i) => <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}><span style={{ color: "#ef4444", flexShrink: 0 }}>−</span>{typeof c === "object" ? JSON.stringify(c) : c}</div>)}
              </div>
            </div>

            {result.analysts && (
              <div style={{ padding: "18px 22px", borderRadius: 14, marginBottom: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase" }}>Analyst Consensus · {result.analysts.count} analysts</div>
                  <div style={{ fontSize: 9, color: "#475569" }}>Real data via Finnhub</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: result.analysts.avgTarget > 0 ? "repeat(4, 1fr)" : "1fr", gap: 16, marginBottom: 14 }}>
                  <StatBox label="Consensus" value={result.analysts.consensus} color="#10b981" />
                  {result.analysts.avgTarget > 0 && <StatBox label="Mean Target" value={fmtPrice(result.analysts.avgTarget)} />}
                  {result.analysts.avgTarget > 0 && <StatBox label="Upside" value={result.analysts?.upside ? `+${result.analysts.upside}%` : "N/A"} color="#10b981" />}
                  {result.analysts.avgTarget > 0 && <StatBox label="Target Range" value={`${fmtPrice(result.analysts.low)} — ${fmtPrice(result.analysts.high)}`} />}
                </div>
                {result.analystRatings && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", marginBottom: 8 }}>BREAKDOWN</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {[
                        { label: "Strong Buy", val: result.analystRatings.strongBuy, color: "#10b981" },
                        { label: "Buy", val: result.analystRatings.buy, color: "#34d399" },
                        { label: "Hold", val: result.analystRatings.hold, color: "#f59e0b" },
                        { label: "Sell", val: result.analystRatings.sell, color: "#f87171" },
                        { label: "Strong Sell", val: result.analystRatings.strongSell, color: "#ef4444" },
                      ].map(({ label, val, color }) => val > 0 && (
                        <div key={label} style={{ flex: val, padding: "6px 0", background: color+"22", border: `1px solid ${color}44`, borderRadius: 6, textAlign: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color }}>{val}</div>
                          <div style={{ fontSize: 8, color: color+"bb", letterSpacing: "0.08em" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.analysts.recent?.map((a, i) => <div key={i} style={{ fontSize: 11, color: "#475569", padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}><span style={{ color: "#38bdf8" }}>→ </span>{typeof a === "object" ? `${a.analyst||""} ${a.rating||""} ${a.target?"$"+a.target:""}`.trim() : a}</div>)}
              </div>
            )}

            {/* Insider Transactions + Earnings Surprises + SEC Filings row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>              

{/* Insider Transactions */}
              <div style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(251,191,36,0.03)", border: "1px solid rgba(251,191,36,0.18)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 7px #fbbf24" }} />
                  <div style={{ fontSize: 9, color: "#fbbf24", letterSpacing: "0.18em", textTransform: "uppercase" }}>Insider Transactions</div>
                </div>
                <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.6, marginBottom: 10 }}>Executive buy/sell activity in the last 90 days via Finnhub & SEC EDGAR.</div>
                
                {(() => {
                  // Try Finnhub data first (has dollar amounts)
                  const finnhubTx = result.insiderTransactions?.filter(tx => tx.buyVal > 0 || tx.sellVal > 0) || [];
                  
                  if (finnhubTx.length > 0) {
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {finnhubTx.map((tx, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 7, background: tx.action === "BUY" ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${tx.action === "BUY" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                            <div style={{ fontSize: 10, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: 9, color: tx.action === "BUY" ? "#10b981" : "#ef4444", fontWeight: 700 }}>{tx.action}</span>
                              <span style={{ fontSize: 9, color: "#475569" }}>{tx.summary}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  
                  // Fallback to SEC Form 4 filings with transaction codes
                  const secFilings = result.secFilings?.filter(f => f.form === "4") || [];
                  if (secFilings.length > 0) {
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {secFilings.slice(0, 5).map((f, i) => {
                          // Determine color and icon based on transaction type
                          let bgColor = "rgba(251,191,36,0.06)";
                          let borderColor = "rgba(251,191,36,0.2)";
                          let textColor = "#fbbf24";
                          let actionIcon = "📄";
                          let actionText = "Form 4";
                          
                          if (f.transactionType === 'purchase') {
                            bgColor = "rgba(16,185,129,0.06)";
                            borderColor = "rgba(16,185,129,0.2)";
                            textColor = "#10b981";
                            actionIcon = "🟢";
                            actionText = "PURCHASE";
                          } else if (f.transactionType === 'sale') {
                            bgColor = "rgba(239,68,68,0.06)";
                            borderColor = "rgba(239,68,68,0.2)";
                            textColor = "#ef4444";
                            actionIcon = "🔴";
                            actionText = "SALE";
                          } else if (f.isCompensatory) {
                            bgColor = "rgba(245,158,11,0.06)";
                            borderColor = "rgba(245,158,11,0.2)";
                            textColor = "#f59e0b";
                            actionIcon = "🟡";
                            actionText = "COMP";
                          }
                          
                          return (
                            <div key={i} style={{ 
                              display: "flex", 
                              justifyContent: "space-between", 
                              alignItems: "center", 
                              padding: "6px 10px", 
                              borderRadius: 7, 
                              background: bgColor, 
                              border: `1px solid ${borderColor}` 
                            }}>
                              <div style={{ fontSize: 10, color: "#94a3b8", flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                                <span>{actionIcon}</span>
                                <span style={{ fontWeight: 700, color: textColor }}>{actionText}</span>
                                <span style={{ marginLeft: 4 }}>· {f.date}</span>
                              </div>
                              <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ 
                                fontSize: 9, 
                                color: textColor, 
                                textDecoration: "none", 
                                border: `1px solid ${textColor}44`, 
                                padding: "2px 8px", 
                                borderRadius: 3 
                              }}>
                                View →
                              </a>
                            </div>
                          );
                        })}
                        <div style={{ fontSize: 9, color: "#64748b", marginTop: 4, padding: "4px 6px", background: "rgba(100,116,139,0.1)", borderRadius: 4 }}>
                          ⓘ 🟢 Purchase = Bullish · 🔴 Sale = Bearish · 🟡 Compensation/Options = Neutral
                        </div>
                      </div>
                    );
                  }
                  
                  return <div style={{ fontSize: 11, color: "#334155" }}>No insider transactions found in last 90 days</div>;
                })()}
              </div>

              {/* Earnings Surprises */}
              <div style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(99,102,241,0.03)", border: "1px solid rgba(99,102,241,0.18)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 7px #6366f1" }} />
                  <div style={{ fontSize: 9, color: "#6366f1", letterSpacing: "0.18em", textTransform: "uppercase" }}>Earnings Surprises</div>
                </div>
                <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.6, marginBottom: 10 }}>Last 4 quarters — did the company beat or miss analyst EPS estimates?</div>
                {result.earningsSurprises?.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {result.earningsSurprises.map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 7, background: e.beat ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1px solid ${e.beat ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                        <span style={{ fontSize: 10, color: "#64748b" }}>{e.period}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: e.beat ? "#10b981" : "#ef4444" }}>{e.beat ? "BEAT" : "MISS"}</span>
                        <span style={{ fontSize: 9, color: "#475569" }}>act ${e.actual} vs est ${e.estimate}</span>
                        <span style={{ fontSize: 9, color: e.beat ? "#10b981" : "#ef4444" }}>{e.surprisePct > 0 ? "+" : ""}{e.surprisePct}%</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontSize: 11, color: "#334155" }}>No earnings history available</div>}
              </div>              {/* SEC Filings */}
              <div style={{ padding: "18px 20px", borderRadius: 14, background: "rgba(56,189,248,0.03)", border: "1px solid rgba(56,189,248,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 7px #38bdf8" }} />
                  <div style={{ fontSize: 9, color: "#38bdf8", letterSpacing: "0.18em", textTransform: "uppercase" }}>SEC Filings — via EDGAR</div>
                </div>
                <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.6, marginBottom: 10 }}>Direct from SEC EDGAR — Form 4 insider trades, 8-K events, 10-Q/10-K reports.</div>
                {result.secFilings && result.secFilings.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.secFilings.slice(0, 5).map((f, i) => {
                                          let formColor = "#94a3b8";
                      let formLabel = "Filing";
                      
                      if (f.form === "4") {
                        if (f.transactionType === 'purchase') {
                          formColor = "#10b981";
                          formLabel = "Insider BUY";
                        } else if (f.transactionType === 'sale') {
                          formColor = "#ef4444";
                          formLabel = "Insider SELL";
                        } else if (f.isCompensatory) {
                          formColor = "#f59e0b";
                          formLabel = "Insider COMP";
                        } else {
                          formColor = "#f59e0b";
                          formLabel = "Insider Filing";
                        }
                      } else if (f.form === "8-K") {
                        formColor = "#c084fc";
                        formLabel = "Material Event";
                      } else if (f.form === "10-Q") {
                        formColor = "#38bdf8";
                        formLabel = "Quarterly Report";
                      } else if (f.form === "10-K") {
                        formColor = "#10b981";
                        formLabel = "Annual Report";
                      }
                      return (
                        <div key={i} style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid " + formColor + "22", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: formColor, background: formColor + "18", padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap" }}>Form {f.form}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{formLabel}</div>
                              <div style={{ fontSize: 9, color: "#334155", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{f.description || `Filed on ${f.date}`}</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 9, color: "#334155" }}>{f.date}</span>
                            <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#38bdf8", textDecoration: "none", border: "1px solid #38bdf822", padding: "1px 6px", borderRadius: 3 }}>View →</a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: "#334155" }}>No recent filings found</div>
                    {result.secFilings && <div style={{ fontSize: 9, color: "#475569", marginTop: 4 }}>Debug: {result.secFilings.length} filings in data but none displayed</div>}
                  </div>
                )}
              </div>

              {/* Fear & Greed Index */}
              <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
                  <div style={{ fontSize: 9, color: "#ef4444", letterSpacing: "0.18em", textTransform: "uppercase" }}>Fear & Greed Index</div>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.7, marginBottom: 12 }}>
                  Measures overall market psychology from 0 (Extreme Fear) to 100 (Extreme Greed). When the market is fearful, even strong stocks get sold. When greedy, momentum carries everything higher.
                </div>
                {result.fearGreed ? (() => {
                  const v = result.fearGreed.value;
                  const color = v <= 25 ? "#ef4444" : v <= 45 ? "#f97316" : v <= 55 ? "#f59e0b" : v <= 75 ? "#84cc16" : "#10b981";
                  return (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 28, fontWeight: 800, color }}>{v}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color }}>{result.fearGreed.label}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ width: v + "%", height: "100%", borderRadius: 3, background: `linear-gradient(90deg, #ef4444, #f97316, #f59e0b, #84cc16, #10b981)` }} />
                      </div>
                    </div>
                  );
                })() : <div style={{ fontSize: 11, color: "#334155" }}>Unavailable</div>}
              </div>

              {/* Alpha Vantage News Sentiment */}
              <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 8px #6366f1" }} />
                  <div style={{ fontSize: 9, color: "#6366f1", letterSpacing: "0.18em", textTransform: "uppercase" }}>News Sentiment — Alpha Vantage</div>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.7, marginBottom: 12 }}>
                  AI-scored sentiment across recent news articles for this ticker. Each article is scored from -1 (very bearish) to +1 (very bullish) and averaged into a single signal.
                </div>
                {result.avSentiment ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: result.avSentiment.label === "Bullish" ? "#10b981" : result.avSentiment.label === "Bearish" ? "#ef4444" : "#f59e0b" }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: result.avSentiment.label === "Bullish" ? "#10b981" : result.avSentiment.label === "Bearish" ? "#ef4444" : "#f59e0b" }}>{result.avSentiment.label}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{result.avSentiment.score}/100</span>
                    </div>
                    <div style={{ fontSize: 10, color: "#334155" }}>Based on {result.avSentiment.articleCount} articles · raw score {result.avSentiment.rawScore}</div>
                  </div>
                ) : <div style={{ fontSize: 11, color: "#334155" }}>Unavailable for this ticker</div>}
              </div>

              {/* Finnhub Earnings Calendar */}
              <div style={{ padding: "20px 22px", borderRadius: 16, background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", boxShadow: "0 0 8px #fbbf24" }} />
                  <div style={{ fontSize: 9, color: "#fbbf24", letterSpacing: "0.18em", textTransform: "uppercase" }}>Earnings Calendar — Finnhub</div>
                </div>
                <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.7, marginBottom: 12 }}>
                  Stocks can move 10–20% on earnings day. Knowing the next earnings date is critical — it changes the entire risk profile of any trade in the weeks leading up to it.
                </div>
                {result.earningsData ? (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>{result.earningsData.date}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>
                      {result.earningsData.epsEstimate != null && <div>EPS Estimate: <span style={{ color: "#94a3b8" }}>${result.earningsData.epsEstimate}</span></div>}
                      {result.earningsData.revenueEstimate != null && <div>Revenue Est: <span style={{ color: "#94a3b8" }}>${(result.earningsData.revenueEstimate / 1e9).toFixed(2)}B</span></div>}
                    </div>
                  </div>
                ) : <div style={{ fontSize: 11, color: "#334155" }}>No earnings scheduled in next 90 days</div>}
              </div>

            </div>

            {/* Conviction Scoring Panel */}
            {result.convictionData && (
              <div style={{ padding: "20px 24px", borderRadius: 16, marginBottom: 14, background: "rgba(255,255,255,0.025)", border: `1px solid ${result.convictionData.color}33` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase" }}>Signal Conviction Score</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: result.convictionData.color, padding: "3px 12px", borderRadius: 100, background: result.convictionData.color+"15", border: `1px solid ${result.convictionData.color}33` }}>{result.convictionData.label}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>avg edge: ~{result.convictionData.avgEdge}%</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "Bull", count: result.convictionData.bullCount, color: "#10b981" },
                    { label: "Bear", count: result.convictionData.bearCount, color: "#ef4444" },
                    { label: "Neutral", count: result.convictionData.neutralCount, color: "#f59e0b" },
                  ].map(({ label, count, color }) => (
                    <div key={label} style={{ flex: 1, padding: "10px", borderRadius: 10, background: color+"10", border: `1px solid ${color}25`, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color }}>{count}</div>
                      <div style={{ fontSize: 9, color: color+"aa", letterSpacing: "0.1em" }}>{label.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {result.convictionData.signals.map((sig, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 3, flexShrink: 0, background: sig.direction==="bull"?"#10b981":sig.direction==="bear"?"#ef4444":"#f59e0b", boxShadow: `0 0 6px ${sig.direction==="bull"?"#10b981":sig.direction==="bear"?"#ef4444":"#f59e0b"}` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: sig.direction==="bull"?"#10b981":sig.direction==="bear"?"#ef4444":"#f59e0b" }}>{sig.name}</span>
                          <span style={{ fontSize: 9, color: "#334155" }}>~{sig.edge}% historical edge</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.5 }}>{sig.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)", fontSize: 10, color: "#475569", lineHeight: 1.6 }}>
                  ⚠ Edge percentages are historical averages from academic research — not guarantees. More aligned signals = higher statistical probability, not certainty. Markets can override any model at any time.
                </div>
              </div>
            )}

            <div style={{ padding: "28px 32px", borderRadius: 16, marginBottom: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Equity Research Report</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{result.company} ({result.ticker})</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "#334155", marginBottom: 4 }}>RATING</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: result.signal === "BUY" ? "#10b981" : result.signal === "SELL" ? "#ef4444" : "#f59e0b", padding: "4px 14px", borderRadius: 100, background: (result.signal === "BUY" ? "#10b981" : result.signal === "SELL" ? "#ef4444" : "#f59e0b") + "18", border: "1px solid " + (result.signal === "BUY" ? "#10b981" : result.signal === "SELL" ? "#ef4444" : "#f59e0b") + "44" }}>{result.signal}</div>
                </div>
              </div>
              {(() => {
                const sectionLabels = [
                  "Company Overview",
                  "Technical Analysis",
                  "Fundamental Analysis",
                  "Catalyst Analysis",
                  "Sentiment & Market Psychology",
                  "Insider & Institutional Activity",
                  "Analyst Consensus & Price Targets",
                  "Investment Thesis & Recommendation",
                ];
                const sectionIcons = ["◈","▲","$","◉","◐","⬡","⊕","✦"];
                const sectionColors = ["#38bdf8","#10b981","#f59e0b","#c084fc","#6366f1","#fb923c","#34d399","#ef4444"];
                const raw = result.summary || "";
                // Split on SECTION N — or double newlines
                // Try multiple split strategies to extract clean sections
                let sections = [];
                // Strategy 1: Split on "SECTION N —" markers
                const byMarker = raw.split(/(?=SECTION\s+\d+\s*[—–\-])/i).map(s => s.trim()).filter(s => s.length > 40);
                if (byMarker.length >= 4) {
                  sections = byMarker;
                } else {
                  // Strategy 2: Split on double newlines
                  sections = raw.split(/\n\n/).map(s => s.trim()).filter(s => s.length > 40);
                }
                // Strip any "SECTION N — LABEL:" or "SECTION N:" prefix from the start of each section
                sections = sections.map(s =>
                  s.replace(/^SECTION\s+\d+\s*[—–\-]+\s*[A-Z0-9,& ]+:\s*/i, "")
                   .replace(/^SECTION\s+\d+\s*[—–\-]+\s*/i, "")
                   .replace(/^SECTION\s+\d+:\s*/i, "")
                   .trim()
                ).filter(s => s.length > 40);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {sections.map((sec, i) => (
                      <div key={i} style={{ padding: "20px 0", borderBottom: i < sections.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 14, color: sectionColors[i % sectionColors.length] }}>{sectionIcons[i % sectionIcons.length]}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: sectionColors[i % sectionColors.length], letterSpacing: "0.18em", textTransform: "uppercase" }}>{sectionLabels[i] || "Analysis"}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 2.0, whiteSpace: "pre-wrap" }}>{sec}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <button onClick={() => { setResult(null); setTimeout(() => inputRef.current?.focus(), 100); }}
                style={{ padding: "10px 24px", borderRadius: 100, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.1em" }}>
                ← ANALYSE ANOTHER STOCK
              </button>
            </div>

            <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)", fontSize: 10, color: "#334155", lineHeight: 1.7, textAlign: "center" }}>
              ⚠ AI-generated analysis for informational purposes only. NOT financial advice. Always conduct your own research.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
