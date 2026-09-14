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

    const trending = getTrendingCoins({ chain, limit: 10, page: 1 }).tokens;
    const newCoins = getNewCoins({ chain, limit: 10, page: 1 }).tokens;
    const hot = getHotCoins({ chain, limit: 10, page: 1 }).tokens;
    const gainers = getTopGainers({ chain, limit: 10, page: 1 }).tokens;
    const topCoins = getTopCoins({ chain, limit: 10, page: 1 }).tokens;
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
        trending,
        new: newCoins,
        hot,
        gainers,
        topCoins,
        promoted,
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
