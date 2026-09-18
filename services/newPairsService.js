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
          ? new Date(pair.pairCreatedAt).toISOString()
          : new Date().toISOString();
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

    // Clean up spam duplicate names
    cleanupDuplicatePairs();

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
    source = 'all',
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

  if (source && source !== 'all') {
    whereClauses.push("source = ?");
    params.push(source);
  }

  if (chain && chain !== 'all') {
    if (chain === 'solana' || chain === 'solana-ecosystem') {
      whereClauses.push("(chain = 'solana' OR chain = 'solana-ecosystem')");
    } else if (chain === 'bsc' || chain === 'binance-smart-chain') {
      whereClauses.push("(chain = 'bsc' OR chain = 'binance-smart-chain')");
    } else if (chain === 'ethereum' || chain === 'ethereum-ecosystem') {
      whereClauses.push("(chain = 'ethereum' OR chain = 'ethereum-ecosystem')");
    } else if (chain === 'base' || chain === 'base-ecosystem') {
      whereClauses.push("(chain = 'base' OR chain = 'base-ecosystem')");
    } else {
      whereClauses.push("chain = ?");
      params.push(chain);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let orderBy = 'pair_created_at DESC, id DESC';
  if (status === 'trending') {
    orderBy = 'volume_24h DESC, liquidity DESC';
  } else if (status === 'matured') {
    orderBy = 'pair_created_at ASC, liquidity DESC';
  }

  const sql = `
    WITH ranked_pairs AS (
      SELECT 
        id, chain, pair_address, token_address, name, symbol, logo_url,
        price, liquidity, volume_24h, txn_count_24h, pair_created_at,
        status, source, website_url, twitter_url, telegram_url, metadata,
        first_discovered_at, last_synced_at,
        ROW_NUMBER() OVER (
          PARTITION BY UPPER(TRIM(name))
          ORDER BY liquidity DESC, volume_24h DESC, pair_created_at DESC, id DESC
        ) as rn
      FROM new_pairs
      ${whereSql}
    )
    SELECT 
      id, chain, pair_address, token_address, name, symbol, logo_url,
      price, liquidity, volume_24h, txn_count_24h, pair_created_at,
      status, source, website_url, twitter_url, telegram_url, metadata,
      first_discovered_at, last_synced_at
    FROM ranked_pairs
    WHERE rn = 1
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  params.push(limitNum, offsetNum);

  const pairs = query(sql, params);
  const countRow = queryOne(`SELECT COUNT(DISTINCT UPPER(TRIM(name))) as count FROM new_pairs ${whereSql}`, params.slice(0, -2));
  const total = countRow?.count || 0;

  // Background auto-enrichment of missing logos
  setTimeout(() => enrichMissingLogos(15), 100);

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
    const hasSpecialSources = queryOne("SELECT COUNT(*) as count FROM new_pairs WHERE source IN ('pumpfun', 'fourmeme', 'stonkfun')");
    
    if (!countRow || countRow.count === 0 || !hasSpecialSources || hasSpecialSources.count === 0) {
      const demoPairs = [
        // --- 1. Pump.fun (Solana) ---
        {
          chain: 'solana-ecosystem',
          pair_address: '8PENGU1nPoolPumpfunSolanaPool1111111111111',
          token_address: '6PENGUINtokenSolanaAddressPumpfun111111111',
          name: 'Penguin Solana',
          symbol: 'PENGUIN',
          logo_url: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
          price: 0.000034,
          liquidity: 85400,
          volume_24h: 342000,
          txn_count_24h: 4210,
          pair_created_at: new Date(Date.now() - 14 * 60000).toISOString(), // 14 mins ago
          status: 'latest',
          source: 'pumpfun',
          website_url: 'https://pump.fun/coin/6PENGUINtokenSolanaAddressPumpfun111111111',
          twitter_url: 'https://x.com/penguin_sol',
          telegram_url: 'https://t.me/penguin_sol',
          metadata: JSON.stringify({ marketCapSol: 184.5, isComplete: false })
        },
        {
          chain: 'solana-ecosystem',
          pair_address: '9BULLRUNpoolPumpfunSolanaAddress1111111111',
          token_address: 'BULLRUNtokenSolanaAddressPumpfun1111111111',
          name: 'Bull Run Meme',
          symbol: 'BULLRUN',
          logo_url: 'https://assets.coingecko.com/coins/images/325/standard/Tether.png',
          price: 0.00012,
          liquidity: 125000,
          volume_24h: 680000,
          txn_count_24h: 7800,
          pair_created_at: new Date(Date.now() - 48 * 60000).toISOString(), // 48 mins ago
          status: 'latest',
          source: 'pumpfun',
          website_url: 'https://pump.fun',
          twitter_url: 'https://x.com/bullrun_sol',
          telegram_url: 'https://t.me/bullrun_sol',
          metadata: JSON.stringify({ marketCapSol: 420.0, isComplete: false })
        },
        {
          chain: 'solana-ecosystem',
          pair_address: '7AIAGENTpoolPumpfunSolanaAddress1111111111',
          token_address: 'AIAGENTtokenSolanaAddressPumpfun1111111111',
          name: 'Neural Agent Pump',
          symbol: 'AIAGENT',
          logo_url: 'https://assets.coingecko.com/coins/images/35529/standard/brett.png',
          price: 0.0048,
          liquidity: 280000,
          volume_24h: 1450000,
          txn_count_24h: 12900,
          pair_created_at: new Date(Date.now() - 3 * 3600000).toISOString(), // 3 hours ago
          status: 'trending',
          source: 'pumpfun',
          website_url: 'https://pump.fun',
          twitter_url: 'https://x.com/aiagent_sol',
          telegram_url: 'https://t.me/aiagent_sol',
          metadata: JSON.stringify({ marketCapSol: 1250.0, isComplete: true })
        },
        {
          chain: 'solana-ecosystem',
          pair_address: '4DOGE2poolPumpfunSolanaAddress111111111111',
          token_address: 'DOGE2tokenSolanaAddressPumpfun111111111111',
          name: 'Super Doge Fun',
          symbol: 'DOGE2',
          logo_url: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
          price: 0.0000085,
          liquidity: 42000,
          volume_24h: 118000,
          txn_count_24h: 1850,
          pair_created_at: new Date(Date.now() - 22 * 60000).toISOString(), // 22 mins ago
          status: 'latest',
          source: 'pumpfun',
          website_url: 'https://pump.fun',
          twitter_url: 'https://x.com/superdoge_sol',
          telegram_url: null,
          metadata: JSON.stringify({ marketCapSol: 95.2, isComplete: false })
        },

        // --- 2. four.meme (BNB Chain) ---
        {
          chain: 'binance-smart-chain',
          pair_address: '0x4444a1b83d97de771804f85e495f543160a2b8e1',
          token_address: '0x4444a1b83d97de771804f85e495f543160a2b8e1',
          name: 'Four Meme Official',
          symbol: 'FOUR',
          logo_url: 'assets/sources/fourmeme.png',
          price: 0.000018,
          liquidity: 96000,
          volume_24h: 410000,
          txn_count_24h: 5300,
          pair_created_at: new Date(Date.now() - 19 * 60000).toISOString(), // 19 mins ago
          status: 'latest',
          source: 'fourmeme',
          website_url: 'https://four.meme/token/0x4444a1b83d97de771804f85e495f543160a2b8e1',
          twitter_url: 'https://x.com/four_meme_token',
          telegram_url: 'https://t.me/four_meme',
          metadata: JSON.stringify({ factory: '0x5c952063c7fc8610ffdb798152d69f0b9550762b' })
        },
        {
          chain: 'binance-smart-chain',
          pair_address: '0x7777c1234567890abcdef1234567890abcdef123',
          token_address: '0x7777c1234567890abcdef1234567890abcdef123',
          name: 'Baby Cat BNB',
          symbol: 'BABYCAT',
          logo_url: 'assets/sources/fourmeme.png',
          price: 0.0000042,
          liquidity: 64000,
          volume_24h: 230000,
          txn_count_24h: 3120,
          pair_created_at: new Date(Date.now() - 52 * 60000).toISOString(), // 52 mins ago
          status: 'latest',
          source: 'fourmeme',
          website_url: 'https://four.meme',
          twitter_url: 'https://x.com/babycat_bnb',
          telegram_url: 'https://t.me/babycat_bnb',
          metadata: JSON.stringify({ factory: '0x5c952063c7fc8610ffdb798152d69f0b9550762b' })
        },
        {
          chain: 'binance-smart-chain',
          pair_address: '0x8888b1234567890abcdef1234567890abcdef888',
          token_address: '0x8888b1234567890abcdef1234567890abcdef888',
          name: 'Meme Bull BSC',
          symbol: 'MEMEBULL',
          logo_url: 'assets/sources/fourmeme.png',
          price: 0.0021,
          liquidity: 310000,
          volume_24h: 1680000,
          txn_count_24h: 14500,
          pair_created_at: new Date(Date.now() - 5 * 3600000).toISOString(), // 5 hours ago
          status: 'trending',
          source: 'fourmeme',
          website_url: 'https://four.meme',
          twitter_url: 'https://x.com/memebull_bsc',
          telegram_url: 'https://t.me/memebull_bsc',
          metadata: JSON.stringify({ factory: '0x5c952063c7fc8610ffdb798152d69f0b9550762b' })
        },

        // --- 3. StonkFun (Solana / Stonk) ---
        {
          chain: 'solana-ecosystem',
          pair_address: 'EQB_stonkfunPoolStonkToken111111111111111111',
          token_address: 'EQB_stonkfunMintStonkToken111111111111111111',
          name: 'Stonk Token Pro',
          symbol: 'STONK',
          logo_url: 'assets/sources/stonkfun.svg',
          price: 0.0014,
          liquidity: 112000,
          volume_24h: 520000,
          txn_count_24h: 6400,
          pair_created_at: new Date(Date.now() - 25 * 60000).toISOString(), // 25 mins ago
          status: 'latest',
          source: 'stonkfun',
          website_url: 'https://www.stonkfun.xyz/token/EQB_stonkfunMintStonkToken111111111111111111',
          twitter_url: 'https://x.com/stonkfun_xyz',
          telegram_url: 'https://t.me/stonkfun',
          metadata: JSON.stringify({ launchpad: 'stonkfun', mode: 'bonding_curve', graduationProgress: 42 })
        },
        {
          chain: 'solana-ecosystem',
          pair_address: 'EQC_dogsRevivalStonkfunPool11111111111111111',
          token_address: 'EQC_dogsRevivalStonkfunMint11111111111111111',
          name: 'Dogs Revival',
          symbol: 'DOGS2',
          logo_url: 'assets/sources/stonkfun.svg',
          price: 0.00078,
          liquidity: 78000,
          volume_24h: 310000,
          txn_count_24h: 4100,
          pair_created_at: new Date(Date.now() - 58 * 60000).toISOString(), // 58 mins ago
          status: 'latest',
          source: 'stonkfun',
          website_url: 'https://www.stonkfun.xyz',
          twitter_url: 'https://x.com/dogs_revival',
          telegram_url: 'https://t.me/dogs_revival',
          metadata: JSON.stringify({ launchpad: 'stonkfun', mode: 'bonding_curve', graduationProgress: 28 })
        },
        {
          chain: 'solana-ecosystem',
          pair_address: 'EQD_notcoinAlphaStonkfunPool111111111111111',
          token_address: 'EQD_notcoinAlphaStonkfunMint111111111111111',
          name: 'Notcoin Alpha Stonk',
          symbol: 'NOTCOIN2',
          logo_url: 'assets/sources/stonkfun.svg',
          price: 0.0082,
          liquidity: 340000,
          volume_24h: 1850000,
          txn_count_24h: 15800,
          pair_created_at: new Date(Date.now() - 4 * 3600000).toISOString(), // 4 hours ago
          status: 'trending',
          source: 'stonkfun',
          website_url: 'https://www.stonkfun.xyz',
          twitter_url: 'https://x.com/notcoin_alpha',
          telegram_url: 'https://t.me/notcoin_alpha',
          metadata: JSON.stringify({ launchpad: 'stonkfun', mode: 'bonding_curve', graduationProgress: 88 })
        },

        // --- 4. DexScreener (Multi-chain) ---
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
          pair_created_at: new Date(Date.now() - 2 * 3600000).toISOString(), // 2 hours ago
          status: 'latest',
          source: 'dexscreener',
          website_url: 'https://dexscreener.com/solana/8sLbNZoA1cfnvMJLPfp98D42FLiT3nJXLajL9JKGpump',
          twitter_url: 'https://x.com/bonk_inu',
          telegram_url: 'https://t.me/bonk_inu',
          metadata: null
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
          pair_created_at: new Date(Date.now() - 18 * 3600000).toISOString(), // 18 hours ago
          status: 'trending',
          source: 'dexscreener',
          website_url: 'https://basedbrett.com',
          twitter_url: 'https://x.com/BasedBrett',
          telegram_url: 'https://t.me/basedbrett',
          metadata: null
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
          pair_created_at: new Date(Date.now() - 12 * 86400000).toISOString(), // 12 days ago
          status: 'matured',
          source: 'dexscreener',
          website_url: 'https://pepe.vip',
          twitter_url: 'https://x.com/pepecoineth',
          telegram_url: 'https://t.me/pepecoineth',
          metadata: null
        },
        {
          chain: 'solana-ecosystem',
          pair_address: '2bF9v5vJ8M5dY6p1xV3n8zK7qL4wE1rT0yU9iO8pA7sD',
          token_address: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY',
          name: 'Moo Deng Hippo',
          symbol: 'MOODENG2',
          logo_url: 'https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg',
          price: 0.156,
          liquidity: 520000,
          volume_24h: 2450000,
          txn_count_24h: 16400,
          pair_created_at: new Date(Date.now() - 6 * 3600000).toISOString(), // 6 hours ago
          status: 'latest',
          source: 'dexscreener',
          website_url: 'https://moodengsol.com',
          twitter_url: 'https://x.com/MooDengSOL',
          telegram_url: null,
          metadata: null
        }
      ];

      for (const p of demoPairs) {
        execute(`
          INSERT INTO new_pairs 
          (chain, pair_address, token_address, name, symbol, logo_url, price, liquidity, volume_24h, txn_count_24h, pair_created_at, status, source, website_url, twitter_url, telegram_url, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(chain, pair_address) DO UPDATE SET
            price = excluded.price,
            liquidity = excluded.liquidity,
            volume_24h = excluded.volume_24h,
            txn_count_24h = excluded.txn_count_24h,
            source = excluded.source,
            website_url = excluded.website_url,
            twitter_url = excluded.twitter_url,
            telegram_url = excluded.telegram_url,
            metadata = excluded.metadata
        `, [
          p.chain, p.pair_address, p.token_address, p.name, p.symbol, p.logo_url,
          p.price, p.liquidity, p.volume_24h, p.txn_count_24h, p.pair_created_at, p.status,
          p.source, p.website_url, p.twitter_url, p.telegram_url, p.metadata
        ]);
      }
      console.log(`[NewPairsService] Seeded ${demoPairs.length} initial multi-source launchpad pairs for radar view.`);
    }
  } catch (err) {
    console.warn('[NewPairsService Seed Notice]', err.message);
  }
}

/**
 * Periodically or on-demand enriches new pairs that have missing or un-normalized logos
 */
async function enrichMissingLogos(limit = 30) {
  try {
    const missing = query(`
      SELECT id, chain, source, pair_address, token_address, metadata 
      FROM new_pairs 
      WHERE (logo_url IS NULL OR logo_url = '' OR logo_url LIKE 'ipfs://%' OR logo_url LIKE '%ipfs.io/ipfs/%')
      ORDER BY id DESC 
      LIMIT ?
    `, [limit]);

    for (const item of missing) {
      try {
        if (item.source === 'fourmeme') {
          const res = await fetch(`https://four.meme/meme-api/v1/private/token/get?address=${item.token_address}`, {
            signal: AbortSignal.timeout(3000),
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.image) {
              execute(`
                UPDATE new_pairs SET 
                  logo_url = ?, 
                  website_url = COALESCE(?, website_url),
                  twitter_url = COALESCE(?, twitter_url),
                  telegram_url = COALESCE(?, telegram_url)
                WHERE id = ?
              `, [json.data.image, json.data.webUrl || null, json.data.twitterUrl || null, json.data.telegramUrl || null, item.id]);
            }
          }
        } else if (item.source === 'pumpfun') {
          const meta = JSON.parse(item.metadata || '{}');
          if (meta.uri) {
            const hashMatch = meta.uri.match(/(?:ipfs\/|ipfs:\/\/)([a-zA-Z0-9_-]+)/);
            if (hashMatch) {
              const hash = hashMatch[1];
              const res = await fetch(`https://pump.mypinata.cloud/ipfs/${hash}`, { signal: AbortSignal.timeout(3000) });
              if (res.ok) {
                const json = await res.json();
                let img = json.image || json.icon;
                if (img) {
                  const imgMatch = img.match(/(?:ipfs\/|ipfs:\/\/)([a-zA-Z0-9_-]+)/);
                  if (imgMatch) {
                    img = `https://pump.mypinata.cloud/ipfs/${imgMatch[1]}`;
                  }
                  execute(`
                    UPDATE new_pairs SET 
                      logo_url = ?, 
                      website_url = COALESCE(?, website_url),
                      twitter_url = COALESCE(?, twitter_url),
                      telegram_url = COALESCE(?, telegram_url)
                    WHERE id = ?
                  `, [img, json.website || null, json.twitter || null, json.telegram || null, item.id]);
                }
              }
            }
          }
        }
      } catch (_) {}
    }
  } catch (err) {
    // Non-fatal
  }
}

/**
 * Deduplicate new_pairs table by removing clone rows with identical token names,
 * preserving only the highest liquidity/volume/most recent instance.
 */
function cleanupDuplicatePairs() {
  try {
    const res = execute(`
      DELETE FROM new_pairs
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY UPPER(TRIM(name))
            ORDER BY liquidity DESC, volume_24h DESC, pair_created_at DESC, id DESC
          ) as rn
          FROM new_pairs
        ) WHERE rn = 1
      )
    `);
    if (res && res.changes > 0) {
      console.log(`[NewPairsService] Cleaned up ${res.changes} duplicate token pairs.`);
    }
  } catch (err) {
    console.warn('[NewPairsService Deduplication Notice]', err.message);
  }
}

seedInitialPairsIfEmpty();
cleanupDuplicatePairs();

module.exports = {
  discoverNewPairs,
  classifyPairs,
  getNewPairs,
  seedInitialPairsIfEmpty,
  enrichMissingLogos,
  cleanupDuplicatePairs
};

