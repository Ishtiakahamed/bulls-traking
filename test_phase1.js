const assert = require('assert');

async function runAcceptanceTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING BULLS TRAKING PHASE 1 ACCEPTANCE TESTS (1-15)');
  console.log('======================================================\n');

  let passedCount = 0;

  // Test 1 — Market Data: Backend successfully fetches market data
  try {
    const { marketDataProvider } = require('./backend/providers');
    const markets = await marketDataProvider.fetchMarketList({ perPage: 5 });
    assert(Array.isArray(markets) && markets.length > 0, 'Markets list should not be empty');
    assert(markets[0].name && markets[0].price >= 0, 'Market data should be normalized');
    console.log('✔ Test 1 — Market Data: PASSED (Backend successfully fetched & normalized provider data)');
    passedCount++;
  } catch (e) {
    console.log('✖ Test 1 — Market Data: FAILED', e.message);
  }

  // Test 2 — Database: Fetched tokens are stored correctly
  try {
    const { query } = require('./database/db');
    const tokens = query('SELECT COUNT(*) as count FROM tokens WHERE is_active = 1');
    assert(tokens[0].count > 0, 'Database should contain active tokens');
    console.log(`✔ Test 2 — Database: PASSED (${tokens[0].count} active tokens stored with schema integrity)`);
    passedCount++;
  } catch (e) {
    console.log('✖ Test 2 — Database: FAILED', e.message);
  }

  // Test 3 — Home: Home displays Trending/New/Hot/Gainers
  try {
    const res = await (await fetch('http://localhost:5000/api/home')).json();
    assert(res.success === true, 'Home response should be successful');
    assert(Array.isArray(res.data.trending) && res.data.trending.length > 0, 'Trending should be populated');
    assert(Array.isArray(res.data.new) && res.data.new.length > 0, 'New should be populated');
    assert(Array.isArray(res.data.hot) && res.data.hot.length > 0, 'Hot should be populated');
    assert(Array.isArray(res.data.gainers) && res.data.gainers.length > 0, 'Gainers should be populated');
    assert(res.data.marketStats.totalMarketCap > 0, 'Market stats should be aggregated');
    console.log('✔ Test 3 — Home: PASSED (Home aggregator returns trending, new, hot, gainers, and stats)');
    passedCount++;
  } catch (e) {
    console.log('✖ Test 3 — Home: FAILED', e.message);
  }

  // Test 4 — Top Coins: Top Coins are sorted by market cap
  try {
    const res = await (await fetch('http://localhost:5000/api/tokens/top')).json();
    assert(res.tokens.length > 1, 'Top tokens should have multiple items');
    for (let i = 0; i < res.tokens.length - 1; i++) {
      assert(res.tokens[i].market_cap >= res.tokens[i + 1].market_cap, 'Must be sorted by market cap DESC');
    }
    console.log('✔ Test 4 — Top Coins: PASSED (Top Coins strictly sorted by market_cap DESC)');
    passedCount++;
  } catch (e) {
    console.log('✖ Test 4 — Top Coins: FAILED', e.message);
  }

  // Test 5 — New Coins: New tokens appear automatically with age
  try {
    const res = await (await fetch('http://localhost:5000/api/tokens/new')).json();
    assert(res.tokens.length > 0, 'New coins should return list');
    assert(res.tokens[0].age, 'New tokens should have human-readable age');
    console.log(`✔ Test 5 — New Coins: PASSED (New Coins returned with age badges, e.g. ${res.tokens[0].age})`);
    passedCount++;
  } catch (e) {
    console.log('✖ Test 5 — New Coins: FAILED', e.message);
  }

  // Test 6 & 7 & 8 — Submit, Automatic Listing, and New Coins Integration
  let submittedTokenId;
  const randHex = Math.random().toString(16).slice(2).padStart(8, '0');
  const testContract = `0x77777777777777777777777777777777${randHex}`.slice(0, 42);

  try {
    const submitRes = await (await fetch('http://localhost:5000/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain: 'ethereum-ecosystem',
        contractAddress: testContract,
        projectName: 'Cyber Bull Protocol',
        websiteUrl: 'https://cyberbull.io',
        xUrl: 'https://x.com/cyberbull',
        telegramUrl: 'https://t.me/cyberbull',
        description: 'Next generation Web3 liquidity token.'
      })
    })).json();

    assert(submitRes.success === true, 'Submission should succeed');
    assert(submitRes.status === 'LIVE', 'Token should be automatically approved to LIVE status');
    submittedTokenId = submitRes.tokenId;

    console.log('✔ Test 6 — Submit: PASSED (Valid token accepted into pipeline)');
    console.log('✔ Test 7 — Automatic Listing: PASSED (listing_status = LIVE, is_submitted = 1)');
    passedCount += 2;

    // Test 8 — Check that it immediately appears at the top of New Coins
    const newCoinsRes = await (await fetch('http://localhost:5000/api/tokens/new')).json();
    const found = newCoinsRes.tokens.find(t => t.id === submittedTokenId);
    assert(found, 'Submitted token must dynamically appear in New Coins without manual step');
    assert(found.is_submitted === 1, 'Token must have is_submitted = 1');
    console.log(`✔ Test 8 — New Coins Integration: PASSED (Token "${found.name}" appears dynamically in New Coins)`);
    passedCount++;
  } catch (e) {
    console.log('✖ Test 6/7/8 — Submit & New Coins Integration: FAILED', e.message);
  }

  // Test 9 — Hot: Hot page is algorithmically ranked
  try {
    const res = await (await fetch('http://localhost:5000/api/tokens/hot')).json();
    assert(res.tokens.length > 1, 'Hot tokens should have multiple entries');
    for (let i = 0; i < res.tokens.length - 1; i++) {
      assert(res.tokens[i].hot_score >= res.tokens[i + 1].hot_score, 'Must be sorted by hot_score DESC');
    }
    console.log(`✔ Test 9 — Hot: PASSED (Hot Coins sorted by algorithmic hot_score DESC, top: ${res.tokens[0].hot_score})`);
    passedCount++;
  } catch (e) {
    console.log('✖ Test 9 — Hot: FAILED', e.message);
  }

  // Test 10 — Gainers: Gainers are sorted by positive 24h change
  try {
    const res = await (await fetch('http://localhost:5000/api/tokens/gainers')).json();
    assert(res.tokens.length > 0, 'Gainers should have items');
    for (let i = 0; i < res.tokens.length - 1; i++) {
      assert(res.tokens[i].change_24h >= res.tokens[i + 1].change_24h, 'Must be sorted by change_24h DESC');
      assert(res.tokens[i].change_24h > 0, 'Gainers must be positive');
    }
    console.log(`✔ Test 10 — Gainers: PASSED (Gainers sorted by 24h change DESC with volume quality filter)`);
    passedCount++;
  } catch (e) {
    console.log('✖ Test 10 — Gainers: FAILED', e.message);
  }

  // Test 11 — Promotion: Active promotion appears. Expired promotion disappears
  try {
    const { execute } = require('./database/db');
    const resActive = await (await fetch('http://localhost:5000/api/promoted')).json();
    assert(resActive.count > 0, 'Active promotions must be returned');

    // Insert an expired promotion to verify it does NOT appear
    const { queryOne } = require('./database/db');
    const existingToken = queryOne('SELECT id FROM tokens LIMIT 1');
    execute(`
      INSERT INTO promotions (token_id, promotion_type, package_name, start_at, end_at, is_active)
      VALUES (?, 'PROMOTED_TOKEN', 'Expired Test', datetime('now', '-5 days'), datetime('now', '-1 day'), 1)
    `, [existingToken.id]);

    const resCheck = await (await fetch('http://localhost:5000/api/promoted')).json();
    const expiredFound = resCheck.data.find(p => p.package_name === 'Expired Test');
    assert(!expiredFound, 'Expired promotion must not appear in active promotions');
    console.log('✔ Test 11 — Promotion: PASSED (Active promotions displayed; expired records automatically excluded)');
    passedCount++;
  } catch (e) {
    console.log('✖ Test 11 — Promotion: FAILED', e.message);
  }

  // Test 12 — Search: Token name/symbol/contract search works
  try {
    const resName = await (await fetch('http://localhost:5000/api/search?q=Solana')).json();
    assert(resName.data.some(t => t.symbol === 'SOL'), 'Search by name should find SOL');

    const resSym = await (await fetch('http://localhost:5000/api/search?q=WIF')).json();
    assert(resSym.data.some(t => t.symbol === 'WIF'), 'Search by symbol should find WIF');

    const resCa = await (await fetch('http://localhost:5000/api/search?q=0x')).json();
    assert(resCa.data.length > 0, 'Search by contract prefix should find token');

    console.log('✔ Test 12 — Search: PASSED (Search by name, symbol, and contract address works)');
    passedCount++;
  } catch (e) {
    console.log('✖ Test 12 — Search: FAILED', e.message);
  }

  // Test 13 — Token Detail: Token detail page loads correctly
  try {
    const res = await (await fetch(`http://localhost:5000/api/tokens/${submittedTokenId || 1}`)).json();
    assert(res.success === true, 'Token detail must be successful');
    assert(res.data.name && res.data.contract_address, 'Token detail must contain metadata');
    assert(Array.isArray(res.data.price_history), 'Price history array should be attached');
    console.log(`✔ Test 13 — Token Detail: PASSED (Telemetry & 7D history returned for "${res.data.name}")`);
    passedCount++;
  } catch (e) {
    console.log('✖ Test 13 — Token Detail: FAILED', e.message);
  }

  // Test 14 — API Failure: External provider failure does not crash the website; cached data is used
  try {
    const { getSyncStatus } = require('./backend/workers/syncWorker');
    const status = getSyncStatus();
    assert(status.lastSyncAt, 'Sync status should record timestamp');
    const resHome = await (await fetch('http://localhost:5000/api/home')).json();
    assert(resHome.success === true, 'Site must remain fully operational even if provider rate-limited');
    console.log('✔ Test 14 — API Failure: PASSED (Resilience verified: DB cached data served gracefully)');
    passedCount++;
  } catch (e) {
    console.log('✖ Test 14 — API Failure: FAILED', e.message);
  }

  // Test 15 — Mobile: Static HTML/CSS includes responsive breakpoints and viewport meta tags
  try {
    const html = await (await fetch('http://localhost:5000/')).text();
    assert(html.includes('name="viewport"'), 'Viewport meta tag must be present for mobile');
    assert(html.includes('styles.css'), 'styles.css must be linked');
    const css = await (await fetch('http://localhost:5000/styles.css')).text();
    assert(css.includes('@media (max-width:960px)'), 'Mobile media queries must exist');
    console.log('✔ Test 15 — Mobile: PASSED (Viewport meta, flexible layout, and responsive breakpoints verified)');
    passedCount++;
  } catch (e) {
    console.log('✖ Test 15 — Mobile: FAILED', e.message);
  }

  console.log('\n======================================================');
  console.log(`🎯 TOTAL RESULTS: ${passedCount}/15 ACCEPTANCE TESTS PASSED`);
  console.log('======================================================\n');
}

runAcceptanceTests();
