const { query, execute, transaction } = require('../../database/db');

/**
 * Get active promoted tokens (Section 15, 46)
 * Strict logic: start_at <= now AND end_at >= now AND is_active = 1
 */
function getActivePromotions() {
  const sql = `
    SELECT 
      p.id AS promotion_id,
      p.package_name,
      p.priority,
      t.id AS token_id,
      t.name,
      t.symbol,
      t.chain,
      t.contract_address,
      t.logo_url,
      t.price,
      t.change_24h,
      t.market_cap,
      t.volume_24h
    FROM promotions p
    JOIN tokens t ON p.token_id = t.id
    WHERE datetime(p.start_at) <= datetime('now')
      AND datetime(p.end_at) >= datetime('now')
      AND p.is_active = 1
      AND t.is_active = 1
    ORDER BY p.priority DESC, p.id DESC
  `;
  return query(sql);
}

/**
 * Create a new promotion order (Section 40)
 */
function createPromotionOrder(data) {
  const {
    tokenId,
    customerName,
    customerEmail,
    telegramUsername,
    promotionType = 'PROMOTED_TOKEN',
    packageName = 'Spotlight 7D',
    durationDays = 7,
    price = 499
  } = data;

  const startAt = new Date().toISOString();
  const endAt = new Date(Date.now() + durationDays * 86400000).toISOString();

  const res = execute(`
    INSERT INTO promotion_orders (
      token_id, customer_name, customer_email, telegram_username,
      promotion_type, package_name, duration_days, price, currency,
      start_at, end_at, payment_status, order_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USDT', ?, ?, 'pending', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [
    tokenId || null, customerName, customerEmail, telegramUsername,
    promotionType, packageName, durationDays, price, startAt, endAt
  ]);

  return {
    orderId: Number(res.lastInsertRowid),
    price,
    currency: 'USDT',
    status: 'pending',
    message: 'Promotion order created with pending status.'
  };
}

module.exports = {
  getActivePromotions,
  createPromotionOrder
};
