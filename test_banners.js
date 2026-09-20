/**
 * test_banners.js
 * End-to-end integration and automated test suite for Bulls Traking Banner Advertising Engine
 */

const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

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

async function runBannerTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING BULLS TRAKING BANNER ADVERTISING TEST SUITE');
  console.log('======================================================\n');

  const BASE_URL = 'http://localhost:5000';

  // Test 1: Active Banner Slots Endpoint
  console.log('[Test 1] GET /api/banners/active');
  const activeRes = await fetchJson(`${BASE_URL}/api/banners/active`);
  assert.strictEqual(activeRes.status, 200, 'Expected status 200');
  assert.strictEqual(activeRes.data.success, true, 'Expected success: true');
  const slots = activeRes.data.data;
  assert.ok(slots.top_banner, 'Expected top_banner slot');
  assert.ok(slots.homepage_banner, 'Expected homepage_banner slot');
  assert.ok(slots.radar_banner, 'Expected radar_banner slot');
  assert.ok(slots.top_banner.title, 'top_banner should have a title');
  assert.ok(slots.homepage_banner.target_url, 'homepage_banner should have a target_url');
  console.log(`✓ Active banner slots verified: top_banner (${slots.top_banner.placement}), homepage_banner (${slots.homepage_banner.placement})\n`);

  // Test 2: Banner Packages Endpoint
  console.log('[Test 2] GET /api/banners/packages');
  const pkgRes = await fetchJson(`${BASE_URL}/api/banners/packages`);
  assert.strictEqual(pkgRes.status, 200, 'Expected status 200');
  assert.strictEqual(pkgRes.data.success, true, 'Expected success: true');
  assert.ok(Array.isArray(pkgRes.data.data), 'Expected array of packages');
  assert.ok(pkgRes.data.data.length >= 3, 'Expected at least 3 banner packages');
  const hasHeaderPkg = pkgRes.data.data.some(p => p.placement === 'top_banner');
  const hasHomePkg = pkgRes.data.data.some(p => p.placement === 'homepage_banner');
  assert.ok(hasHeaderPkg, 'Expected top_banner package');
  assert.ok(hasHomePkg, 'Expected homepage_banner package');
  console.log(`✓ Banner packages verified: ${pkgRes.data.data.map(p => `${p.name} ($${p.price})`).join(', ')}\n`);

  // Test 3: Create Banner Order
  console.log('[Test 3] POST /api/banners/order (Booking campaign)');
  const orderPayload = {
    title: 'Automated Test DEX — Fast Execution',
    targetUrl: 'https://dex.example.com',
    bannerImage: 'https://dex.example.com/banner728x90.png',
    placement: 'homepage_banner',
    durationDays: 7,
    price: 299.00
  };
  const createRes = await fetchJson(`${BASE_URL}/api/banners/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: orderPayload
  });
  assert.strictEqual(createRes.status, 201, 'Expected status 201 Created');
  assert.strictEqual(createRes.data.success, true, 'Expected success: true');
  const createdBanner = createRes.data.data;
  assert.ok(createdBanner.id, 'Expected returned banner ID');
  assert.strictEqual(createdBanner.title, orderPayload.title);
  assert.strictEqual(createdBanner.placement, 'homepage_banner');
  console.log(`✓ Banner order created successfully: Order #${createdBanner.id} — "${createdBanner.title}"\n`);

  // Test 4: Track Banner Click
  console.log(`[Test 4] POST /api/banners/click/${createdBanner.id}`);
  const clickRes = await fetchJson(`${BASE_URL}/api/banners/click/${createdBanner.id}`, {
    method: 'POST'
  });
  assert.strictEqual(clickRes.status, 200, 'Expected status 200');
  assert.strictEqual(clickRes.data.success, true, 'Expected success: true');
  assert.strictEqual(clickRes.data.recorded, true, 'Expected click recorded: true');
  console.log(`✓ Banner click recorded successfully for banner #${createdBanner.id}\n`);

  // Test 5: /api/home Single Aggregation Payload
  console.log('[Test 5] GET /api/home integration with banners');
  const homeRes = await fetchJson(`${BASE_URL}/api/home`);
  assert.strictEqual(homeRes.status, 200, 'Expected status 200');
  const homeData = homeRes.data.data || homeRes.data;
  assert.ok(homeData.banners, 'Expected banners object in /api/home');
  assert.ok(homeData.banners.top_banner, 'Expected top_banner in /api/home payload');
  assert.ok(homeData.banners.homepage_banner, 'Expected homepage_banner in /api/home payload');
  console.log(`✓ /api/home delivers banners seamlessly alongside tokens, stats, and trending\n`);

  // Test 6: Admin Banner Retrieval
  console.log('[Test 6] GET /api/admin/banners');
  const adminRes = await fetchJson(`${BASE_URL}/api/admin/banners`);
  assert.strictEqual(adminRes.status, 200, 'Expected status 200');
  assert.strictEqual(adminRes.data.success, true);
  assert.ok(Array.isArray(adminRes.data.data), 'Expected array of orders');
  const foundOurOrder = adminRes.data.data.find(b => b.id === createdBanner.id);
  assert.ok(foundOurOrder, 'Created banner order should be present in admin listing');
  assert.strictEqual(foundOurOrder.click_count, 1, 'Banner click count should be 1');
  console.log(`✓ Admin retrieved ${adminRes.data.count} banner orders with live click telemetry (${foundOurOrder.click_count} clicks)\n`);

  // Test 7: Frontend Files Parity & Class Integrity
  console.log('[Test 7] Frontend Parity & Component Checks');
  const styleHashRoot = fileHash('styles.css');
  const styleHashPub = fileHash('public/styles.css');
  assert.strictEqual(styleHashRoot, styleHashPub, 'styles.css and public/styles.css must be identical');

  const appHashRoot = fileHash('app.js');
  const appHashPub = fileHash('public/app.js');
  assert.strictEqual(appHashRoot, appHashPub, 'app.js and public/app.js must be identical');

  const stylesContent = fs.readFileSync('styles.css', 'utf8');
  assert.ok(stylesContent.includes('.banner-ad-card'), 'styles.css must contain .banner-ad-card');
  assert.ok(stylesContent.includes('.banner-ad-wrapper'), 'styles.css must contain .banner-ad-wrapper');
  assert.ok(stylesContent.includes('.banner-ad-badge'), 'styles.css must contain .banner-ad-badge');

  const appContent = fs.readFileSync('app.js', 'utf8');
  assert.ok(appContent.includes('function renderBannerAd'), 'app.js must contain renderBannerAd');
  assert.ok(appContent.includes('function trackBannerClick'), 'app.js must contain trackBannerClick');
  assert.ok(appContent.includes('function switchPromoteMode'), 'app.js must contain switchPromoteMode');
  assert.ok(appContent.includes('topBannerHtml'), 'app.js must render topBannerHtml in buildHomeUI');
  assert.ok(appContent.includes('homeBannerHtml'), 'app.js must render homeBannerHtml in buildHomeUI');
  console.log('✓ 100% hash parity verified between root and public/ assets with all banner elements present\n');

  console.log('======================================================');
  console.log('🎯 ALL BANNER ADVERTISING ENGINE TESTS PASSED (7/7)!');
  console.log('======================================================');
}

runBannerTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
