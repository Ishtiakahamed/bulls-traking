const express = require('express');
const router = express.Router();
const { 
  getActivePromotedTokens, 
  getCurrentAdBoard, 
  getActiveBanners, 
  createPromotionOrder 
} = require('../services/promotionService');

router.get('/promotions/active', (req, res) => {
  try {
    const promoted = getActivePromotedTokens();
    res.json({ success: true, count: promoted.length, data: promoted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/adboard/current', (req, res) => {
  try {
    const adData = getCurrentAdBoard();
    res.json({ success: true, data: adData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/banners/active', (req, res) => {
  try {
    const banners = getActiveBanners();
    res.json({ success: true, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/orders/promotion', (req, res) => {
  try {
    const result = createPromotionOrder(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
