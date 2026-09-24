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
  updateBannerApproval
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

// Admin: Retrieve all banner orders with analytics
router.get('/admin/banners', (req, res) => {
  try {
    const banners = getAllBannersAdmin();
    res.json({ success: true, count: banners.length, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update banner approval status
router.post('/admin/banners/:id/status', (req, res) => {
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

module.exports = router;
