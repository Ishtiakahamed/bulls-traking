/**
 * Bulls Traking — Token Discovery Service
 * Automatically fetches high-volume, real token pools per ecosystem from CoinGecko,
 * upserts them into `tokens` table with deduplication on (chain, coingecko_id),
 * and resolves on-chain contract addresses for DexScreener enrichment & Scanner UI.
 */

const { query, queryOne, execute, transaction } = require('../database/db');
const CoinGeckoProvider = require('../backend/providers/coingecko');
const { calculateHotScore } = require('../backend/services/hotScoreService');
const config = require('../config/default');

// Internal chain-slug mapping matching app.js and database
const SUPPORTED_CHAINS = [
  { chain: 'solana-ecosystem', category: 'solana-ecosystem', platform: 'solana' },
  { chain: 'ethereum-ecosystem', category: 'ethereum-ecosystem', platform: 'ethereum' },
  { chain: 'binance-smart-chain', category: 'binance-smart-chain', platform: 'binance-smart-chain' },
  { chain: 'base-ecosystem', category: 'base-ecosystem', platform: 'base' }
];

// Module-level platforms cache for address resolution (24h TTL)
let platformsCache = null;
let lastPlatformsFetchTime = 0;
const PLATFORMS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let isDiscovering = false;

/**
 * Discover and upsert real tokens from CoinGecko markets
 */
async function discoverTokens() {
  if (isDiscovering) {
    console.log('[TokenDiscovery] Discovery cycle already in progress, skipping.');
    return;
  }
  isDiscovering = true;
  console.log('\n======================================================');
  console.log('[TokenDiscovery] Starting multi-chain token discovery cycle...');
  console.log('======================================================');

  const cg = new CoinGeckoProvider();
  let totalInserted = 0;
  let totalUpdated = 0;

  try {
    for (let i = 0; i < SUPPORTED_CHAINS.length; i++) {
      const { chain, category } = SUPPORTED_CHAINS[i];
      console.log(`[TokenDiscovery] Fetching top tokens for ${chain} (category: ${category})...`);

      try {
        const url = `${cg.baseUrl}/coins/markets?vs_currency=usd&category=${encodeURIComponent(category)}&order=market_cap_desc&per_page=250&page=1&price_change_percentage=1h,24h,7d&sparkline=true`;
        
        const res = await fetch(url, {
          headers: cg.getHeaders(),
          signal: AbortSignal.timeout(15000)
        });

        if (!res.ok) {
          console.warn(`[TokenDiscovery Warning] CoinGecko returned ${res.status} ${res.statusText} for ${chain}`);
          continue;
        }

        const coins = await res.json();
        if (!Array.isArray(coins) || coins.length === 0) {
          console.log(`[TokenDiscovery] No coins returned for ${chain}`);
          continue;
        }

        let chainInserted = 0;
        let chainUpdated = 0;
        const nowSec = Math.floor(Date.now() / 1000);

        transaction(() => {
          for (const coin of coins) {
            if (!coin.id || !coin.name || !coin.symbol) continue;

            // Filter out synthetic peg tokens from other L1 networks (e.g. binance-peg-xrp, binance-peg-cardano)
            if (chain === 'binance-smart-chain') {
              const isPeg = coin.id.startsWith('binance-peg-') || coin.name.toLowerCase().startsWith('binance-peg ');
              if (isPeg) continue;
              // Skip Uniswap under BSC as it is natively an Ethereum token
              if (coin.id === 'uniswap' || (coin.symbol || '').toUpperCase() === 'UNI') continue;
            }

            const existing = queryOne(
              'SELECT id, first_seen_at, contract_address FROM tokens WHERE chain = ? AND coingecko_id = ? LIMIT 1',
              [chain, coin.id]
            );

            const price = parseFloat(coin.current_price || 0);
            const marketCap = parseFloat(coin.market_cap || 0);
            const volume24h = parseFloat(coin.total_volume || 0);
            const chg1h = parseFloat(coin.price_change_percentage_1h_in_currency || 0);
            const chg24h = parseFloat(coin.price_change_percentage_24h_in_currency || coin.price_change_percentage_24h || 0);
            const chg7d = parseFloat(coin.price_change_percentage_7d_in_currency || 0);
            const circSupply = parseFloat(coin.circulating_supply || 0);
            const totalSupply = parseFloat(coin.total_supply || coin.circulating_supply || 0);
            const ath = parseFloat(coin.ath || 0);
            const athDate = coin.ath_date || null;
            const atl = parseFloat(coin.atl || 0);
            const atlDate = coin.atl_date || null;
            const rank = parseInt(coin.market_cap_rank, 10) || 9999;
            const hotScore = calculateHotScore({
              volume_24h: volume24h,
              change_24h: chg24h,
              change_1h: chg1h,
              market_cap: marketCap
            });

            if (!existing) {
              // Insert new discovered token row
              const insertResult = execute(`
                INSERT INTO tokens (
                  chain, contract_address, coingecko_id, provider_id, name, symbol, logo_url,
                  price, market_cap, volume_24h, change_1h, change_24h, change_7d,
                  circulating_supply, total_supply, ath, ath_date, atl, atl_date,
                  market_cap_rank, hot_score, is_submitted, is_promoted, is_active,
                  listing_status, verification_status, first_seen_at,
                  created_at, updated_at, last_data_sync
                ) VALUES (
                  ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?,
                  ?, ?, 0, 0, 1,
                  'LIVE', 'verified', CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
              `, [
                chain, null, coin.id, coin.id, coin.name, coin.symbol.toUpperCase(), coin.image || null,
                price, marketCap, volume24h, chg1h, chg24h, chg7d,
                circSupply, totalSupply, ath, athDate, atl, atlDate,
                rank, hotScore
              ]);

              chainInserted++;

              // Seed 7-day sparkline history points if returned by CoinGecko
              const sparklinePrices = coin.sparkline_in_7d?.price;
              if (Array.isArray(sparklinePrices) && sparklinePrices.length > 0) {
                const tokenId = insertResult.lastInsertRowid;
                // Sample 14 evenly spaced points across 7 days
                const step = Math.max(1, Math.floor(sparklinePrices.length / 14));
                for (let s = 0; s < sparklinePrices.length; s += step) {
                  const histTime = nowSec - (7 * 86400) + Math.floor((s / sparklinePrices.length) * (7 * 86400));
                  execute(`
                    INSERT INTO token_price_history (token_id, price, market_cap, volume_24h, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                  `, [tokenId, sparklinePrices[s], marketCap, volume24h, histTime]);
                }
              }
            } else {
              // Update existing token price & telemetry without modifying first_seen_at
              execute(`
                UPDATE tokens SET
                  price = ?, market_cap = ?, volume_24h = ?,
                  change_1h = ?, change_24h = ?, change_7d = ?,
                  circulating_supply = ?, total_supply = ?,
                  market_cap_rank = ?, hot_score = ?,
                  last_data_sync = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [
                price, marketCap, volume24h,
                chg1h, chg24h, chg7d,
                circSupply, totalSupply,
                rank, hotScore, existing.id
              ]);
              chainUpdated++;
            }
          }
        });

        console.log(`[TokenDiscovery] ${chain}: ${chainInserted} inserted, ${chainUpdated} updated (Total fetched: ${coins.length})`);
        totalInserted += chainInserted;
        totalUpdated += chainUpdated;
      } catch (chainErr) {
        console.warn(`[TokenDiscovery Error] Failed processing ${chain}:`, chainErr.message);
      }

      // Space calls by 1.5 - 2.0s to respect CoinGecko rate limits
      if (i < SUPPORTED_CHAINS.length - 1) {
        await new Promise(r => setTimeout(r, 1800));
      }
    }

    console.log(`[TokenDiscovery Summary] Cycle completed: ${totalInserted} new tokens inserted, ${totalUpdated} updated.`);

    // Step 3: Resolve contract addresses for newly inserted tokens
    await resolveContractAddresses(cg);
  } catch (err) {
    console.error('[TokenDiscovery Fatal Error]', err.message);
  } finally {
    isDiscovering = false;
  }
}

/**
 * Contract address resolution using CoinGecko's /coins/list?include_platform=true
 * Allows discovered tokens to work with Scanner, DexScreener enrichment, and on-chain explorers.
 */
async function resolveContractAddresses(cgInstance = null) {
  try {
    const cg = cgInstance || new CoinGeckoProvider();

    // Cache platform list for 24h to avoid heavy payload on every sync
    const isCacheStale = !platformsCache || (Date.now() - lastPlatformsFetchTime > PLATFORMS_CACHE_TTL_MS);
    if (isCacheStale) {
      console.log('[TokenDiscovery] Refreshing CoinGecko coins platform map...');
      const url = `${cg.baseUrl}/coins/list?include_platform=true`;
      const res = await fetch(url, {
        headers: cg.getHeaders(),
        signal: AbortSignal.timeout(20000)
      });

      if (!res.ok) {
        console.warn(`[TokenDiscovery Warning] Failed fetching coins list: ${res.status}`);
        return;
      }

      const list = await res.json();
      if (Array.isArray(list)) {
        platformsCache = new Map();
        for (const item of list) {
          if (item.id && item.platforms && typeof item.platforms === 'object') {
            platformsCache.set(item.id, item.platforms);
          }
        }
        lastPlatformsFetchTime = Date.now();
        console.log(`[TokenDiscovery] Platform map cached: ${platformsCache.size} coins indexed.`);
      }
    }

    if (!platformsCache || platformsCache.size === 0) {
      return;
    }

    // Query tokens with coingecko_id but missing contract_address
    const unresolvedTokens = query(`
      SELECT id, chain, coingecko_id 
      FROM tokens 
      WHERE coingecko_id IS NOT NULL 
        AND (contract_address IS NULL OR contract_address = '')
    `);

    if (!unresolvedTokens || unresolvedTokens.length === 0) {
      return;
    }

    let resolvedCount = 0;
    transaction(() => {
      for (const tok of unresolvedTokens) {
        const platforms = platformsCache.get(tok.coingecko_id);
        if (!platforms) continue;

        const chainDef = SUPPORTED_CHAINS.find(c => c.chain === tok.chain);
        if (!chainDef) continue;

        const address = platforms[chainDef.platform];
        if (address && typeof address === 'string' && address.trim().length > 4) {
          execute('UPDATE tokens SET contract_address = ? WHERE id = ?', [address.trim(), tok.id]);
          resolvedCount++;
        }
      }
    });

    if (resolvedCount > 0) {
      console.log(`[TokenDiscovery] Resolved contract addresses for ${resolvedCount} tokens.`);
    }
  } catch (err) {
    console.warn('[TokenDiscovery Address Resolution Notice]', err.message);
  }
}

module.exports = {
  discoverTokens,
  resolveContractAddresses
};
