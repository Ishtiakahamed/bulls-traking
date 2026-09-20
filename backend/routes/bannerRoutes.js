const express = require('express');
const router = express.Router();
const {
  getActiveBanners,
  recordBannerClick,
  createBannerOrder,
  getBannerPackages,
  getAllBannersAdmin,
  updateBannerApproval
} = require('../services/bannerService');

// Public: Get currently active banner slots
router.get('/banners/active', (req, res) => {
  try {
    const banners = getActiveBanners();
    res.json({ success: true, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Get banner ad packages & pricing
router.get('/banners/packages', (req, res) => {
  try {
    const packages = getBannerPackages();
    res.json({ success: true, data: packages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Track banner ad click
router.post('/banners/click/:id', (req, res) => {
  try {
    const recorded = recordBannerClick(req.params.id);
    res.json({ success: true, recorded });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public: Create banner advertisement order
router.post('/banners/order', (req, res) => {
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
