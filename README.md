📈 Stock Oracle
AI-Powered Stock Analysis Platform

Stock Oracle is a full-stack web application that provides comprehensive stock analysis by combining real-time market data, news sentiment, SEC filings, and AI-powered insights. The app fetches live data from multiple financial APIs and uses Groq's LLM to generate institutional-grade research reports.

🔗 Live Demo: https://stock-oracle-fullstack.onrender.com

✨ Features
📊 Real-Time Market Data
Live stock prices, 52-week highs/lows, and daily changes via Twelve Data

5-year historical price charts with yearly sampling

Technical indicators calculated in real-time (RSI, MACD, MA50, MA200)

📰 Multi-Source News Integration
Company-specific news from Finnhub (past 7 days)

Global macro events from NewsAPI

AI-scored news sentiment from Alpha Vantage

📑 SEC Filings & Insider Trading
Direct access to SEC EDGAR database

Form 4 insider transaction tracking

8-K, 10-Q, and 10-K filings with direct links to source documents

Transaction type classification (purchase/sale/compensatory)

🧠 AI-Powered Analysis
Groq LLM (Llama 3.3 70B) generates comprehensive research reports

8-section institutional-grade analysis

Price predictions with statistical probability ranges

Conviction scoring based on 6 technical and fundamental signals

📱 User Features
Search any stock, ETF, or crypto ticker

Recent scans history (stores last 10 analyses)

Clean, dark-themed UI with responsive design

Real-time loading states with phase indicators

🏗️ Architecture
text
stock-oracle-fullstack/
├── frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   ├── main.jsx       # Entry point
│   │   └── index.css      # Global styles
│   ├── index.html          # Vite entry point
│   ├── package.json        # Frontend dependencies
│   └── vite.config.js      # Vite configuration
├── backend/                # Node.js + Express backend
│   ├── server.js           # Main server with API proxies
│   ├── package.json        # Backend dependencies
│   └── .env                # Environment variables (local)
├── .gitignore              # Git ignore rules
└── Changelog.pdf           # Development history
Frontend (React + Vite)
Single-page application with zero backend dependencies

All API calls proxied through the backend for security

Custom components for charts, news cards, and signal rings

CSS animations and glass-morphism UI effects

Backend (Node.js + Express)
Proxies all external API requests to hide API keys

SEC EDGAR integration with rate limiting and CIK lookup

Serves built frontend static files

Health check and debug endpoints

🔌 API Integrations
Service	Purpose	Endpoint
Twelve Data	Live prices & historical data	/api/twelve/*
Finnhub	Company news, ratings, fundamentals	/api/finnhub/*
NewsAPI	Global news & macro events	/api/news
Alpha Vantage	News sentiment scoring	/api/alpha/sentiment
Groq	AI analysis generation	/api/groq/analyse
SEC EDGAR	Insider filings & company reports	/api/sec/filings/*
🚀 Deployment
Deploy on Render (as done here)
Fork/clone the repository

Create a new Web Service on Render

Configure build settings:

Build Command: cd frontend && npm install && npm run build && cd ../backend && npm install

Start Command: cd backend && node server.js

Add environment variables (see below)

Deploy!

Environment Variables
Create a .env file in the backend folder (for local development) or add these to Render:

text
GROQ_KEY=your_groq_api_key
TWELVEDATA_KEY=your_twelvedata_key
FINNHUB_KEY=your_finnhub_key
NEWSAPI_KEY=your_newsapi_key
ALPHAVANTAGE_KEY=your_alphavantage_key
🧪 Local Development
bash
# Clone the repository
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
The frontend will be available at http://localhost:5173 and the backend at http://localhost:3001.

📚 How It Works
User enters a ticker (e.g., AAPL, TSLA, BTC-USD)

Frontend calls backend API at /api/* endpoints

Backend proxies requests to external APIs with keys

Data is collected from:

Twelve Data (prices & history)

Finnhub (news, ratings, fundamentals)

NewsAPI (world events)

Alpha Vantage (sentiment)

SEC EDGAR (insider filings)

All data is sent to Groq with a detailed prompt

Groq returns JSON analysis with predictions, signals, and report

Frontend renders the complete analysis with charts and cards

🔒 Security Features
API keys stored only on backend (never exposed to client)

CORS enabled for controlled access

SEC EDGAR rate limiting with 200ms delays

Environment variables for all sensitive data

No client-side API calls to external services

🧠 Technical Highlights
Real technical indicators calculated in JavaScript from raw price data

Historical volatility computed using log returns and square root of time

Conviction scoring with academic edge percentages (53-60%)

SEC CIK lookup for any ticker using official SEC mappings

Form 4 transaction classification (purchase/sale/options)

📝 Changelog
See Changelog.pdf for a complete history of development from v0.1 to v3.1, including:

Failed experiments (StockTwits, direct SEC calls)

Cost optimization journey

Architecture evolution from Python script to full-stack React

⚠️ Disclaimer
This application is for informational and educational purposes only. It does not constitute financial advice. Always conduct your own research before making investment decisions.

👨‍💻 Author
Dominique Church

GitHub: @DOMCHURCH

📄 License
ISC License — see LICENSE file for details.

Built with React, Node.js, and a lot of trial and error.
