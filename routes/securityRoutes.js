const express = require('express');
const router = express.Router();
const { scanTokenSecurity } = require('../services/securityService');
const { strictLimiter } = require('../backend/middleware/rateLimiters');

router.get('/security/scan', strictLimiter, async (req, res) => {
  try {
    const { chain = 'binance-smart-chain', address } = req.query;
    if (!address) {
      return res.status(400).json({ success: false, error: 'Contract address parameter is required' });
    }
    const report = await scanTokenSecurity(chain, address);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
