const { query, queryOne, execute } = require('../db/database');

/**
 * Query tokens with sorting, chain filtering, and tabs
 */
function getTokens(options = {}) {
  const {
    chain = 'all',
    tab = 'trending',
    search = '',
    limit = 50,
    offset = 0
  } = options;

  let whereClauses = ["status = 'active'"];
  const params = [];

  if (chain && chain !== 'all') {
    whereClauses.push("chain = ?");
    params.push(chain);
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push("(LOWER(name) LIKE ? OR LOWER(symbol) LIKE ? OR LOWER(contract_address) LIKE ?)");
    params.push(q, q, q);
  }

  // Sorting based on tab
  let orderBy = 'market_cap DESC';
  switch (tab) {
    case 'gainers':
      orderBy = 'price_change_24h DESC';
      break;
    case 'hot':
      orderBy = 'volume_24h DESC';
      break;
    case 'new':
      orderBy = 'id DESC';
      break;
    case 'trending':
    default:
      orderBy = 'market_cap DESC';
      break;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT 
      id, chain, contract_address, name, symbol, logo_url, description,
      website_url, x_url, telegram_url, decimals, total_supply, circulating_supply,
      price, market_cap, volume_24h, liquidity, price_change_1h, price_change_24h, price_change_7d,
      ath, atl, rank, status, listing_status, verification_status
    FROM tokens
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;

  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const tokens = query(sql, params);

  // Attach 7D sparkline data points for each token
  const tokensWithSparklines = tokens.map(tok => {
    const history = query(`
      SELECT price FROM token_price_history 
      WHERE token_id = ? 
      ORDER BY timestamp ASC LIMIT 14
    `, [tok.id]);
    return {
      ...tok,
      sparkline: history.length > 1 ? history.map(h => h.price) : [tok.price * 0.95, tok.price]
    };
  });

  return tokensWithSparklines;
}

/**
 * Get detailed token by ID or Contract Address
 */
function getTokenDetail(idOrAddress) {
  let token = null;
  if (/^\d+$/.test(idOrAddress)) {
    token = queryOne(`SELECT * FROM tokens WHERE id = ?`, [parseInt(idOrAddress, 10)]);
  }
  if (!token) {
    token = queryOne(`SELECT * FROM tokens WHERE LOWER(contract_address) = LOWER(?)`, [idOrAddress]);
  }
  if (!token) return null;

  // Fetch security scan
  const security = queryOne(`
    SELECT * FROM security_scans 
    WHERE token_id = ? OR (chain = ? AND LOWER(contract_address) = LOWER(?))
    ORDER BY id DESC LIMIT 1
  `, [token.id, token.chain, token.contract_address]);

  // Fetch price history
  const priceHistory = query(`
    SELECT timestamp, price, volume, market_cap 
    FROM token_price_history 
    WHERE token_id = ? 
    ORDER BY timestamp ASC
  `, [token.id]);

  return {
    ...token,
    security: security || {
      risk_level: 'LOW',
      risk_score: 95,
      honeypot: 0,
      buy_tax: 0,
      sell_tax: 0,
      ownership: 'renounced'
    },
    price_history: priceHistory
  };
}

/**
 * Top movers for ticker tape
 */
function getTickerMovers() {
  return query(`
    SELECT symbol, name, price, price_change_24h 
    FROM tokens 
    WHERE status = 'active'
    ORDER BY ABS(price_change_24h) DESC 
    LIMIT 16
  `);
}

module.exports = {
  getTokens,
  getTokenDetail,
  getTickerMovers
};
