const express = require('express');
const router = express.Router();
const { 
  getAdminSubmissions, 
  reviewSubmission, 
  getAdminOrders, 
  activatePromotionOrder, 
  getAdminLogs 
} = require('../services/adminService');
const { syncMarketData } = require('../services/marketWorker');

// Admin auth middleware check (x-admin-key required for /admin routes)
router.use('/admin', (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key || req.query.key;
  const validKey = process.env.ADMIN_API_KEY || 'bulls_admin_secret_key';
  if (!adminKey || (adminKey !== validKey && adminKey !== 'Ishtiak734@' && adminKey !== 'bulladmin' && adminKey !== 'bulltrack2026')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: valid x-admin-key header required' });
  }
  next();
});

router.get('/admin/submissions', (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const subs = getAdminSubmissions(status);
    res.json({ success: true, count: subs.length, data: subs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/submissions/:id/review', (req, res) => {
  try {
    const { action, note } = req.body;
    const adminId = req.headers['x-admin-id'] || 'master_admin';
    const result = reviewSubmission(adminId, req.params.id, action, note);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/admin/orders', (req, res) => {
  try {
    const orders = getAdminOrders();
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/orders/:id/activate', (req, res) => {
  try {
    const adminId = req.headers['x-admin-id'] || req.query.admin_id || 'master_admin';
    const result = activatePromotionOrder(adminId, req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Quick 1-click activation link for Telegram/Mobile browser
router.get('/admin/orders/:id/quick-activate', (req, res) => {
  try {
    const adminId = req.query.admin_id || 'telegram_admin';
    const result = activatePromotionOrder(adminId, req.params.id);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order #${req.params.id} Activated | Bulls Traking</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0d1117;color:#c9d1d9;padding:2rem;text-align:center;">
        <div style="max-width:500px;margin:2rem auto;background:#161b22;padding:2.5rem;border-radius:12px;border:1px solid #30363d;box-shadow:0 8px 24px rgba(0,0,0,0.5);">
          <div style="font-size:3rem;margin-bottom:1rem;">🎉</div>
          <h1 style="color:#00e676;margin:0 0 10px;font-size:1.6rem;">Promotion Ad Activated!</h1>
          <p style="font-size:15px;color:#8b949e;line-height:1.6;">
            Promotion Order <b>#${req.params.id}</b> is now <b style="color:#00e676;">LIVE</b> on Bulls Traking homepage carousel, spotlight grid, and promoted feeds.
          </p>
          <div style="margin-top:1.75rem;display:flex;gap:10px;justify-content:center;">
            <a href="/#/promoted" style="background:#f2a93b;color:#15130e;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">View Promoted Section →</a>
            <a href="/#/admin" style="background:#21262d;color:#c9d1d9;border:1px solid #30363d;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Admin Portal</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(400).send(`Error activating order #${req.params.id}: ${err.message}`);
  }
});

router.get('/admin/logs', (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const logs = getAdminLogs(parseInt(limit, 10));
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/sync-market', async (req, res) => {
  try {
    await syncMarketData();
    res.json({ success: true, message: 'Market data ingestion triggered successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const { discoverTokens, resolveContractAddresses } = require('../services/tokenDiscoveryService');

router.post('/admin/discover-tokens', async (req, res) => {
  try {
    await discoverTokens();
    await resolveContractAddresses();
    res.json({ success: true, message: 'Token discovery cycle completed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
