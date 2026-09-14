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
   * Fetch market data with automatic fallback
   */
  async fetchMarketList(options = {}) {
    try {
      return await this.primary.fetchMarkets(options);
    } catch (primaryErr) {
      console.warn(`[MarketDataProvider] Primary (${this.primary.name}) failed: ${primaryErr.message}. Attempting fallback...`);
      try {
        return await this.fallback.fetchMarkets(options);
      } catch (fallbackErr) {
        console.warn(`[MarketDataProvider] Fallback (${this.fallback.name}) failed: ${fallbackErr.message}`);
        throw new Error(`All market data providers failed. Primary: ${primaryErr.message}, Fallback: ${fallbackErr.message}`);
      }
    }
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
