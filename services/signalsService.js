/**
 * Bulls Traking — Signals Service (Phase 3 Task 3)
 * Manages crypto alpha signals ingested from Telegram channels and administrative alerts.
 */

const { query, queryOne, execute } = require('../database/db');

/**
 * Fetch list of signals with optional filtering and pagination
 */
function getSignals(options = {}) {
  const {
    direction = 'all',
    limit = 20,
    page = 1,
    isActive = 1
  } = options;

  seedInitialSignalsIfEmpty();
  const limitNum = parseInt(limit, 10) || 20;
  const pageNum = parseInt(page, 10) || 1;
  const offsetNum = (pageNum - 1) * limitNum;

  const whereClauses = [];
  const params = [];

  if (isActive != null && isActive !== 'all') {
    whereClauses.push('s.is_active = ?');
    params.push(parseInt(isActive, 10) || 1);
  }

  if (direction && direction !== 'all') {
    whereClauses.push('LOWER(s.direction) = LOWER(?)');
    params.push(direction);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = queryOne(`
    SELECT COUNT(*) as count 
    FROM signals s
    ${whereSql}
  `, params);
  const total = countRow ? countRow.count : 0;

  const sql = `
    SELECT 
      s.id,
      s.token_id,
      s.title,
      s.message,
      s.direction,
      s.source,
      s.posted_at,
      s.is_active,
      t.name AS token_name,
      t.symbol AS token_symbol,
      t.logo_url AS token_logo_url,
      t.price AS token_price,
      t.change_24h AS token_change_24h,
      t.chain AS token_chain,
      t.contract_address AS token_contract
    FROM signals s
    LEFT JOIN tokens t ON s.token_id = t.id
    ${whereSql}
    ORDER BY s.posted_at DESC, s.id DESC
    LIMIT ? OFFSET ?
  `;

  const signals = query(sql, [...params, limitNum, offsetNum]);

  return {
    signals,
    total,
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum) || 1
  };
}

/**
 * Create a new signal (e.g. from Telegram ingest or Admin UI)
 */
function createSignal(data = {}) {
  const {
    token_id = null,
    title,
    message,
    direction = 'watch',
    source = 'telegram'
  } = data;

  if (!title || !title.trim()) {
    throw new Error('Signal title is required');
  }
  if (!message || !message.trim()) {
    throw new Error('Signal message content is required');
  }

  const validDirections = ['buy', 'sell', 'watch'];
  const dir = (direction || '').toLowerCase().trim();
  if (!validDirections.includes(dir)) {
    throw new Error(`Invalid signal direction '${direction}'. Allowed: ${validDirections.join(', ')}`);
  }

  // Validate token_id if provided
  let validTokenId = null;
  if (token_id) {
    const token = queryOne('SELECT id FROM tokens WHERE id = ?', [token_id]);
    if (token) validTokenId = token.id;
  }

  const result = execute(`
    INSERT INTO signals (token_id, title, message, direction, source, posted_at, is_active)
    VALUES (?, ?, ?, ?, ?, datetime('now'), 1)
  `, [validTokenId, title.trim(), message.trim(), dir, source.trim()]);

  return {
    id: result.lastInsertRowid,
    token_id: validTokenId,
    title: title.trim(),
    message: message.trim(),
    direction: dir,
    source: source.trim(),
    posted_at: new Date().toISOString(),
    is_active: 1
  };
}

/**
 * Seed initial mock/demo signals if none exist
 */
function seedInitialSignalsIfEmpty() {
  try {
    const countRow = queryOne('SELECT COUNT(*) as count FROM signals');
    if (countRow && countRow.count === 0) {
      // Find popular tokens like SOL or BTC
      const sol = queryOne("SELECT id FROM tokens WHERE symbol = 'SOL' LIMIT 1");
      const btc = queryOne("SELECT id FROM tokens WHERE symbol = 'BTC' LIMIT 1");
      const eth = queryOne("SELECT id FROM tokens WHERE symbol = 'ETH' LIMIT 1");

      const seeds = [
        {
          token_id: sol ? sol.id : null,
          title: 'Solana High Velocity Breakout Setup',
          message: 'Massive on-chain DEX volume surge (+42% 1h) with strong RSI continuation above 60. Clean consolidation breakout across Raydium pools.',
          direction: 'buy',
          source: 'telegram'
        },
        {
          token_id: btc ? btc.id : null,
          title: 'Bitcoin CME Gap & Resistance Confluence',
          message: 'Price reaching key overhead liquidity cluster. Divergence spotted on lower timeframes. Watch for retest of lower support before entering.',
          direction: 'watch',
          source: 'telegram'
        },
        {
          token_id: eth ? eth.id : null,
          title: 'Ethereum Local Range High Take Profit',
          message: 'Whale transfers spotted hitting CEX deposit contracts. Tighten stops and trim 30% of swing positions.',
          direction: 'sell',
          source: 'telegram'
        }
      ];

      for (const s of seeds) {
        createSignal(s);
      }
      console.log('[SignalsService] Seeded initial demo alpha signals.');
    }
  } catch (err) {
    console.warn('[SignalsService Seed Notice]', err.message);
  }
}

// Auto-seed on load
seedInitialSignalsIfEmpty();

module.exports = {
  getSignals,
  createSignal,
  seedInitialSignalsIfEmpty
};
