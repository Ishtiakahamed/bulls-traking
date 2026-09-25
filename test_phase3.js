/**
 * Bulls Traking — Phase 3 Automated Verification Suite
 * Tests New Pairs radar API, admin authentication, and retained frontend asset integrity.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';

async function runPhase3Tests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING BULLS TRAKING PHASE 3 TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error('   Error:', err.message);
    }
  }

  // 1. GET /api/new-pairs endpoint
  await test('1. GET /api/new-pairs returns discovered on-chain pairs', async () => {
    const res = await fetch(`${BASE_URL}/new-pairs`);
    assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.pairs), 'data.pairs should be an array');
    console.log(`      Found ${data.pairs.length} pairs in new-pairs feed.`);
  });

  // 2. GET /api/new-pairs subtabs (latest, trending, matured)
  await test('2. GET /api/new-pairs?tab=latest & ?tab=trending & ?tab=matured classification', async () => {
    const resLatest = await (await fetch(`${BASE_URL}/new-pairs?tab=latest`)).json();
    assert.strictEqual(resLatest.success, true);

    const resTrending = await (await fetch(`${BASE_URL}/new-pairs?tab=trending`)).json();
    assert.strictEqual(resTrending.success, true);

    const resMatured = await (await fetch(`${BASE_URL}/new-pairs?tab=matured`)).json();
    assert.strictEqual(resMatured.success, true);
  });

  // 3. Admin routes x-admin-key verification
  await test('8. Admin endpoints properly enforce x-admin-key authorization', async () => {
    // Rejected without key
    const resNoAuth = await fetch(`${BASE_URL}/admin/submissions`);
    assert.strictEqual(resNoAuth.status, 401);

    // Accepted with valid key
    const resAuth = await fetch(`${BASE_URL}/admin/submissions`, {
      headers: { 'x-admin-key': process.env.ADMIN_API_KEY || 'Ishtiak734@' }
    });
    assert.strictEqual(resAuth.status, 200);
  });

  // 9. Frontend Asset Integrity: HTML & Nav Links
  await test('9. Frontend index.html contains New Pairs and Legal nav', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(html.includes('href="#/new-pairs"'), 'Missing new-pairs nav link');
    assert.ok(!html.includes('href="#/signals"'), 'Signals navigation must be removed');
    assert.ok(html.includes('href="#/about"'), 'Missing about footer link');
    assert.ok(html.includes('href="#/terms-of-service"'), 'Missing terms footer link');
    assert.ok(html.includes('href="#/privacy-policy"'), 'Missing privacy footer link');
    assert.ok(html.includes('href="#/cookie-statement"'), 'Missing cookies footer link');
    assert.ok(html.includes('href="#/disclaimer"'), 'Missing disclaimer footer link');
  });

  // 10. Frontend Asset Integrity: app.js views and routes
  await test('10. app.js contains retained views and no removed page views', () => {
    const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
    assert.ok(js.includes('renderNewPairs'), 'Missing renderNewPairs');
    assert.ok(!js.includes('renderWatchlistPage'), 'Watchlist view must be removed');
    assert.ok(!js.includes('renderSignalsPage'), 'Signals view must be removed');
    assert.ok(js.includes('renderAbout'), 'Missing renderAbout');
    assert.ok(js.includes('renderTerms'), 'Missing renderTerms');
    assert.ok(js.includes('renderPrivacy'), 'Missing renderPrivacy');
    assert.ok(js.includes('renderCookies'), 'Missing renderCookies');
    assert.ok(js.includes('renderDisclaimer'), 'Missing renderDisclaimer');
    assert.ok(js.includes('legal-disclaimer-box'), 'Missing legal review disclaimer notice');
  });

  // 11. Frontend Styles Integrity: styles.css classes
  await test('11. styles.css contains retained Radar and Legal classes', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf-8');
    assert.ok(css.includes('.radar-disclaimer'), 'Missing .radar-disclaimer style');
    assert.ok(css.includes('.legal-container'), 'Missing .legal-container style');
  });

  console.log('\n======================================================');
  console.log(`📊 PHASE 3 TEST RESULTS: ${passed}/${total} TESTS PASSED`);
  if (passed === total) {
    console.log('🎉 ALL PHASE 3 ACCEPTANCE CRITERIA SATISFIED 100%!');
  } else {
    console.log('⚠️ Some tests failed. Please review the output above.');
  }
  console.log('======================================================\n');
}

runPhase3Tests();
