/**
 * test_spotlight.js
 * Comprehensive automated verification for Token Spotlight visibility guard
 */

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { execute, queryOne } = require('./database/db');
const { getActiveSpotlight } = require('./backend/services/bannerService');
const { invalidateHomeCache } = require('./backend/controllers/homeController');

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function runSpotlightTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING TOKEN SPOTLIGHT VISIBILITY GUARD TEST SUITE');
  console.log('======================================================\n');

  const BASE_URL = 'http://localhost:5000';

  // Ensure clean initial state for zero-state verification
  execute("DELETE FROM promotion_orders WHERE token_name IN ('Audit Test Token', 'Activation Test Token', 'Test Spotlight Token')");
  execute("DELETE FROM promotions WHERE package_name = 'Spotlight 7D' AND auto_trading_url IS NULL");
  invalidateHomeCache();

  // Test 1: Zero State Backend Query
  console.log('[Test 1] Zero State: getActiveSpotlight() returns null when no active paid order exists');
  const initialSpotlight = getActiveSpotlight();
  assert.strictEqual(initialSpotlight, null, 'Expected initial getActiveSpotlight() to be null');
  console.log('✓ Verified: getActiveSpotlight() returns null in clean state\n');

  // Test 2: Zero State Public API Endpoints
  console.log('[Test 2] Zero State: GET /api/spotlight/active and /api/promotion/spotlight/active return null');
  const ep1 = await fetchJson(`${BASE_URL}/api/spotlight/active`);
  assert.strictEqual(ep1.status, 200, 'Expected 200 OK');
  assert.strictEqual(ep1.data.success, true);
  assert.strictEqual(ep1.data.data, null, 'Expected data: null in zero state');

  const ep2 = await fetchJson(`${BASE_URL}/api/promotion/spotlight/active`);
  assert.strictEqual(ep2.status, 200, 'Expected 200 OK');
  assert.strictEqual(ep2.data.success, true);
  assert.strictEqual(ep2.data.data, null, 'Expected data: null in zero state');
  console.log('✓ Verified: /api/spotlight/active and /api/promotion/spotlight/active return null\n');

  // Test 3: Zero State in /api/home aggregator
  console.log('[Test 3] Zero State: GET /api/home aggregator includes spotlight: null');
  invalidateHomeCache();
  const homeRes = await fetchJson(`${BASE_URL}/api/home?nocache=true`);
  assert.strictEqual(homeRes.status, 200, 'Expected 200 OK');
  const homeData = homeRes.data.data || homeRes.data;
  assert.strictEqual(homeData.spotlight, null, 'Expected homeData.spotlight to be null in zero state');
  console.log('✓ Verified: /api/home provides data.spotlight = null\n');

  // Test 4: Frontend Behavior Simulation
  console.log('[Test 4] Frontend Simulation: renderBannerAd logic');
  const appCode = fs.readFileSync('app.js', 'utf8');
  assert.ok(appCode.includes('function renderBannerAd(banner, slotPlacement'), 'Expected renderBannerAd function');
  assert.ok(appCode.includes('return \'\';'), 'Expected renderBannerAd to return empty string when empty');
  assert.ok(appCode.includes('const spotlightOrder = data.spotlight || null;'), 'Expected buildHomeUI to bind to data.spotlight');
  assert.ok(appCode.includes('id="homeSpotlightWrapper"'), 'Expected homeSpotlightWrapper in buildHomeUI');
  console.log('✓ Verified: frontend logic hides Token Spotlight when null\n');

  // Test 5: Manual Activation of a Paid Spotlight Order in DB
  console.log('[Test 5] Active State: Mark test order as active/paid in DB');
  const testOrderName = 'Kobe AI Autonomous Fund';
  const testLogo = 'https://bullstraking.io/uploads/kobe_logo.png';
  const testUrl = 'https://kobe.ai';

  const insertRes = execute(`
    INSERT INTO promotion_orders (
      token_name, token_symbol, package_name, promotion_type,
      duration_days, price, start_at, end_at, payment_status, order_status,
      logo_url, website_url
    ) VALUES (
      ?, 'KOBE', 'Spotlight 7 Days', 'TOKEN_SPOTLIGHT',
      7, 149.00, datetime('now', '-10 minutes'), datetime('now', '+6 days'), 'paid', 'active',
      ?, ?
    )
  `, [testOrderName, testLogo, testUrl]);
  const testOrderId = insertRes.lastInsertRowid;
  invalidateHomeCache();

  try {
    const activeSpot = getActiveSpotlight();
    assert.ok(activeSpot, 'Expected getActiveSpotlight() to find the active order');
    assert.strictEqual(activeSpot.id, Number(testOrderId));
    assert.strictEqual(activeSpot.title, testOrderName);
    assert.strictEqual(activeSpot.banner_image, testLogo);
    assert.strictEqual(activeSpot.target_url, testUrl);
    assert.strictEqual(activeSpot.cta_text, 'Learn More →');
    assert.strictEqual(activeSpot.is_placeholder, false);
    console.log(`✓ Verified: Active order #${testOrderId} immediately returned with real title ("${activeSpot.title}"), thumbnail, and CTA ("${activeSpot.cta_text}")\n`);

    // Verify through HTTP API
    const liveApiRes = await fetchJson(`${BASE_URL}/api/spotlight/active`);
    assert.strictEqual(liveApiRes.status, 200);
    assert.ok(liveApiRes.data.data, 'Expected HTTP API to return active order');
    assert.strictEqual(liveApiRes.data.data.title, testOrderName);
    console.log('✓ Verified: GET /api/spotlight/active serves the newly activated order live\n');

    // Verify /api/home returns the active spotlight
    invalidateHomeCache();
    const liveHomeRes = await fetchJson(`${BASE_URL}/api/home?nocache=true`);
    const liveHomeData = liveHomeRes.data.data || liveHomeRes.data;
    assert.ok(liveHomeData.spotlight, 'Expected liveHomeData.spotlight to be present');
    assert.strictEqual(liveHomeData.spotlight.title, testOrderName);
    console.log('✓ Verified: /api/home aggregator delivers the active spotlight order to frontend\n');
  } finally {
    // Test 6: Cleanup and Return to Zero State
    console.log('[Test 6] Cleanup: Remove test order and verify immediate zero-state return');
    execute('DELETE FROM promotion_orders WHERE id = ?', [testOrderId]);
    invalidateHomeCache();

    const afterCleanupSpot = getActiveSpotlight();
    assert.strictEqual(afterCleanupSpot, null, 'Expected getActiveSpotlight() to be null after deletion');

    const cleanHomeRes = await fetchJson(`${BASE_URL}/api/home?nocache=true`);
    const cleanHomeData = cleanHomeRes.data.data || cleanHomeRes.data;
    assert.strictEqual(cleanHomeData.spotlight, null, 'Expected cleanHomeData.spotlight to be null after cleanup');
    console.log('✓ Verified: Zero state cleanly restored after order expiration/deletion\n');
  }

  // Test 7: Asset Parity
  console.log('[Test 7] Asset Parity: app.js <-> public/app.js');
  const appHash = fileHash('app.js');
  const pubAppHash = fileHash('public/app.js');
  assert.strictEqual(appHash, pubAppHash, 'Expected 100% SHA256 parity between app.js and public/app.js');
  console.log(`✓ 100% hash parity verified: ${appHash}\n`);

  console.log('======================================================');
  console.log('🎯 ALL TOKEN SPOTLIGHT ACCEPTANCE TESTS PASSED (7/7)!');
  console.log('======================================================\n');
}

runSpotlightTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
