const express = require('express');
const router = express.Router();
const {
  getActiveBanners,
  getActiveSpotlight,
  recordBannerClick,
  recordBannerImpression,
  createBannerOrder,
  getBannerPackages,
  getAllBannersAdmin,
  updateBannerApproval,
  activateBannerOrder
} = require('../services/bannerService');

// Public: Get currently active banner slots (supports both /banners/active and /promotion/banners/active)
router.get(['/banners/active', '/promotion/banners/active'], (req, res) => {
  try {
    const banners = getActiveBanners();
    res.json({ success: true, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get currently active Token Spotlight order (returns null if no active paid order)
router.get(['/spotlight/active', '/promotion/spotlight/active', '/banners/spotlight/active'], (req, res) => {
  try {
    const spotlight = getActiveSpotlight();
    res.json({ success: true, data: spotlight });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get banner ad packages & pricing
router.get(['/banners/packages', '/promotion/banners/packages'], (req, res) => {
  try {
    const packages = getBannerPackages();
    res.json({ success: true, data: packages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const { strictLimiter } = require('../middleware/rateLimiters');

// Public: 8-minute ad board rotation endpoint
router.get(['/adboard/current', '/promotion/adboard/current'], (req, res) => {
  res.json({
    success: true,
    data: {
      currentAd: {
        id: 1,
        title: 'Minotaur Bull Presale',
        tagline: '$1 Today, $100 Tomorrow — Wake Up Rich',
        cta_text: 'Join Presale',
        cta_url: 'https://minotaurbull.io'
      },
      remainingSeconds: 240,
      slotDurationMinutes: 8,
      totalSlots: 1
    }
  });
});

// Public: Track banner ad click (supports both :id/click and click/:id)
router.post(['/banners/click/:id', '/banners/:id/click', '/promotion/banners/click/:id', '/promotion/banners/:id/click'], strictLimiter, (req, res) => {
  try {
    const recorded = recordBannerClick(req.params.id);
    res.json({ success: true, recorded });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Track banner ad impression
router.post(['/banners/impression/:id', '/banners/:id/impression', '/promotion/banners/impression/:id', '/promotion/banners/:id/impression'], (req, res) => {
  try {
    const recorded = recordBannerImpression(req.params.id);
    res.json({ success: true, recorded });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Create banner advertisement order
router.post(['/banners/order', '/promotion/banners/order'], strictLimiter, (req, res) => {
  try {
    const result = createBannerOrder(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const { requireAdminAuth } = require('../middleware/adminAuth');
const { queryOne } = require('../../database/db');

// Public: Check banner order status
router.get(['/banners/order/:id', '/banners/order/:id/status', '/promotion/banners/order/:id'], (req, res) => {
  try {
    const numId = parseInt(req.params.id, 10);
    if (isNaN(numId) || numId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid banner order ID' });
    }
    const order = queryOne(`
      SELECT id, token_id, title, placement, duration, price, payment_status, approval_status, start_at, end_at, created_at
      FROM banner_orders WHERE id = ?
    `, [numId]);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Banner order not found' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Retrieve all banner orders with analytics (strictly protected)
router.get('/admin/banners', requireAdminAuth, (req, res) => {
  try {
    const banners = getAllBannersAdmin();
    res.json({ success: true, count: banners.length, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update banner approval status (strictly protected)
router.post('/admin/banners/:id/status', requireAdminAuth, (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    const updated = updateBannerApproval(req.params.id, status);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Activate banner order upon verified payment clearance (strictly protected)
router.post('/admin/banners/:id/activate', requireAdminAuth, (req, res) => {
  try {
    const adminId = req.headers['x-admin-id'] || 'admin';
    const note = req.body?.note || 'Manual Telegram settlement verified';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const result = activateBannerOrder(req.params.id, adminId, note, ipAddress);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
