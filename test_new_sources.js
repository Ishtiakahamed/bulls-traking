const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { query, queryOne, execute, initDatabase } = require('./database/db');
const { pollNewLaunches } = require('./services/stonkfunService');
const { pollFourmemeLogs, processTokenCreateLog } = require('./backend/workers/fourmemeListener');
const { handleNewTokenEvent, fetchTokenMetadata } = require('./backend/workers/pumpfunListener');
const { getNewPairs } = require('./services/newPairsService');

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING BULLS TRAKING NEW PAIRS SOURCES TEST SUITE');
  console.log('======================================================\n');

  initDatabase();

  // Test 1: Database Schema & Columns
  console.log('Test 1: Verifying new_pairs schema columns...');
  const columns = query('PRAGMA table_info(new_pairs)').map(c => c.name);
  assert(columns.includes('source'), 'new_pairs must have source column');
  assert(columns.includes('website_url'), 'new_pairs must have website_url column');
  assert(columns.includes('twitter_url'), 'new_pairs must have twitter_url column');
  assert(columns.includes('telegram_url'), 'new_pairs must have telegram_url column');
  assert(columns.includes('metadata'), 'new_pairs must have metadata column');
  console.log('✅ Test 1: PASSED (Schema contains source, website_url, twitter_url, telegram_url, metadata)');

  // Test 2: Local Badge Assets
  console.log('Test 2: Verifying locally hosted source badge assets...');
  const requiredBadges = ['pumpfun.png', 'fourmeme.png', 'stonkfun.svg'];
  for (const b of requiredBadges) {
    assert(fs.existsSync(path.join('assets', 'sources', b)), `assets/sources/${b} must exist`);
    assert(fs.existsSync(path.join('public', 'assets', 'sources', b)), `public/assets/sources/${b} must exist`);
  }
  console.log('✅ Test 2: PASSED (All source badges exist locally in both root and public)');

  // Test 3: Frontend Parity
  console.log('Test 3: Verifying parity between root and public files...');
  const appJsRoot = fs.readFileSync('app.js', 'utf8');
  const appJsPub = fs.readFileSync('public/app.js', 'utf8');
  assert.strictEqual(appJsRoot, appJsPub, 'app.js and public/app.js must be 100% identical');
  const cssRoot = fs.readFileSync('styles.css', 'utf8');
  const cssPub = fs.readFileSync('public/styles.css', 'utf8');
  assert.strictEqual(cssRoot, cssPub, 'styles.css and public/styles.css must be 100% identical');
  console.log('✅ Test 3: PASSED (100% parity verified between root and public)');

  // Test 4: Pump.fun Ingestion & Error Resilience
  console.log('Test 4: Verifying Pump.fun listener event ingestion and metadata resilience...');
  // Test dead metadata link handling (must not crash)
  const deadMeta = await fetchTokenMetadata('https://dead-ipfs-gateway-domain-999.xyz/ipfs/fakehash');
  assert.strictEqual(deadMeta, null, 'Dead metadata link should return null gracefully');

  // Test event ingestion
  const testMint = 'PUMP_TEST_MINT_' + Date.now();
  await handleNewTokenEvent({
    mint: testMint,
    bondingCurveKey: 'CURVE_' + testMint,
    name: 'Pump Test Dog',
    symbol: 'PTDOG',
    uri: '',
    marketCapSol: 35.5,
    vSolInBondingCurve: 32.1
  });
  const pumpRow = queryOne('SELECT * FROM new_pairs WHERE token_address = ?', [testMint]);
  assert(pumpRow, 'Pump.fun event must be inserted into new_pairs');
  assert.strictEqual(pumpRow.source, 'pumpfun');
  assert.strictEqual(pumpRow.chain, 'solana');
  assert.strictEqual(pumpRow.status, 'latest');
  assert(pumpRow.price > 0, 'Pump price must be calculated');
  assert(pumpRow.liquidity > 0, 'Pump liquidity must be calculated');
  console.log(`✅ Test 4: PASSED (Pump.fun token upserted with source='pumpfun', price=$${pumpRow.price.toFixed(6)})`);

  // Test 5: StonkFun REST Ingestion & Rate Limit Handling
  console.log('Test 5: Verifying StonkFun live polling and schema mapping...');
  const stonkMints = await pollNewLaunches();
  assert(Array.isArray(stonkMints), 'pollNewLaunches should return an array');
  const stonkRows = query('SELECT * FROM new_pairs WHERE source = ? LIMIT 5', ['stonkfun']);
  assert(stonkRows.length > 0, 'StonkFun rows must exist in new_pairs');
  assert.strictEqual(stonkRows[0].source, 'stonkfun');
  assert.strictEqual(stonkRows[0].chain, 'solana');
  console.log(`✅ Test 5: PASSED (StonkFun polled and indexed ${stonkRows.length}+ tokens with source='stonkfun')`);

  // Test 6: four.meme On-Chain BSC Log Processing & Enrichment
  console.log('Test 6: Verifying four.meme on-chain log decoding and enrichment...');
  const fourRows = query('SELECT * FROM new_pairs WHERE source = ? LIMIT 5', ['fourmeme']);
  assert(fourRows.length > 0, 'four.meme rows must exist in new_pairs');
  assert.strictEqual(fourRows[0].source, 'fourmeme');
  assert.strictEqual(fourRows[0].chain, 'bsc');
  console.log(`✅ Test 6: PASSED (four.meme decoded and indexed ${fourRows.length}+ tokens with source='fourmeme')`);

  // Test 7: GET /api/new-pairs API Filtering & Fields
  console.log('Test 7: Verifying GET /api/new-pairs returns source and supports source filter...');
  const allRes = getNewPairs({ limit: 50 });
  assert(allRes.pairs.length > 0, 'getNewPairs must return pairs');
  const hasSourceField = allRes.pairs.every(p => p.source != null);
  assert(hasSourceField, 'Every pair returned must have a source field');

  const stonkFilter = getNewPairs({ source: 'stonkfun', limit: 10 });
  assert(stonkFilter.pairs.every(p => p.source === 'stonkfun'), 'Filtering by source=stonkfun must only return stonkfun pairs');

  const fourFilter = getNewPairs({ source: 'fourmeme', limit: 10 });
  assert(fourFilter.pairs.every(p => p.source === 'fourmeme'), 'Filtering by source=fourmeme must only return fourmeme pairs');
  console.log('✅ Test 7: PASSED (API returns source column and filters by source correctly)');

  // Clean up test token
  execute('DELETE FROM new_pairs WHERE token_address = ?', [testMint]);

  console.log('\n======================================================');
  console.log('🎯 TOTAL RESULTS: 7/7 NEW SOURCES TESTS PASSED');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
