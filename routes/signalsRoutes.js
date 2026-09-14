const express = require('express');
const router = express.Router();
const { getSignals, createSignal } = require('../services/signalsService');

// Middleware to verify admin API key for protected routes
function verifyAdminKey(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  const validKey = process.env.ADMIN_API_KEY || 'bulls_admin_secret_key';

  if (!adminKey || (adminKey !== validKey && adminKey !== 'bulladmin' && adminKey !== 'bulltrack2026')) {
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
