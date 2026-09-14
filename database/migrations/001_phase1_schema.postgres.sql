-- Bulls Traking Phase 1 PostgreSQL Production Schema

CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
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
  price NUMERIC(36, 12) DEFAULT 0,
  market_cap NUMERIC(36, 2) DEFAULT 0,
  volume_24h NUMERIC(36, 2) DEFAULT 0,
  change_1h NUMERIC(10, 4) DEFAULT 0,
  change_24h NUMERIC(10, 4) DEFAULT 0,
  change_7d NUMERIC(10, 4) DEFAULT 0,
  circulating_supply NUMERIC(36, 8) DEFAULT 0,
  total_supply NUMERIC(36, 8) DEFAULT 0,
  ath NUMERIC(36, 12) DEFAULT 0,
  ath_date TIMESTAMPTZ,
  atl NUMERIC(36, 12) DEFAULT 0,
  atl_date TIMESTAMPTZ,
  market_cap_rank INTEGER DEFAULT 9999,
  hot_score NUMERIC(12, 4) DEFAULT 0,
  is_submitted BOOLEAN DEFAULT FALSE,
  is_promoted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  listing_status VARCHAR(30) DEFAULT 'LIVE',
  verification_status VARCHAR(30) DEFAULT 'unverified',
  first_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_data_sync TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  price NUMERIC(36, 12) NOT NULL,
  market_cap NUMERIC(36, 2),
  volume_24h NUMERIC(36, 2),
  timestamp BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_token ON token_price_history(token_id);
CREATE INDEX IF NOT EXISTS idx_price_history_time ON token_price_history(timestamp);

CREATE TABLE IF NOT EXISTS token_submissions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
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
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  promotion_type VARCHAR(50) NOT NULL,
  package_name VARCHAR(100),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(start_at, end_at, is_active);

CREATE TABLE IF NOT EXISTS promotion_orders (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_email VARCHAR(150),
  telegram_username VARCHAR(150),
  promotion_type VARCHAR(50) NOT NULL,
  package_name VARCHAR(100),
  duration_days INTEGER DEFAULT 7,
  price NUMERIC(18, 4) DEFAULT 0,
  currency VARCHAR(20) DEFAULT 'USDT',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  payment_status VARCHAR(30) DEFAULT 'pending',
  order_status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
