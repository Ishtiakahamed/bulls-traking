-- Bulls Traking Migration 004 (PostgreSQL): Add source, socials, and metadata to new_pairs table

ALTER TABLE new_pairs ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'dexscreener';
ALTER TABLE new_pairs ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE new_pairs ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE new_pairs ADD COLUMN IF NOT EXISTS telegram_url TEXT;
ALTER TABLE new_pairs ADD COLUMN IF NOT EXISTS metadata TEXT;

CREATE INDEX IF NOT EXISTS idx_new_pairs_source ON new_pairs(source);
