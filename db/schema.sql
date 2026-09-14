-- Bull Straking Relational Database Schema (SQLite / PostgreSQL Compatible)

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  total_supply REAL DEFAULT 0,
  circulating_supply REAL DEFAULT 0,
  price REAL DEFAULT 0,
  market_cap REAL DEFAULT 0,
  volume_24h REAL DEFAULT 0,
  liquidity REAL DEFAULT 0,
  price_change_1h REAL DEFAULT 0,
  price_change_24h REAL DEFAULT 0,
  price_change_7d REAL DEFAULT 0,
  ath REAL DEFAULT 0,
  atl REAL DEFAULT 0,
  rank INTEGER DEFAULT 9999,
  status VARCHAR(30) DEFAULT 'active',
  listing_status VARCHAR(30) DEFAULT 'LIVE',
  verification_status VARCHAR(30) DEFAULT 'unverified',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_data_sync DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tokens_chain_contract UNIQUE (chain, contract_address)
);

CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens(chain);
CREATE INDEX IF NOT EXISTS idx_tokens_rank ON tokens(rank);
CREATE INDEX IF NOT EXISTS idx_tokens_listing_status ON tokens(listing_status);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);

CREATE TABLE IF NOT EXISTS token_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
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
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  approved_at DATETIME,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON token_submissions(status);

CREATE TABLE IF NOT EXISTS promotion_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  customer_name VARCHAR(150),
  customer_email VARCHAR(150),
  telegram_username VARCHAR(150),
  promotion_type VARCHAR(50) NOT NULL,
  package_id VARCHAR(50),
  duration INTEGER DEFAULT 7,
  start_at DATETIME,
  end_at DATETIME,
  price REAL DEFAULT 0,
  currency VARCHAR(20) DEFAULT 'USDT',
  payment_status VARCHAR(30) DEFAULT 'pending',
  order_status VARCHAR(30) DEFAULT 'pending',
  banner_url TEXT,
  ad_title VARCHAR(255),
  ad_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_promotion_orders_status ON promotion_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_dates ON promotion_orders(start_at, end_at);

CREATE TABLE IF NOT EXISTS ad_boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  banner_image TEXT,
  cta_url TEXT,
  start_at DATETIME,
  end_at DATETIME,
  duration INTEGER DEFAULT 8,
  price REAL DEFAULT 0,
  status VARCHAR(30) DEFAULT 'active',
  rotation_order INTEGER DEFAULT 0,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ad_boards_status ON ad_boards(status);

CREATE TABLE IF NOT EXISTS banner_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_name VARCHAR(100) NOT NULL,
  position VARCHAR(50) NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS banner_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  banner_image TEXT NOT NULL,
  target_url TEXT NOT NULL,
  placement VARCHAR(50) NOT NULL,
  duration INTEGER DEFAULT 7,
  start_at DATETIME,
  end_at DATETIME,
  price REAL DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'pending',
  approval_status VARCHAR(30) DEFAULT 'pending',
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_banner_orders_placement ON banner_orders(placement, approval_status);

CREATE TABLE IF NOT EXISTS presales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name VARCHAR(150) NOT NULL,
  token_id INTEGER,
  chain VARCHAR(50) NOT NULL,
  launchpad VARCHAR(50) NOT NULL,
  presale_url TEXT NOT NULL,
  website_url TEXT,
  x_url TEXT,
  telegram_url TEXT,
  start_at DATETIME,
  end_at DATETIME,
  soft_cap REAL DEFAULT 0,
  hard_cap REAL DEFAULT 0,
  progress_percent REAL DEFAULT 0,
  status VARCHAR(30) DEFAULT 'upcoming',
  featured INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_presales_launchpad ON presales(launchpad);
CREATE INDEX IF NOT EXISTS idx_presales_status ON presales(status);

CREATE TABLE IF NOT EXISTS security_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  chain VARCHAR(50) NOT NULL,
  contract_address VARCHAR(255) NOT NULL,
  honeypot INTEGER DEFAULT 0,
  buy_tax REAL DEFAULT 0,
  sell_tax REAL DEFAULT 0,
  mintable INTEGER DEFAULT 0,
  ownership VARCHAR(100) DEFAULT 'renounced',
  blacklist INTEGER DEFAULT 0,
  proxy INTEGER DEFAULT 0,
  risk_level VARCHAR(30) DEFAULT 'LOW',
  risk_score INTEGER DEFAULT 95,
  raw_response TEXT,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scans_chain_contract ON security_scans(chain, contract_address);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER,
  provider VARCHAR(50) DEFAULT 'crypto',
  transaction_id VARCHAR(255),
  amount REAL NOT NULL,
  currency VARCHAR(20) DEFAULT 'USDT',
  status VARCHAR(30) DEFAULT 'pending',
  network VARCHAR(50),
  payment_wallet VARCHAR(255),
  tx_hash VARCHAR(255),
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id VARCHAR(100) DEFAULT 'system_admin',
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);

CREATE TABLE IF NOT EXISTS token_price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  price REAL NOT NULL,
  market_cap REAL,
  volume REAL,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_token_time ON token_price_history(token_id, timestamp);
