const express = require('express');
const router = express.Router();
const { getTokens, getTokenDetail, getTickerMovers } = require('../services/tokenService');

router.get('/tokens', (req, res) => {
  try {
    const { chain, tab, search, limit, offset } = req.query;
    const tokens = getTokens({ chain, tab, search, limit, offset });
    res.json({ success: true, count: tokens.length, data: tokens });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
