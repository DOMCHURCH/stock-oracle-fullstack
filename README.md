# Stock Oracle

**AI-Powered Stock Analysis Platform**

Stock Oracle is a full-stack web application that provides comprehensive stock analysis by combining real-time market data, news sentiment, SEC filings, and AI-powered insights. The app fetches live data from multiple financial APIs and uses Groq's LLM to generate institutional-grade research reports.

Live Demo: https://stock-oracle-fullstack.onrender.com

## Features

- Live market data from Twelve Data (prices, 52-week highs/lows, daily changes, 5-year historical charts)
- Technical indicators calculated in real-time (RSI, MACD, MA50, MA200)
- Company-specific news from Finnhub (past 7 days)
- Global macro events from NewsAPI
- AI-scored news sentiment from Alpha Vantage
- SEC EDGAR filings including Form 4 insider trades, 8-K, 10-Q, and 10-K reports
- AI analysis via Groq LLM generating comprehensive research reports with 8 sections
- Price predictions with statistical probability ranges
- Conviction scoring based on six technical and fundamental signals
- **Rate limiting: 3 free analyses per day per user with localStorage persistence**
- Search any stock, ETF, or crypto ticker
- Recent scans history (stores last 10 analyses)
- Dark-themed responsive UI with loading states

## Architecture

The application consists of a React frontend and a Node.js backend.

### Frontend (React + Vite)
- Single-page application with zero backend dependencies
- All API calls proxied through the backend for security
- Custom components for charts, news cards, signal rings
- CSS animations and glass-morphism UI effects
- Client-side rate limit checking to prevent API usage when limit reached

### Backend (Node.js + Express)
- Proxies all external API requests to hide API keys
- Fetches and formats data from multiple sources
- Serves built frontend static files
- SEC EDGAR integration with rate limiting and CIK lookup
- Express-rate-limit middleware with 3 analyses per day per IP
- Health check and debug endpoints

## API Integrations

- **Twelve Data**: live prices and historical data
- **Finnhub**: company news, analyst ratings, fundamentals, insider transactions, earnings calendar
- **NewsAPI**: global news and macro events
- **Alpha Vantage**: news sentiment scoring
- **Groq**: AI analysis generation
- **SEC EDGAR**: insider filings and company reports

## Rate Limiting

Stock Oracle implements a two-layer rate limiting system:

1. **Backend rate limiting**: 3 analysis requests per day per IP address using `express-rate-limit`
2. **Frontend rate limit checking**: LocalStorage persistence ensures users cannot exceed limits even after closing the browser

When users hit their daily limit, all inputs (search bar and ticker buttons) are disabled and a popup appears showing the time remaining until reset.

## Deployment

### Deploy on Render

1. Fork or clone the repository.
2. Create a new Web Service on Render.
3. Configure build settings:
   - **Build Command**: `cd frontend && npm install && npm run build && cd ../backend && npm install`
   - **Start Command**: `cd backend && node server.js`
4. Add environment variables (see below).
5. Deploy.

### Environment Variables

Create a `.env` file in the `backend` folder or add these to Render:

- `GROQ_KEY`
- `TWELVEDATA_KEY`
- `FINNHUB_KEY`
- `NEWSAPI_KEY`
- `ALPHAVANTAGE_KEY`

## Local Development

```bash
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
