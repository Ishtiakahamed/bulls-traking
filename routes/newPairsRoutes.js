const express = require('express');
const router = express.Router();
const { getNewPairs } = require('../services/newPairsService');

router.get('/new-pairs', (req, res) => {
  try {
    const { chain, limit, offset, page } = req.query;
    const status = req.query.status || req.query.tab || 'latest';
    const result = getNewPairs({ chain, status, limit, offset, page });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
