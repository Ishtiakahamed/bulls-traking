const { query, queryOne, execute } = require('../../database/db');
const { validateHttpsUrl, validateTextLength } = require('../utils/validators');
const { getRotationSlot } = require('../utils/rotationScheduler');
const { appendRecord, saveOrderTelegramReference } = require('./telegramPrimaryStore');

/**
 * Get active approved banners for each placement slot with deterministic UTC rotation
 * Fallback to an elegant placeholder if no sponsor is currently active
 */
function getActiveBanners(nowUtc = new Date()) {
  const sql = `
    SELECT bo.*, t.name AS token_name, t.symbol AS token_symbol, t.logo_url AS token_logo
    FROM banner_orders bo
    LEFT JOIN tokens t ON bo.token_id = t.id
    WHERE bo.approval_status = 'approved'
      AND bo.payment_status IN ('paid', 'completed')
      AND bo.start_at IS NOT NULL
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
      const img = found.banner_image || found.banner_url || null;
      const target = found.target_url || '#/promote';
      return {
        ...found,
        orderId: found.id,
        imageUrl: img,
        banner_url: img,
        banner_image: img,
        targetUrl: target,
        target_url: target,
        startAt: found.start_at,
        endAt: found.end_at,
        activatedAt: found.start_at || found.created_at,
        is_placeholder: false,
        isActive: true
      };
    }
    // High-converting placeholder slot
    return {
      id: null,
      orderId: null,
      title: defaultTitle,
      imageUrl: null,
      banner_url: null,
      banner_image: null,
      targetUrl: '#/promote',
      target_url: '#/promote',
      placement,
      price: defaultPrice,
      is_placeholder: true,
      isActive: false,
      cta_text: defaultCta
    };
  };

  const slot1 = findSlot('top_banner_1', '🚀 Meme Launchpad / DEX Spot', 'Book Slot 1 ($149/7D) →', 149);
  const slot2 = findSlot('top_banner_2', '🔥 Center Prime Presale Spotlight', 'Book Slot 2 ($199/7D) →', 199);
  const slot3 = findSlot('top_banner_3', '⚡ Alpha Calls & Live Signals', 'Book Slot 3 ($149/7D) →', 149);
  const homeBanner = findSlot('homepage_banner', '⚡ Verified Token Promotion — 1-Click DEX Volume', 'Book In-Feed Banner ($299/7D) →', 299);
  const radarBanner = findSlot('radar_banner', '📡 New Pairs Radar Sponsorship', 'Book Radar Banner ($149/7D) →', 149);

  // Filter paid & approved top banners for deterministic 24h rotation
  const activeTopBanners = activeList.filter(b => 
    ['top_banner_1', 'top_banner_2', 'top_banner_3', 'top_banner'].includes(b.placement)
  );

  // Deterministic sort: priority DESC, id ASC
  activeTopBanners.sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.id - b.id);

  const rotationItems = activeTopBanners.length > 0
    ? activeTopBanners.map((b, idx) => ({
        ...b,
        orderId: b.id,
        imageUrl: b.banner_image || b.banner_url,
        banner_url: b.banner_image || b.banner_url,
        banner_image: b.banner_image || b.banner_url,
        targetUrl: b.target_url,
        target_url: b.target_url,
        startAt: b.start_at,
        endAt: b.end_at,
        scheduleIndex: idx,
        is_placeholder: false,
        isActive: true
      }))
    : [slot1];

  const rotation = getRotationSlot({
    items: rotationItems,
    nowUtc,
    cycleHours: 24,
    minSlotMinutes: 0
  });

  const activeMobileBanner = rotation.activeItem || slot1;

  return {
    desktop: [slot1, slot2, slot3],
    mobile: activeMobileBanner,
    rotation: {
      timezone: 'UTC',
      cycleHours: 24,
      activeSlotIndex: rotation.activeSlotIndex,
      slotStart: rotation.slotStart,
      slotEnd: rotation.slotEnd,
      slotDurationHours: rotation.slotDurationHours,
      totalActiveCount: activeTopBanners.length
    },
    top_banners: [slot1, slot2, slot3],
    top_banner_1: slot1,
    top_banner_2: slot2,
    top_banner_3: slot3,
    top_banner: slot1,
    homepage_banner: slot2,
    presale_banner: slot3,
    in_feed_banner: homeBanner,
    radar_banner: radarBanner
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
 * Server-authoritative: package ID dictates duration and price.
 * Orders start in pending state (start_at and end_at are NULL) until admin activation.
 */
async function createBannerOrder(data) {
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
    packageId,
    package_id,
    packageKey,
    package_key,
    ctaText,
    cta_text,
    description,
    desc
  } = data || {};

  const rawBannerImage = bannerImage || banner_image || bannerUrl || banner_url;
  const rawTargetUrl = targetUrl || target_url;

  if (!rawBannerImage || !rawTargetUrl) {
    throw new Error('Both bannerImage and targetUrl are required.');
  }

  // Validate URLs & text inputs
  const safeTargetUrl = validateHttpsUrl(rawTargetUrl, { allowInternal: true });
  const safeTitle = validateTextLength(title, 120, 'Title') || 'Banner Advertisement';
  const safeCta = validateTextLength(ctaText || cta_text, 50, 'CTA Text') || 'Learn More →';
  const safeDesc = validateTextLength(description || desc, 500, 'Description') || '';

  // Server-authoritative package resolution
  const packages = getBannerPackages();
  const requestedPkgId = packageId || package_id || packageKey || package_key;
  let pkg = packages.find(p => p.id === requestedPkgId);
  if (!pkg) {
    pkg = packages.find(p => p.placement === placement) || packages.find(p => p.id === 'banner_slot_2');
  }

  const finalPlacement = pkg.placement;
  const finalDurationDays = pkg.durationDays;
  const finalPrice = pkg.price;

  const insertSql = `
    INSERT INTO banner_orders (
      token_id, title, banner_image, target_url, placement, duration,
      start_at, end_at, price, payment_status, approval_status,
      cta_text, description
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      NULL, NULL, ?, 'pending', 'pending',
      ?, ?
    )
  `;

  const result = execute(insertSql, [
    tokenId || null,
    safeTitle,
    rawBannerImage,
    safeTargetUrl,
    finalPlacement,
    finalDurationDays,
    finalPrice,
    safeCta,
    safeDesc
  ]);

  const orderId = Number(result.lastInsertRowid);
  const telegramRecord = await appendRecord('banner_order', {
    orderId,
    status: 'pending',
    paymentStatus: 'pending',
    title: safeTitle,
    targetUrl: safeTargetUrl,
    placement: finalPlacement,
    durationDays: finalDurationDays,
    price: finalPrice,
    ctaText: safeCta,
    description: safeDesc
  });
  if (telegramRecord.configured) {
    saveOrderTelegramReference('banner_orders', orderId, telegramRecord);
    execute(`INSERT OR IGNORE INTO telegram_primary_records
      (record_kind, entity_id, telegram_chat_id, telegram_message_id, record_hash, payload_json, status)
      VALUES (?, ?, ?, ?, ?, ?, 'sent')`, [
      'banner_order', orderId, telegramRecord.chatId, telegramRecord.messageId,
      telegramRecord.recordHash, JSON.stringify({ orderId, type: 'banner_order', status: 'pending' })
    ]);
  }

  return {
    id: orderId,
    title: safeTitle,
    placement: finalPlacement,
    durationDays: finalDurationDays,
    duration: finalDurationDays,
    price: finalPrice,
    payment_status: 'pending',
    approval_status: 'pending',
    status: 'pending',
    telegramRecord
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

/**
 * Admin action: activate a banner order upon verified payment clearance
 * Idempotent: activating an already active order preserves duration without resetting dates.
 */
function activateBannerOrder(orderId, adminId = 'admin', note = '', ipAddress = '127.0.0.1') {
  const numId = parseInt(orderId, 10);
  if (isNaN(numId) || numId <= 0) {
    throw new Error('Invalid banner order ID');
  }

  const existing = queryOne('SELECT * FROM banner_orders WHERE id = ?', [numId]);
  if (!existing) {
    throw new Error(`Banner order #${numId} not found`);
  }

  // Idempotency: if already paid and approved, return current active order without modifying duration or resetting timestamps
  if (existing.approval_status === 'approved' && (existing.payment_status === 'paid' || existing.payment_status === 'completed') && existing.start_at) {
    return {
      success: true,
      alreadyActive: true,
      order: existing
    };
  }

  const durationDays = existing.duration || 7;
  const startAt = new Date().toISOString();
  const endAt = new Date(Date.now() + durationDays * 86400000).toISOString();

  execute(`
    UPDATE banner_orders
    SET approval_status = 'approved',
        payment_status = 'paid',
        start_at = ?,
        end_at = ?
    WHERE id = ?
  `, [startAt, endAt, numId]);

  try {
    execute(`
      INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, old_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId,
      'ACTIVATE_BANNER_ORDER',
      'banner_order',
      numId,
      JSON.stringify({ approval_status: existing.approval_status, payment_status: existing.payment_status }),
      JSON.stringify({ approval_status: 'approved', payment_status: 'paid', note, start_at: startAt, end_at: endAt }),
      ipAddress
    ]);
  } catch (logErr) {
    console.warn('[BannerService] Admin log notice:', logErr.message);
  }

  const updated = queryOne('SELECT * FROM banner_orders WHERE id = ?', [numId]);
  return {
    success: true,
    alreadyActive: false,
    order: updated
  };
}

module.exports = {
  getActiveBanners,
  getActiveSpotlight,
  recordBannerClick,
  recordBannerImpression,
  createBannerOrder,
  getBannerPackages,
  getAllBannersAdmin,
  updateBannerApproval,
  activateBannerOrder
};
