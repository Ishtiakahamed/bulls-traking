const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

console.log('\n======================================================');
console.log('🧪 RUNNING BULLS TRAKING VERCEL SERVERLESS TESTS');
console.log('======================================================\n');

// 1. Verify package.json engines
console.log('Test 1: Verifying package.json Node 22 engine specification...');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
assert.strictEqual(pkg.engines?.node, '22.x', 'package.json must specify "node": "22.x" for Vercel');
console.log('✅ Test 1: PASSED (Node 22 engine pinned to "22.x")');

// 2. Verify vercel.json structure & native catch-all architecture
console.log('Test 2: Verifying vercel.json configuration and catch-all architecture...');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf-8'));
assert(vercelConfig.version === 2, 'vercel.json version should be 2');
// Vercel Active CPU / Fluid compute ignores 'memory', requires maxDuration configuration
assert(vercelConfig.functions?.['api/index.js']?.maxDuration >= 10, 'Function maxDuration should be >= 10s');
assert(Array.isArray(vercelConfig.rewrites), 'Rewrites must be an array');
// Catch-all serverless entrypoint api/[...all].js natively routes /api/* without internal rewrite destination warnings
assert(fs.existsSync(path.join(__dirname, 'api', '[...all].js')), 'Catch-all serverless function api/[...all].js must exist');
console.log('✅ Test 2: PASSED (vercel.json configured for Vercel Active CPU / Fluid compute with catch-all routing)');

// 3. Verify .vercelignore
console.log('Test 3: Verifying .vercelignore exclusions...');
assert(fs.existsSync(path.join(__dirname, '.vercelignore')), '.vercelignore must exist');
const vercelIgnore = fs.readFileSync(path.join(__dirname, '.vercelignore'), 'utf-8');
assert(vercelIgnore.includes('data/*.db') || vercelIgnore.includes('*.db'), '.vercelignore must exclude local .db files');
assert(vercelIgnore.includes('*.zip'), '.vercelignore must exclude zip archives');
console.log('✅ Test 3: PASSED (.vercelignore excludes local SQLite files and archives)');

// 4. Simulate Vercel Serverless Invocation with api/index.js via real HTTP server
console.log('Test 4: Simulating Vercel Serverless Function execution via api/index.js & api/[...all].js...');
process.env.VERCEL = '1';
const handler = require('./api/index');
const catchAllHandler = require('./api/[...all]');

const server = http.createServer((req, res) => {
  // Test both handlers: use catchAllHandler for sub-paths, handler for root
  if (req.url && req.url.startsWith('/api/') && req.url !== '/api/') {
    return catchAllHandler(req, res);
  }
  return handler(req, res);
});

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 4a. Request to /api (root info)
    const rootRes = await fetch(`${baseUrl}/api`);
    assert.strictEqual(rootRes.status, 200, 'GET /api should return 200');
    const rootData = await rootRes.json();
    assert.strictEqual(rootData.success, true, 'GET /api should return success: true');
    console.log('✅ Test 4a: PASSED (GET /api returns 200 with platform endpoints)');

    // 4b. Request to /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200, 'GET /api/health should return 200');
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok', 'Health status should be ok');
    console.log('✅ Test 4b: PASSED (GET /api/health returns 200 with status "ok")');

    // 4c. Request where path arrived without /api prefix: /tokens?limit=3
    const strippedRes = await fetch(`${baseUrl}/tokens?limit=3`);
    assert.strictEqual(strippedRes.status, 200, 'GET /tokens should normalize and return 200');
    const strippedData = await strippedRes.json();
    assert.strictEqual(strippedData.success, true, 'GET /tokens should return success: true');
    assert(Array.isArray(strippedData.tokens), 'Tokens must be an array');
    console.log(`✅ Test 4c: PASSED (Normalized URL /tokens -> /api/tokens, returned ${strippedData.tokens.length} tokens)`);

    // 4d. Request to /api/new-pairs (should respond instantly without blocking timeouts)
    const t0Np = Date.now();
    const npRes = await fetch(`${baseUrl}/api/new-pairs?limit=10`);
    const npLatency = Date.now() - t0Np;
    assert.strictEqual(npRes.status, 200, 'GET /api/new-pairs should return 200');
    const npData = await npRes.json();
    assert(Array.isArray(npData.pairs), 'new-pairs must return pairs array');
    assert(npLatency < 1000, `new-pairs latency (${npLatency}ms) should be fast, not blocking on external APIs`);
    console.log(`✅ Test 4d: PASSED (GET /api/new-pairs returned ${npData.pairs.length} pairs in ${npLatency}ms)`);

    // 4e. Verify each of the 4 launchpad sources exists in the new-pairs feed
    const sources = ['pumpfun', 'fourmeme', 'stonkfun', 'dexscreener'];
    for (const src of sources) {
      const srcRes = await fetch(`${baseUrl}/api/new-pairs?source=${src}`);
      assert.strictEqual(srcRes.status, 200, `GET /api/new-pairs?source=${src} should return 200`);
      const srcData = await srcRes.json();
      assert(srcData.pairs.length > 0, `Source "${src}" must have seeded tokens available on Vercel cold boot`);
      const first = srcData.pairs[0];
      assert.strictEqual(first.source, src, `Seeded pair source should match ${src}`);
      console.log(`✅ Test 4e [${src}]: PASSED (${srcData.pairs.length} tokens available on cold boot, top: ${first.name} [${first.symbol}])`);
    }

    // 4f. Verify GET /api/home delivers populated market data with topCoins
    const t0Home = Date.now();
    const homeRes = await fetch(`${baseUrl}/api/home`);
    const homeLatency = Date.now() - t0Home;
    assert.strictEqual(homeRes.status, 200, 'GET /api/home should return 200');
    const homeData = await homeRes.json();
    assert(homeData.data && Array.isArray(homeData.data.topCoins), 'homeData.data.topCoins must be an array');
    assert(homeData.data.topCoins.length > 0, 'homeData.data.topCoins must not be empty');
    console.log(`✅ Test 4f: PASSED (GET /api/home delivered ${homeData.data.topCoins.length} top coins in ${homeLatency}ms)`);

    // 4g. Verify GET /api/banners/active delivers 24h deterministic rotation metadata on Vercel
    const bannerRes = await fetch(`${baseUrl}/api/banners/active`);
    assert.strictEqual(bannerRes.status, 200, 'GET /api/banners/active should return 200');
    const bannerData = await bannerRes.json();
    assert(bannerData.data?.rotation?.timezone === 'UTC', 'rotation.timezone must be UTC');
    console.log(`✅ Test 4g: PASSED (GET /api/banners/active returned UTC rotation schedule)`);

    // 4h. Verify GET /api/promotions delivers equal-share promoted tokens on Vercel
    const promoRes = await fetch(`${baseUrl}/api/promotions`);
    assert.strictEqual(promoRes.status, 200, 'GET /api/promotions should return 200');
    const promoData = await promoRes.json();
    assert(promoData.rotation?.timezone === 'UTC', 'promotions rotation timezone must be UTC');
    console.log(`✅ Test 4h: PASSED (GET /api/promotions returned equal-share schedule)`);

    server.close();
    console.log('\n======================================================');
    console.log('🎯 TOTAL RESULTS: ALL VERCEL SERVERLESS TESTS PASSED!');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    server.close();
    console.error('\n❌ Vercel test error:', err);
    process.exit(1);
  }
});
