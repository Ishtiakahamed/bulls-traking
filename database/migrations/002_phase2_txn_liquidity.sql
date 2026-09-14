-- Bulls Traking Phase 2 Migration: Add txn_count_24h, price_change_6h, and liquidity

ALTER TABLE tokens ADD COLUMN txn_count_24h INTEGER DEFAULT 0;
ALTER TABLE tokens ADD COLUMN price_change_6h REAL DEFAULT 0;
ALTER TABLE tokens ADD COLUMN liquidity REAL DEFAULT 0;
