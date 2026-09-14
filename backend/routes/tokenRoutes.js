const express = require('express');
const router = express.Router();
const {
  handleGetTopCoins,
  handleGetNewCoins,
  handleGetHotCoins,
  handleGetTopGainers,
  handleGetTrendingCoins,
  handleGetTokenDetail,
  handleSearchTokens,
  handleGetTokensByIds
} = require('../controllers/tokenController');

// Token Categories (Section 26)
router.get('/tokens', handleGetTopCoins);
router.get('/tokens/top', handleGetTopCoins);
router.get('/tokens/new', handleGetNewCoins);
router.get('/tokens/hot', handleGetHotCoins);
router.get('/tokens/gainers', handleGetTopGainers);
router.get('/tokens/trending', handleGetTrendingCoins);

// Watchlist batch fetch by IDs
router.get('/tokens/by-ids', handleGetTokensByIds);

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
