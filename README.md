Stock Oracle
AI-Powered Stock Analysis Platform

Stock Oracle is a full-stack web application that provides comprehensive stock analysis by combining real-time market data, news sentiment, SEC filings, and AI-powered insights. The app fetches live data from multiple financial APIs and uses Groq's LLM to generate institutional-grade research reports.

Live Demo: https://stock-oracle-fullstack.onrender.com

Features
Live market data from Twelve Data (prices, 52-week highs/lows, daily changes, 5-year historical charts)

Technical indicators calculated in real-time (RSI, MACD, MA50, MA200)

Company-specific news from Finnhub (past 7 days)

Global macro events from NewsAPI

AI-scored news sentiment from Alpha Vantage

SEC EDGAR filings including Form 4 insider trades, 8-K, 10-Q, and 10-K reports

AI analysis via Groq LLM generating comprehensive research reports with 8 sections

Price predictions with statistical probability ranges

Conviction scoring based on six technical and fundamental signals

Search any stock, ETF, or crypto ticker

Recent scans history (stores last 10 analyses)

Dark-themed responsive UI with loading states

Architecture
The application consists of a React frontend and a Node.js backend.

Frontend (React + Vite)

Single-page application with zero backend dependencies

All API calls proxied through the backend for security

Custom components for charts, news cards, signal rings

CSS animations and glass-morphism UI effects

Backend (Node.js + Express)

Proxies all external API requests to hide API keys

Fetches and formats data from multiple sources

Serves built frontend static files

SEC EDGAR integration with rate limiting and CIK lookup

Health check and debug endpoints

API Integrations
Twelve Data: live prices and historical data

Finnhub: company news, analyst ratings, fundamentals, insider transactions, earnings calendar

NewsAPI: global news and macro events

Alpha Vantage: news sentiment scoring

Groq: AI analysis generation

SEC EDGAR: insider filings and company reports

Deployment
Deploy on Render

Fork or clone the repository.

Create a new Web Service on Render.

Configure build settings:

Build Command: cd frontend && npm install && npm run build && cd ../backend && npm install

Start Command: cd backend && node server.js

Add environment variables (see below).

Deploy.

Environment Variables

Create a .env file in the backend folder or add these to Render:

GROQ_KEY

TWELVEDATA_KEY

FINNHUB_KEY

NEWSAPI_KEY

ALPHAVANTAGE_KEY

Local Development
bash
git clone https://github.com/DOMCHURCH/stock-oracle-fullstack.git
cd stock-oracle-fullstack

# Install and run frontend
cd frontend
npm install
npm run dev

# In another terminal, install and run backend
cd ../backend
npm install
node server.js
Frontend runs at http://localhost:5173, backend at http://localhost:3001.

How It Works
User enters a ticker (e.g., AAPL, TSLA, BTC-USD).

Frontend calls backend API endpoints at /api/...

Backend proxies requests to external APIs using stored keys.

Data is collected from:

Twelve Data (prices and history)

Finnhub (news, ratings, fundamentals)

NewsAPI (world events)

Alpha Vantage (sentiment)

SEC EDGAR (insider filings)

All data is sent to Groq with a detailed prompt.

Groq returns a JSON analysis with predictions, signals, and a written report.

Frontend renders the analysis with charts, news cards, and panels.

Security
API keys are stored only on the backend, never exposed to the client.

CORS is enabled for controlled access.

SEC EDGAR requests include rate limiting delays (200ms).

All sensitive data uses environment variables.

No client-side API calls to external services.

Technical Highlights
Technical indicators (RSI, MACD, moving averages) calculated in JavaScript from raw price data.

Historical volatility computed using log returns and square root of time rule.

Conviction scoring based on six signals with historical edge percentages sourced from academic research (53-60%).

SEC CIK lookup for any ticker using official SEC mappings.

Form 4 transaction classification (purchase, sale, compensatory).

Changelog
See Changelog.pdf for a complete history of development from v0.1 to v3.1, including failed experiments, cost optimization, and architecture evolution.

Disclaimer
This application is for informational and educational purposes only. It does not constitute financial advice. Always conduct your own research before making investment decisions.

Author
Dominique Church
GitHub: @DOMCHURCH
