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
        execute('UPDATE banner_orders SET impression_count = COALESCE(impression_count, 0) + 1 WHERE id = ?', [found.id]);
      } catch (_) {}
      const img = found.banner_image || found.banner_url || null;
      return {
        ...found,
        banner_url: img,
        banner_image: img,
        is_placeholder: false
      };
    }
    // High-converting placeholder slot
    return {
      id: null,
      title: defaultTitle,
      banner_url: null,
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
    top_banner: slot1,
    homepage_banner: slot2,
    presale_banner: slot3,
    in_feed_banner: homeBanner,
    radar_banner: findSlot('radar_banner', '📡 New Pairs Radar Sponsorship', 'Book Radar Banner ($149/7D) →', 149)
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
    console.warn('[BannerService] Click tracking error:', err.message);
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
    console.warn('[BannerService] Impression tracking error:', err.message);
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
    banner_image,
    bannerUrl,
    banner_url,
    targetUrl,
    target_url,
    placement = 'top_banner_2',
    durationDays,
    duration,
    price = 199.00
  } = data || {};

  const finalBannerImage = bannerImage || banner_image || bannerUrl || banner_url;
  const finalTargetUrl = targetUrl || target_url;
  const finalDuration = durationDays || duration || 7;

  if (!finalBannerImage || !finalTargetUrl) {
    throw new Error('Both bannerImage and targetUrl are required');
  }

  const validPlacements = ['top_banner_1', 'top_banner_2', 'top_banner_3', 'top_banner', 'homepage_banner', 'presale_banner', 'radar_banner'];
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
    finalBannerImage,
    finalTargetUrl,
    safePlacement,
    finalDuration,
    finalDuration,
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

/**
 * Get active approved and paid Token Spotlight order
 * Returns the current active, paid, non-expired Token Spotlight order if one exists, or null.
 */
function getActiveSpotlight() {
  // 1. Check promotion_orders table for an active, paid spotlight order
  try {
    const promoSql = `
      SELECT 
        po.id,
        po.token_id,
        COALESCE(po.token_name, t.name, 'Sponsored Token') AS title,
        po.package_name,
        po.duration_days,
        COALESCE(po.logo_url, t.logo_url, 'assets/logo-transparent.png') AS banner_image,
        COALESCE(po.website_url, po.auto_trading_url, t.website_url, ('#/token/' || po.token_id)) AS target_url,
        po.price,
        po.start_at,
        po.end_at,
        po.payment_status,
        po.order_status
      FROM promotion_orders po
      LEFT JOIN tokens t ON po.token_id = t.id
      WHERE po.order_status = 'active'
        AND po.payment_status IN ('paid', 'completed')
        AND datetime(po.start_at) <= datetime('now')
        AND datetime(po.end_at) >= datetime('now')
        AND (
          po.package_name LIKE '%Spotlight%' 
          OR po.promotion_type LIKE '%SPOTLIGHT%' 
          OR po.promotion_type = 'TOKEN_SPOTLIGHT'
          OR po.package_name LIKE '%spotlight%'
        )
      ORDER BY po.id DESC
      LIMIT 1
    `;
    const activePromo = queryOne(promoSql);
    if (activePromo) {
      return {
        id: activePromo.id,
        token_id: activePromo.token_id,
        title: activePromo.title,
        description: 'Verified Token Spotlight Partner',
        banner_image: activePromo.banner_image,
        image_url: activePromo.banner_image,
        target_url: activePromo.target_url,
        cta_text: 'Learn More →',
        placement: 'homepage_banner',
        price: activePromo.price,
        is_placeholder: false,
        source: 'promotion_orders'
      };
    }
  } catch (err) {
    console.warn('[BannerService] Active spotlight promo_orders query notice:', err.message);
  }

  // 2. Check banner_orders table for an active paid spotlight / in-feed order
  try {
    const bannerSql = `
      SELECT bo.*, t.name AS token_name, t.symbol AS token_symbol, t.logo_url AS token_logo
      FROM banner_orders bo
      LEFT JOIN tokens t ON bo.token_id = t.id
      WHERE bo.placement IN ('homepage_banner', 'spotlight', 'token_spotlight')
        AND bo.approval_status = 'approved'
        AND bo.payment_status IN ('paid', 'completed')
        AND datetime(bo.start_at) <= datetime('now')
        AND datetime(bo.end_at) >= datetime('now')
      ORDER BY bo.id DESC
      LIMIT 1
    `;
    const activeBanner = queryOne(bannerSql);
    if (activeBanner) {
      const isDemo = activeBanner.target_url === '#/promote' || 
                     activeBanner.title?.startsWith('Promote Your Token') || 
                     activeBanner.title?.startsWith('Automated Test DEX');
      if (!isDemo) {
        const img = activeBanner.banner_image || activeBanner.banner_url || activeBanner.token_logo || 'assets/logo-transparent.png';
        return {
          id: activeBanner.id,
          token_id: activeBanner.token_id,
          title: activeBanner.title || activeBanner.token_name || 'Sponsored Partner',
          description: activeBanner.description || '',
          banner_image: img,
          image_url: img,
          target_url: activeBanner.target_url || '#/promote',
          cta_text: activeBanner.cta_text || 'Learn More →',
          placement: activeBanner.placement,
          price: activeBanner.price,
          is_placeholder: false,
          source: 'banner_orders'
        };
      }
    }
  } catch (err) {
    console.warn('[BannerService] Active spotlight banner_orders query notice:', err.message);
  }

  return null;
}

module.exports = {
  getActiveBanners,
  getActiveSpotlight,
  recordBannerClick,
  recordBannerImpression,
  createBannerOrder,
  getBannerPackages,
  getAllBannersAdmin,
  updateBannerApproval
};
