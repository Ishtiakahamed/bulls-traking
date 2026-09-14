const assert = require('assert');
const fs = require('fs');

async function testTask1() {
  console.log('Testing Task 1 (Contract Scanner)...');

  // 1. Check API endpoint
  const res = await fetch('http://localhost:5000/api/security/scan?chain=binance-smart-chain&address=0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82');
  assert.strictEqual(res.status, 200, 'Security scan endpoint should return HTTP 200');
  const json = await res.json();
  assert.strictEqual(json.success, true, 'Response success should be true');
  assert(json.data, 'Response data should be present');
  assert.strictEqual(json.data.chain, 'binance-smart-chain');
  assert.strictEqual(typeof json.data.risk_score, 'number');
  assert(json.data.risk_level, 'Risk level should be present');
  console.log('✔ GET /api/security/scan returned valid security report: Risk Score', json.data.risk_score, json.data.risk_level);

  // 2. Check index.html markup
  const indexHtml = fs.readFileSync('index.html', 'utf-8');
  assert(indexHtml.includes('<a href="#/scan" class="nav-item" data-route="scan">Scanner</a>'), 'index.html must include nav link for Scanner');
  assert(indexHtml.includes('<a href="#/scan">Contract Scanner</a>'), 'index.html must include footer link for Contract Scanner');
  console.log('✔ index.html nav & footer verified.');

  // 3. Check styles.css classes
  const stylesCss = fs.readFileSync('styles.css', 'utf-8');
  assert(stylesCss.includes('.risk-summary'), 'styles.css must include .risk-summary');
  assert(stylesCss.includes('.risk-summary.safe'), 'styles.css must include .risk-summary.safe');
  assert(stylesCss.includes('.risk-summary.warn'), 'styles.css must include .risk-summary.warn');
  assert(stylesCss.includes('.risk-summary.danger'), 'styles.css must include .risk-summary.danger');
  assert(stylesCss.includes('.check-grid'), 'styles.css must include .check-grid');
  assert(stylesCss.includes('.check-item'), 'styles.css must include .check-item');
  console.log('✔ styles.css classes verified.');

  // 4. Check app.js function & routing
  const appJs = fs.readFileSync('app.js', 'utf-8');
  assert(appJs.includes('function renderScanner()'), 'app.js must define renderScanner');
  assert(appJs.includes("path === '/scan'"), 'app.js router must handle /scan path');
  assert(appJs.includes('/security/scan?chain='), 'app.js must call /security/scan');
  console.log('✔ app.js renderScanner & router verified.');

  console.log('\n🎯 TASK 1 VERIFICATION: 100% PASSED!\n');
}

testTask1().catch(err => {
  console.error('✖ Task 1 verification failed:', err);
  process.exit(1);
});
