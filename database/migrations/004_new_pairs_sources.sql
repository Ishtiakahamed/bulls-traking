-- Bulls Traking Migration 004: Add source, socials, and metadata to new_pairs table

ALTER TABLE new_pairs ADD COLUMN source VARCHAR(50) DEFAULT 'dexscreener';
ALTER TABLE new_pairs ADD COLUMN website_url TEXT;
ALTER TABLE new_pairs ADD COLUMN twitter_url TEXT;
ALTER TABLE new_pairs ADD COLUMN telegram_url TEXT;
ALTER TABLE new_pairs ADD COLUMN metadata TEXT;

CREATE INDEX IF NOT EXISTS idx_new_pairs_source ON new_pairs(source);
