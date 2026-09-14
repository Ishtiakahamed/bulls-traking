-- Bulls Traking Phase 3 Migration: Add new_pairs table for on-chain pair discovery feed

CREATE TABLE IF NOT EXISTS new_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain VARCHAR(50) NOT NULL,
  pair_address VARCHAR(255) NOT NULL,
  token_address VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  logo_url TEXT,
  price REAL DEFAULT 0,
  liquidity REAL DEFAULT 0,
  volume_24h REAL DEFAULT 0,
  txn_count_24h INTEGER DEFAULT 0,
  pair_created_at DATETIME,
  status VARCHAR(20) DEFAULT 'latest', -- 'latest' | 'trending' | 'matured'
  first_discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_new_pairs_chain_pair UNIQUE (chain, pair_address)
);

CREATE INDEX IF NOT EXISTS idx_new_pairs_status ON new_pairs(status);
CREATE INDEX IF NOT EXISTS idx_new_pairs_chain ON new_pairs(chain);
CREATE INDEX IF NOT EXISTS idx_new_pairs_created ON new_pairs(pair_created_at);
