-- Bull Straking PostgreSQL Production Schema (Supabase / RDS / Neon Ready)

CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  chain VARCHAR(50) NOT NULL,
  contract_address VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  decimals INTEGER DEFAULT 18,
  total_supply NUMERIC(36, 8) DEFAULT 0,
  circulating_supply NUMERIC(36, 8) DEFAULT 0,
  price NUMERIC(36, 12) DEFAULT 0,
  market_cap NUMERIC(36, 2) DEFAULT 0,
  volume_24h NUMERIC(36, 2) DEFAULT 0,
  liquidity NUMERIC(36, 2) DEFAULT 0,
  price_change_1h NUMERIC(10, 4) DEFAULT 0,
  price_change_24h NUMERIC(10, 4) DEFAULT 0,
  price_change_7d NUMERIC(10, 4) DEFAULT 0,
  ath NUMERIC(36, 12) DEFAULT 0,
  atl NUMERIC(36, 12) DEFAULT 0,
  rank INTEGER DEFAULT 9999,
  status VARCHAR(30) DEFAULT 'active',
  listing_status VARCHAR(30) DEFAULT 'LIVE',
  verification_status VARCHAR(30) DEFAULT 'unverified',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_data_sync TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tokens_chain_contract UNIQUE (chain, contract_address)
);

CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens(chain);
CREATE INDEX IF NOT EXISTS idx_tokens_rank ON tokens(rank);
CREATE INDEX IF NOT EXISTS idx_tokens_listing_status ON tokens(listing_status);

CREATE TABLE IF NOT EXISTS token_submissions (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  submitted_contract VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  submitted_by VARCHAR(150),
  project_name VARCHAR(150) NOT NULL,
  project_email VARCHAR(150),
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  description TEXT,
  logo_url TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  admin_note TEXT,
  submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS promotion_orders (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_email VARCHAR(150),
  telegram_username VARCHAR(150),
  promotion_type VARCHAR(50) NOT NULL,
  package_id VARCHAR(50),
  duration INTEGER DEFAULT 7,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  price NUMERIC(18, 4) DEFAULT 0,
  currency VARCHAR(20) DEFAULT 'USDT',
  payment_status VARCHAR(30) DEFAULT 'pending',
  order_status VARCHAR(30) DEFAULT 'pending',
  banner_url TEXT,
  ad_title VARCHAR(255),
  ad_description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ad_boards (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  banner_image TEXT,
  cta_url TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  duration INTEGER DEFAULT 8,
  price NUMERIC(18, 4) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  rotation_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS banner_slots (
  id SERIAL PRIMARY KEY,
  slot_name VARCHAR(100) NOT NULL,
  position VARCHAR(50) NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS banner_orders (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  banner_image TEXT NOT NULL,
  target_url TEXT NOT NULL,
  placement VARCHAR(50) NOT NULL,
  duration INTEGER DEFAULT 7,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  price NUMERIC(18, 4) DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'pending',
  approval_status VARCHAR(30) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS presales (
  id SERIAL PRIMARY KEY,
  project_name VARCHAR(150) NOT NULL,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  chain VARCHAR(50) NOT NULL,
  launchpad VARCHAR(50) NOT NULL,
  presale_url TEXT NOT NULL,
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  soft_cap NUMERIC(24, 4) DEFAULT 0,
  hard_cap NUMERIC(24, 4) DEFAULT 0,
  progress_percent NUMERIC(6, 2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'upcoming',
  featured INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_scans (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE CASCADE,
  chain VARCHAR(50) NOT NULL,
  contract_address VARCHAR(255) NOT NULL,
  honeypot INTEGER DEFAULT 0,
  buy_tax NUMERIC(6, 2) DEFAULT 0,
  sell_tax NUMERIC(6, 2) DEFAULT 0,
  mintable INTEGER DEFAULT 0,
  ownership VARCHAR(100) DEFAULT 'renounced',
  blacklist INTEGER DEFAULT 0,
  proxy INTEGER DEFAULT 0,
  risk_level VARCHAR(30) DEFAULT 'LOW',
  risk_score INTEGER DEFAULT 95,
  raw_response TEXT,
  scanned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER,
  provider VARCHAR(50) DEFAULT 'crypto',
  transaction_id VARCHAR(255),
  amount NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(20) DEFAULT 'USDT',
  status VARCHAR(30) DEFAULT 'pending',
  network VARCHAR(50),
  payment_wallet VARCHAR(255),
  tx_hash VARCHAR(255),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(100) DEFAULT 'system_admin',
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_price_history (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  price NUMERIC(36, 12) NOT NULL,
  market_cap NUMERIC(36, 2),
  volume NUMERIC(36, 2)
);
