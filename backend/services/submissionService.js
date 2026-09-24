const { queryOne, execute, transaction } = require('../../database/db');
const { marketDataProvider } = require('../providers');
const { calculateHotScore } = require('./hotScoreService');
const { normalizeChain, getChainAliases, isValidContractAddress } = require('../utils/helpers');
const { persistSubmittedToken } = require('../../database/syncStore');
const { invalidateHomeCache } = require('../controllers/homeController');

/**
 * Process token submission and automatically inject into New Coins (Section 11, 45)
 */
async function processSubmission(data) {
  const {
    chain,
    contractAddress,
    projectName,
    tokenSymbol: userSymbol = '',
    symbol = '',
    projectEmail = '',
    description = '',
    logoUrl = '',
    websiteUrl = '',
    xUrl = '',
    telegramUrl = ''
  } = data;

  // 1. Validation
  if (!chain || !contractAddress || !projectName) {
    throw new Error('Chain, contract address, and project name are required.');
  }

  const cleanChain = normalizeChain(chain);
  const cleanContract = contractAddress.trim();

  // Validate contract address format
  if (!isValidContractAddress(cleanChain, cleanContract)) {
    throw new Error(`Invalid contract address format for chain '${cleanChain}'.`);
  }

  // 2. Duplicate Detection
  const aliases = getChainAliases(cleanChain) || [cleanChain];
  const ph = aliases.map(() => '?').join(',');
  const existing = queryOne(`
    SELECT id, name, symbol FROM tokens 
    WHERE chain IN (${ph}) AND LOWER(contract_address) = LOWER(?)
  `, [...aliases, cleanContract]);

  if (existing) {
    throw new Error(`Token with contract address '${cleanContract}' is already listed as ${existing.name} ($${existing.symbol}).`);
  }

  // 3. Fetch on-chain metadata (DexScreener or fallback)
  let meta = null;
  try {
    meta = await marketDataProvider.fetchContractMetadata(cleanChain, cleanContract);
  } catch (metaErr) {
    console.warn('[Submission Meta Notice]', metaErr.message);
  }

  const tokenName = projectName.trim();
  const tokenSymbol = (userSymbol || symbol || meta?.symbol || tokenName.slice(0, 5)).trim().toUpperCase();
  const tokenPrice = meta?.price || 0.0001;
  const tokenCap = meta?.marketCap || 25000;
  const tokenVol = meta?.volume24h || 500;
  const tokenChg = meta?.change24h || 0;
  const tokenLogo = logoUrl || 'assets/logo-transparent.png';

  const hotScore = calculateHotScore({
    volume_24h: tokenVol,
    change_24h: tokenChg,
    change_1h: 0,
    market_cap: tokenCap
  });

  const submissionResult = transaction(() => {
    // 4. Insert into tokens with is_submitted = 1, listing_status = 'LIVE', first_seen_at = CURRENT_TIMESTAMP
    const insertTokenSql = `
      INSERT INTO tokens (
        chain, contract_address, provider_id, name, symbol, logo_url, description,
        website_url, x_url, telegram_url, price, market_cap, volume_24h,
        change_1h, change_24h, change_7d, circulating_supply, total_supply,
        ath, ath_date, atl, atl_date, market_cap_rank, hot_score,
        is_submitted, is_promoted, is_active, listing_status, verification_status,
        first_seen_at, last_data_sync
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        0, ?, 0, 1000000000, 1000000000,
        ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, 9999, ?,
        1, 0, 1, 'LIVE', 'verified',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;

    const tokenRes = execute(insertTokenSql, [
      cleanChain, cleanContract, cleanContract.slice(0, 12), tokenName, tokenSymbol, tokenLogo, description,
      websiteUrl, xUrl, telegramUrl, tokenPrice, tokenCap, tokenVol,
      tokenChg, tokenPrice * 1.2, tokenPrice * 0.8, hotScore
    ]);

    const tokenId = Number(tokenRes.lastInsertRowid);

    // Initial price history point
    const nowSec = Math.floor(Date.now() / 1000);
    execute(`
      INSERT INTO token_price_history (token_id, price, market_cap, volume_24h, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `, [tokenId, tokenPrice, tokenCap, tokenVol, nowSec]);

    // 5. Insert into token_submissions with status = 'LIVE'
    const subRes = execute(`
      INSERT INTO token_submissions (
        token_id, chain, contract_address, project_name, project_email,
        description, logo_url, website_url, x_url, telegram_url,
        status, admin_note, submitted_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LIVE', 'Automated validation passed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      tokenId, cleanChain, cleanContract, tokenName, projectEmail,
      description, tokenLogo, websiteUrl, xUrl, telegramUrl
    ]);

    const submissionId = Number(subRes.lastInsertRowid);

    return {
      submissionId,
      tokenId,
      name: tokenName,
      symbol: tokenSymbol,
      chain: cleanChain,
      contractAddress: cleanContract,
      logoUrl: tokenLogo,
      price: tokenPrice,
      marketCap: tokenCap,
      volume24h: tokenVol,
      status: 'LIVE',
      message: 'Token Submitted Successfully. Your token has been successfully processed and is now live on Bulls Traking.'
    };
  });

  // 6. Cross-Environment Persistence: Save to syncStore (local JSON + /tmp + PostgreSQL)
  try {
    persistSubmittedToken({
      id: submissionResult.tokenId,
      chain: cleanChain,
      contract_address: cleanContract,
      name: tokenName,
      symbol: tokenSymbol,
      logo_url: tokenLogo,
      description,
      website_url: websiteUrl,
      x_url: xUrl,
      telegram_url: telegramUrl,
      price: tokenPrice,
      market_cap: tokenCap,
      volume_24h: tokenVol,
      change_1h: 0,
      change_24h: tokenChg,
      change_7d: 0,
      circulating_supply: 1000000000,
      total_supply: 1000000000,
      ath: tokenPrice * 1.2,
      ath_date: new Date().toISOString(),
      atl: tokenPrice * 0.8,
      atl_date: new Date().toISOString(),
      market_cap_rank: 9999,
      hot_score: hotScore,
      is_submitted: 1,
      is_promoted: 0,
      is_active: 1,
      listing_status: 'LIVE',
      verification_status: 'verified',
      first_seen_at: new Date().toISOString()
    });
  } catch (persistErr) {
    console.warn('[Submission Persist Notice]', persistErr.message);
  }

  // 7. Invalidate Home In-Memory Cache so Home and New Coins reflect instantly
  try {
    invalidateHomeCache();
  } catch (cacheErr) {
    // Non-fatal
  }

  // 8. Broadcast to live connected clients via WebSocket
  try {
    const { broadcast } = require('../websocket/wsServer');
    if (typeof broadcast === 'function') {
      broadcast({
        type: 'NEW_PAIR',
        data: {
          chain: cleanChain,
          name: tokenName,
          symbol: tokenSymbol,
          contractAddress: cleanContract,
          price: tokenPrice,
          marketCap: tokenCap,
          source: 'submission'
        }
      });
    }
  } catch (wsErr) {
    // Non-fatal
  }

  return submissionResult;
}

/**
 * Get submission status
 */
function getSubmissionById(submissionId) {
  const row = queryOne(`
    SELECT ts.*, t.symbol, t.price, t.listing_status 
    FROM token_submissions ts
    LEFT JOIN tokens t ON ts.token_id = t.id
    WHERE ts.id = ?
  `, [submissionId]);
  if (!row) return null;
  return {
    ...row,
    currentStep: row.status === 'LIVE' ? 'LIVE' : (row.status || 'PENDING'),
    celebrationMessage: 'Token is live on Bulls Traking!'
  };
}

module.exports = {
  processSubmission,
  getSubmissionById
};
