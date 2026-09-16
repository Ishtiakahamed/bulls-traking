const CoinGeckoProvider = require('./coingecko');
const CoinMarketCapProvider = require('./coinmarketcap');
const config = require('../../config/default');

class MarketDataProvider {
  constructor() {
    this.coingecko = new CoinGeckoProvider();
    this.coinmarketcap = new CoinMarketCapProvider();
    this.primary = config.primaryProvider === 'coinmarketcap' ? this.coinmarketcap : this.coingecko;
    this.fallback = config.primaryProvider === 'coinmarketcap' ? this.coingecko : this.coinmarketcap;
  }

  /**
   * Fetch market data combining CoinMarketCap and CoinGecko for maximum coverage & redundancy
   */
  async fetchMarketList(options = {}) {
    const combined = [];
    const seenSymbols = new Set();

    // 1. Fetch from primary provider (e.g. CoinMarketCap Pro)
    try {
      const list = await this.primary.fetchMarkets(options);
      if (Array.isArray(list) && list.length > 0) {
        for (const item of list) {
          combined.push(item);
          if (item.symbol) seenSymbols.add(item.symbol.toUpperCase());
        }
      }
    } catch (primaryErr) {
      console.warn(`[MarketDataProvider] Primary (${this.primary.name}) notice: ${primaryErr.message}`);
    }

    // 2. Also fetch from fallback/complementary provider (e.g. CoinGecko) to merge & enrich
    try {
      const fallbackList = await this.fallback.fetchMarkets(options);
      if (Array.isArray(fallbackList) && fallbackList.length > 0) {
        for (const item of fallbackList) {
          const sym = item.symbol ? item.symbol.toUpperCase() : null;
          if (sym && seenSymbols.has(sym)) {
            // Enrich existing with CoinGecko ID, ATH, ATL, and logo if missing
            const existing = combined.find(c => (c.symbol || '').toUpperCase() === sym);
            if (existing) {
              if (!existing.coingecko_id && item.providerId) existing.coingecko_id = item.providerId;
              if (!existing.logo && item.logo) existing.logo = item.logo;
              if (!existing.ath && item.ath) {
                existing.ath = item.ath;
                existing.athDate = item.athDate;
              }
              if (!existing.atl && item.atl) {
                existing.atl = item.atl;
                existing.atlDate = item.atlDate;
              }
            }
          } else {
            combined.push(item);
            if (sym) seenSymbols.add(sym);
          }
        }
      }
    } catch (fallbackErr) {
      console.warn(`[MarketDataProvider] Secondary (${this.fallback.name}) notice: ${fallbackErr.message}`);
    }

    if (combined.length === 0) {
      throw new Error('All market data providers (CoinMarketCap & CoinGecko) failed to return market data.');
    }

    return combined;
  }

  /**
   * On-chain metadata resolution for submitted tokens (DexScreener API)
   */
  async fetchContractMetadata(chain, contractAddress) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const pair = data.pairs?.[0];
        if (pair) {
          return {
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            price: parseFloat(pair.priceUsd || 0),
            volume24h: parseFloat(pair.volume?.h24 || 0),
            marketCap: parseFloat(pair.fdv || pair.marketCap || 0),
            change24h: parseFloat(pair.priceChange?.h24 || 0),
            liquidity: parseFloat(pair.liquidity?.usd || 0),
            dexUrl: pair.url
          };
        }
      }
    } catch (e) {
      console.warn(`[MarketDataProvider] On-chain metadata resolution notice for ${contractAddress}:`, e.message);
    }
    return null;
  }
}

const marketDataProvider = new MarketDataProvider();

module.exports = {
  MarketDataProvider,
  marketDataProvider
};
