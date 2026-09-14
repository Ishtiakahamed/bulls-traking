const { query, queryOne, execute, transaction } = require('../db/database');

const AD_SLOT_MINUTES = 8;
const AD_SLOT_SECONDS = AD_SLOT_MINUTES * 60;

/**
 * Get currently active promoted tokens
 */
function getActivePromotedTokens() {
  const sql = `
    SELECT 
      po.id AS promotion_id,
      po.package_id,
      po.duration,
      po.ad_title,
      po.ad_description,
      t.id AS token_id,
      t.name,
      t.symbol,
      t.chain,
      t.contract_address,
      t.logo_url,
      t.price,
      t.price_change_24h,
      t.market_cap,
      t.volume_24h
    FROM promotion_orders po
    JOIN tokens t ON po.token_id = t.id
    WHERE po.promotion_type = 'PROMOTED_TOKEN'
      AND po.order_status = 'active'
      AND datetime(po.start_at) <= datetime('now')
      AND datetime(po.end_at) >= datetime('now')
    ORDER BY po.id DESC
  `;
  return query(sql);
}

/**
 * 8-minute synchronized Ad Board rotation engine
 */
function getCurrentAdBoard() {
  const activeAds = query(`
    SELECT ab.*, t.symbol, t.price, t.price_change_24h 
    FROM ad_boards ab
    LEFT JOIN tokens t ON ab.token_id = t.id
    WHERE ab.status = 'active'
      AND datetime(ab.start_at) <= datetime('now')
      AND datetime(ab.end_at) >= datetime('now')
    ORDER BY ab.rotation_order ASC, ab.id ASC
  `);

  if (!activeAds || activeAds.length === 0) {
    return {
      currentAd: null,
      remainingSeconds: 0,
      totalSlots: 0,
      queue: []
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const currentSlotIndex = Math.floor(nowSeconds / AD_SLOT_SECONDS) % activeAds.length;
  const remainingSeconds = AD_SLOT_SECONDS - (nowSeconds % AD_SLOT_SECONDS);
  const currentAd = activeAds[currentSlotIndex];

  return {
    currentAd,
    remainingSeconds,
    slotDurationMinutes: AD_SLOT_MINUTES,
    slotIndex: currentSlotIndex + 1,
    totalSlots: activeAds.length,
    queue: activeAds.map((ad, idx) => ({
      id: ad.id,
      title: ad.title,
      logo_url: ad.logo_url,
      symbol: ad.symbol,
      isCurrent: idx === currentSlotIndex
    }))
  };
}

/**
 * Get active banner placements (Top, Homepage, Presale)
 */
function getActiveBanners() {
  const sql = `
    SELECT bo.*, t.name AS token_name, t.symbol AS token_symbol
    FROM banner_orders bo
    LEFT JOIN tokens t ON bo.token_id = t.id
    WHERE bo.approval_status = 'approved'
      AND datetime(bo.start_at) <= datetime('now')
      AND datetime(bo.end_at) >= datetime('now')
    ORDER BY bo.id DESC
  `;
  const banners = query(sql);

  return {
    top_banner: banners.filter(b => b.placement === 'top_banner')[0] || null,
    homepage_banner: banners.filter(b => b.placement === 'homepage_banner')[0] || null,
    presale_banner: banners.filter(b => b.placement === 'presale_banner')[0] || null
  };
}

/**
 * Create a new promotion / banner / ad order
 */
function createPromotionOrder(data) {
  return transaction(() => {
    const {
      tokenId,
      customerName,
      customerEmail,
      telegramUsername,
      promotionType,
      packageId,
      durationDays = 7,
      price = 0,
      bannerUrl = null,
      adTitle = null,
      adDescription = null
    } = data;

    const startAt = new Date().toISOString();
    const endAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const result = execute(`
      INSERT INTO promotion_orders (
        token_id, customer_name, customer_email, telegram_username, promotion_type,
        package_id, duration, start_at, end_at, price, currency, payment_status,
        order_status, banner_url, ad_title, ad_description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USDT', 'pending', 'pending', ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      tokenId || null, customerName, customerEmail, telegramUsername, promotionType,
      packageId, durationDays, startAt, endAt, price, bannerUrl, adTitle, adDescription
    ]);

    const orderId = Number(result.lastInsertRowid);

    // Create associated payment record (separate entity)
    execute(`
      INSERT INTO payments (
        order_id, provider, amount, currency, status, created_at
      ) VALUES (?, 'crypto', ?, 'USDT', 'pending', CURRENT_TIMESTAMP)
    `, [orderId, price]);

    // Audit log
    execute(`
      INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, new_value)
      VALUES ('client', 'PROMOTION_ORDER_CREATED', 'promotion_orders', ?, ?)
    `, [orderId, JSON.stringify({ promotionType, packageId, price, customerEmail })]);

    return { orderId, status: 'pending', price, currency: 'USDT' };
  });
}

module.exports = {
  getActivePromotedTokens,
  getCurrentAdBoard,
  getActiveBanners,
  createPromotionOrder
};
