const {
  getActivePromotions,
  createPromotionOrder,
  activatePromotionFromOrder,
  getOrderById
} = require('../services/promotionService');
const {
  getPackages,
  getTreasuryAddresses,
  verifyTransactionOnChain
} = require('../services/cryptoPaymentService');

function handleGetPromotions(req, res, next) {
  try {
    const promotions = getActivePromotions();
    res.json({ success: true, count: promotions.length, data: promotions });
  } catch (err) {
    next(err);
  }
}

async function handleCreatePromotionOrder(req, res, next) {
  try {
    const result = await createPromotionOrder(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function handleGetPromotionOrder(req, res, next) {
  try {
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
}

function handleGetPackages(req, res, next) {
  try {
    res.json({
      success: true,
      packages: getPackages(),
      treasury: getTreasuryAddresses()
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Instant On-Chain Auto-Verification:
 * Receives orderId and txHash, verifies transaction on-chain in < 5 seconds,
 * and immediately activates the token promotion!
 */
async function handleVerifyTransaction(req, res, next) {
  try {
    const { orderId, txHash } = req.body;
    if (!orderId || !txHash) {
      return res.status(400).json({ success: false, error: 'Both orderId and txHash are required.' });
    }

    const order = getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: `Order #${orderId} not found.` });
    }

    if (order.payment_status === 'paid' && order.order_status === 'active') {
      return res.json({
        success: true,
        alreadyActive: true,
        message: 'This promotion is already active!',
        order
      });
    }

    // 1. Verify transaction on blockchain via JSON-RPC
    const verification = await verifyTransactionOnChain({
      txHash,
      expectedAmountUsd: order.price,
      chain: order.chain || 'bsc',
      orderCreatedAt: order.created_at
    });

    // 2. Automatically activate promotion
    const activation = activatePromotionFromOrder(order.id, txHash);

    res.json({
      success: true,
      verified: true,
      verification,
      activation,
      message: `Transaction verified successfully on-chain! Your promotion is now LIVE.`
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

const crypto = require('crypto');

/**
 * Turnkey Gateway Webhook (NOWPayments / Cryptomus IPN callback)
 * In this release, manual Telegram settlement is the primary operational payment workflow.
 * Direct webhook activation is deferred and strictly protected by provider signature.
 */
async function handleGatewayWebhook(req, res, next) {
  try {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const signature = req.headers['x-nowpayments-sig'] || req.headers['x-webhook-signature'];

    // Strict signature check: if secret or signature is missing, reject
    if (!webhookSecret || !signature) {
      return res.status(403).json({
        success: false,
        error: 'Automatic webhook activation is deferred. Manual Telegram settlement with admin approval is required.'
      });
    }

    // Verify HMAC-SHA512 signature
    const hmac = crypto.createHmac('sha512', webhookSecret);
    hmac.update(JSON.stringify(req.body));
    const expectedSig = hmac.digest('hex');

    if (signature !== expectedSig) {
      return res.status(401).json({ success: false, error: 'Invalid webhook signature.' });
    }

    const payload = req.body || {};
    const orderId = payload.order_id || payload.orderId;
    const paymentStatus = (payload.payment_status || payload.status || '').toLowerCase();
    const txHash = payload.payin_hash || payload.tx_hash || null;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Missing order_id' });
    }

    console.log(`[Promotion Webhook] Verified payment update for Order #${orderId}, status: ${paymentStatus}`);

    if (paymentStatus === 'confirmed' || paymentStatus === 'finished' || paymentStatus === 'sending' || paymentStatus === 'paid') {
      const order = getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: `Order #${orderId} not found` });
      }
      activatePromotionFromOrder(parseInt(orderId, 10), txHash);
      return res.json({ success: true, activated: true });
    }

    res.json({ success: true, status: paymentStatus });
  } catch (err) {
    console.warn('[Promotion Webhook Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleGetPromotions,
  handleCreatePromotionOrder,
  handleGetPromotionOrder,
  handleGetPackages,
  handleVerifyTransaction,
  handleGatewayWebhook
};
