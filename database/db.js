const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('[DB Critical Error] Failed to load node:sqlite. Node.js >= 22.5.0 is required.', e.message);
  throw e;
}

// Vercel / Serverless execution has a read-only filesystem except for /tmp
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? (fs.existsSync('/tmp') ? '/tmp' : os.tmpdir()) : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'bullstraking.db');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('[DB Directory Notice]', e.message);
  }
}

let db;
try {
  db = new DatabaseSync(DB_FILE);
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA foreign_keys = ON;');
  } catch (pe) {
    // WAL may not be supported on some network mounts/serverless tmp files
    try {
      db.exec('PRAGMA journal_mode = DELETE;');
      db.exec('PRAGMA busy_timeout = 5000;');
    } catch (_) {}
  }
} catch (err) {
  console.warn('[DB Warning] File DB initialization failed, falling back to in-memory DB:', err.message);
  db = new DatabaseSync(':memory:');
}

let isSeeding = false;
let isInitialized = false;

function initDatabase() {
  if (isInitialized) return;
  isInitialized = true;
  const schemaPath = path.join(__dirname, 'migrations', '001_phase1_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Security Scans schema (GoPlus security cache)
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id INTEGER,
      chain VARCHAR(50) NOT NULL,
      contract_address VARCHAR(255) NOT NULL,
      honeypot INTEGER DEFAULT 0,
      buy_tax REAL DEFAULT 0,
      sell_tax REAL DEFAULT 0,
      mintable INTEGER DEFAULT 0,
      ownership VARCHAR(100) DEFAULT 'renounced',
      blacklist INTEGER DEFAULT 0,
      proxy INTEGER DEFAULT 0,
      risk_level VARCHAR(30) DEFAULT 'LOW',
      risk_score INTEGER DEFAULT 95,
      raw_response TEXT,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_scans_chain_contract ON security_scans(chain, contract_address);
  `);

  // Phase 2 migration: add txn_count_24h, price_change_6h, liquidity
  try {
    const columns = db.prepare('PRAGMA table_info(tokens)').all().map(c => c.name);
    if (!columns.includes('txn_count_24h')) {
      db.exec('ALTER TABLE tokens ADD COLUMN txn_count_24h INTEGER DEFAULT 0;');
    }
    if (!columns.includes('price_change_6h')) {
      db.exec('ALTER TABLE tokens ADD COLUMN price_change_6h REAL DEFAULT 0;');
    }
    if (!columns.includes('liquidity')) {
      db.exec('ALTER TABLE tokens ADD COLUMN liquidity REAL DEFAULT 0;');
    }
    if (!columns.includes('coingecko_id')) {
      db.exec('ALTER TABLE tokens ADD COLUMN coingecko_id VARCHAR(100);');
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_chain_coingecko_id ON tokens(chain, coingecko_id) WHERE coingecko_id IS NOT NULL;');
  } catch (migErr) {
    console.warn('[DB Migration Notice]', migErr.message);
  }

  // Phase 3 migrations: new_pairs & signals
  try {
    db.exec(`
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
        status VARCHAR(20) DEFAULT 'latest',
        source VARCHAR(50) DEFAULT 'dexscreener',
        website_url TEXT,
        twitter_url TEXT,
        telegram_url TEXT,
        metadata TEXT,
        first_discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_new_pairs_chain_pair UNIQUE (chain, pair_address)
      );
      CREATE INDEX IF NOT EXISTS idx_new_pairs_status ON new_pairs(status);
      CREATE INDEX IF NOT EXISTS idx_new_pairs_chain ON new_pairs(chain);
      CREATE INDEX IF NOT EXISTS idx_new_pairs_created ON new_pairs(pair_created_at);

      CREATE TABLE IF NOT EXISTS signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_id INTEGER,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        direction VARCHAR(10) NOT NULL,
        source VARCHAR(50) DEFAULT 'manual',
        posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_signals_posted ON signals(posted_at);
      CREATE INDEX IF NOT EXISTS idx_signals_direction ON signals(direction);

      CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        old_value TEXT,
        new_value TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at);
    `);

    // Migration for existing new_pairs tables
    const npCols = db.prepare('PRAGMA table_info(new_pairs)').all().map(c => c.name);
    if (!npCols.includes('source')) {
      db.exec("ALTER TABLE new_pairs ADD COLUMN source VARCHAR(50) DEFAULT 'dexscreener';");
    }
    if (!npCols.includes('website_url')) {
      db.exec("ALTER TABLE new_pairs ADD COLUMN website_url TEXT;");
    }
    if (!npCols.includes('twitter_url')) {
      db.exec("ALTER TABLE new_pairs ADD COLUMN twitter_url TEXT;");
    }
    if (!npCols.includes('telegram_url')) {
      db.exec("ALTER TABLE new_pairs ADD COLUMN telegram_url TEXT;");
    }
    if (!npCols.includes('metadata')) {
      db.exec("ALTER TABLE new_pairs ADD COLUMN metadata TEXT;");
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_new_pairs_source ON new_pairs(source);');

    // Normalize legacy timestamps without timezone to standard UTC ISO-8601
    db.exec(`
      UPDATE new_pairs 
      SET pair_created_at = replace(pair_created_at, ' ', 'T') || 'Z' 
      WHERE pair_created_at IS NOT NULL 
        AND pair_created_at NOT LIKE '%Z' 
        AND pair_created_at NOT LIKE '%+%';
    `);
  } catch (p3Err) {
    console.warn('[DB Phase 3 Notice]', p3Err.message);
  }

  // Promoted coins & Hybrid payment migrations
  try {
    const tokenCols = db.prepare('PRAGMA table_info(tokens)').all().map(c => c.name);
    if (!tokenCols.includes('reddit_url')) {
      db.exec('ALTER TABLE tokens ADD COLUMN reddit_url TEXT;');
    }

    const promoCols = db.prepare('PRAGMA table_info(promotions)').all().map(c => c.name);
    if (!promoCols.includes('auto_trading_url')) {
      db.exec('ALTER TABLE promotions ADD COLUMN auto_trading_url TEXT;');
    }
    if (!promoCols.includes('reddit_url')) {
      db.exec('ALTER TABLE promotions ADD COLUMN reddit_url TEXT;');
    }

    const orderCols = db.prepare('PRAGMA table_info(promotion_orders)').all().map(c => c.name);
    if (!orderCols.includes('tx_hash')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN tx_hash VARCHAR(255);');
    }
    if (!orderCols.includes('chain')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN chain VARCHAR(50);');
    }
    if (!orderCols.includes('contract_address')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN contract_address VARCHAR(255);');
    }
    if (!orderCols.includes('token_name')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN token_name VARCHAR(150);');
    }
    if (!orderCols.includes('token_symbol')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN token_symbol VARCHAR(50);');
    }
    if (!orderCols.includes('logo_url')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN logo_url TEXT;');
    }
    if (!orderCols.includes('website_url')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN website_url TEXT;');
    }
    if (!orderCols.includes('x_url')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN x_url TEXT;');
    }
    if (!orderCols.includes('telegram_url')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN telegram_url TEXT;');
    }
    if (!orderCols.includes('reddit_url')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN reddit_url TEXT;');
    }
    if (!orderCols.includes('payment_method')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN payment_method VARCHAR(50);');
    }
    if (!orderCols.includes('auto_trading_url')) {
      db.exec('ALTER TABLE promotion_orders ADD COLUMN auto_trading_url TEXT;');
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_orders_tx_hash ON promotion_orders(tx_hash) WHERE tx_hash IS NOT NULL;');
  } catch (promoMigErr) {
    console.warn('[DB Promotion Migration Notice]', promoMigErr.message);
  }

  // Auto-seed initial tokens if table is empty (e.g. on clean serverless start)
  if (!isSeeding) {
    try {
      const countRow = db.prepare('SELECT COUNT(*) as count FROM tokens').get();
      if (!countRow || countRow.count < 100) {
        console.log('[DB] Under-populated or fresh database detected. Auto-seeding full verified tokens pool...');
        isSeeding = true;
        const { runSeed } = require('./seeds/seed');
        runSeed(true);
        isSeeding = false;
      }
    } catch (seedErr) {
      isSeeding = false;
      console.warn('[DB Auto-seed Notice]', seedErr.message);
    }

    try {
      const npCount = db.prepare('SELECT COUNT(*) as count FROM new_pairs').get();
      if (!npCount || npCount.count === 0) {
        const { seedInitialPairsIfEmpty } = require('../services/newPairsService');
        seedInitialPairsIfEmpty();
      }
    } catch (npErr) {
      // Non-fatal if newPairsService not yet loaded
    }
  }

  // Normalize legacy/alias chain values in tokens table
  try {
    db.exec(`
      UPDATE tokens SET chain = 'solana-ecosystem' WHERE chain = 'solana' OR chain = 'sol';
      UPDATE tokens SET chain = 'binance-smart-chain' WHERE chain = 'bsc' OR chain = 'binance' OR chain = 'bnb';
      UPDATE tokens SET chain = 'ethereum-ecosystem' WHERE chain = 'ethereum' OR chain = 'eth';
      UPDATE tokens SET chain = 'base-ecosystem' WHERE chain = 'base';
    `);
  } catch (normErr) {
    // Non-fatal
  }

  // Restore and sync all submitted tokens permanently
  try {
    const { syncSubmittedTokensIntoDb } = require('./syncStore');
    syncSubmittedTokensIntoDb(db);
  } catch (syncErr) {
    console.warn('[DB Submitted Tokens Sync Notice]', syncErr.message);
  }

  // Initialize PostgreSQL if DATABASE_URL is configured
  try {
    const { isPostgresConfigured, initPostgresSchema } = require('./postgres');
    if (isPostgresConfigured()) {
      initPostgresSchema().catch(err => console.warn('[Postgres Init Notice]', err.message));
    }
  } catch (pgErr) {}

  console.log('[DB] Bulls Traking schema initialized.');
}

function query(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (err) {
    console.error('[DB Query Error]', sql, params, err);
    throw err;
  }
}

function queryOne(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  } catch (err) {
    console.error('[DB QueryOne Error]', sql, params, err);
    throw err;
  }
}

function execute(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  } catch (err) {
    console.error('[DB Execute Error]', sql, params, err);
    throw err;
  }
}

function transaction(fn) {
  execute('BEGIN TRANSACTION');
  try {
    const result = fn();
    execute('COMMIT');
    return result;
  } catch (err) {
    execute('ROLLBACK');
    throw err;
  }
}

module.exports = {
  db,
  initDatabase,
  query,
  queryOne,
  execute,
  transaction
};

// Ensure database schema is initialized on first load
try {
  initDatabase();
} catch (autoInitErr) {
  console.warn('[DB AutoInit Notice]', autoInitErr.message);
}
