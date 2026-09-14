-- Bulls Traking Phase 3 Migration: Add signals table for Telegram & market alpha signals

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'buy' | 'sell' | 'watch'
  source VARCHAR(50) DEFAULT 'manual',
  posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_signals_posted ON signals(posted_at);
CREATE INDEX IF NOT EXISTS idx_signals_direction ON signals(direction);
