const {
  getTopCoins,
  getNewCoins,
  getHotCoins,
  getTopGainers,
  getTrendingCoins,
  getTokenDetail,
  searchTokens
} = require('../services/tokenService');

function handleGetTopCoins(req, res, next) {
  try {
    const { chain, limit, page, include_stables } = req.query;
    const excludeStablecoins = include_stables !== 'true';
    const result = getTopCoins({ chain, limit, page, excludeStablecoins });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

function handleGetNewCoins(req, res, next) {
  try {
    const { chain, limit, page } = req.query;
    const result = getNewCoins({ chain, limit, page });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

function handleGetHotCoins(req, res, next) {
  try {
    const { chain, limit, page, include_stables } = req.query;
    const excludeStablecoins = include_stables !== 'true';
    const result = getHotCoins({ chain, limit, page, excludeStablecoins });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

function handleGetTopGainers(req, res, next) {
  try {
    const { chain, limit, page, include_stables } = req.query;
    const excludeStablecoins = include_stables !== 'true';
    const result = getTopGainers({ chain, limit, page, excludeStablecoins });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

function handleGetTrendingCoins(req, res, next) {
  try {
    const { chain, limit, page, include_stables } = req.query;
    const excludeStablecoins = include_stables !== 'true';
    const result = getTrendingCoins({ chain, limit, page, excludeStablecoins });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

function handleGetTokenDetail(req, res, next) {
  try {
    const { id } = req.params;
    const { chain } = req.query;
    const token = getTokenDetail(id, chain);
    if (!token) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }
    res.json({ success: true, data: token });
  } catch (err) {
    next(err);
  }
}

function handleSearchTokens(req, res, next) {
  try {
    const q = req.query.q || req.query.search || '';
    const limit = req.query.limit || 10;
    const results = searchTokens(q, limit);
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    next(err);
  }
}

function handleGetTokensByIds(req, res, next) {
  try {
    const rawIds = req.query.ids;
    if (!rawIds) return res.json({ success: true, tokens: [] });
    const ids = rawIds.toString().split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id) && id > 0);
    const { getTokensByIds } = require('../services/tokenService');
    const tokens = getTokensByIds(ids);
    res.json({ success: true, count: tokens.length, tokens });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetTopCoins,
  handleGetNewCoins,
  handleGetHotCoins,
  handleGetTopGainers,
  handleGetTrendingCoins,
  handleGetTokenDetail,
  handleSearchTokens,
  handleGetTokensByIds
};
