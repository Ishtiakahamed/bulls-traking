-- Migration: 006_banner_advertising.postgres.sql
-- Bulls Traking Banner Advertising Engine (PostgreSQL)

CREATE TABLE IF NOT EXISTS banner_slots (
  id SERIAL PRIMARY KEY,
  slot_name VARCHAR(100) NOT NULL,
  position VARCHAR(50) NOT NULL UNIQUE,
  dimensions VARCHAR(50) DEFAULT '728x90',
  price_per_week NUMERIC(10,2) DEFAULT 199.00,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS banner_orders (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
  title VARCHAR(150),
  banner_image TEXT NOT NULL,
  target_url TEXT NOT NULL,
  placement VARCHAR(50) NOT NULL,
  duration INTEGER DEFAULT 7,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  price NUMERIC(10,2) DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'completed',
  approval_status VARCHAR(30) DEFAULT 'approved',
  click_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banner_orders_placement ON banner_orders(placement, approval_status);
CREATE INDEX IF NOT EXISTS idx_banner_slots_position ON banner_slots(position);
