-- Bulls Traking Phase 1 Relational Database Schema (SQLite / PostgreSQL Compatible)

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain VARCHAR(50) NOT NULL,
  contract_address VARCHAR(255) NOT NULL,
  provider_id VARCHAR(100),
  name VARCHAR(150) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  price REAL DEFAULT 0,
  market_cap REAL DEFAULT 0,
  volume_24h REAL DEFAULT 0,
  change_1h REAL DEFAULT 0,
  change_24h REAL DEFAULT 0,
  change_7d REAL DEFAULT 0,
  circulating_supply REAL DEFAULT 0,
  total_supply REAL DEFAULT 0,
  ath REAL DEFAULT 0,
  ath_date TEXT,
  atl REAL DEFAULT 0,
  atl_date TEXT,
  market_cap_rank INTEGER DEFAULT 9999,
  hot_score REAL DEFAULT 0,
  is_submitted INTEGER DEFAULT 0,
  is_promoted INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  listing_status VARCHAR(30) DEFAULT 'LIVE',
  verification_status VARCHAR(30) DEFAULT 'unverified',
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_data_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tokens_chain_contract UNIQUE (chain, contract_address)
);

CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens(chain);
CREATE INDEX IF NOT EXISTS idx_tokens_contract ON tokens(contract_address);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_market_cap ON tokens(market_cap);
CREATE INDEX IF NOT EXISTS idx_tokens_volume ON tokens(volume_24h);
CREATE INDEX IF NOT EXISTS idx_tokens_change_24h ON tokens(change_24h);
CREATE INDEX IF NOT EXISTS idx_tokens_first_seen ON tokens(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_tokens_listing_status ON tokens(listing_status);
CREATE INDEX IF NOT EXISTS idx_tokens_is_submitted ON tokens(is_submitted);
CREATE INDEX IF NOT EXISTS idx_tokens_hot_score ON tokens(hot_score);

CREATE TABLE IF NOT EXISTS token_price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  price REAL NOT NULL,
  market_cap REAL,
  volume_24h REAL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_token ON token_price_history(token_id);
CREATE INDEX IF NOT EXISTS idx_price_history_time ON token_price_history(timestamp);

CREATE TABLE IF NOT EXISTS token_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  chain VARCHAR(50) NOT NULL,
  contract_address VARCHAR(255) NOT NULL,
  project_name VARCHAR(150) NOT NULL,
  project_email VARCHAR(150),
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  status VARCHAR(30) DEFAULT 'PENDING',
  admin_note TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON token_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_contract ON token_submissions(chain, contract_address);

CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  promotion_type VARCHAR(50) NOT NULL,
  package_name VARCHAR(100),
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(start_at, end_at, is_active);

CREATE TABLE IF NOT EXISTS promotion_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  customer_name VARCHAR(150),
  customer_email VARCHAR(150),
  telegram_username VARCHAR(150),
  promotion_type VARCHAR(50) NOT NULL,
  package_name VARCHAR(100),
  duration_days INTEGER DEFAULT 7,
  price REAL DEFAULT 0,
  currency VARCHAR(20) DEFAULT 'USDT',
  start_at DATETIME,
  end_at DATETIME,
  payment_status VARCHAR(30) DEFAULT 'pending',
  order_status VARCHAR(30) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_promotion_orders_status ON promotion_orders(order_status, payment_status);
