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

// 2. Verify vercel.json structure
console.log('Test 2: Verifying vercel.json configuration and rewrites...');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf-8'));
assert(vercelConfig.version === 2, 'vercel.json version should be 2');
assert(vercelConfig.functions?.['api/index.js']?.memory >= 1024, 'Function memory should be >= 1024MB');
assert(Array.isArray(vercelConfig.rewrites), 'Rewrites must be an array');
const hasApiRewrite = vercelConfig.rewrites.some(r => r.source.includes('/api') && r.destination === '/api');
assert(hasApiRewrite, 'Rewrites must map /api requests to /api function');
console.log('✅ Test 2: PASSED (vercel.json properly configured with 1024MB memory and rewrites)');

// 3. Verify .vercelignore
console.log('Test 3: Verifying .vercelignore exclusions...');
assert(fs.existsSync(path.join(__dirname, '.vercelignore')), '.vercelignore must exist');
const vercelIgnore = fs.readFileSync(path.join(__dirname, '.vercelignore'), 'utf-8');
assert(vercelIgnore.includes('data/*.db') || vercelIgnore.includes('*.db'), '.vercelignore must exclude local .db files');
assert(vercelIgnore.includes('*.zip'), '.vercelignore must exclude zip archives');
console.log('✅ Test 3: PASSED (.vercelignore excludes local SQLite files and archives)');

// 4. Simulate Vercel Serverless Invocation with api/index.js via real HTTP server
console.log('Test 4: Simulating Vercel Serverless Function execution via api/index.js...');
process.env.VERCEL = '1';
const handler = require('./api/index');

const server = http.createServer(handler);

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

    // 4c. Request where Vercel stripped /api prefix: /tokens?limit=3
    const strippedRes = await fetch(`${baseUrl}/tokens?limit=3`);
    assert.strictEqual(strippedRes.status, 200, 'GET /tokens should normalize and return 200');
    const strippedData = await strippedRes.json();
    assert.strictEqual(strippedData.success, true, 'GET /tokens should return success: true');
    assert(Array.isArray(strippedData.tokens), 'Tokens must be an array');
    console.log(`✅ Test 4c: PASSED (Normalized stripped URL /tokens -> /api/tokens, returned ${strippedData.tokens.length} tokens)`);

    // 4d. Request to /api/new-pairs
    const npRes = await fetch(`${baseUrl}/api/new-pairs?limit=10`);
    assert.strictEqual(npRes.status, 200, 'GET /api/new-pairs should return 200');
    const npData = await npRes.json();
    assert(Array.isArray(npData.pairs), 'new-pairs must return pairs array');
    console.log(`✅ Test 4d: PASSED (GET /api/new-pairs returned ${npData.pairs.length} pairs)`);

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
