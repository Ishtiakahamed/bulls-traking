const express = require('express');
const router = express.Router();

const tokenRoutes = require('./tokenRoutes');
const submissionRoutes = require('./submissionRoutes');
const promotionRoutes = require('./promotionRoutes');
const bannerRoutes = require('./bannerRoutes');
const securityRoutes = require('../../routes/securityRoutes');
const newPairsRoutes = require('../../routes/newPairsRoutes');
const signalsRoutes = require('../../routes/signalsRoutes');
const adminRoutes = require('../../routes/adminRoutes');
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
      signals: '/api/signals',
      marketStats: '/api/market-stats',
      security: '/api/security/scan'
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

// Sub-routes
router.use('/', tokenRoutes);
router.use('/', submissionRoutes);
router.use('/', promotionRoutes);
router.use('/', bannerRoutes);
router.use('/', securityRoutes);
router.use('/', newPairsRoutes);
router.use('/', signalsRoutes);
router.use('/', adminRoutes);

module.exports = router;
