const express = require('express');
const router = express.Router();

const tokenRoutes = require('./tokenRoutes');
const submissionRoutes = require('./submissionRoutes');
const promotionRoutes = require('./promotionRoutes');
const { handleGetHomeData } = require('../controllers/homeController');
const { getSyncStatus } = require('../workers/syncWorker');

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

module.exports = router;
