# Bulls Traking — Phase 1 Platform

Bulls Traking is an independent, database-driven Web3 token discovery, real-time analytics, trending and listing platform across Solana, Ethereum, BNB Chain, and Base.

---

## 1. Project Structure

```text
bull-straking/
│
├── backend/
│   ├── controllers/
│   │   ├── tokenController.js      # Handlers for /top, /new, /hot, /gainers, /trending, /:id
│   │   ├── homeController.js       # Single optimized GET /api/home aggregator
│   │   ├── submissionController.js # Validation, metadata fetch, instant New Coins injection
│   │   └── promotionController.js  # Active promotions handler
│   ├── routes/
│   │   ├── tokenRoutes.js          # /api/tokens/* and /api/search
│   │   ├── submissionRoutes.js     # /api/submissions
│   │   ├── promotionRoutes.js      # /api/promoted and /api/promotions/order
│   │   └── index.js                # Central router mounting /api
│   ├── services/
│   │   ├── tokenService.js         # Queries, sorting, pagination, and sparklines
│   │   ├── hotScoreService.js      # Algorithmic Hot Score engine with configurable weights
│   │   ├── submissionService.js    # Automated validation & instant New Coins injection
│   │   └── promotionService.js     # Time-sensitive active promotions
│   ├── providers/
│   │   ├── coingecko.js            # CoinGecko provider with rate limiting & normalization
│   │   ├── coinmarketcap.js        # CoinMarketCap provider fallback
│   │   └── index.js                # MarketDataProvider abstraction interface
│   ├── workers/
│   │   └── syncWorker.js           # Background periodic data synchronization & rank recalculation
│   ├── middleware/
│   │   └── errorHandler.js         # Unified JSON error handling
│   └── utils/
│       └── helpers.js              # Token age calculation (12m, 3h, 2d), address format validation
│
├── database/
│   ├── db.js                       # SQLite / PostgreSQL client abstraction
│   ├── migrations/
│   │   ├── 001_phase1_schema.sql          # SQLite / standard SQL relational schema
│   │   └── 001_phase1_schema.postgres.sql # PostgreSQL production migration schema
│   └── seeds/
│       └── seed.js                 # Initial seed dataset with real token telemetry
│
├── config/
│   └── default.js                  # Configurable weights, provider URLs, and cache TTLs
│
├── index.html                      # Bulls Traking Web3 dark UI interface
├── styles.css                      # Modern Web3 styling, compact tables, responsive design
├── app.js                          # Frontend client interacting exclusively with Bull Straking APIs
├── server.js                       # Express backend server serving API & frontend
├── test_phase1.js                  # 15 automated acceptance tests (100% pass)
├── .env.example                    # Environment variable template
├── package.json
└── README.md
```

---

## 2. Database Schema

The core relational database features:
* `tokens`: Unique `(chain, contract_address)`, market metrics (`price`, `market_cap`, `volume_24h`, `change_1h`, `change_24h`, `change_7d`), supplies, ATH/ATL, rank, algorithmic `hot_score`, `first_seen_at`, `is_submitted`, `is_promoted`, `listing_status`, `verification_status`.
* `token_submissions`: Submission lifecycle tracking (`PENDING`, `PROCESSING`, `LIVE`, `REJECTED`, `SUSPENDED`).
* `promotions`: Time-sensitive promotional records (`start_at`, `end_at`, `is_active`, `priority`).
* `promotion_orders`: Client order records (`customer_name`, `email`, `package_name`, `price`, `payment_status`).
* `token_price_history`: Historical price points for 7-day sparkline generation.

---

## 3. Environment Variables

Create `.env` based on `.env.example`:

```env
PORT=5000
NODE_ENV=development
SYNC_INTERVAL_MS=60000

# Optional Provider Keys
COINGECKO_API_KEY=
COINMARKETCAP_API_KEY=

# Optional PostgreSQL Production URL
DATABASE_URL=
```

---

## 4. REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health & sync status |
| `GET` | `/api/home` | Single aggregated home payload (trending, new, hot, gainers, stats) |
| `GET` | `/api/tokens/top` | Top coins ranked by `market_cap DESC` |
| `GET` | `/api/tokens/new` | New coins sorted by `first_seen_at DESC` with token age |
| `GET` | `/api/tokens/hot` | Hot coins ranked by algorithmic `hot_score DESC` |
| `GET` | `/api/tokens/gainers` | Top gainers sorted by `change_24h DESC` with volume filter |
| `GET` | `/api/tokens/trending` | Internal trending ranking |
| `GET` | `/api/tokens/:id` | Token detail with metadata and 7-day price history |
| `GET` | `/api/search?q=` | Global search by name, symbol, or contract address |
| `GET` | `/api/promoted` | Active time-windowed promoted tokens |
| `POST` | `/api/submissions` | Submit token; auto-validated and injected into New Coins |
| `GET` | `/api/submissions/:id` | Check submission status |

---

## 5. Setup & Running Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Seed Database**:
   ```bash
   npm run seed
   ```

3. **Start Platform**:
   ```bash
   npm start
   ```
   Open `http://localhost:5000` in your browser.

4. **Run 15 Acceptance Tests**:
   ```bash
   npm test
   ```

---

## 6. Data-Sync Instructions

The background synchronization worker runs automatically via `backend/workers/syncWorker.js`:
* Executes periodically according to `config.syncIntervalMs` (default: every 60 seconds).
* Fetches market data using the `MarketDataProvider` abstraction.
* Gracefully degrades to cached data if external APIs are rate-limited.
* Updates ranks, calculates hot scores, and records historical price snapshots.

---

## 7. Known API Limitations & Fallbacks

* **CoinGecko Free Tier Rate Limits**: CoinGecko public API allows ~10–30 requests per minute. The Bulls Traking backend abstracts and throttles provider queries. Visitors **never** hit external APIs directly.
* **New Token On-Chain Discovery**: DexScreener on-chain endpoints are used to resolve newly submitted DEX tokens on Solana, Ethereum, BNB Chain, and Base.
* **Presales**: Presale radar is scoped as a placeholder page (`Presale tracking is coming soon.`) per Phase 1 instructions.

---

## 8. Deploying to Vercel (Zero-Config Serverless)

Bulls Traking is configured for out-of-the-box deployment on Vercel.

### Key Serverless Features
- **Node.js 22 Runtime**: Pinned to `"node": "22.x"` in `package.json` for native `node:sqlite` (`DatabaseSync`) support.
- **Serverless API Routing**: `vercel.json` and `api/index.js` handle all API requests (`/api/*`) and SPA routing (`/index.html`).
- **Cold-Start Auto-Hydration**: On cold container boot, `/tmp/bullstraking.db` is initialized and automatically hydrated with 100+ verified tokens and multi-source launchpad pairs (`pumpfun`, `fourmeme`, `stonkfun`, `dexscreener`).
- **On-Demand Launchpad Refresh**: Visiting or refreshing the New Pairs radar triggers on-demand live polling to StonkFun & DexScreener.

### Quick Deploy via Vercel CLI
```bash
# 1. Install Vercel CLI (if not already installed)
npm install -g vercel

# 2. Deploy directly from repository root
vercel

# 3. Deploy to production
vercel --prod
```

### Deploy via GitHub / Vercel Dashboard
1. Push this repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com/new), select **Import Project** and pick your repository.
3. Framework Preset: Choose **Other**.
4. Root Directory: `./` (leave default).
5. Environment Variables (Optional):
   - `COINGECKO_API_KEY`: *(Optional)* Your CoinGecko API key.
   - `COINMARKETCAP_API_KEY`: *(Optional)* Your CoinMarketCap Pro API key.
6. Click **Deploy**.

