const { query, queryOne, execute, transaction } = require('../../database/db');
const { generateAutoTradeLinks } = require('../utils/tradeLinks');
const { PROMOTION_PACKAGES, getTreasuryAddresses, createGatewayInvoice } = require('./cryptoPaymentService');
const { validateHttpsUrl, validateContractAddress, validateTextLength } = require('../utils/validators');
const { getRotationSlot } = require('../utils/rotationScheduler');
const { appendRecord, saveOrderTelegramReference } = require('./telegramPrimaryStore');

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
      p.start_at,
      p.end_at,
      p.created_at,
      p.auto_trading_url,
      COALESCE(p.reddit_url, t.reddit_url) AS reddit_url,
      t.id AS token_id,
      t.name,
      t.symbol,
      t.chain,
      t.contract_address,
      t.logo_url,
      t.price,
      t.change_24h,
      t.market_cap,
      t.volume_24h,
      t.website_url,
      t.x_url,
      t.telegram_url
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
 * Deterministic UTC Promoted Token equal-share rotation service
 * Nominal share = 24 / N hours. Minimum slot duration = minSlotMinutes (default 30).
 */
function getActivePromotedTokens(options = {}) {
  const {
    nowUtc = new Date(),
    cycleHours = 24,
    minSlotMinutes = 30
  } = options;

  const rawPromotions = getActivePromotions();
  // Deterministic sorting: priority DESC, start_at ASC, id ASC
  const sortedTokens = rawPromotions.slice().sort((a, b) => {
    if ((b.priority || 0) !== (a.priority || 0)) {
      return (b.priority || 0) - (a.priority || 0);
    }
    const aTime = new Date(a.start_at || a.created_at || 0).getTime();
    const bTime = new Date(b.start_at || b.created_at || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return (a.promotion_id || a.token_id || 0) - (b.promotion_id || b.token_id || 0);
  });

  const rotation = getRotationSlot({
    items: sortedTokens,
    nowUtc,
    cycleHours,
    minSlotMinutes
  });

  const activeMobileToken = rotation.activeItem ? {
    token: rotation.activeItem,
    visibleFrom: rotation.slotStart,
    visibleUntil: rotation.slotEnd,
    slotDurationMinutes: rotation.slotDurationMinutes
  } : null;

  const desktopTokens = sortedTokens.map((t, idx) => ({
    ...t,
    scheduleIndex: idx,
    visibleFrom: rotation.slotStart,
    visibleUntil: rotation.slotEnd
  }));

  return {
    promotions: sortedTokens,
    mobile: activeMobileToken,
    desktop: desktopTokens,
    rotation: {
      timezone: 'UTC',
      cycleHours,
      activeCount: sortedTokens.length,
      activeSlotIndex: rotation.activeSlotIndex,
      slotDurationMinutes: rotation.slotDurationMinutes,
      slotDurationHours: rotation.slotDurationHours,
      slotStart: rotation.slotStart,
      slotEnd: rotation.slotEnd
    }
  };
}
async function createPromotionOrder(data) {
  const {
    tokenId,
    customerName = 'Partner Developer',
    customerEmail = '',
    telegramUsername = '',
    promotionType = 'PROMOTED_TOKEN',
    packageKey = '7D',
    packageName,
    durationDays,
    price,
    chain = 'bsc',
    contractAddress = '',
    tokenName = '',
    tokenSymbol = '',
    logoUrl = '',
    websiteUrl = '',
    xUrl = '',
    telegramUrl = '',
    redditUrl = '',
    paymentMethod = 'direct_bsc'
  } = data;

  // Validate inputs
  const safeTokenName = validateTextLength(tokenName, 80, 'Token name');
  const safeTokenSymbol = validateTextLength(tokenSymbol, 20, 'Token symbol');
  const safeCustomerName = validateTextLength(customerName, 100, 'Customer name') || 'Partner Developer';
  const safeCustomerEmail = validateTextLength(customerEmail, 120, 'Customer email');
  const safeTelegramUsername = validateTextLength(telegramUsername, 60, 'Telegram username');

  if (contractAddress) {
    validateContractAddress(contractAddress, chain);
  }

  const safeWebsiteUrl = websiteUrl ? validateHttpsUrl(websiteUrl, { allowInternal: false }) : '';
  const safeXUrl = xUrl ? validateHttpsUrl(xUrl, { allowInternal: false }) : '';
  const safeTelegramUrl = telegramUrl ? validateHttpsUrl(telegramUrl, { allowInternal: false }) : '';
  const safeRedditUrl = redditUrl ? validateHttpsUrl(redditUrl, { allowInternal: false }) : '';

  // Server-authoritative Package & Pricing resolution (client cannot override price/duration)
  const cleanKey = (packageKey || '7D').toUpperCase();
  const pkgConfig = PROMOTION_PACKAGES[cleanKey] || PROMOTION_PACKAGES['7D'];
  const finalPackageName = pkgConfig.name;
  const finalDurationDays = pkgConfig.days;
  const finalPrice = pkgConfig.price;

  // Generate automated DEX trading URL
  const tradeLinkObj = generateAutoTradeLinks(chain, contractAddress);
  const autoTradingUrl = tradeLinkObj ? tradeLinkObj.primarySwapUrl : null;

  const res = execute(`
    INSERT INTO promotion_orders (
      token_id, customer_name, customer_email, telegram_username,
      promotion_type, package_name, duration_days, price, currency,
      start_at, end_at, payment_status, order_status,
      chain, contract_address, token_name, token_symbol,
      logo_url, website_url, x_url, telegram_url, reddit_url,
      payment_method, auto_trading_url,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, 'USDT',
      NULL, NULL, 'pending', 'pending',
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `, [
    tokenId || null, safeCustomerName, safeCustomerEmail, safeTelegramUsername,
    promotionType, finalPackageName, finalDurationDays, finalPrice,
    chain, contractAddress, safeTokenName, safeTokenSymbol,
    logoUrl, safeWebsiteUrl, safeXUrl, safeTelegramUrl, safeRedditUrl,
    paymentMethod, autoTradingUrl
  ]);

  const orderId = Number(res.lastInsertRowid);
  const treasuryAddresses = getTreasuryAddresses();

  const telegramRecord = await appendRecord('promotion_order', {
    orderId,
    status: 'pending',
    paymentStatus: 'pending',
    customerName: safeCustomerName,
    customerEmail: safeCustomerEmail,
    telegramUsername: safeTelegramUsername,
    promotionType,
    packageName: finalPackageName,
    durationDays: finalDurationDays,
    price: finalPrice,
    currency: 'USDT',
    chain,
    contractAddress,
    tokenName: safeTokenName,
    tokenSymbol: safeTokenSymbol,
    paymentMethod: 'telegram_manual'
  });
  if (telegramRecord.configured) {
    saveOrderTelegramReference('promotion_orders', orderId, telegramRecord);
    execute(`INSERT OR IGNORE INTO telegram_primary_records
      (record_kind, entity_id, telegram_chat_id, telegram_message_id, record_hash, payload_json, status)
      VALUES (?, ?, ?, ?, ?, ?, 'sent')`, [
      'promotion_order', orderId, telegramRecord.chatId, telegramRecord.messageId,
      telegramRecord.recordHash, JSON.stringify({ orderId, type: 'promotion_order', status: 'pending' })
    ]);
  }

  // If payment method is gateway, generate gateway invoice
  let gatewayData = null;
  if (paymentMethod === 'gateway_nowpayments') {
    gatewayData = await createGatewayInvoice({
      orderId,
      priceUsd: finalPrice,
      tokenName: tokenName || finalPackageName
    });
  }

  return {
    orderId,
    packageName: finalPackageName,
    durationDays: finalDurationDays,
    price: finalPrice,
    currency: 'USDT',
    chain,
    contractAddress,
    autoTradingUrl,
    treasuryAddresses,
    status: 'pending',
    paymentMethod: 'telegram_manual',
    telegramRecord,
    gatewayData,
    message: 'Promotion order created successfully. Awaiting payment confirmation.'
  };
}

/**
 * Activate a promotion order upon verified payment (On-chain RPC or Webhook)
 */
function activatePromotionFromOrder(orderId, txHash = null, { adminId = 'admin', note = '', ipAddress = '127.0.0.1' } = {}) {
  const order = queryOne('SELECT * FROM promotion_orders WHERE id = ?', [orderId]);
  if (!order) {
    throw new Error(`Promotion order #${orderId} not found.`);
  }

  if (order.payment_status === 'paid' && order.order_status === 'active' && order.token_id) {
    const existingPromo = queryOne(
      "SELECT id FROM promotions WHERE token_id = ? AND is_active = 1 AND datetime(end_at) >= datetime('now') LIMIT 1",
      [order.token_id]
    );
    if (existingPromo) {
      return { success: true, alreadyActive: true, orderId: order.id, status: 'already_active' };
    }
  }

  let finalTokenId = order.token_id;

  transaction(() => {
    // 1. If tokenId is null, find or create the token in tokens table
    if (!finalTokenId && order.contract_address) {
      const existingTok = queryOne(
        'SELECT id FROM tokens WHERE chain = ? AND LOWER(contract_address) = LOWER(?) LIMIT 1',
        [order.chain, order.contract_address]
      );
      if (existingTok) {
        finalTokenId = existingTok.id;
      }
    }

    if (!finalTokenId && order.token_name) {
      const existingByName = queryOne(
        'SELECT id FROM tokens WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) LIMIT 1',
        [order.token_name]
      );
      if (existingByName) {
        finalTokenId = existingByName.id;
      }
    }

    if (finalTokenId) {
      // Update existing token with promotional socials & promoted flag
      execute(`
        UPDATE tokens SET
          logo_url = COALESCE(?, logo_url),
          website_url = COALESCE(?, website_url),
          x_url = COALESCE(?, x_url),
          telegram_url = COALESCE(?, telegram_url),
          reddit_url = COALESCE(?, reddit_url),
          is_promoted = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        order.logo_url || null,
        order.website_url || null,
        order.x_url || null,
        order.telegram_url || null,
        order.reddit_url || null,
        finalTokenId
      ]);
    } else {
      // Insert new promoted token into tokens table
      const tradeObj = generateAutoTradeLinks(order.chain, order.contract_address);
      const resTok = execute(`
        INSERT INTO tokens (
          chain, contract_address, name, symbol, logo_url,
          website_url, x_url, telegram_url, reddit_url,
          price, market_cap, volume_24h,
          is_promoted, is_submitted, is_active, listing_status,
          first_seen_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          0.0001, 100000, 5000,
          1, 1, 1, 'LIVE',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        order.chain || 'bsc',
        order.contract_address || ('0xpromo' + order.id),
        order.token_name || 'Promoted Token',
        order.token_symbol || 'PROMO',
        order.logo_url || null,
        order.website_url || (tradeObj ? tradeObj.primarySwapUrl : null),
        order.x_url || null,
        order.telegram_url || null,
        order.reddit_url || null
      ]);
      finalTokenId = Number(resTok.lastInsertRowid);
    }

    // 2. Insert into live promotions table
    const startAt = new Date().toISOString();
    const endAt = new Date(Date.now() + (order.duration_days || 7) * 86400000).toISOString();
    const priority = order.duration_days >= 30 ? 100 : order.duration_days >= 7 ? 50 : 20;

    execute(`
      INSERT INTO promotions (
        token_id, promotion_type, package_name, start_at, end_at,
        priority, is_active, auto_trading_url, reddit_url, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, 1, ?, ?, CURRENT_TIMESTAMP
      )
    `, [
      finalTokenId,
      order.promotion_type || 'PROMOTED_TOKEN',
      order.package_name || 'Spotlight 7D',
      startAt,
      endAt,
      priority,
      order.auto_trading_url || null,
      order.reddit_url || null
    ]);

    const safeTxHash = txHash
      ? (txHash.startsWith('MANUAL_') && !txHash.includes(String(order.id)) ? `${txHash}_${order.id}` : txHash)
      : null;

    // 3. Mark promotion order as paid & active
    execute(`
      UPDATE promotion_orders SET
        token_id = ?,
        payment_status = 'paid',
        order_status = 'active',
        tx_hash = COALESCE(?, tx_hash),
        start_at = ?,
        end_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      finalTokenId,
      safeTxHash,
      startAt,
      endAt,
      order.id
    ]);

    try {
      execute(`
        INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, old_value, new_value, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        adminId || 'admin',
        'ACTIVATE_PROMOTION_ORDER',
        'promotion_order',
        order.id,
        JSON.stringify({ payment_status: order.payment_status, order_status: order.order_status }),
        JSON.stringify({ payment_status: 'paid', order_status: 'active', tx_hash: safeTxHash, note }),
        ipAddress || '127.0.0.1'
      ]);
    } catch (logErr) {
      console.warn('[PromotionService] Admin log notice:', logErr.message);
    }
  });

  return {
    success: true,
    alreadyActive: false,
    orderId: order.id,
    tokenId: finalTokenId,
    status: 'active',
    message: `Promotion order #${order.id} is now LIVE on Bulls Traking!`
  };
}

function getOrderById(orderId) {
  return queryOne('SELECT * FROM promotion_orders WHERE id = ?', [orderId]);
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
    console.warn('[PromotionService] Active spotlight promo_orders query notice:', err.message);
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
    console.warn('[PromotionService] Active spotlight banner_orders query notice:', err.message);
  }

  return null;
}

module.exports = {
  getActivePromotions,
  getActivePromotedTokens,
  createPromotionOrder,
  activatePromotionFromOrder,
  getOrderById,
  getActiveSpotlight
};
