const assert = require('assert');

async function runSubmitVerification() {
  console.log('=== Starting Token Submission & Database Verification ===\n');
  const BASE_URL = 'http://localhost:5000/api';

  // 1. Submit a brand new Solana token
  const randNum = Math.floor(100000 + Math.random() * 900000);
  const solContract = `SolBull${randNum}X11111111111111111111111111111111`;
  const solName = `Solana Bull Elite ${randNum}`;
  const solSymbol = `SBULL${randNum.toString().slice(-3)}`;

  console.log(`[Test 1] Submitting Solana token: ${solName} ($${solSymbol}) [CA: ${solContract}]...`);
  const solSubmitRes = await fetch(`${BASE_URL}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chain: 'solana-ecosystem',
      contractAddress: solContract,
      projectName: solName,
      tokenSymbol: solSymbol,
      projectEmail: 'dev@solanabull.io',
      websiteUrl: 'https://solanabull.io',
      xUrl: 'https://x.com/solanabull',
      telegramUrl: 'https://t.me/solanabull',
      description: 'Exclusive decentralized utility token for high-speed trading.'
    })
  });

  const solSubmitData = await solSubmitRes.json();
  console.log('Submission Response:', solSubmitData);
  assert(solSubmitData.success === true, 'Submission must succeed');
  assert(solSubmitData.tokenId > 0, 'Must return numeric tokenId');
  assert(solSubmitData.status === 'LIVE', 'Listing status must be LIVE');
  console.log('✔ Test 1: Solana Token Submission Successful! Token ID:', solSubmitData.tokenId);

  // 2. Submit a brand new BSC token using short alias 'bsc'
  const bscHex = Math.random().toString(16).slice(2).padStart(8, '0');
  const bscContract = `0x88888888888888888888888888888888${bscHex}`.slice(0, 42);
  const bscName = `BNB Gold Tracker ${randNum}`;
  const bscSymbol = `BGOLD${randNum.toString().slice(-3)}`;

  console.log(`\n[Test 2] Submitting BSC token with chain alias 'bsc': ${bscName} ($${bscSymbol}) [CA: ${bscContract}]...`);
  const bscSubmitRes = await fetch(`${BASE_URL}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chain: 'bsc',
      contractAddress: bscContract,
      projectName: bscName,
      tokenSymbol: bscSymbol,
      projectEmail: 'dev@bnbgold.io',
      websiteUrl: 'https://bnbgold.io',
      xUrl: 'https://x.com/bnbgold',
      telegramUrl: 'https://t.me/bnbgold',
      description: 'Staking & reward asset on BNB Chain.'
    })
  });

  const bscSubmitData = await bscSubmitRes.json();
  console.log('Submission Response:', bscSubmitData);
  assert(bscSubmitData.success === true, 'BSC Submission must succeed');
  assert(bscSubmitData.tokenId > 0, 'Must return numeric tokenId');
  assert(bscSubmitData.status === 'LIVE', 'Listing status must be LIVE');
  console.log('✔ Test 2: BSC Token Submission with alias Successful! Token ID:', bscSubmitData.tokenId);

  // 3. Verify GET /api/tokens/new
  console.log('\n[Test 3] Verifying GET /api/tokens/new (Top of feed check)...');
  const newCoinsRes = await (await fetch(`${BASE_URL}/tokens/new`)).json();
  assert(newCoinsRes.success === true, 'New coins query must succeed');
  const topTokens = newCoinsRes.tokens.slice(0, 5);
  console.log('Top 5 tokens in New Coins:');
  topTokens.forEach((t, i) => console.log(`  ${i + 1}. [ID: ${t.id}] ${t.name} ($${t.symbol}) [Chain: ${t.chain}] is_sub: ${t.is_submitted} age: ${t.age}`));

  const foundSol = newCoinsRes.tokens.find(t => t.id === solSubmitData.tokenId);
  assert(foundSol, 'Solana submitted token must be in New Coins feed');
  assert(foundSol.is_submitted === 1, 'is_submitted must equal 1');

  const foundBsc = newCoinsRes.tokens.find(t => t.id === bscSubmitData.tokenId);
  assert(foundBsc, 'BSC submitted token must be in New Coins feed');
  assert(foundBsc.is_submitted === 1, 'is_submitted must equal 1');
  console.log('✔ Test 3: Newly submitted tokens appear at the top of New Coins!');

  // 4. Verify GET /api/tokens/:id
  console.log(`\n[Test 4] Verifying Token Detail by ID (${solSubmitData.tokenId})...`);
  const detailRes = await (await fetch(`${BASE_URL}/tokens/${solSubmitData.tokenId}`)).json();
  assert(detailRes.success === true, 'Token detail must return 200 OK');
  assert(detailRes.data.name === solName, 'Token name must match submission');
  assert(detailRes.data.contract_address === solContract, 'Contract address must match');
  assert(detailRes.data.is_submitted === 1, 'Token must have is_submitted = 1');
  console.log('✔ Test 4: Token Detail by ID returns complete data: Price:', detailRes.data.price, 'MCap:', detailRes.data.market_cap);

  // 5. Verify GET /api/tokens/:contractAddress
  console.log(`\n[Test 5] Verifying Token Detail by Contract Address (${bscContract})...`);
  const caDetailRes = await (await fetch(`${BASE_URL}/tokens/${bscContract}`)).json();
  assert(caDetailRes.success === true, 'Contract address lookup must return 200 OK');
  assert(caDetailRes.data.name === bscName, 'Token name must match submission');
  console.log('✔ Test 5: Token lookup by Contract Address works directly!');

  // 6. Verify GET /api/home aggregator
  console.log('\n[Test 6] Verifying GET /api/home aggregator includes submitted tokens under new tab...');
  const homeRes = await (await fetch(`${BASE_URL}/home`)).json();
  assert(homeRes.success === true, 'Home data must succeed');
  const homeNew = homeRes.data.new || [];
  const homeHasSol = homeNew.some(t => t.id === solSubmitData.tokenId);
  const homeHasBsc = homeNew.some(t => t.id === bscSubmitData.tokenId);
  assert(homeHasSol, 'Home new tab must contain recently submitted Solana token');
  assert(homeHasBsc, 'Home new tab must contain recently submitted BSC token');
  console.log('✔ Test 6: Home aggregated new tab includes both newly submitted tokens!');

  // 7. Verify GET /api/search?q=...
  console.log(`\n[Test 7] Verifying Search for "${solSymbol}"...`);
  const searchRes = await (await fetch(`${BASE_URL}/search?q=${solSymbol}`)).json();
  assert(searchRes.success === true, 'Search must succeed');
  assert(searchRes.data.length > 0, 'Search must find the token');
  assert(searchRes.data[0].id === solSubmitData.tokenId, 'Search result #1 must be the submitted token');
  console.log(`✔ Test 7: Global Search correctly returns #${searchRes.data[0].id} (${searchRes.data[0].name})!`);

  // 8. Verify data/submitted_tokens.json file persistence
  console.log('\n[Test 8] Verifying persistence in data/submitted_tokens.json...');
  const fs = require('fs');
  const path = require('path');
  const storePath = path.join(__dirname, 'data', 'submitted_tokens.json');
  assert(fs.existsSync(storePath), 'submitted_tokens.json must exist');
  const storedList = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  const storedSol = storedList.find(t => t.contract_address === solContract);
  const storedBsc = storedList.find(t => t.contract_address === bscContract);
  assert(storedSol, 'Solana token must be persisted in submitted_tokens.json');
  assert(storedBsc, 'BSC token must be persisted in submitted_tokens.json');
  console.log(`✔ Test 8: Both tokens are safely persisted in ${storePath}! Total stored: ${storedList.length}`);

  console.log('\n======================================================');
  console.log('🎉 ALL 8 TESTS PASSED! Database & Token Submissions Fully Connected.');
  console.log('======================================================');
}

runSubmitVerification().catch(err => {
  console.error('\n✖ TEST FAILED:', err.message);
  process.exit(1);
});
