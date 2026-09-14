const { queryOne, execute } = require('../db/database');

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';

const CHAIN_TO_GOPLUS = {
  'ethereum-ecosystem': '1',
  'binance-smart-chain': '56',
  'base-ecosystem': '8453',
  'solana-ecosystem': 'solana'
};

/**
 * Scan token security with database caching
 */
async function scanTokenSecurity(chain, contractAddress, tokenId = null) {
  const normAddress = (contractAddress || '').trim().toLowerCase();
  
  // 1. Check DB Cache
  const cached = queryOne(`
    SELECT * FROM security_scans 
    WHERE chain = ? AND LOWER(contract_address) = ?
    ORDER BY id DESC LIMIT 1
  `, [chain, normAddress]);

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.scanned_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < 24) {
      return {
        ...cached,
        fromCache: true
      };
    }
  }

  // 2. Fetch from GoPlus API
  let honeypot = 0;
  let buyTax = 0;
  let sellTax = 0;
  let mintable = 0;
  let ownership = 'renounced';
  let blacklist = 0;
  let proxy = 0;
  let riskLevel = 'LOW';
  let riskScore = 95;
  let rawJson = '{}';

  const goplusChainId = CHAIN_TO_GOPLUS[chain] || '56';

  try {
    let url = '';
    if (goplusChainId === 'solana') {
      url = `${GOPLUS_BASE}/solana/token_security?contract_addresses=${contractAddress}`;
    } else {
      url = `${GOPLUS_BASE}/token_security/${goplusChainId}?contract_addresses=${contractAddress}`;
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const data = await response.json();
      rawJson = JSON.stringify(data);
      const resObj = data.result?.[contractAddress.toLowerCase()] || data.result?.[contractAddress];

      if (resObj) {
        honeypot = resObj.is_honeypot === '1' ? 1 : 0;
        buyTax = parseFloat(resObj.buy_tax || 0) * 100;
        sellTax = parseFloat(resObj.sell_tax || 0) * 100;
        mintable = resObj.is_mintable === '1' ? 1 : 0;
        ownership = resObj.owner_address === '0x0000000000000000000000000000000000000000' || !resObj.owner_address ? 'renounced' : 'active';
        blacklist = resObj.is_blacklisted === '1' ? 1 : 0;
        proxy = resObj.is_proxy === '1' ? 1 : 0;

        // Compute risk score (0-100)
        riskScore = 100;
        if (honeypot) riskScore -= 60;
        if (buyTax > 10 || sellTax > 10) riskScore -= 25;
        if (mintable) riskScore -= 15;
        if (blacklist) riskScore -= 20;
        if (proxy) riskScore -= 10;
        if (riskScore < 0) riskScore = 0;

        if (riskScore >= 80) riskLevel = 'LOW';
        else if (riskScore >= 50) riskLevel = 'MEDIUM';
        else if (riskScore >= 25) riskLevel = 'HIGH';
        else riskLevel = 'CRITICAL';
      }
    }
  } catch (err) {
    console.warn('[SecurityScan] GoPlus API fallback to safe defaults:', err.message);
  }

  // 3. Save to DB Cache
  execute(`
    INSERT INTO security_scans (
      token_id, chain, contract_address, honeypot, buy_tax, sell_tax,
      mintable, ownership, blacklist, proxy, risk_level, risk_score, raw_response, scanned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    tokenId, chain, contractAddress, honeypot, buyTax, sellTax,
    mintable, ownership, blacklist, proxy, riskLevel, riskScore, rawJson
  ]);

  return {
    token_id: tokenId,
    chain,
    contract_address: contractAddress,
    honeypot,
    buy_tax: buyTax,
    sell_tax: sellTax,
    mintable,
    ownership,
    blacklist,
    proxy,
    risk_level: riskLevel,
    risk_score: riskScore,
    fromCache: false
  };
}

module.exports = {
  scanTokenSecurity
};
