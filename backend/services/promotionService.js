const { query, queryOne, execute, transaction } = require('../../database/db');
const { generateAutoTradeLinks } = require('../utils/tradeLinks');
const { PROMOTION_PACKAGES, getTreasuryAddresses, createGatewayInvoice } = require('./cryptoPaymentService');

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
 * Create a new promotion order (Section 40)
 */
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

  // Resolve Package & Pricing
  const pkgConfig = PROMOTION_PACKAGES[packageKey] || PROMOTION_PACKAGES['7D'];
  const finalPackageName = packageName || pkgConfig.name;
  const finalDurationDays = durationDays || pkgConfig.days;
  const finalPrice = price != null ? Number(price) : pkgConfig.price;

  // Generate automated DEX trading URL
  const tradeLinkObj = generateAutoTradeLinks(chain, contractAddress);
  const autoTradingUrl = tradeLinkObj ? tradeLinkObj.primarySwapUrl : null;

  const startAt = new Date().toISOString();
  const endAt = new Date(Date.now() + finalDurationDays * 86400000).toISOString();

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
      ?, ?, 'pending', 'pending',
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `, [
    tokenId || null, customerName, customerEmail, telegramUsername,
    promotionType, finalPackageName, finalDurationDays, finalPrice,
    startAt, endAt,
    chain, contractAddress, tokenName, tokenSymbol,
    logoUrl, websiteUrl, xUrl, telegramUrl, redditUrl,
    paymentMethod, autoTradingUrl
  ]);

  const orderId = Number(res.lastInsertRowid);
  const treasuryAddresses = getTreasuryAddresses();

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
    paymentMethod,
    gatewayData,
    message: 'Promotion order created successfully. Awaiting payment confirmation.'
  };
}

/**
 * Activate a promotion order upon verified payment (On-chain RPC or Webhook)
 */
function activatePromotionFromOrder(orderId, txHash = null) {
  const order = queryOne('SELECT * FROM promotion_orders WHERE id = ?', [orderId]);
  if (!order) {
    throw new Error(`Promotion order #${orderId} not found.`);
  }

  if (order.payment_status === 'paid' && order.order_status === 'active') {
    return { success: true, orderId: order.id, status: 'already_active' };
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
      txHash || null,
      startAt,
      endAt,
      order.id
    ]);
  });

  return {
    success: true,
    orderId: order.id,
    tokenId: finalTokenId,
    status: 'active',
    message: `Promotion order #${order.id} is now LIVE on Bulls Traking!`
  };
}

function getOrderById(orderId) {
  return queryOne('SELECT * FROM promotion_orders WHERE id = ?', [orderId]);
}

module.exports = {
  getActivePromotions,
  createPromotionOrder,
  activatePromotionFromOrder,
  getOrderById
};
