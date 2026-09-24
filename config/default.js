module.exports = {
  port: process.env.PORT || 5000,
  environment: process.env.NODE_ENV || 'development',
  brandName: 'Bulls Traking',
  
  // Market Data Ingestion
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS, 10) || 60000, // 60 seconds
  primaryProvider: process.env.PRIMARY_PROVIDER || 'coingecko',
  
  // CoinGecko & CMC API Configuration (API keys provided via environment variables)
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    apiKey: process.env.COINGECKO_API_KEY || process.env.COINGECKO_DEMO_API_KEY || '',
    timeoutMs: 8000
  },
  coinmarketcap: {
    baseUrl: 'https://pro-api.coinmarketcap.com/v1',
    apiKey: process.env.COINMARKETCAP_API_KEY || '',
    timeoutMs: 8000
  },
  
  // Algorithmic Hot Score Weights (Configurable per Section 13)
  hotScoreWeights: {
    volumeWeight: 0.35,
    momentumWeight: 0.25,
    priceChangeWeight: 0.20,
    activityWeight: 0.10,
    liquidityWeight: 0.10
  },

  // Top Gainers Quality Filters (Configurable per Section 14)
  gainersFilter: {
    minVolume24hUsd: 1000, // Minimum $1,000 volume to exclude illiquid honeypots/glitches
    minMarketCapUsd: 5000
  },

  // New Pairs Radar Configuration (Phase 3 Task 1)
  newPairsSyncIntervalMs: parseInt(process.env.NEW_PAIRS_SYNC_INTERVAL_MS, 10) || 120000, // 2 minutes
  newPairsFilter: {
    minLiquidityUsd: 1000,
    trendingTopPercentile: 0.20,
    maturedAgeDays: 7
  },

  // Token Discovery Configuration (Bug Fix & Pool Expansion)
  tokenDiscoveryIntervalMs: parseInt(process.env.TOKEN_DISCOVERY_INTERVAL_MS, 10) || 1800000, // 30 minutes

  // Cache Time-To-Live in seconds
  cacheTtl: {
    marketListSec: 60,
    tokenDetailSec: 60,
    searchSec: 120
  }
};
