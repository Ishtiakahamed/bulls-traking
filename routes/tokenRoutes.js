const express = require('express');
const router = express.Router();
const { getTokens, getTokenDetail, getTickerMovers } = require('../services/tokenService');

router.get('/tokens', (req, res) => {
  try {
    const { chain, tab, search, limit = 25, offset, page } = req.query;
    const limitNum = parseInt(limit, 10) || 25;
    const computedOffset = offset != null ? parseInt(offset, 10) : (page ? (Math.max(1, parseInt(page, 10)) - 1) * limitNum : 0);
    const tokens = getTokens({ chain, tab, search, limit: limitNum, offset: computedOffset });
    res.json({ success: true, count: tokens.length, data: tokens });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hot Tokens page and endpoint were removed in Phase 1; prevent a legacy
// /tokens/:id route from treating "hot" as a token identifier.
router.get('/tokens/hot', (req, res) => {
  res.status(404).json({ success: false, error: 'Hot Tokens page has been removed' });
});

router.get('/tokens/:id', (req, res) => {
  try {
    const token = getTokenDetail(req.params.id);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }
    res.json({ success: true, data: token });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/ticker', (req, res) => {
  try {
    const movers = getTickerMovers();
    res.json({ success: true, data: movers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
