const { query, queryOne, execute } = require('../../database/db');

/**
 * Get active approved banners for each placement slot
 * Fallback to an elegant placeholder if no sponsor is currently active
 */
function getActiveBanners() {
  const sql = `
    SELECT bo.*, t.name AS token_name, t.symbol AS token_symbol, t.logo_url AS token_logo
    FROM banner_orders bo
    LEFT JOIN tokens t ON bo.token_id = t.id
    WHERE bo.approval_status = 'approved'
      AND datetime(bo.start_at) <= datetime('now')
      AND datetime(bo.end_at) >= datetime('now')
    ORDER BY bo.id DESC
  `;

  let activeList = [];
  try {
    activeList = query(sql);
  } catch (err) {
    console.warn('[BannerService] Active banner query notice:', err.message);
  }

  const findSlot = (placement, defaultTitle, defaultCta, defaultPrice) => {
    const found = activeList.find(b => b.placement === placement);
    if (found) {
      // Async increment impression counter
      try {
        execute('UPDATE banner_orders SET impression_count = impression_count + 1 WHERE id = ?', [found.id]);
      } catch (_) {}
      return {
        ...found,
        is_placeholder: false
      };
    }
    // High-converting placeholder slot
    return {
      id: null,
      title: defaultTitle,
      banner_image: null,
      target_url: '#/promote',
      placement,
      price: defaultPrice,
      is_placeholder: true,
      cta_text: defaultCta
    };
  };

  return {
    top_banner: findSlot('top_banner', '🚀 Spotlight Your Token — Reach 100K+ Active Multi-Chain Traders', 'Book Header Banner ($199/7D) →', 199),
    homepage_banner: findSlot('homepage_banner', '⚡ Verified Token Promotion — 1-Click DEX Volume & Direct Exposure', 'Book In-Feed Banner ($299/7D) →', 299),
    radar_banner: findSlot('radar_banner', '📡 New Pairs Radar Sponsorship — High Intent Fair Launch Traffic', 'Book Radar Banner ($149/7D) →', 149)
  };
}

/**
 * Record a click on a banner ad
 */
function recordBannerClick(id) {
  if (!id) return false;
  try {
    execute('UPDATE banner_orders SET click_count = click_count + 1 WHERE id = ?', [id]);
    return true;
  } catch (err) {
    console.warn('[BannerService] Click tracking error:', err.message);
    return false;
  }
}

/**
 * Create a new banner advertisement order
 */
function createBannerOrder(data) {
  const {
    tokenId = null,
    title = 'Banner Advertisement',
    bannerImage,
    targetUrl,
    placement = 'top_banner',
    durationDays = 7,
    price = 199.00
  } = data || {};

  if (!bannerImage || !targetUrl) {
    throw new Error('Both bannerImage and targetUrl are required');
  }

  const validPlacements = ['top_banner', 'homepage_banner', 'radar_banner'];
  const safePlacement = validPlacements.includes(placement) ? placement : 'top_banner';

  const insertSql = `
    INSERT INTO banner_orders (
      token_id, title, banner_image, target_url, placement, duration,
      start_at, end_at, price, payment_status, approval_status
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      datetime('now'),
      datetime('now', '+' || ? || ' days'),
      ?, 'completed', 'approved'
    )
  `;

  const result = execute(insertSql, [
    tokenId || null,
    title,
    bannerImage,
    targetUrl,
    safePlacement,
    durationDays,
    durationDays,
    price
  ]);

  return {
    id: result.lastInsertRowid,
    title,
    placement: safePlacement,
    durationDays,
    price,
    status: 'approved'
  };
}

/**
 * Get available banner packages for the promote page
 */
function getBannerPackages() {
  return [
    {
      id: 'banner_top_7d',
      name: 'Top Header Leaderboard (7 Days)',
      placement: 'top_banner',
      dimensions: '728x90 / Mobile Responsive',
      price: 199,
      durationDays: 7,
      description: 'Maximum prominence directly under the top ticker tape across every page.'
    },
    {
      id: 'banner_home_7d',
      name: 'Homepage In-Feed Spotlight (7 Days)',
      placement: 'homepage_banner',
      dimensions: '970x90 / Mobile Responsive',
      price: 299,
      durationDays: 7,
      description: 'High-converting eye-level banner placed right above Top Coins leaderboard.'
    },
    {
      id: 'banner_bundle_30d',
      name: 'Monthly Leaderboard VIP (30 Days)',
      placement: 'top_banner',
      dimensions: '728x90 Multi-Device',
      price: 599,
      durationDays: 30,
      description: 'Full month prime header domination with unlimited clicks and priority rendering.'
    }
  ];
}

/**
 * Admin view: retrieve all banner orders
 */
function getAllBannersAdmin() {
  try {
    return query(`
      SELECT bo.*, t.name AS token_name, t.symbol AS token_symbol
      FROM banner_orders bo
      LEFT JOIN tokens t ON bo.token_id = t.id
      ORDER BY bo.id DESC
    `);
  } catch (err) {
    return [];
  }
}

/**
 * Admin action: update approval status
 */
function updateBannerApproval(id, approvalStatus) {
  execute('UPDATE banner_orders SET approval_status = ? WHERE id = ?', [approvalStatus, id]);
  return queryOne('SELECT * FROM banner_orders WHERE id = ?', [id]);
}

module.exports = {
  getActiveBanners,
  recordBannerClick,
  createBannerOrder,
  getBannerPackages,
  getAllBannersAdmin,
  updateBannerApproval
};
