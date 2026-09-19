/**
 * test_promotions.js
 * End-to-end unit and integration test suite for Automated Promoted Coins & Payments
 */

const assert = require('assert');
const { generateAutoTradeLinks } = require('./backend/utils/tradeLinks');
const { PROMOTION_PACKAGES, getTreasuryAddresses, verifyTransactionOnChain } = require('./backend/services/cryptoPaymentService');
const promotionService = require('./backend/services/promotionService');
const { query, execute } = require('./database/db');

async function runTests() {
  console.log('=== Starting Promoted Coin & Automated Payment Tests ===\n');

  // 1. Test Trade Link Utilities
  console.log('[Test 1] Trade Link Generation for Solana, BSC, Ethereum, Base');
  const solLinks = generateAutoTradeLinks('solana', 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  assert.ok(solLinks.primarySwapUrl.includes('raydium.io') || solLinks.primarySwapUrl.includes('jup.ag'), 'Solana should generate DEX swap link');
  assert.ok(solLinks.dexLinks.some(l => l.name === 'Jupiter' || l.name === 'Raydium'), 'Solana should list Jupiter/Raydium');

  const bscLinks = generateAutoTradeLinks('bsc', '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82');
  assert.ok(bscLinks.primarySwapUrl.includes('pancakeswap.finance'), 'BSC should generate PancakeSwap link');
  assert.strictEqual(bscLinks.primaryDexName, 'PancakeSwap', 'PancakeSwap should be primary for BSC');

  const ethLinks = generateAutoTradeLinks('ethereum', '0x6982508145454ce325ddbe47a25d4ec3d2311933');
  assert.ok(ethLinks.primarySwapUrl.includes('uniswap.org'), 'Ethereum should generate Uniswap link');

  const baseLinks = generateAutoTradeLinks('base', '0x4ed4e862860bed51a9570b96d89af5e1b0efefed');
  assert.ok(baseLinks.primarySwapUrl.includes('aerodrome.finance'), 'Base should generate Aerodrome link');

  console.log('✓ Trade links successfully generated across all target ecosystems\n');

  // 2. Test Packages and Deposit Wallets
  console.log('[Test 2] Packages and Payment Configurations');
  assert.strictEqual(PROMOTION_PACKAGES['12H'].price, 39);
  assert.strictEqual(PROMOTION_PACKAGES['1D'].price, 59);
  assert.strictEqual(PROMOTION_PACKAGES['7D'].price, 149);
  assert.strictEqual(PROMOTION_PACKAGES['30D'].price, 399);
  const treasuries = getTreasuryAddresses();
  assert.ok(treasuries.solana, 'Solana deposit wallet must exist');
  assert.ok(treasuries.bsc, 'BSC EVM deposit wallet must exist');
  console.log('✓ Payment packages and treasury addresses properly configured\n');

  // 3. Test Order Creation in promotionService
  console.log('[Test 3] Promotion Order Creation');
  const testOrderPayload = {
    chain: 'solana',
    contractAddress: 'Bonk111111111111111111111111111111111111111',
    tokenName: 'Automated Test Bull',
    tokenSymbol: 'ATBULL',
    logoUrl: 'https://example.com/logo.png',
    packageKey: '7D',
    paymentMethod: 'direct_solana',
    websiteUrl: 'https://atbull.crypto',
    xUrl: 'https://x.com/atbull',
    telegramUrl: 'https://t.me/atbull',
    redditUrl: 'https://reddit.com/r/atbull'
  };

  const createdOrder = await promotionService.createPromotionOrder(testOrderPayload);
  assert.ok(createdOrder.orderId, 'Order must return orderId');
  assert.strictEqual(createdOrder.price, 149, '7-day tier must be $149');
  assert.strictEqual(createdOrder.status, 'pending');
  assert.ok(createdOrder.autoTradingUrl.includes('Bonk111111111111111111111111111111111111111'), 'Order must have generated auto-trade link');
  console.log(`✓ Created order #${createdOrder.orderId} with auto-trading link: ${createdOrder.autoTradingUrl}\n`);

  // 4. Test On-Chain Verification and Instant Activation
  console.log('[Test 4] On-Chain TX Verification and Instant Activation');
  const mockTxHash = `TEST_TX_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const activationResult = await promotionService.activatePromotionFromOrder(createdOrder.orderId, mockTxHash);

  assert.strictEqual(activationResult.success, true);
  assert.strictEqual(activationResult.status, 'active');
  assert.ok(activationResult.orderId, 'Order must be activated');
  console.log(`✓ Activated promotion #${activationResult.orderId} from order #${createdOrder.orderId}\n`);

  // 5. Test Double-Spend TX Prevention
  console.log('[Test 5] Double-Spend TX Prevention');
  const duplicateOrder = await promotionService.createPromotionOrder({
    ...testOrderPayload,
    tokenName: 'Double Spend Attempt'
  });

  let threwDuplicateError = false;
  try {
    // Attempting to verify the duplicate order with the same txHash
    await verifyTransactionOnChain({
      orderId: duplicateOrder.orderId,
      txHash: mockTxHash
    });
  } catch (err) {
    threwDuplicateError = true;
    assert.ok(err.message.includes('already been used') || err.message.includes('UNIQUE constraint'), 'Should fail with duplicate tx message');
    console.log(`✓ Correctly rejected double-spend txHash: ${err.message}`);
  }
  assert.strictEqual(threwDuplicateError, true, 'Re-using the same txHash must throw error');
  console.log('');

  // 5b. Test Anti-Fraud Old Transaction Rejection
  console.log('[Test 5b] Anti-Fraud Protection: Old Transaction Hash Rejection');
  let threwOldTxError = false;
  try {
    await verifyTransactionOnChain({
      txHash: 'TEST_OLD_TX_987654321',
      expectedAmountUsd: 99,
      chain: 'bsc',
      orderCreatedAt: new Date().toISOString()
    });
  } catch (err) {
    threwOldTxError = true;
    assert.ok(err.message.includes('Anti-Fraud Alert') || err.message.includes('before this promotion order'), 'Should trigger anti-fraud alert');
    console.log(`✓ Correctly blocked old transaction submission: ${err.message}`);
  }
  assert.strictEqual(threwOldTxError, true, 'Submitting an old transaction must be blocked by Anti-Fraud check');
  console.log('');

  // 6. Test Active Promotions List & Social Links
  console.log('[Test 6] Active Promoted Listing with Conditional Social Links & Auto-Trade');
  const activePromotions = await promotionService.getActivePromotions();
  const found = activePromotions.find(p => p.name === 'Automated Test Bull' || p.symbol === 'ATBULL');
  assert.ok(found, 'Newly activated promotion must appear in activePromotions list');
  assert.strictEqual(found.reddit_url, 'https://reddit.com/r/atbull', 'Reddit URL must be stored and returned');
  assert.ok(found.auto_trading_url.includes('Bonk111111111111111111111111111111111111111'), 'Auto-trading URL must be present');
  console.log(`✓ Found promoted coin "${found.name}" with Reddit: ${found.reddit_url} and Trade URL: ${found.auto_trading_url}\n`);

  // Clean up test records
  console.log('[Cleanup] Removing test orders');
  execute('DELETE FROM promotions WHERE auto_trading_url LIKE ?', ['%Bonk111111111111111111111111111111111111111%']);
  execute('DELETE FROM promotion_orders WHERE token_name = ? OR token_name = ?', ['Automated Test Bull', 'Double Spend Attempt']);
  execute('DELETE FROM tokens WHERE symbol = ?', ['ATBULL']);
  console.log('✓ Cleaned up test data');

  console.log('\n🎉 ALL PROMOTED COIN & AUTOMATED PAYMENT TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
