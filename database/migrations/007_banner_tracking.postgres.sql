-- Migration: 007_banner_tracking.postgres.sql
-- Bulls Traking Banner Click & Impression Telemetry Tracking (PostgreSQL)

ALTER TABLE banner_orders ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE banner_orders ADD COLUMN IF NOT EXISTS impression_count INTEGER DEFAULT 0;
