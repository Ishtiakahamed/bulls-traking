const { query, queryOne, execute, transaction } = require('../database/db');
const config = require('../config/default');

const CHAIN_MAP = {
  'solana': 'solana-ecosystem',
  'ethereum': 'ethereum-ecosystem',
  'bsc': 'binance-smart-chain',
  'base': 'base-ecosystem'
};

const DEX_TOKEN_PROFILES_URL = 'https://api.dexscreener.com/token-profiles/latest/v1';
const DEX_TOKEN_DETAIL_URL = 'https://api.dexscreener.com/latest/dex/tokens';

/**
 * Discovers new token pairs from DexScreener free token profiles
 * NOTE: This discovers pairs as they are profiled on DexScreener.
 * It is a free-tier discovery feed rather than a complete real-time chain firehose.
 */
async function discoverNewPairs() {
  console.log('[NewPairsService] Polling DexScreener latest token profiles for new pairs...');

  try {
    const res = await fetch(DEX_TOKEN_PROFILES_URL, {
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      console.warn(`[NewPairsService] Token profiles fetch status: ${res.status}`);
      return [];
    }

    const profiles = await res.json();
    if (!Array.isArray(profiles)) return [];

    // Filter to supported chains
    const supportedProfiles = profiles.filter(p => CHAIN_MAP[p.chainId] && p.tokenAddress);
    console.log(`[NewPairsService] Found ${supportedProfiles.length} candidate profiles on supported chains.`);

    const discoveredPairs = [];

    // Enrich pairs with detailed DEX pool metrics
    for (const item of supportedProfiles.slice(0, 15)) {
      try {
        const chainKey = CHAIN_MAP[item.chainId];
        const detailRes = await fetch(`${DEX_TOKEN_DETAIL_URL}/${item.tokenAddress}`, {
          signal: AbortSignal.timeout(5000)
        });

        if (!detailRes.ok) continue;
        const detailJson = await detailRes.json();
        const pair = detailJson.pairs?.[0];
        if (!pair || !pair.pairAddress) continue;

        const price = parseFloat(pair.priceUsd || 0);
        const liquidity = parseFloat(pair.liquidity?.usd || 0);
        const volume24h = parseFloat(pair.volume?.h24 || 0);
        const buys = parseInt(pair.txns?.h24?.buys || 0, 10);
        const sells = parseInt(pair.txns?.h24?.sells || 0, 10);
        const txnCount = buys + sells;
        const pairCreatedAt = pair.pairCreatedAt
          ? new Date(pair.pairCreatedAt).toISOString().replace('T', ' ').replace(/\..+/, '')
          : new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
        const logoUrl = item.icon || null;

        execute(`
          INSERT INTO new_pairs (
            chain, pair_address, token_address, name, symbol, logo_url,
            price, liquidity, volume_24h, txn_count_24h, pair_created_at, status, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'latest', CURRENT_TIMESTAMP)
          ON CONFLICT(chain, pair_address) DO UPDATE SET
            price = excluded.price,
            liquidity = excluded.liquidity,
            volume_24h = excluded.volume_24h,
            txn_count_24h = excluded.txn_count_24h,
            last_synced_at = CURRENT_TIMESTAMP
        `, [
          chainKey, pair.pairAddress, pair.baseToken.address,
          pair.baseToken.name || 'Discovered Token',
          pair.baseToken.symbol || 'PAIR',
          logoUrl, price, liquidity, volume24h, txnCount, pairCreatedAt
        ]);

        discoveredPairs.push(pair.pairAddress);
      } catch (itemErr) {
        // Continue processing next candidate
      }
    }

    console.log(`[NewPairsService] Successfully discovered and upserted ${discoveredPairs.length} pairs.`);
    
    // Classify pairs into latest / trending / matured
    classifyPairs();

    return discoveredPairs;
  } catch (err) {
    console.warn('[NewPairsService Error]', err.message);
    return [];
  }
}

/**
 * Classify pairs into Latest / Trending / Matured:
 * - 'latest': pair_created_at within the last 24h
 * - 'trending': not 'latest', but volume_24h in the pool's top 20% AND liquidity > minLiquidityUsd ($1,000)
 * - 'matured': pair_created_at older than 7 days AND liquidity still above minLiquidityUsd floor
 */
function classifyPairs() {
  try {
    const minLiq = config.newPairsFilter?.minLiquidityUsd || 1000;
    const maturedDays = config.newPairsFilter?.maturedAgeDays || 7;

    // 1. Set 'latest' for pairs created within last 24h
    execute(`
      UPDATE new_pairs 
      SET status = 'latest' 
      WHERE pair_created_at >= datetime('now', '-24 hours')
    `);

    // 2. Fetch older pairs to compute volume threshold for 'trending'
    const olderPairs = query(`
      SELECT id, volume_24h, liquidity, pair_created_at 
      FROM new_pairs 
      WHERE pair_created_at < datetime('now', '-24 hours')
      ORDER BY volume_24h DESC
    `);

    if (olderPairs.length > 0) {
      // Top 20% volume threshold
      const topCount = Math.max(1, Math.ceil(olderPairs.length * (config.newPairsFilter?.trendingTopPercentile || 0.20)));
      const thresholdVol = olderPairs[topCount - 1]?.volume_24h || 0;

      transaction(() => {
        for (const p of olderPairs) {
          const ageMs = Date.now() - new Date(p.pair_created_at).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);

          if (p.volume_24h >= thresholdVol && p.liquidity >= minLiq) {
            execute(`UPDATE new_pairs SET status = 'trending' WHERE id = ?`, [p.id]);
          } else if (ageDays >= maturedDays && p.liquidity >= minLiq) {
            execute(`UPDATE new_pairs SET status = 'matured' WHERE id = ?`, [p.id]);
          } else {
            execute(`UPDATE new_pairs SET status = 'latest' WHERE id = ?`, [p.id]);
          }
        }
      });
    }

    console.log('[NewPairsService] Classification complete (latest / trending / matured).');
  } catch (err) {
    console.warn('[NewPairsService Classify Notice]', err.message);
  }
}

/**
 * Get new pairs with filtering, status tab, and pagination
 */
function getNewPairs(options = {}) {
  const {
    chain = 'all',
    status = 'latest',
    limit = 25,
    offset = 0,
    page = 1
  } = options;

  seedInitialPairsIfEmpty();
  const limitNum = parseInt(limit, 10) || 25;
  const pageNum = parseInt(page, 10) || 1;
  const offsetNum = offset != null ? parseInt(offset, 10) : (pageNum - 1) * limitNum;

  let whereClauses = [];
  const params = [];

  if (status && status !== 'all') {
    whereClauses.push("status = ?");
    params.push(status);
  }

  if (chain && chain !== 'all') {
    whereClauses.push("chain = ?");
    params.push(chain);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let orderBy = 'pair_created_at DESC, id DESC';
  if (status === 'trending') {
    orderBy = 'volume_24h DESC, liquidity DESC';
  } else if (status === 'matured') {
    orderBy = 'pair_created_at ASC, liquidity DESC';
  }

  const sql = `
    SELECT 
      id, chain, pair_address, token_address, name, symbol, logo_url,
      price, liquidity, volume_24h, txn_count_24h, pair_created_at,
      status, first_discovered_at, last_synced_at
    FROM new_pairs
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  params.push(limitNum, offsetNum);

  const pairs = query(sql, params);
  const countRow = queryOne(`SELECT COUNT(*) as count FROM new_pairs ${whereSql}`, params.slice(0, -2));
  const total = countRow?.count || 0;

  return {
    pairs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: offsetNum + pairs.length < total
    }
  };
}

function seedInitialPairsIfEmpty() {
  try {
    const countRow = queryOne('SELECT COUNT(*) as count FROM new_pairs');
    if (!countRow || countRow.count === 0) {
      const demoPairs = [
        {
          chain: 'solana-ecosystem',
          pair_address: '8sLbNZoA1cfnvMJLPfp98D42FLiT3nJXLajL9JKGpump',
          token_address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
          name: 'Bonk Doge Alpha',
          symbol: 'BDOGE',
          logo_url: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
          price: 0.000024,
          liquidity: 145000,
          volume_24h: 320000,
          txn_count_24h: 3450,
          pair_created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
          status: 'latest'
        },
        {
          chain: 'base-ecosystem',
          pair_address: '0x40bc5225d36b2880c5e7ce9a2a9003ff54b4c501',
          token_address: '0x532f27101965dd16442e59d40670faf5ebb142e4',
          name: 'Brett Runner 2026',
          symbol: 'BRETT2',
          logo_url: 'https://assets.coingecko.com/coins/images/35529/standard/brett.png',
          price: 0.084,
          liquidity: 480000,
          volume_24h: 1250000,
          txn_count_24h: 8900,
          pair_created_at: new Date(Date.now() - 18 * 3600000).toISOString(),
          status: 'trending'
        },
        {
          chain: 'ethereum-ecosystem',
          pair_address: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f',
          token_address: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
          name: 'Pepe Vault Pool',
          symbol: 'PEPEV',
          logo_url: 'https://assets.coingecko.com/coins/images/29850/standard/pepe-token.png',
          price: 0.0000098,
          liquidity: 920000,
          volume_24h: 2100000,
          txn_count_24h: 14200,
          pair_created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
          status: 'matured'
        }
      ];

      for (const p of demoPairs) {
        execute(`
          INSERT OR IGNORE INTO new_pairs 
          (chain, pair_address, token_address, name, symbol, logo_url, price, liquidity, volume_24h, txn_count_24h, pair_created_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          p.chain, p.pair_address, p.token_address, p.name, p.symbol, p.logo_url,
          p.price, p.liquidity, p.volume_24h, p.txn_count_24h, p.pair_created_at, p.status
        ]);
      }
      console.log('[NewPairsService] Seeded initial demo pairs for radar view.');
    }
  } catch (err) {
    console.warn('[NewPairsService Seed Notice]', err.message);
  }
}

seedInitialPairsIfEmpty();

module.exports = {
  discoverNewPairs,
  classifyPairs,
  getNewPairs,
  seedInitialPairsIfEmpty
};
