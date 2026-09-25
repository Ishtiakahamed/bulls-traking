const express = require('express');
const router = express.Router();

const tokenRoutes = require('./tokenRoutes');
const submissionRoutes = require('./submissionRoutes');
const promotionRoutes = require('./promotionRoutes');
const bannerRoutes = require('./bannerRoutes');
const newPairsRoutes = require('../../routes/newPairsRoutes');
const adminRoutes = require('../../routes/adminRoutes');
const telegramRoutes = require('./telegramRoutes');
const { handleGetHomeData } = require('../controllers/homeController');
const { getSyncStatus } = require('../workers/syncWorker');

// Root API Route
router.get('/', (req, res) => {
  res.json({
    success: true,
    platform: 'Bulls Traking API',
    version: '1.0.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      home: '/api/home',
      tokens: '/api/tokens',
      newPairs: '/api/new-pairs',
      marketStats: '/api/market-stats',
      telegram: '/api/telegram/status'
    }
  });
});

// Health Check (Section 26)
router.get('/health', (req, res) => {
  const sync = getSyncStatus();
  res.json({
    success: true,
    platform: 'Bulls Traking API',
    version: '1.0.0-phase1',
    status: 'ok',
    timestamp: new Date().toISOString(),
    sync
  });
});

// Single Home Data Aggregator (Section 42)
router.get('/home', handleGetHomeData);

const legacyPromotionRoutes = require('../../routes/promotionRoutes');
const presaleRoutes = require('../../routes/presaleRoutes');
const legacyTokenRoutes = require('../../routes/tokenRoutes');

// Sub-routes
router.use('/', tokenRoutes);
router.use('/', submissionRoutes);
router.use('/', promotionRoutes);
router.use('/', bannerRoutes);
router.use('/', legacyPromotionRoutes);
router.use('/promotion', legacyPromotionRoutes);
router.use('/promotions', legacyPromotionRoutes);
router.use('/', presaleRoutes);
router.use('/', legacyTokenRoutes);
router.use('/', newPairsRoutes);
router.use('/', adminRoutes);
router.use('/', telegramRoutes);

module.exports = router;
