const express = require('express');
const router = express.Router();
const { getSignals, createSignal } = require('../services/signalsService');

const crypto = require('crypto');

function verifyAdminSecret(providedKey) {
  const secret = process.env.ADMIN_API_KEY;
  if (!secret || !providedKey || typeof providedKey !== 'string') return false;
  const a = Buffer.from(providedKey);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Middleware to verify admin API key for protected routes
function verifyAdminKey(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;

  if (!verifyAdminSecret(adminKey)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: valid x-admin-key header required'
    });
  }
  next();
}

/**
 * Public: Get Telegram & alpha signals
 * Query: limit, page, direction ('buy' | 'sell' | 'watch')
 */
router.get('/signals', (req, res) => {
  try {
    const { direction, limit, page, is_active } = req.query;
    const result = getSignals({ direction, limit, page, isActive: is_active });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Protected (Admin / Telegram Ingest Worker): Post a new signal
 * Body: { token_id, title, message, direction, source }
 */
router.post('/signals', verifyAdminKey, (req, res) => {
  try {
    const { token_id, title, message, direction, source } = req.body;
    const signal = createSignal({ token_id, title, message, direction, source });
    res.status(201).json({ success: true, signal });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
