const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'bulltrack.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

// Enable WAL mode and foreign keys for high performance & integrity
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
} catch (e) {
  console.warn('[DB] Pragma setting notice:', e.message);
}

function initDatabase() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schemaSql);
  console.log('[DB] Relational schema initialized successfully.');
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
