-- Bulls Traking Phase 3 Migration: PostgreSQL for signals table

CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  direction VARCHAR(10) NOT NULL,
  source VARCHAR(50) DEFAULT 'manual',
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_signals_posted ON signals(posted_at);
CREATE INDEX IF NOT EXISTS idx_signals_direction ON signals(direction);
