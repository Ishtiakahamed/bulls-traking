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

const homeCache = new Map();
const HOME_CACHE_TTL_MS = 10000; // 10 seconds in-memory cache

/**
 * Single optimized home data API response (Section 42)
 */
function handleGetHomeData(req, res, next) {
  try {
    const chain = req.query.chain || 'all';
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const excludeStablecoins = req.query.include_stables !== 'true';
    const cacheKey = `${chain}:${limit}:${page}:${excludeStablecoins}`;

    const cached = homeCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < HOME_CACHE_TTL_MS)) {
      return res.json(cached.payload);
    }

    const trendingRes = getTrendingCoins({ chain, limit, page, excludeStablecoins });
    const newCoinsRes = getNewCoins({ chain, limit, page });
    const hotRes = getHotCoins({ chain, limit, page, excludeStablecoins });
    const gainersRes = getTopGainers({ chain, limit, page, excludeStablecoins });
    const topCoinsRes = getTopCoins({ chain, limit, page, excludeStablecoins });
    const promoted = getActivePromotions().slice(0, 6);

    const stats = queryOne(`
      SELECT 
        SUM(market_cap) as totalMarketCap,
        SUM(volume_24h) as total24hVolume,
        COUNT(*) as totalActiveTokens
      FROM (
        SELECT market_cap, volume_24h, name
        FROM tokens
        WHERE is_active = 1
        GROUP BY UPPER(TRIM(name))
      )
    `);

    const syncStatus = getSyncStatus();

    const payload = {
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
          total: topCoinsRes.pagination?.total || stats?.totalActiveTokens || 0,
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
    };
    homeCache.set(cacheKey, { timestamp: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

function invalidateHomeCache() {
  homeCache.clear();
}

module.exports = {
  handleGetHomeData,
  invalidateHomeCache
};
