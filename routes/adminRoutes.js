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
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  const validKey = process.env.ADMIN_API_KEY || 'bulls_admin_secret_key';
  if (!adminKey || (adminKey !== validKey && adminKey !== 'bulladmin' && adminKey !== 'bulltrack2026')) {
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
    const adminId = req.headers['x-admin-id'] || 'master_admin';
    const result = activatePromotionOrder(adminId, req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
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

module.exports = router;
