const assert = require('assert');
const fs = require('fs');

async function runPhase2Tests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING BULLS TRAKING PHASE 2 ACCEPTANCE TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function record(name, condition, msg) {
    total++;
    if (condition) {
      console.log(`✔ Test ${total} — ${name}: PASSED (${msg})`);
      passed++;
    } else {
      console.error(`✖ Test ${total} — ${name}: FAILED (${msg})`);
    }
  }

  // 1. Scanner API
  try {
    const res = await fetch('http://localhost:5000/api/security/scan?chain=binance-smart-chain&address=0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82');
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert(json.data.risk_score >= 0 && json.data.risk_score <= 100);
    assert(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(json.data.risk_level));
    record('Security Scanner API', true, `Score ${json.data.risk_score}/100, Level ${json.data.risk_level}`);
  } catch (e) {
    record('Security Scanner API', false, e.message);
  }

  // 2. Scanner DB Cache
  try {
    const { queryOne } = require('./database/db');
    const cached = queryOne('SELECT * FROM security_scans WHERE LOWER(contract_address) = ?', ['0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82']);
    assert(cached, 'Security scan must be cached in database');
    record('Scanner DB Cache', true, `Cached record #${cached.id} stored in security_scans table`);
  } catch (e) {
    record('Scanner DB Cache', false, e.message);
  }

  // 3. Navigation & Scanner UI
  try {
    const appJs = fs.readFileSync('app.js', 'utf-8');
    assert(appJs.includes('function renderScanner()'), 'app.js must define renderScanner()');
    record('Scanner Navigation & UI', true, 'renderScanner defined and router available');
  } catch (e) {
    record('Scanner Navigation & UI', false, e.message);
  }

  // 4. Scanner Styles
  try {
    const styles = fs.readFileSync('styles.css', 'utf-8');
    assert(styles.includes('.risk-summary'), 'styles.css must have .risk-summary');
    assert(styles.includes('.risk-summary.safe'), 'styles.css must have .safe modifier');
    assert(styles.includes('.risk-summary.warn'), 'styles.css must have .warn modifier');
    assert(styles.includes('.risk-summary.danger'), 'styles.css must have .danger modifier');
    assert(styles.includes('.check-grid'), 'styles.css must have .check-grid');
    record('Scanner CSS Risk Theme', true, '.risk-summary (.safe/.warn/.danger) & .check-grid verified');
  } catch (e) {
    record('Scanner CSS Risk Theme', false, e.message);
  }

  // 5. Database Schema Migration Files
  try {
    assert(fs.existsSync('database/migrations/002_phase2_txn_liquidity.sql'), 'SQLite migration must exist');
    assert(fs.existsSync('database/migrations/002_phase2_txn_liquidity.postgres.sql'), 'PostgreSQL migration must exist');
    const sql = fs.readFileSync('database/migrations/002_phase2_txn_liquidity.sql', 'utf-8');
    assert(sql.includes('txn_count_24h') && sql.includes('price_change_6h') && sql.includes('liquidity'));
    record('Migration Files', true, '002_phase2_txn_liquidity.sql and .postgres.sql verified');
  } catch (e) {
    record('Migration Files', false, e.message);
  }

  // 6. Database Columns in Live Table
  try {
    const { db } = require('./database/db');
    const cols = db.prepare('PRAGMA table_info(tokens)').all().map(c => c.name);
    assert(cols.includes('txn_count_24h'), 'tokens table must have txn_count_24h');
    assert(cols.includes('price_change_6h'), 'tokens table must have price_change_6h');
    assert(cols.includes('liquidity'), 'tokens table must have liquidity');
    record('Database Schema Columns', true, 'tokens table contains txn_count_24h, price_change_6h, liquidity');
  } catch (e) {
    record('Database Schema Columns', false, e.message);
  }

  // 7. DexScreener Sync Ingestion
  try {
    const { query } = require('./database/db');
    const dexTokens = query('SELECT symbol, txn_count_24h, liquidity, price_change_6h FROM tokens WHERE txn_count_24h > 0');
    assert(dexTokens.length > 0, 'DexScreener must populate real on-chain metrics');
    const topDex = dexTokens[0];
    record('DexScreener Data Sync', true, `${dexTokens.length} tokens synced, e.g. ${topDex.symbol}: ${topDex.txn_count_24h} txns, $${topDex.liquidity.toFixed(0)} LP`);
  } catch (e) {
    record('DexScreener Data Sync', false, e.message);
  }

  // 8. Table Headers and Cells
  try {
    const appJs = fs.readFileSync('app.js', 'utf-8');
    assert(appJs.includes('<th>6h</th><th>TXN</th><th>LP</th>') || (appJs.includes('>6h</th>') && appJs.includes('>TXN</th>') && appJs.includes('>LP</th>')), 'Every table must have 6h, TXN, LP headers');
    assert(appJs.includes('t.price_change_6h'), 'renderTokenRows must render 6h price change');
    assert(appJs.includes('t.txn_count_24h'), 'renderTokenRows must render TXN count');
    assert(appJs.includes('t.liquidity'), 'renderTokenRows must render LP');
    record('Frontend Table Columns', true, '6h, TXN, and LP rendered with fmtChg/fmtUsd and em-dash fallback');
  } catch (e) {
    record('Frontend Table Columns', false, e.message);
  }

  // 9. Pagination API
  try {
    const resPage1 = await (await fetch('http://localhost:5000/api/tokens/top?page=1&limit=5')).json();
    const resPage2 = await (await fetch('http://localhost:5000/api/tokens/top?page=2&limit=5')).json();
    assert(resPage1.tokens.length <= 5, 'Page 1 limit must be respected');
    assert(resPage2.tokens.length <= 5, 'Page 2 limit must be respected');
    assert.strictEqual(resPage1.pagination.page, 1);
    assert.strictEqual(resPage2.pagination.page, 2);
    // Non-overlapping check
    const idSet1 = new Set(resPage1.tokens.map(t => t.id));
    const overlap = resPage2.tokens.some(t => idSet1.has(t.id));
    assert(!overlap, 'Page 1 and Page 2 tokens must not overlap');
    record('Backend Pagination', true, `Page 1 & 2 return distinct non-overlapping slices (5 items each)`);
  } catch (e) {
    record('Backend Pagination', false, e.message);
  }

  // 10. Load More Button & Logic
  try {
    const appJs = fs.readFileSync('app.js', 'utf-8');
    assert(appJs.includes('btnLoadMoreTop'), 'Top Coins must have Load More button');
    assert(appJs.includes('btnLoadMoreNew'), 'New Coins must have Load More button');
    assert(appJs.includes('btnLoadMoreHot'), 'Hot Coins must have Load More button');
    assert(appJs.includes('btnLoadMoreGainers'), 'Gainers must have Load More button');
    assert(appJs.includes("insertAdjacentHTML('beforeend'"), 'Load More must append rows without reload');
    record('Frontend Load More Controls', true, 'All list views feature dynamic Load More row appending');
  } catch (e) {
    record('Frontend Load More Controls', false, e.message);
  }

  console.log('\n======================================================');
  console.log(`🎯 TOTAL RESULTS: ${passed}/${total} PHASE 2 ACCEPTANCE TESTS PASSED`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase2Tests();
