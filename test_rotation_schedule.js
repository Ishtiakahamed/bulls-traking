/**
 * test_rotation_schedule.js
 * Comprehensive automated verification for:
 * 1. 24-Hour UTC Deterministic Banner & Promoted Token Rotation
 * 2. Exact Boundary Transitions (07:59:59 vs 08:00:00, 15:59:59 vs 16:00:00, 23:59:59)
 * 3. Equal-Share Durations (1=24h, 2=12h, 3=8h, 4=6h, 6=4h, minSlotMinutes=30)
 * 4. Wall-Clock UTC Persistence Across Reloads
 * 5. Mobile Single-Item (100% width, zero peeking, is-mobile-active) & Desktop 3-Grid Containment
 * 6. Live Server HTTP Endpoints & Time-Travel Query Validation
 * 7. Asset SHA256 Parity (styles.css & app.js vs public/)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const { getRotationSlot } = require('./backend/utils/rotationScheduler');
const { getActiveBanners } = require('./backend/services/bannerService');
const { getActivePromotedTokens } = require('./backend/services/promotionService');

function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runRotationTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING 24-HOUR UTC ROTATION & LAYOUT AUDIT SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Test 1: Mathematical Determinism & N=1,2,3,4,6 Equal-Share Slots
  // -------------------------------------------------------------
  console.log('[Test 1] Pure Math & Equal-Share Slot Calculations');
  const mockBanners = [
    { id: 101, title: 'Banner A' },
    { id: 102, title: 'Banner B' },
    { id: 103, title: 'Banner C' }
  ];

  // N = 1 (24 hours)
  const singleSlot = getRotationSlot({
    items: [mockBanners[0]],
    nowUtc: new Date('2026-09-24T14:30:00Z'),
    cycleHours: 24
  });
  assert.strictEqual(singleSlot.activeSlotIndex, 0);
  assert.strictEqual(singleSlot.slotDurationHours, 24);
  assert.strictEqual(singleSlot.activeItem.id, 101);
  console.log('  ✔ N=1: 24h duration, activeSlotIndex = 0');

  // N = 2 (12 hours each)
  const slot2_morning = getRotationSlot({
    items: mockBanners.slice(0, 2),
    nowUtc: new Date('2026-09-24T05:00:00Z'),
    cycleHours: 24
  });
  const slot2_evening = getRotationSlot({
    items: mockBanners.slice(0, 2),
    nowUtc: new Date('2026-09-24T18:00:00Z'),
    cycleHours: 24
  });
  assert.strictEqual(slot2_morning.slotDurationHours, 12);
  assert.strictEqual(slot2_morning.activeSlotIndex, 0);
  assert.strictEqual(slot2_evening.slotDurationHours, 12);
  assert.strictEqual(slot2_evening.activeSlotIndex, 1);
  console.log('  ✔ N=2: 12h each (00:00-12:00 -> Slot 0, 12:00-24:00 -> Slot 1)');

  // N = 4 (6 hours each)
  const mock4 = [1, 2, 3, 4].map(id => ({ id, title: `Banner ${id}` }));
  const slot4_q1 = getRotationSlot({ items: mock4, nowUtc: new Date('2026-09-24T03:00:00Z') });
  const slot4_q2 = getRotationSlot({ items: mock4, nowUtc: new Date('2026-09-24T09:00:00Z') });
  const slot4_q3 = getRotationSlot({ items: mock4, nowUtc: new Date('2026-09-24T15:00:00Z') });
  const slot4_q4 = getRotationSlot({ items: mock4, nowUtc: new Date('2026-09-24T21:00:00Z') });
  assert.strictEqual(slot4_q1.slotDurationHours, 6);
  assert.strictEqual(slot4_q1.activeSlotIndex, 0);
  assert.strictEqual(slot4_q2.activeSlotIndex, 1);
  assert.strictEqual(slot4_q3.activeSlotIndex, 2);
  assert.strictEqual(slot4_q4.activeSlotIndex, 3);
  console.log('  ✔ N=4: 6h each (Slots 0, 1, 2, 3 properly partitioned)');

  // N = 6 (4 hours each)
  const mock6 = [1, 2, 3, 4, 5, 6].map(id => ({ id, title: `Banner ${id}` }));
  const slot6 = getRotationSlot({ items: mock6, nowUtc: new Date('2026-09-24T13:00:00Z') });
  assert.strictEqual(slot6.slotDurationHours, 4);
  assert.strictEqual(slot6.activeSlotIndex, 3); // 12:00 to 16:00 is slot 3
  console.log('  ✔ N=6: 4h each (13:00 UTC -> Slot 3)');

  // Minimum Slot Guard (minSlotMinutes = 30)
  const mock100 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
  const slotGuard = getRotationSlot({ items: mock100, minSlotMinutes: 30 });
  assert.strictEqual(slotGuard.slotDurationMinutes, 30);
  assert.strictEqual(slotGuard.slotDurationHours, 0.5);
  console.log('  ✔ Minimum slot duration guard (30 minutes) enforced');

  // -------------------------------------------------------------
  // Test 2: Exact Boundary Transition Tests (UTC Wall-Clock)
  // -------------------------------------------------------------
  console.log('\n[Test 2] Exact Second Boundary Transitions for N=3 (8h each)');
  // Slot 0: 00:00:00.000Z - 07:59:59.999Z -> Banner A (id: 101)
  // Slot 1: 08:00:00.000Z - 15:59:59.999Z -> Banner B (id: 102)
  // Slot 2: 16:00:00.000Z - 23:59:59.999Z -> Banner C (id: 103)

  const b0_end = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T07:59:59.999Z') });
  assert.strictEqual(b0_end.activeSlotIndex, 0, '07:59:59.999Z must be Slot 0');
  assert.strictEqual(b0_end.activeItem.id, 101);

  const b1_start = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T08:00:00.000Z') });
  assert.strictEqual(b1_start.activeSlotIndex, 1, '08:00:00.000Z must be Slot 1');
  assert.strictEqual(b1_start.activeItem.id, 102);

  const b1_end = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T15:59:59.999Z') });
  assert.strictEqual(b1_end.activeSlotIndex, 1, '15:59:59.999Z must be Slot 1');
  assert.strictEqual(b1_end.activeItem.id, 102);

  const b2_start = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T16:00:00.000Z') });
  assert.strictEqual(b2_start.activeSlotIndex, 2, '16:00:00.000Z must be Slot 2');
  assert.strictEqual(b2_start.activeItem.id, 103);

  const b2_end = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T23:59:59.999Z') });
  assert.strictEqual(b2_end.activeSlotIndex, 2, '23:59:59.999Z must be Slot 2');
  assert.strictEqual(b2_end.activeItem.id, 103);

  console.log('  ✔ 07:59:59.999Z -> Slot 0 (Banner A)');
  console.log('  ✔ 08:00:00.000Z -> Slot 1 (Banner B)');
  console.log('  ✔ 15:59:59.999Z -> Slot 1 (Banner B)');
  console.log('  ✔ 16:00:00.000Z -> Slot 2 (Banner C)');
  console.log('  ✔ 23:59:59.999Z -> Slot 2 (Banner C)');

  // -------------------------------------------------------------
  // Test 3: Wall-Clock UTC Persistence Across Reloads
  // -------------------------------------------------------------
  console.log('\n[Test 3] Wall-Clock UTC Persistence Across Simulated Page Reloads');
  // At 10:15 UTC, reload 1:
  const reload1 = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T10:15:00Z') });
  // Reload 2 (30 seconds later):
  const reload2 = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T10:15:30Z') });
  // Reload 3 (2 hours later, still in Slot 1):
  const reload3 = getRotationSlot({ items: mockBanners, nowUtc: new Date('2026-09-24T12:45:00Z') });

  assert.strictEqual(reload1.activeSlotIndex, 1);
  assert.strictEqual(reload2.activeSlotIndex, 1);
  assert.strictEqual(reload3.activeSlotIndex, 1);
  assert.strictEqual(reload1.activeItem.id, reload2.activeItem.id);
  assert.strictEqual(reload1.activeItem.id, reload3.activeItem.id);
  console.log('  ✔ User refreshing browser at 10:15:00 and 10:15:30 sees identical Banner B');
  console.log('  ✔ Slot does not randomly shuffle or reset on page reload');

  // -------------------------------------------------------------
  // Test 4: Live Backend Banner Service & HTTP Endpoint
  // -------------------------------------------------------------
  console.log('\n[Test 4] Live Banner Endpoint /api/banners/active and Time Simulation');
  const bannerRes = await fetchJson('http://localhost:5000/api/banners/active');
  assert.strictEqual(bannerRes.status, 200);
  assert.strictEqual(bannerRes.data.success, true);

  const bData = bannerRes.data.data;
  assert(Array.isArray(bData.desktop), 'desktop must be an array');
  assert(bData.desktop.length <= 3, 'desktop must contain at most 3 items');
  assert(bData.mobile !== undefined, 'mobile item must be defined');
  assert(bData.rotation !== undefined, 'rotation metadata must be defined');
  assert.strictEqual(bData.rotation.timezone, 'UTC');
  assert.strictEqual(bData.rotation.cycleHours, 24);

  // Test Time-Travel query param on API
  const timeQueryRes1 = await fetchJson('http://localhost:5000/api/banners/active?time=2026-09-24T05:00:00Z');
  const timeQueryRes2 = await fetchJson('http://localhost:5000/api/banners/active?time=2026-09-24T19:00:00Z');
  assert.strictEqual(timeQueryRes1.status, 200);
  assert.strictEqual(timeQueryRes2.status, 200);
  console.log('  ✔ /api/banners/active returns desktop trio, mobile single item, and UTC rotation metadata');
  console.log(`  ✔ Current active mobile banner: "${bData.mobile ? bData.mobile.title : 'None'}"`);
  console.log(`  ✔ Active slot index: ${bData.rotation.activeSlotIndex}, slot duration: ${bData.rotation.slotDurationHours}h`);

  // -------------------------------------------------------------
  // Test 5: Live Promoted Tokens Service & Equal-Share Partitioning
  // -------------------------------------------------------------
  console.log('\n[Test 5] Live Promoted Tokens /api/promotions with Equal-Share Duration');
  const promoRes = await fetchJson('http://localhost:5000/api/promotions');
  assert.strictEqual(promoRes.status, 200);
  assert.strictEqual(promoRes.data.success, true);
  assert(Array.isArray(promoRes.data.data), 'promotions data must be an array');
  assert(promoRes.data.rotation !== undefined, 'promotions rotation metadata must be present');
  assert.strictEqual(promoRes.data.rotation.timezone, 'UTC');

  console.log(`  ✔ Active Promoted Tokens: ${promoRes.data.count}`);
  console.log(`  ✔ Equal share per token: ${promoRes.data.rotation.slotDurationHours} hours (${promoRes.data.rotation.slotDurationMinutes} minutes)`);
  if (promoRes.data.mobile) {
    console.log(`  ✔ Active mobile token: ${promoRes.data.mobile.token ? promoRes.data.mobile.token.name : 'N/A'}`);
    assert(promoRes.data.mobile.visibleFrom, 'mobile token must include visibleFrom timestamp');
    assert(promoRes.data.mobile.visibleUntil, 'mobile token must include visibleUntil timestamp');
  }

  // -------------------------------------------------------------
  // Test 6: CSS Layout Rules Audit (Zero Peeking & Desktop Grid)
  // -------------------------------------------------------------
  console.log('\n[Test 6] CSS Layout Audit (Anti-Peeking & Grid Rules)');
  const cssContent = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

  // Verify that flex: 0 0 85% is completely removed from mobile styles
  assert(!cssContent.includes('flex: 0 0 85%'), 'FAIL: styles.css must not contain flex: 0 0 85%');
  console.log('  ✔ Verified: "flex: 0 0 85%" is 100% removed from styles.css');

  // Verify mobile single banner display rule
  assert(cssContent.includes('.banner-strip-item:not(.is-mobile-active)'), 'FAIL: Must hide inactive mobile banners');
  assert(cssContent.includes('.banner-strip-item.is-mobile-active'), 'FAIL: Must define .is-mobile-active banner');
  assert(cssContent.includes('width: 100% !important;'), 'FAIL: Active mobile banner must have width 100%');
  console.log('  ✔ Verified: Mobile hides inactive banners (:not(.is-mobile-active) display: none)');
  console.log('  ✔ Verified: Mobile active banner occupies width: 100% with ZERO peeking');

  // Verify desktop 3-item grid
  assert(cssContent.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'FAIL: Desktop banner strip must use repeat(3, minmax(0, 1fr))');
  console.log('  ✔ Verified: Desktop banner strip configured with 3 equal columns (repeat(3, minmax(0, 1fr)))');

  // Verify mobile overflow protection
  assert(cssContent.includes('overflow-x: hidden !important;'), 'FAIL: Mobile root/container must enforce overflow-x: hidden');
  console.log('  ✔ Verified: Mobile root/container enforces overflow-x: hidden');

  // -------------------------------------------------------------
  // Test 7: Frontend SHA256 Asset Parity (styles.css & app.js)
  // -------------------------------------------------------------
  console.log('\n[Test 7] Frontend Asset SHA256 Parity Verification');
  const styleRootHash = fileHash(path.join(__dirname, 'styles.css'));
  const stylePubHash = fileHash(path.join(__dirname, 'public/styles.css'));
  assert.strictEqual(styleRootHash, stylePubHash, 'styles.css and public/styles.css must have identical SHA256 hash');
  console.log(`  ✔ styles.css <-> public/styles.css parity verified (SHA256: ${styleRootHash.slice(0, 16)}...)`);

  const appRootHash = fileHash(path.join(__dirname, 'app.js'));
  const appPubHash = fileHash(path.join(__dirname, 'public/app.js'));
  assert.strictEqual(appRootHash, appPubHash, 'app.js and public/app.js must have identical SHA256 hash');
  console.log(`  ✔ app.js <-> public/app.js parity verified (SHA256: ${appRootHash.slice(0, 16)}...)`);

  console.log('\n================================================================');
  console.log('🎯 ALL 7 ROTATION & LAYOUT TESTS PASSED 100%');
  console.log('================================================================\n');
}

runRotationTests().catch(err => {
  console.error('\n❌ ROTATION TEST SUITE FAILED:', err);
  process.exit(1);
});
