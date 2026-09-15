const { query, execute, transaction } = require('../../database/db');
const { marketDataProvider } = require('../providers');
const { calculateHotScore } = require('../services/hotScoreService');
const config = require('../../config/default');

let isRunning = false;
let lastSyncStatus = {
  lastSyncAt: new Date().toISOString(),
  providerStatus: 'live',
  tokensSynced: 0
};

/**
 * Scheduled Market Sync Worker (Section 27)
 */
async function syncMarketData() {
  if (isRunning) return;
  isRunning = true;
  console.log('[SyncWorker] Initiating market data synchronization...');

  try {
    const marketList = await marketDataProvider.fetchMarketList({ perPage: 50, page: 1 });
    const marketMap = new Map();
    for (const item of marketList) {
      if (item.providerId) {
        marketMap.set(item.providerId.toLowerCase(), item);
      }
      if (item.id) {
        marketMap.set(item.id.toLowerCase(), item);
      }
      if (item.symbol) {
        marketMap.set(item.symbol.toLowerCase(), item);
      }
    }

    const currentTokens = query(`SELECT * FROM tokens WHERE is_active = 1`);
    const nowSec = Math.floor(Date.now() / 1000);

    // Fetch DexScreener on-chain metrics (TXN count, LP / liquidity, 6h price change)
    const dexMetricsMap = new Map();
    await Promise.allSettled(
      currentTokens
        .filter(t => t.contract_address && !t.contract_address.startsWith('0x0000000000000000000000000000000000000000') && t.contract_address.length > 8)
        .map(async (tok) => {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tok.contract_address}`, {
              signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
              const json = await res.json();
              const pair = json.pairs?.[0];
              if (pair) {
                const buys = parseInt(pair.txns?.h24?.buys || 0, 10);
                const sells = parseInt(pair.txns?.h24?.sells || 0, 10);
                dexMetricsMap.set(tok.id, {
                  txn_count_24h: buys + sells,
                  liquidity: parseFloat(pair.liquidity?.usd || 0),
                  price_change_6h: parseFloat(pair.priceChange?.h6 || 0)
                });
              }
            }
          } catch (dexErr) {
            // Non-fatal DexScreener fallback to 0/null
          }
        })
    );

    transaction(() => {
      for (const tok of currentTokens) {
        // Look up by CoinGecko stable ID first; fall back to symbol only if coingecko_id is null
        let live = null;
        if (tok.coingecko_id) {
          live = marketMap.get(tok.coingecko_id.toLowerCase());
        }
        if (!live && tok.symbol) {
          live = marketMap.get(tok.symbol.toLowerCase());
        }

        let newPrice = tok.price;
        let newCap = tok.market_cap;
        let newVol = tok.volume_24h;
        let chg1h = tok.change_1h;
        let chg24 = tok.change_24h;
        let chg7d = tok.change_7d;

        if (live) {
          newPrice = live.price;
          newCap = live.marketCap;
          newVol = live.volume24h;
          chg1h = live.change1h;
          chg24 = live.change24h;
          chg7d = live.change7d;
        }

        const hotScore = calculateHotScore({
          volume_24h: newVol,
          change_24h: chg24,
          change_1h: chg1h,
          market_cap: newCap
        });

        const dex = dexMetricsMap.get(tok.id);
        const txnCount = dex ? dex.txn_count_24h : (tok.txn_count_24h || 0);
        const liquidity = dex ? dex.liquidity : (tok.liquidity || 0);
        const chg6h = dex ? dex.price_change_6h : (tok.price_change_6h || 0);

        execute(`
          UPDATE tokens SET 
            price = ?, market_cap = ?, volume_24h = ?,
            change_1h = ?, change_24h = ?, change_7d = ?,
            hot_score = ?, txn_count_24h = ?, liquidity = ?, price_change_6h = ?,
            last_data_sync = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newPrice, newCap, newVol, chg1h, chg24, chg7d, hotScore, txnCount, liquidity, chg6h, tok.id]);

        // Historical snapshot for 7-day chart (sample)
        execute(`
          INSERT INTO token_price_history (token_id, price, market_cap, volume_24h, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `, [tok.id, newPrice, newCap, newVol, nowSec]);

        // Retain last 30 historical snapshots per token
        execute(`
          DELETE FROM token_price_history 
          WHERE token_id = ? AND id NOT IN (
            SELECT id FROM token_price_history WHERE token_id = ? ORDER BY timestamp DESC LIMIT 30
          )
        `, [tok.id, tok.id]);
      }

      // Recalculate market cap ranks
      const rankedTokens = query(`SELECT id FROM tokens WHERE is_active = 1 ORDER BY market_cap DESC`);
      rankedTokens.forEach((t, idx) => {
        execute(`UPDATE tokens SET market_cap_rank = ? WHERE id = ?`, [idx + 1, t.id]);
      });
    });

    lastSyncStatus = {
      lastSyncAt: new Date().toISOString(),
      providerStatus: 'live',
      tokensSynced: currentTokens.length
    };
    console.log(`[SyncWorker] Market synchronization completed successfully for ${currentTokens.length} tokens.`);
  } catch (err) {
    console.warn('[SyncWorker Notice] Provider reach limitation (cached telemetry preserved):', err.message);
    lastSyncStatus.providerStatus = 'delayed';
  } finally {
    isRunning = false;
  }
}

function getSyncStatus() {
  return lastSyncStatus;
}

const { discoverNewPairs } = require('../../services/newPairsService');
const { discoverTokens, resolveContractAddresses } = require('../../services/tokenDiscoveryService');

function startSyncWorker() {
  console.log(`[SyncWorker] Registered with ${config.syncIntervalMs / 1000}s interval.`);
  // Run initial sync after 2 seconds
  setTimeout(syncMarketData, 2000);
  const marketInterval = setInterval(syncMarketData, config.syncIntervalMs);

  // Phase 3: Start New Pairs on-chain discovery feed (DexScreener profile polling)
  console.log(`[NewPairsWorker] Registered with ${config.newPairsSyncIntervalMs / 1000}s interval.`);
  setTimeout(discoverNewPairs, 4000);
  const newPairsInterval = setInterval(discoverNewPairs, config.newPairsSyncIntervalMs);

  // Token Discovery Worker: Expand token pool across chains via CoinGecko
  console.log(`[TokenDiscovery] Registered with ${config.tokenDiscoveryIntervalMs / 1000}s interval.`);
  setTimeout(async () => {
    try {
      await discoverTokens();
      await resolveContractAddresses();
    } catch (err) {
      console.warn('[TokenDiscovery Startup Error]', err.message);
    }
  }, 6000);
  const discoveryInterval = setInterval(async () => {
    try {
      await discoverTokens();
      await resolveContractAddresses();
    } catch (err) {
      console.warn('[TokenDiscovery Interval Error]', err.message);
    }
  }, config.tokenDiscoveryIntervalMs);

  // Phase 3: Telegram Ingestion Worker
  const { startTelegramWorker } = require('./telegramIngestWorker');
  startTelegramWorker();

  return { marketInterval, newPairsInterval, discoveryInterval };
}

module.exports = {
  syncMarketData,
  startSyncWorker,
  getSyncStatus
};
