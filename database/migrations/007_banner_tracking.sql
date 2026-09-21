-- Migration: 007_banner_tracking.sql
-- Bulls Traking Banner Click & Impression Telemetry Tracking

-- Ensure click_count and impression_count exist on banner_orders table
-- Note: SQLite does not support IF NOT EXISTS in ALTER TABLE, so db.js checks columns via PRAGMA before applying.
ALTER TABLE banner_orders ADD COLUMN click_count INTEGER DEFAULT 0;
ALTER TABLE banner_orders ADD COLUMN impression_count INTEGER DEFAULT 0;
