const { query, queryOne } = require('../../database/db');
const { calculateTokenAge } = require('../utils/helpers');
const config = require('../../config/default');

function attachSparklines(tokens) {
  return tokens.map(tok => {
    const history = query(`
      SELECT price FROM token_price_history 
      WHERE token_id = ? 
      ORDER BY timestamp ASC LIMIT 14
    `, [tok.id]);

    const prices = history.length > 1 ? history.map(h => h.price) : [tok.price * 0.95, tok.price];
    return {
      ...tok,
      age: calculateTokenAge(tok.first_seen_at),
      sparkline: prices
    };
  });
}

/**
 * Top Coins (Section 9): Sorted by Market Cap DESC
 */
function getTopCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  let where = "WHERE is_active = 1";
  const params = [];

  if (chain && chain !== 'all') {
    where += " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM tokens
    ${where}
    ORDER BY market_cap DESC
    LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit, 10), offset);

  const tokens = query(sql, params);
  const total = queryOne(`SELECT COUNT(*) as count FROM tokens ${where}`, params.slice(0, -2))?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
  };
}

/**
 * New Coins (Section 10): Source A (API) + Source B (User Submitted)
 * Sorted by first_seen_at DESC
 */
function getNewCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  let where = "WHERE is_active = 1";
  const params = [];

  if (chain && chain !== 'all') {
    where += " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM tokens
    ${where}
    ORDER BY first_seen_at DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit, 10), offset);

  const tokens = query(sql, params);
  const total = queryOne(`SELECT COUNT(*) as count FROM tokens ${where}`, params.slice(0, -2))?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
  };
}

/**
 * Hot Coins (Section 13): Algorithmic Hot Score DESC
 */
function getHotCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  let where = "WHERE is_active = 1";
  const params = [];

  if (chain && chain !== 'all') {
    where += " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM tokens
    ${where}
    ORDER BY hot_score DESC, volume_24h DESC
    LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit, 10), offset);

  const tokens = query(sql, params);
  const total = queryOne(`SELECT COUNT(*) as count FROM tokens ${where}`, params.slice(0, -2))?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
  };
}

/**
 * Top Gainers (Section 14): 24h percentage gain DESC with minimum quality filter
 */
function getTopGainers({ chain = 'all', limit = 50, page = 1 } = {}) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const minVol = config.gainersFilter.minVolume24hUsd;
  let where = "WHERE is_active = 1 AND volume_24h >= ? AND change_24h > 0";
  const params = [minVol];

  if (chain && chain !== 'all') {
    where += " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM tokens
    ${where}
    ORDER BY change_24h DESC
    LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit, 10), offset);

  const tokens = query(sql, params);
  const total = queryOne(`SELECT COUNT(*) as count FROM tokens ${where}`, params.slice(0, -2))?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
  };
}

/**
 * Trending Coins (Section 39): Internal ranking
 */
function getTrendingCoins({ chain = 'all', limit = 50, page = 1 } = {}) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  let where = "WHERE is_active = 1";
  const params = [];

  if (chain && chain !== 'all') {
    where += " AND chain = ?";
    params.push(chain);
  }

  const sql = `
    SELECT * FROM tokens
    ${where}
    ORDER BY (volume_24h * 0.4 + market_cap * 0.3 + ABS(change_24h) * 100000) DESC
    LIMIT ? OFFSET ?
  `;
  params.push(parseInt(limit, 10), offset);

  const tokens = query(sql, params);
  const total = queryOne(`SELECT COUNT(*) as count FROM tokens ${where}`, params.slice(0, -2))?.count || 0;

  return {
    tokens: attachSparklines(tokens),
    pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total }
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
    SELECT id, name, symbol, logo_url, price, change_24h, chain, contract_address, provider_id
    FROM tokens
    WHERE is_active = 1 AND (
      LOWER(name) LIKE ? OR 
      LOWER(symbol) LIKE ? OR 
      LOWER(contract_address) LIKE ? OR
      LOWER(provider_id) LIKE ?
    )
    ORDER BY market_cap DESC
    LIMIT ?
  `;
  return query(sql, [q, q, q, q, parseInt(limit, 10)]);
}

module.exports = {
  getTopCoins,
  getNewCoins,
  getHotCoins,
  getTopGainers,
  getTrendingCoins,
  getTokenDetail,
  searchTokens
};
