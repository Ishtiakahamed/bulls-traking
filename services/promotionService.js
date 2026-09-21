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

  const formatBanner = (b) => {
    if (!b) return null;
    const img = b.banner_image || b.banner_url || null;
    return {
      id: b.id,
      token_id: b.token_id,
      title: b.title,
      banner_url: img,
      banner_image: img,
      target_url: b.target_url,
      placement: b.placement,
      duration: b.duration,
      start_at: b.start_at,
      end_at: b.end_at,
      price: b.price,
      click_count: b.click_count || 0,
      impression_count: b.impression_count || 0,
      token_name: b.token_name || null,
      token_symbol: b.token_symbol || null
    };
  };

  const top1 = banners.find(b => b.placement === 'top_banner_1' || b.placement === 'top_banner') || null;
  const top2 = banners.find(b => b.placement === 'top_banner_2' || b.placement === 'homepage_banner') || null;
  const top3 = banners.find(b => b.placement === 'top_banner_3' || b.placement === 'presale_banner') || null;

  return {
    top_banner: formatBanner(top1),
    homepage_banner: formatBanner(top2),
    presale_banner: formatBanner(top3)
  };
}

/**
 * Record a click on a banner ad
 */
function recordBannerClick(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId <= 0) return false;
  try {
    const banner = queryOne('SELECT id FROM banner_orders WHERE id = ?', [numId]);
    if (!banner) return false;
    execute('UPDATE banner_orders SET click_count = COALESCE(click_count, 0) + 1 WHERE id = ?', [numId]);
    return true;
  } catch (err) {
    console.warn('[PromotionService] Click tracking notice:', err.message);
    return false;
  }
}

/**
 * Record an impression on a banner ad
 */
function recordBannerImpression(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId) || numId <= 0) return false;
  try {
    const banner = queryOne('SELECT id FROM banner_orders WHERE id = ?', [numId]);
    if (!banner) return false;
    execute('UPDATE banner_orders SET impression_count = COALESCE(impression_count, 0) + 1 WHERE id = ?', [numId]);
    return true;
  } catch (err) {
    console.warn('[PromotionService] Impression tracking notice:', err.message);
    return false;
  }
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
  createPromotionOrder,
  recordBannerClick,
  recordBannerImpression
};
