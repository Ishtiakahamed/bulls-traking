const express = require('express');
const router = express.Router();
const {
  handleGetTopCoins,
  handleGetNewCoins,
  handleGetTopGainers,
  handleGetTrendingCoins,
  handleGetTokenDetail,
  handleSearchTokens,
} = require('../controllers/tokenController');

// Token Categories (Section 26)
router.get('/tokens', handleGetTopCoins);
router.get('/tokens/top', handleGetTopCoins);
router.get('/tokens/new', handleGetNewCoins);
// Hot Tokens page and endpoint were removed in Phase 1.
router.get('/tokens/hot', (req, res) => {
  res.status(404).json({ success: false, error: 'Hot Tokens page has been removed' });
});
router.get('/tokens/gainers', handleGetTopGainers);
router.get('/tokens/trending', handleGetTrendingCoins);

// Search endpoint
router.get('/search', handleSearchTokens);

// Token Detail endpoint (supports /tokens/:id or /tokens/:chain/:contract)
router.get('/tokens/:id', handleGetTokenDetail);
router.get('/tokens/:chain/:contract', (req, res, next) => {
  req.params.id = req.params.contract;
  req.query.chain = req.params.chain;
  handleGetTokenDetail(req, res, next);
});

module.exports = router;
