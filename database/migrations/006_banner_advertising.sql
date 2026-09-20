-- Migration: 006_banner_advertising.sql
-- Bulls Traking Banner Advertising Engine (Slots & Orders)

CREATE TABLE IF NOT EXISTS banner_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_name VARCHAR(100) NOT NULL,
  position VARCHAR(50) NOT NULL UNIQUE,
  dimensions VARCHAR(50) DEFAULT '728x90',
  price_per_week REAL DEFAULT 199.00,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS banner_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER,
  title VARCHAR(150),
  banner_image TEXT NOT NULL,
  target_url TEXT NOT NULL,
  placement VARCHAR(50) NOT NULL,
  duration INTEGER DEFAULT 7,
  start_at DATETIME,
  end_at DATETIME,
  price REAL DEFAULT 0,
  payment_status VARCHAR(30) DEFAULT 'completed',
  approval_status VARCHAR(30) DEFAULT 'approved',
  click_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_banner_orders_placement ON banner_orders(placement, approval_status);
CREATE INDEX IF NOT EXISTS idx_banner_slots_position ON banner_slots(position);
