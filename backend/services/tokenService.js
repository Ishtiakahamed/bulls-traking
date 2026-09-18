const { query, queryOne } = require('../../database/db');
const { calculateTokenAge } = require('../utils/helpers');
const config = require('../../config/default');

function attachSparklines(tokens) {
  if (!tokens || tokens.length === 0) return [];
  const tokenIds = tokens.map(t => t.id).filter(Boolean);
  if (tokenIds.length === 0) return tokens;

  const placeholders = tokenIds.map(() => '?').join(',');
  const allHistory = query(`
    SELECT token_id, price FROM token_price_history 
    WHERE token_id IN (${placeholders})
    ORDER BY timestamp ASC
  `, tokenIds);

  const historyMap = new Map();
  for (const h of allHistory) {
    if (!historyMap.has(h.token_id)) historyMap.set(h.token_id, []);
    const arr = historyMap.get(h.token_id);
    if (arr.length < 14) arr.push(h.price);
  }

  return tokens.map(tok => {
    const arr = historyMap.get(tok.id);
    const prices = (arr && arr.length > 1) ? arr : [tok.price * 0.95, tok.price];
    return {
      ...tok,
      age: calculateTokenAge(tok.first_seen_at),
      sparkline: prices
    };
  });
}

/**
 * Top Coins (Section 9): Sorted by Market Cap DESC, deduplicated by name
 */
function getTopCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const p = Math.max(1, parseInt(page, 10));
  const lim = parseInt(limit, 10);
  const offset = (p - 1) * lim;
  let chainFilter = "";
  const params = [];

  if (chain && chain !== 'all') {
    chainFilter = " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(name)) 
        ORDER BY market_cap DESC, volume_24h DESC
      ) as rn
      FROM tokens
      WHERE is_active = 1 ${chainFilter}
    )
    WHERE rn = 1
    ORDER BY market_cap DESC
    LIMIT ? OFFSET ?
  `;
  params.push(lim, offset);

  const tokens = query(sql, params);
  const countSql = `SELECT COUNT(DISTINCT UPPER(TRIM(name))) as count FROM tokens WHERE is_active = 1 ${chainFilter}`;
  const countParams = chain && chain !== 'all' ? [chain] : [];
  const total = queryOne(countSql, countParams)?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: p, limit: lim, total }
  };
}

/**
 * New Coins (Section 10): Source A (API) + Source B (User Submitted)
 * Sorted by first_seen_at DESC, deduplicated by name
 */
function getNewCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const p = Math.max(1, parseInt(page, 10));
  const lim = parseInt(limit, 10);
  const offset = (p - 1) * lim;
  let chainFilter = "";
  const params = [];

  if (chain && chain !== 'all') {
    chainFilter = " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(name)) 
        ORDER BY first_seen_at DESC, id DESC
      ) as rn
      FROM tokens
      WHERE is_active = 1 ${chainFilter}
    )
    WHERE rn = 1
    ORDER BY first_seen_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  params.push(lim, offset);

  const tokens = query(sql, params);
  const countSql = `SELECT COUNT(DISTINCT UPPER(TRIM(name))) as count FROM tokens WHERE is_active = 1 ${chainFilter}`;
  const countParams = chain && chain !== 'all' ? [chain] : [];
  const total = queryOne(countSql, countParams)?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: p, limit: lim, total }
  };
}

/**
 * Hot Coins (Section 13): Algorithmic Hot Score DESC, deduplicated by name
 */
function getHotCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const p = Math.max(1, parseInt(page, 10));
  const lim = parseInt(limit, 10);
  const offset = (p - 1) * lim;
  let chainFilter = "";
  const params = [];

  if (chain && chain !== 'all') {
    chainFilter = " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(name)) 
        ORDER BY hot_score DESC, volume_24h DESC
      ) as rn
      FROM tokens
      WHERE is_active = 1 ${chainFilter}
    )
    WHERE rn = 1
    ORDER BY hot_score DESC, volume_24h DESC
    LIMIT ? OFFSET ?
  `;
  params.push(lim, offset);

  const tokens = query(sql, params);
  const countSql = `SELECT COUNT(DISTINCT UPPER(TRIM(name))) as count FROM tokens WHERE is_active = 1 ${chainFilter}`;
  const countParams = chain && chain !== 'all' ? [chain] : [];
  const total = queryOne(countSql, countParams)?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: p, limit: lim, total }
  };
}

/**
 * Top Gainers (Section 14): 24h percentage gain DESC with minimum quality filter, deduplicated by name
 */
function getTopGainers({ chain = 'all', limit = 50, page = 1 } = {}) {
  const p = Math.max(1, parseInt(page, 10));
  const lim = parseInt(limit, 10);
  const offset = (p - 1) * lim;
  const minVol = config.gainersFilter.minVolume24hUsd;
  let chainFilter = "";
  const params = [minVol];

  if (chain && chain !== 'all') {
    chainFilter = " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(name)) 
        ORDER BY change_24h DESC, volume_24h DESC
      ) as rn
      FROM tokens
      WHERE is_active = 1 AND volume_24h >= ? AND change_24h > 0 ${chainFilter}
    )
    WHERE rn = 1
    ORDER BY change_24h DESC
    LIMIT ? OFFSET ?
  `;
  params.push(lim, offset);

  const tokens = query(sql, params);
  const countSql = `
    SELECT COUNT(DISTINCT UPPER(TRIM(name))) as count 
    FROM tokens 
    WHERE is_active = 1 AND volume_24h >= ? AND change_24h > 0 ${chainFilter}
  `;
  const countParams = chain && chain !== 'all' ? [minVol, chain] : [minVol];
  const total = queryOne(countSql, countParams)?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: p, limit: lim, total }
  };
}

/**
 * Trending Coins (Section 39): Internal ranking, deduplicated by name
 */
function getTrendingCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const p = Math.max(1, parseInt(page, 10));
  const lim = parseInt(limit, 10);
  const offset = (p - 1) * lim;
  let chainFilter = "";
  const params = [];

  if (chain && chain !== 'all') {
    chainFilter = " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(name)) 
        ORDER BY (volume_24h * 0.4 + market_cap * 0.3 + ABS(change_24h) * 100000) DESC
      ) as rn
      FROM tokens
      WHERE is_active = 1 ${chainFilter}
    )
    WHERE rn = 1
    ORDER BY (volume_24h * 0.4 + market_cap * 0.3 + ABS(change_24h) * 100000) DESC
    LIMIT ? OFFSET ?
  `;
  params.push(lim, offset);

  const tokens = query(sql, params);
  const countSql = `SELECT COUNT(DISTINCT UPPER(TRIM(name))) as count FROM tokens WHERE is_active = 1 ${chainFilter}`;
  const countParams = chain && chain !== 'all' ? [chain] : [];
  const total = queryOne(countSql, countParams)?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: p, limit: lim, total }
  };
}

/**
 * Token Detail (Section 23)
 */
function getTokenDetail(identifier, chain = null) {
  let token = null;

  if (/^\d+$/.test(identifier)) {
    token = queryOne(`SELECT * FROM tokens WHERE id = ?`, [parseInt(identifier, 10)]);
  }

  if (!token && chain) {
    token = queryOne(`SELECT * FROM tokens WHERE chain = ? AND LOWER(contract_address) = LOWER(?)`, [chain, identifier]);
  }

  if (!token) {
    token = queryOne(`SELECT * FROM tokens WHERE LOWER(contract_address) = LOWER(?) OR LOWER(provider_id) = LOWER(?)`, [identifier, identifier]);
  }

  if (!token) return null;

  // 7D price history
  const history = query(`
    SELECT price, market_cap, volume_24h, timestamp 
    FROM token_price_history 
    WHERE token_id = ? 
    ORDER BY timestamp ASC
  `, [token.id]);

  return {
    ...token,
    age: calculateTokenAge(token.first_seen_at),
    price_history: history
  };
}

/**
 * Search Tokens (Section 24): Name, Symbol, Contract Address, Provider ID
 */
function searchTokens(searchQuery, limit = 10) {
  if (!searchQuery || !searchQuery.trim()) return [];
  const q = `%${searchQuery.trim().toLowerCase()}%`;
  
  const sql = `
    SELECT * FROM (
      SELECT id, name, symbol, logo_url, price, change_24h, chain, contract_address, provider_id, market_cap, volume_24h,
             ROW_NUMBER() OVER (
               PARTITION BY UPPER(TRIM(name))
               ORDER BY market_cap DESC, volume_24h DESC
             ) as rn
      FROM tokens
      WHERE is_active = 1 AND (
        LOWER(name) LIKE ? OR 
        LOWER(symbol) LIKE ? OR 
        LOWER(contract_address) LIKE ? OR 
        LOWER(provider_id) LIKE ?
      )
    )
    WHERE rn = 1
    ORDER BY market_cap DESC
    LIMIT ?
  `;
  return query(sql, [q, q, q, q, parseInt(limit, 10)]);
}

/**
 * Get Tokens By ID List (for local Watchlist batch fetching)
 */
function getTokensByIds(ids = []) {
  if (!ids || ids.length === 0) return [];
  const validIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (validIds.length === 0) return [];

  const placeholders = validIds.map(() => '?').join(',');
  const sql = `
    SELECT * FROM tokens
    WHERE id IN (${placeholders})
    ORDER BY market_cap DESC
  `;
  const tokens = query(sql, validIds);
  return attachSparklines(tokens);
}

module.exports = {
  getTopCoins,
  getNewCoins,
  getHotCoins,
  getTopGainers,
  getTrendingCoins,
  getTokenDetail,
  searchTokens,
  getTokensByIds
};
