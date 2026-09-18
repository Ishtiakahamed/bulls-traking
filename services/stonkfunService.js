const { execute } = require('../database/db');

const STONKFUN_API_BASE = 'https://www.stonkfun.xyz/api/public';
let isPolling = false;
let rateLimitResetUntil = 0;

/**
 * Poll newly launched tokens from StonkFun official public REST API
 */
async function pollNewLaunches() {
  if (isPolling) return [];
  if (Date.now() < rateLimitResetUntil) {
    console.warn(`[StonkFunService] Rate limit backoff active until ${new Date(rateLimitResetUntil).toISOString()}`);
    return [];
  }

  isPolling = true;
  console.log('[StonkFunService] Polling StonkFun newest launches...');

  try {
    const res = await fetch(`${STONKFUN_API_BASE}/v1/tokens?sort=newest&status=new&pageSize=50`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BullsTraking/1.0'
      },
      signal: AbortSignal.timeout(6000)
    });

    // Check rate limit headers
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');
    const retryAfter = res.headers.get('retry-after');

    if (res.status === 429) {
      const waitSec = retryAfter ? parseInt(retryAfter, 10) : 30;
      rateLimitResetUntil = Date.now() + (waitSec * 1000);
      console.warn(`[StonkFunService] Rate limit reached (429). Backing off for ${waitSec}s.`);
      return [];
    }

    if (remaining !== null && parseInt(remaining, 10) < 5 && reset) {
      const resetTimestamp = parseInt(reset, 10) * 1000;
      if (resetTimestamp > Date.now()) {
        rateLimitResetUntil = resetTimestamp;
      }
    }

    if (!res.ok) {
      console.warn(`[StonkFunService] API response status: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const tokens = json.data?.tokens;
    if (!Array.isArray(tokens)) {
      console.warn('[StonkFunService] Unexpected response structure (data.tokens not array)');
      return [];
    }

    console.log(`[StonkFunService] Retrieved ${tokens.length} newest tokens from StonkFun.`);
    const upsertedMints = [];

    for (const tok of tokens) {
      try {
        const mint = tok.mint;
        const pool = tok.pool || mint;
        const name = (tok.name || 'Stonk Token').slice(0, 150);
        const symbol = (tok.symbol || 'STONK').slice(0, 50);
        const logoUrl = tok.imageUrl || null;
        
        const price = parseFloat(tok.market?.priceUsd || 0);
        const liquidity = parseFloat(tok.market?.liquidityUsd || 0);
        const volume24h = parseFloat(tok.market?.volume24hUsd || 0);
        
        const websiteUrl = tok.links?.website || null;
        const twitterUrl = tok.links?.twitter || null;
        const telegramUrl = tok.links?.telegram || null;

        const pairCreatedAt = tok.createdAt 
          ? new Date(tok.createdAt).toISOString()
          : new Date().toISOString();

        const metaJson = JSON.stringify({
          quote: tok.quote || null,
          launchpad: tok.launchpad || null,
          mode: tok.mode || null,
          graduationProgress: tok.graduationProgress != null ? tok.graduationProgress : null,
          fdvUsd: tok.market?.fdvUsd || null,
          peakMarketCapUsd: tok.market?.peakMarketCapUsd || null
        });

        execute(`
          INSERT INTO new_pairs (
            chain, pair_address, token_address, name, symbol, logo_url,
            price, liquidity, volume_24h, txn_count_24h, pair_created_at,
            status, source, website_url, twitter_url, telegram_url, metadata,
            first_discovered_at, last_synced_at
          ) VALUES (
            'solana', ?, ?, ?, ?, ?,
            ?, ?, ?, 1, ?,
            'latest', 'stonkfun', ?, ?, ?, ?,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT(chain, pair_address) DO UPDATE SET
            price = excluded.price,
            liquidity = excluded.liquidity,
            volume_24h = excluded.volume_24h,
            logo_url = COALESCE(excluded.logo_url, new_pairs.logo_url),
            website_url = COALESCE(excluded.website_url, new_pairs.website_url),
            twitter_url = COALESCE(excluded.twitter_url, new_pairs.twitter_url),
            telegram_url = COALESCE(excluded.telegram_url, new_pairs.telegram_url),
            metadata = excluded.metadata,
            last_synced_at = CURRENT_TIMESTAMP
        `, [
          pool, mint, name, symbol, logoUrl,
          price, liquidity, volume24h, pairCreatedAt,
          websiteUrl, twitterUrl, telegramUrl, metaJson
        ]);

        upsertedMints.push(mint);
      } catch (tokErr) {
        // Continue processing other tokens
      }
    }

    console.log(`[StonkFunService] Successfully upserted ${upsertedMints.length} StonkFun tokens into new_pairs.`);
    return upsertedMints;
  } catch (err) {
    console.warn('[StonkFunService Polling Error]', err.message);
    return [];
  } finally {
    isPolling = false;
  }
}

module.exports = {
  pollNewLaunches
};
