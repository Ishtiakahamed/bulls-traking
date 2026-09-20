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

  const slot1 = findSlot('top_banner_1', '🚀 Meme Launchpad / DEX Spot', 'Book Slot 1 ($149/7D) →', 149);
  const slot2 = findSlot('top_banner_2', '🔥 Center Prime Presale Spotlight', 'Book Slot 2 ($199/7D) →', 199);
  const slot3 = findSlot('top_banner_3', '⚡ Alpha Calls & Live Signals', 'Book Slot 3 ($149/7D) →', 149);
  const homeBanner = findSlot('homepage_banner', '⚡ Verified Token Promotion — 1-Click DEX Volume', 'Book In-Feed Banner ($299/7D) →', 299);

  return {
    top_banners: [slot1, slot2, slot3],
    top_banner_1: slot1,
    top_banner_2: slot2,
    top_banner_3: slot3,
    top_banner: slot2, // backward compatibility
    homepage_banner: homeBanner,
    radar_banner: findSlot('radar_banner', '📡 New Pairs Radar Sponsorship', 'Book Radar Banner ($149/7D) →', 149)
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
    placement = 'top_banner_2',
    durationDays = 7,
    price = 199.00
  } = data || {};

  if (!bannerImage || !targetUrl) {
    throw new Error('Both bannerImage and targetUrl are required');
  }

  const validPlacements = ['top_banner_1', 'top_banner_2', 'top_banner_3', 'top_banner', 'homepage_banner', 'radar_banner'];
  const safePlacement = validPlacements.includes(placement) ? placement : 'top_banner_2';

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
      id: 'banner_slot_1',
      name: 'Top Leaderboard Slot 1 (Left)',
      placement: 'top_banner_1',
      dimensions: '420x140 (3:1 Aspect) / Mobile Fluid',
      price: 149,
      durationDays: 7,
      description: 'Prime left-wing banner in the high-visibility top 3-slot grid.'
    },
    {
      id: 'banner_slot_2',
      name: 'Top Leaderboard Slot 2 (Center Prime)',
      placement: 'top_banner_2',
      dimensions: '420x140 (3:1 Aspect) / Mobile Fluid',
      price: 199,
      durationDays: 7,
      description: 'Absolute center eye-level dominance in the top 3-slot grid.'
    },
    {
      id: 'banner_slot_3',
      name: 'Top Leaderboard Slot 3 (Right)',
      placement: 'top_banner_3',
      dimensions: '420x140 (3:1 Aspect) / Mobile Fluid',
      price: 149,
      durationDays: 7,
      description: 'Right-wing banner directly above Promoted Tokens table.'
    },
    {
      id: 'banner_bundle_30d',
      name: 'Monthly Leaderboard VIP (30 Days)',
      placement: 'top_banner_2',
      dimensions: '420x140 / 3:1 Aspect',
      price: 499,
      durationDays: 30,
      description: 'Full month center prime banner domination with unlimited clicks.'
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
