const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'bullstraking.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  console.warn('[DB] Pragma setting notice:', e.message);
}

function initDatabase() {
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
  } catch (migErr) {
    console.warn('[DB Migration Notice]', migErr.message);
  }

  console.log('[DB] Bulls Traking Phase 1 & 2 schema initialized.');
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
