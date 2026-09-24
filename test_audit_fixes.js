/**
 * Bulls Traking — Automated Code Audit & Fixes Verification Suite
 * Exercises all security, payment, admin authentication, upload, layout, and placement fixes.
 */

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

const BASE_URL = 'http://localhost:5000';
const ADMIN_KEY = process.env.ADMIN_API_KEY || 'Ishtiak734@';

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

async function runAuditTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING BULLS TRAKING COMPLETE CODE AUDIT VERIFICATION SUITE');
  console.log('================================================================\n');

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
      throw err;
    }
  }

  // 1. Solana Payment Security
  await test('1. Solana Payment Verification: Rejects bad mint, wrong recipient, underpayment, reverted tx', async () => {
    const { verifySolanaTransaction, SOLANA_USDC_MINT } = require('./backend/services/cryptoPaymentService');
    assert.strictEqual(SOLANA_USDC_MINT, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    await assert.rejects(
      () => verifySolanaTransaction({ txHash: 'TEST_BAD_MINT_123', expectedAmountUsd: 149 }),
      /Counterfeit Mint/
    );

    await assert.rejects(
      () => verifySolanaTransaction({ txHash: 'TEST_BAD_RECIPIENT_123', expectedAmountUsd: 149 }),
      /treasury/
    );

    await assert.rejects(
      () => verifySolanaTransaction({ txHash: 'TEST_UNDERPAY_123', expectedAmountUsd: 149 }),
      /Insufficient/
    );

    await assert.rejects(
      () => verifySolanaTransaction({ txHash: 'TEST_REVERTED_123', expectedAmountUsd: 149 }),
      /failed/
    );

    const validSol = await verifySolanaTransaction({ txHash: 'TEST_SIMULATION_SOL_1', expectedAmountUsd: 149 });
    assert.strictEqual(validSol.success, true);
    assert.strictEqual(validSol.mint, SOLANA_USDC_MINT);
  });

  // 2. EVM Payment Security
  await test('2. EVM Payment Verification: Rejects counterfeit token contract, wrong recipient, underpayment', async () => {
    const { verifyEvmTransaction, OFFICIAL_EVM_TOKENS } = require('./backend/services/cryptoPaymentService');
    assert.ok(OFFICIAL_EVM_TOKENS.bsc);
    assert.ok(OFFICIAL_EVM_TOKENS.ethereum);
    assert.ok(OFFICIAL_EVM_TOKENS.base);

    await assert.rejects(
      () => verifyEvmTransaction({ txHash: 'TEST_BAD_CONTRACT_123', expectedAmountUsd: 199, chain: 'bsc' }),
      /Counterfeit Token/
    );

    await assert.rejects(
      () => verifyEvmTransaction({ txHash: 'TEST_BAD_RECIPIENT_123', expectedAmountUsd: 199, chain: 'bsc' }),
      /treasury/
    );

    await assert.rejects(
      () => verifyEvmTransaction({ txHash: 'TEST_UNDERPAY_123', expectedAmountUsd: 199, chain: 'bsc' }),
      /Insufficient/
    );

    await assert.rejects(
      () => verifyEvmTransaction({ txHash: 'TEST_REVERTED_123', expectedAmountUsd: 199, chain: 'bsc' }),
      /reverted/
    );

    const validEvm = await verifyEvmTransaction({ txHash: 'TEST_SIMULATION_BSC_1', expectedAmountUsd: 199, chain: 'bsc' });
    assert.strictEqual(validEvm.success, true);
    assert.strictEqual(validEvm.tokenContract.toLowerCase(), OFFICIAL_EVM_TOKENS.bsc.toLowerCase());
  });

  // 3. Webhook Protection & Admin Audit Trail
  await test('3. Webhook Protection: Missing signature returns 403, invalid returns 401', async () => {
    const resNoSig = await fetchJson(`${BASE_URL}/api/promotions/payment-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { payment_id: 12345, payment_status: 'finished', order_id: 1 }
    });
    assert.strictEqual(resNoSig.status, 403, 'Missing signature must return 403');

    const resBadSig = await fetchJson(`${BASE_URL}/api/promotions/payment-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nowpayments-sig': 'bad_fake_signature_hash'
      },
      body: { payment_id: 12345, payment_status: 'finished', order_id: 1 }
    });
    assert.ok([401, 403].includes(resBadSig.status), 'Invalid signature must return 401 or 403');
  });

  // 4. Server-Authoritative Promotion Order & Pending State
  await test('4. Promotion Order: Server-authoritative price & pending creation status', async () => {
    const res = await fetchJson(`${BASE_URL}/api/promotions/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        tokenName: 'Audit Test Token',
        tokenSymbol: 'ATT',
        chain: 'bsc',
        contractAddress: '0x1111111111111111111111111111111111111111',
        packageKey: '7D',
        price: 1.00, // Client tries to override price to $1
        durationDays: 365 // Client tries to override duration
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.price, 149, 'Client price override must be ignored, server price $149 used');
    assert.strictEqual(res.data.durationDays, 7, 'Client duration override must be ignored, 7 days used');

    // Verify order in database is pending and has null start_at
    const { queryOne } = require('./database/db');
    const dbOrder = queryOne('SELECT * FROM promotion_orders WHERE id = ?', [res.data.orderId]);
    assert.strictEqual(dbOrder.payment_status, 'pending');
    assert.strictEqual(dbOrder.order_status, 'pending');
    assert.strictEqual(dbOrder.start_at, null);
    assert.strictEqual(dbOrder.end_at, null);
  });

  // 5. Admin Promotion Activation: Idempotent and logs in admin_logs
  await test('5. Admin Promotion Activation: Idempotent and audit logged', async () => {
    const { activatePromotionFromOrder } = require('./backend/services/promotionService');
    const { queryOne } = require('./database/db');

    // Create a pending order to activate
    const orderRes = await fetchJson(`${BASE_URL}/api/promotions/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        tokenName: 'Activation Test Token',
        tokenSymbol: 'ACT',
        chain: 'bsc',
        contractAddress: '0x2222222222222222222222222222222222222222',
        packageKey: '3D'
      }
    });

    const orderId = orderRes.data.orderId;
    const act1 = activatePromotionFromOrder(orderId, 'MANUAL_TG_VERIFIED');
    assert.strictEqual(act1.success, true);
    assert.strictEqual(act1.alreadyActive, false);

    const activatedOrder = queryOne('SELECT * FROM promotion_orders WHERE id = ?', [orderId]);
    assert.strictEqual(activatedOrder.payment_status, 'paid');
    assert.strictEqual(activatedOrder.order_status, 'active');
    assert.ok(activatedOrder.start_at !== null);

    // Call second time -> must be idempotent
    const act2 = activatePromotionFromOrder(orderId, 'MANUAL_TG_VERIFIED');
    assert.strictEqual(act2.success, true);
    assert.strictEqual(act2.alreadyActive, true);
    const afterSecond = queryOne('SELECT * FROM promotion_orders WHERE id = ?', [orderId]);
    assert.strictEqual(afterSecond.start_at, activatedOrder.start_at, 'start_at must not be reset on re-activation');

    // Check admin_logs
    const log = queryOne('SELECT * FROM admin_logs WHERE action = ? AND entity_id = ? ORDER BY id DESC LIMIT 1', ['ACTIVATE_PROMOTION_ORDER', orderId]);
    assert.ok(log, 'Activation action must be recorded in admin_logs');
  });

  // 6. Banner Order Pending State & Server Authoritative Pricing
  let testBannerId = null;
  await test('6. Banner Order: Created as pending, server package pricing, hidden from active endpoint', async () => {
    const res = await fetchJson(`${BASE_URL}/api/banners/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        title: 'Audit Banner Test Alpha',
        targetUrl: 'https://audit-banner.example.com',
        bannerImage: 'https://audit-banner.example.com/banner.png',
        placement: 'top_banner_2',
        price: 5.00, // Client tries to override price to $5
        durationDays: 365
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    testBannerId = res.data.data.id;
    assert.strictEqual(res.data.data.payment_status, 'pending');
    assert.strictEqual(res.data.data.approval_status, 'pending');
    assert.strictEqual(res.data.data.price, 199, 'Server package price ($199) must be enforced');
    assert.strictEqual(res.data.data.durationDays, 7);

    // Ensure pending banner is NOT visible in public active banners
    const activeRes = await fetchJson(`${BASE_URL}/api/banners/active`);
    const activeBanners = activeRes.data.data;
    const foundInActive = (activeBanners.top_banners || []).some(b => b.id === testBannerId);
    assert.strictEqual(foundInActive, false, 'Pending banner order must never appear in public active banners');
  });

  // 7. Admin Banner Authentication: 401 without key, 403 with wrong key, 200 with valid key
  await test('7. Admin Banner Authentication: 401 missing key, 403 wrong key, 200 valid key', async () => {
    const resNoKey = await fetchJson(`${BASE_URL}/api/admin/banners`);
    assert.strictEqual(resNoKey.status, 401, 'Missing key must return 401');

    const resWrongKey = await fetchJson(`${BASE_URL}/api/admin/banners`, {
      headers: { 'x-admin-key': 'definitely_wrong_admin_key_12345' }
    });
    assert.strictEqual(resWrongKey.status, 403, 'Invalid key must return 403');

    const resValidKey = await fetchJson(`${BASE_URL}/api/admin/banners`, {
      headers: { 'x-admin-key': ADMIN_KEY }
    });
    assert.strictEqual(resValidKey.status, 200, 'Valid key must return 200');
    assert.ok(Array.isArray(resValidKey.data.data));
  });

  // 8. Admin Banner Activation: Idempotent & visible after activation
  await test('8. Admin Banner Activation: Idempotent and appears in active banners after activation', async () => {
    assert.ok(testBannerId, 'testBannerId must exist from Test 6');

    // Unauthenticated activation rejected
    const unauthRes = await fetchJson(`${BASE_URL}/api/admin/banners/${testBannerId}/activate`, {
      method: 'POST'
    });
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated activation must be rejected with 401');

    // Authenticated activation succeeds
    const authRes = await fetchJson(`${BASE_URL}/api/admin/banners/${testBannerId}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      },
      body: { note: 'Telegram manual clearance verified by admin' }
    });
    assert.strictEqual(authRes.status, 200);
    assert.strictEqual(authRes.data.success, true);
    assert.strictEqual(authRes.data.alreadyActive, false);
    assert.strictEqual(authRes.data.order.payment_status, 'paid');
    assert.strictEqual(authRes.data.order.approval_status, 'approved');

    // Re-activating is idempotent
    const reActRes = await fetchJson(`${BASE_URL}/api/admin/banners/${testBannerId}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY
      }
    });
    assert.strictEqual(reActRes.data.alreadyActive, true);

    // Now active banner MUST be visible in active banners endpoint
    const activeRes = await fetchJson(`${BASE_URL}/api/banners/active`);
    const activeBanners = activeRes.data.data;
    const foundInActive = (activeBanners.top_banners || []).some(b => b.id === testBannerId);
    assert.strictEqual(foundInActive, true, 'Activated banner must now appear in public active banners');
  });

  // 9. Upload Security: Magic bytes, rejecting unsafe SVGs/scripts, size limits
  await test('9. Upload Endpoint Security: Magic bytes verification & unsafe SVG rejection', async () => {
    // A: SVG with active script rejected with 400
    const svgScriptBase64 = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64');
    const resSvg = await fetchJson(`${BASE_URL}/api/upload-logo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { imageBase64: svgScriptBase64 }
    });
    assert.strictEqual(resSvg.status, 400, 'Unsafe SVG must be rejected with 400');

    // B: Fake image (plain text base64) rejected with 400
    const fakeImgBase64 = 'data:image/png;base64,' + Buffer.from('This is not a real image binary').toString('base64');
    const resFake = await fetchJson(`${BASE_URL}/api/upload-logo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { imageBase64: fakeImgBase64 }
    });
    assert.strictEqual(resFake.status, 400, 'Fake image without PNG magic bytes must be rejected with 400');

    // C: Valid 1x1 PNG accepted
    const validPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const resValidPng = await fetchJson(`${BASE_URL}/api/upload-logo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { imageBase64: validPngBase64 }
    });
    assert.strictEqual(resValidPng.status, 200, 'Valid PNG must be accepted with 200');
    assert.strictEqual(resValidPng.data.success, true);
    assert.ok(resValidPng.data.url, 'Valid upload must return URL');

    // D: Oversized logo payload rejected
    const hugeBuffer = Buffer.alloc(2.5 * 1024 * 1024, 0x89);
    hugeBuffer[1] = 0x50; hugeBuffer[2] = 0x4E; hugeBuffer[3] = 0x47;
    const hugeBase64 = 'data:image/png;base64,' + hugeBuffer.toString('base64');
    const resHuge = await fetchJson(`${BASE_URL}/api/upload-logo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { imageBase64: hugeBase64 }
    });
    assert.strictEqual(resHuge.status, 400, 'Oversized logo payload (>2MB) must be rejected with 400');
  });

  // 10. URL & Contract Address Validators
  await test('10. Server Input Validators: Rejects malicious URL schemes & malformed addresses', async () => {
    const { validateHttpsUrl, validateContractAddress } = require('./backend/utils/validators');

    assert.throws(() => validateHttpsUrl('javascript:alert(1)'), /scheme/);
    assert.throws(() => validateHttpsUrl('data:text/html;base64,PHNjcmlwdD4='), /scheme/);
    assert.throws(() => validateHttpsUrl('http://insecure-domain.com'), /https/);
    assert.throws(() => validateHttpsUrl('https://localhost:8080/admin'), /Localhost/);
    assert.strictEqual(validateHttpsUrl('https://example.com/project'), 'https://example.com/project');

    // Solana base58 check
    assert.throws(() => validateContractAddress('0xinvalidSolanaAddress', 'solana'), /Solana/);
    assert.strictEqual(validateContractAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'solana'), 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    // EVM 0x address check
    assert.throws(() => validateContractAddress('not_an_evm_address', 'bsc'), /EVM/);
    assert.strictEqual(validateContractAddress('0x55d398326f99059fF775485246999027B3197955', 'bsc'), '0x55d398326f99059fF775485246999027B3197955');
  });

  // 11. Frontend Parity & Class Integrity
  await test('11. Frontend Parity: 100% SHA256 match between root and public/ assets', async () => {
    assert.strictEqual(fileHash('app.js'), fileHash('public/app.js'), 'app.js and public/app.js must match');
    assert.strictEqual(fileHash('styles.css'), fileHash('public/styles.css'), 'styles.css and public/styles.css must match');

    const appContent = fs.readFileSync('app.js', 'utf8');
    const stylesContent = fs.readFileSync('styles.css', 'utf8');

    // Undeclared variable fix in initBannerHandlers
    assert.ok(appContent.includes('const prevSlotIndicatorBadge = document.getElementById'), 'prevSlotIndicatorBadge must be declared in initBannerHandlers');
    assert.ok(appContent.includes('const btnCreateBannerOrder = document.getElementById'), 'btnCreateBannerOrder must be declared in initBannerHandlers');

    // 3-slot preview trio grid
    assert.ok(stylesContent.includes('.banner-preview-trio'), 'styles.css must contain .banner-preview-trio');
    assert.ok(stylesContent.includes('.banner-preview-slot'), 'styles.css must contain .banner-preview-slot');
    assert.ok(appContent.includes('banner-preview-trio'), 'app.js must contain banner-preview-trio');

    // 2-column promoted card layout
    assert.ok(stylesContent.includes('.promoted-card-main'), 'styles.css must contain .promoted-card-main');
    assert.ok(stylesContent.includes('.promoted-card-metrics'), 'styles.css must contain .promoted-card-metrics');
    assert.ok(appContent.includes('promoted-card-main'), 'app.js must use promoted-card-main');
    assert.ok(appContent.includes('promoted-card-metrics'), 'app.js must use promoted-card-metrics');

    // Mobile social buttons
    assert.ok(stylesContent.includes('.social-links-mobile'), 'styles.css must contain .social-links-mobile');
    assert.ok(appContent.includes('renderMobileSocialLinks'), 'app.js must contain renderMobileSocialLinks');
    assert.ok(appContent.includes('social-links-mobile'), 'app.js must render social-links-mobile in token rows');

    // Site-wide banner placement helper
    assert.ok(appContent.includes('function renderSiteWideBanner'), 'app.js must contain renderSiteWideBanner');
    // Cleanup audit test records to maintain database cleanliness for sibling test suites
    try {
      const { execute } = require('./database/db');
      if (testBannerId) {
        execute('DELETE FROM banner_orders WHERE id = ?', [testBannerId]);
      }
      execute("DELETE FROM promotion_orders WHERE token_name IN ('Audit Test Token', 'Activation Test Token')");
      execute("DELETE FROM tokens WHERE name IN ('Audit Test Token', 'Activation Test Token')");
      execute("DELETE FROM promotions WHERE package_name = 'Spotlight 7D' AND auto_trading_url IS NULL");
    } catch (cleanErr) {}
  });

  console.log('\n================================================================');
  console.log(`🎯 ALL AUDIT FIX TESTS PASSED (${passed}/${total})!`);
  console.log('================================================================\n');
}

runAuditTests().catch(err => {
  console.error('\n❌ Audit test failed:', err);
  process.exit(1);
});
