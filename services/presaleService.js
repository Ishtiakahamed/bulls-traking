const { query, execute } = require('../db/database');

/**
 * Get presales filtered by launchpad and chain
 */
function getPresales(options = {}) {
  const { launchpad = 'all', chain = 'all' } = options;

  let whereClauses = [];
  const params = [];

  if (launchpad && launchpad.toLowerCase() !== 'all') {
    whereClauses.push("LOWER(launchpad) = LOWER(?)");
    params.push(launchpad);
  }

  if (chain && chain.toLowerCase() !== 'all') {
    whereClauses.push("chain = ?");
    params.push(chain);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `
    SELECT 
      p.*,
      t.symbol AS token_symbol,
      t.logo_url AS token_logo
    FROM presales p
    LEFT JOIN tokens t ON p.token_id = t.id
    ${whereSql}
    ORDER BY p.featured DESC, p.start_at ASC
  `;

  return query(sql, params);
}

module.exports = {
  getPresales
};
