const { queryOne, execute, transaction } = require('../../database/db');
const { marketDataProvider } = require('../providers');
const { calculateHotScore } = require('./hotScoreService');
const { isValidContractAddress } = require('../utils/helpers');

/**
 * Process token submission and automatically inject into New Coins (Section 11, 45)
 */
async function processSubmission(data) {
  const {
    chain,
    contractAddress,
    projectName,
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

  const cleanContract = contractAddress.trim();

  // Validate contract address format
  if (!isValidContractAddress(chain, cleanContract)) {
    throw new Error(`Invalid contract address format for chain '${chain}'.`);
  }

  // 2. Duplicate Detection
  const existing = queryOne(`
    SELECT id, name, symbol FROM tokens 
    WHERE chain = ? AND LOWER(contract_address) = LOWER(?)
  `, [chain, cleanContract]);

  if (existing) {
    throw new Error(`Token with contract address '${cleanContract}' is already listed as ${existing.name} (${existing.symbol}).`);
  }

  // 3. Fetch on-chain metadata (DexScreener or fallback)
  const meta = await marketDataProvider.fetchContractMetadata(chain, cleanContract);
  const tokenName = projectName.trim();
  const tokenSymbol = meta?.symbol || tokenName.slice(0, 5).toUpperCase();
  const tokenPrice = meta?.price || 0.00001;
  const tokenCap = meta?.marketCap || 25000;
  const tokenVol = meta?.volume24h || 500;
  const tokenChg = meta?.change24h || 0;
  const tokenLogo = logoUrl || 'https://assets.coingecko.com/coins/images/325/standard/Tether.png';

  const hotScore = calculateHotScore({
    volume_24h: tokenVol,
    change_24h: tokenChg,
    change_1h: 0,
    market_cap: tokenCap
  });

  return transaction(() => {
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
      chain, cleanContract, cleanContract.slice(0, 12), tokenName, tokenSymbol, tokenLogo, description,
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
      tokenId, chain, cleanContract, tokenName, projectEmail,
      description, tokenLogo, websiteUrl, xUrl, telegramUrl
    ]);

    const submissionId = Number(subRes.lastInsertRowid);

    return {
      submissionId,
      tokenId,
      name: tokenName,
      symbol: tokenSymbol,
      chain,
      contractAddress: cleanContract,
      status: 'LIVE',
      message: '🎉 Token Submitted Successfully. Your token has been successfully processed and is now live on Bulls Traking.'
    };
  });
}

/**
 * Get submission status
 */
function getSubmissionById(submissionId) {
  return queryOne(`
    SELECT ts.*, t.symbol, t.price, t.listing_status 
    FROM token_submissions ts
    LEFT JOIN tokens t ON ts.token_id = t.id
    WHERE ts.id = ?
  `, [submissionId]);
}

module.exports = {
  processSubmission,
  getSubmissionById
};
