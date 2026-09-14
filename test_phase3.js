/**
 * Bulls Traking — Phase 3 Automated Verification Suite
 * Tests New Pairs radar API, Watchlist batch endpoint, Signals API (public + admin auth),
 * and frontend asset integrity.
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

  // 3. GET /api/tokens/by-ids for Watchlist
  await test('3. GET /api/tokens/by-ids batch retrieves watchlisted tokens', async () => {
    // Get existing tokens first
    const topRes = await (await fetch(`${BASE_URL}/tokens/top?limit=2`)).json();
    const tokenIds = (topRes.tokens || []).map(t => t.id);
    assert.ok(tokenIds.length > 0, 'Should have at least 1 token in DB');

    const res = await fetch(`${BASE_URL}/tokens/by-ids?ids=${tokenIds.join(',')}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.tokens.length, tokenIds.length);
    assert.ok(data.tokens[0].price > 0, 'Returned token has valid price');
  });

  // 4. GET /api/signals (Public Alpha Signals)
  await test('4. GET /api/signals returns public signals feed', async () => {
    const res = await fetch(`${BASE_URL}/signals`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.signals), 'data.signals should be an array');
    assert.ok(data.signals.length > 0, 'Should have seeded or ingested alpha signals');
    console.log(`      Found ${data.signals.length} signals (Total: ${data.total}).`);
  });

  // 5. GET /api/signals with direction filter ('buy', 'sell', 'watch')
  await test('5. GET /api/signals?direction=buy filters correctly', async () => {
    const res = await (await fetch(`${BASE_URL}/signals?direction=buy`)).json();
    assert.strictEqual(res.success, true);
    for (const s of res.signals) {
      assert.strictEqual(s.direction, 'buy');
    }
  });

  // 6. POST /api/signals without x-admin-key -> 401 Unauthorized
  await test('6. POST /api/signals rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${BASE_URL}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Test Signal',
        message: 'This should be blocked without valid admin key',
        direction: 'buy'
      })
    });
    assert.strictEqual(res.status, 401, `Expected 401 Unauthorized, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // 7. POST /api/signals with valid x-admin-key -> 201 Created
  await test('7. POST /api/signals creates signal with valid x-admin-key', async () => {
    const testTitle = `Alpha Breakout Signal Test #${Date.now().toString().slice(-4)}`;
    const res = await fetch(`${BASE_URL}/signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'bulls_admin_secret_key'
      },
      body: JSON.stringify({
        title: testTitle,
        message: 'Massive accumulation volume detected on-chain. RSI continuation signal confirmed.',
        direction: 'buy',
        source: 'telegram_alpha_bot'
      })
    });
    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.signal.title, testTitle);
    assert.strictEqual(data.signal.direction, 'buy');
    assert.ok(data.signal.id > 0);
  });

  // 8. Admin routes x-admin-key verification
  await test('8. Admin endpoints properly enforce x-admin-key authorization', async () => {
    // Rejected without key
    const resNoAuth = await fetch(`${BASE_URL}/admin/submissions`);
    assert.strictEqual(resNoAuth.status, 401);

    // Accepted with valid key
    const resAuth = await fetch(`${BASE_URL}/admin/submissions`, {
      headers: { 'x-admin-key': 'bulls_admin_secret_key' }
    });
    assert.strictEqual(resAuth.status, 200);
  });

  // 9. Frontend Asset Integrity: HTML & Nav Links
  await test('9. Frontend index.html contains New Pairs, Watchlist, Signals, and Legal nav', () => {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(html.includes('href="#/new-pairs"'), 'Missing new-pairs nav link');
    assert.ok(html.includes('href="#/watchlist"'), 'Missing watchlist nav link');
    assert.ok(html.includes('href="#/signals"'), 'Missing signals nav link');
    assert.ok(html.includes('href="#/about"'), 'Missing about footer link');
    assert.ok(html.includes('href="#/terms-of-service"'), 'Missing terms footer link');
    assert.ok(html.includes('href="#/privacy-policy"'), 'Missing privacy footer link');
    assert.ok(html.includes('href="#/cookie-statement"'), 'Missing cookies footer link');
    assert.ok(html.includes('href="#/disclaimer"'), 'Missing disclaimer footer link');
  });

  // 10. Frontend Asset Integrity: app.js views and routes
  await test('10. app.js contains renderNewPairs, renderWatchlistPage, renderSignalsPage, and legal views', () => {
    const js = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
    assert.ok(js.includes('renderNewPairs'), 'Missing renderNewPairs');
    assert.ok(js.includes('renderWatchlistPage'), 'Missing renderWatchlistPage');
    assert.ok(js.includes('renderSignalsPage'), 'Missing renderSignalsPage');
    assert.ok(js.includes('renderAbout'), 'Missing renderAbout');
    assert.ok(js.includes('renderTerms'), 'Missing renderTerms');
    assert.ok(js.includes('renderPrivacy'), 'Missing renderPrivacy');
    assert.ok(js.includes('renderCookies'), 'Missing renderCookies');
    assert.ok(js.includes('renderDisclaimer'), 'Missing renderDisclaimer');
    assert.ok(js.includes('bt_watchlist'), 'Missing bt_watchlist localStorage key');
    assert.ok(js.includes('watch-star'), 'Missing watch-star CSS reference');
    assert.ok(js.includes('legal-disclaimer-box'), 'Missing legal review disclaimer notice');
  });

  // 11. Frontend Styles Integrity: styles.css classes
  await test('11. styles.css contains Watchlist, Signals, Radar, and Legal classes', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf-8');
    assert.ok(css.includes('.watch-star'), 'Missing .watch-star style');
    assert.ok(css.includes('.watch-star.is-active'), 'Missing .watch-star.is-active style');
    assert.ok(css.includes('.watchlist-empty'), 'Missing .watchlist-empty style');
    assert.ok(css.includes('.radar-disclaimer'), 'Missing .radar-disclaimer style');
    assert.ok(css.includes('.signals-grid'), 'Missing .signals-grid style');
    assert.ok(css.includes('.signal-badge.buy'), 'Missing .signal-badge.buy style');
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
