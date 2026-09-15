const {
  getTopCoins,
  getNewCoins,
  getHotCoins,
  getTopGainers,
  getTrendingCoins
} = require('../services/tokenService');
const { getActivePromotions } = require('../services/promotionService');
const { getSyncStatus } = require('../workers/syncWorker');
const { queryOne } = require('../../database/db');

/**
 * Single optimized home data API response (Section 42)
 */
function handleGetHomeData(req, res, next) {
  try {
    const chain = req.query.chain || 'all';
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const trendingRes = getTrendingCoins({ chain, limit, page });
    const newCoinsRes = getNewCoins({ chain, limit, page });
    const hotRes = getHotCoins({ chain, limit, page });
    const gainersRes = getTopGainers({ chain, limit, page });
    const topCoinsRes = getTopCoins({ chain, limit, page });
    const promoted = getActivePromotions().slice(0, 6);

    const stats = queryOne(`
      SELECT 
        SUM(market_cap) as totalMarketCap,
        SUM(volume_24h) as total24hVolume,
        COUNT(*) as totalActiveTokens
      FROM tokens WHERE is_active = 1
    `);

    const syncStatus = getSyncStatus();

    res.json({
      success: true,
      data: {
        trending: trendingRes.tokens,
        new: newCoinsRes.tokens,
        hot: hotRes.tokens,
        gainers: gainersRes.tokens,
        topCoins: topCoinsRes.tokens,
        promoted,
        pagination: {
          page,
          limit,
          total: stats?.totalActiveTokens || 0,
          trendingTotal: trendingRes.pagination?.total || 0,
          newTotal: newCoinsRes.pagination?.total || 0,
          hotTotal: hotRes.pagination?.total || 0,
          gainersTotal: gainersRes.pagination?.total || 0,
          topTotal: topCoinsRes.pagination?.total || 0
        },
        marketStats: {
          totalMarketCap: stats?.totalMarketCap || 0,
          total24hVolume: stats?.total24hVolume || 0,
          totalTokens: stats?.totalActiveTokens || 0,
          lastSyncTime: syncStatus.lastSyncAt,
          providerStatus: syncStatus.providerStatus
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleGetHomeData
};
