const config = require('../../config/default');

class CoinGeckoProvider {
  constructor() {
    this.name = 'coingecko';
    this.baseUrl = config.coingecko.baseUrl;
    this.apiKey = config.coingecko.apiKey;
    this.timeoutMs = config.coingecko.timeoutMs;
  }

  getHeaders() {
    const headers = { 'Accept': 'application/json' };
    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Fetch market data batch and normalize
   */
  async fetchMarkets({ vsCurrency = 'usd', perPage = 50, page = 1 } = {}) {
    const url = `${this.baseUrl}/coins/markets?vs_currency=${vsCurrency}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=1h,24h,7d`;
    
    const res = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return data.map(item => this.normalizeToken(item));
  }

  /**
   * Normalize CoinGecko coin item to canonical format
   */
  normalizeToken(item) {
    return {
      providerId: item.id || null,
      name: item.name || 'Unknown Token',
      symbol: (item.symbol || '').toUpperCase(),
      logo: item.image || null,
      price: parseFloat(item.current_price || 0),
      marketCap: parseFloat(item.market_cap || 0),
      volume24h: parseFloat(item.total_volume || 0),
      change1h: parseFloat(item.price_change_percentage_1h_in_currency || 0),
      change24h: parseFloat(item.price_change_percentage_24h_in_currency || item.price_change_percentage_24h || 0),
      change7d: parseFloat(item.price_change_percentage_7d_in_currency || 0),
      rank: parseInt(item.market_cap_rank, 10) || 9999,
      circulatingSupply: parseFloat(item.circulating_supply || 0),
      totalSupply: parseFloat(item.total_supply || item.circulating_supply || 0),
      ath: parseFloat(item.ath || 0),
      athDate: item.ath_date || null,
      atl: parseFloat(item.atl || 0),
      atlDate: item.atl_date || null,
      chain: 'ethereum-ecosystem',
      contractAddress: null,
      websiteUrl: null,
      xUrl: null,
      telegramUrl: null
    };
  }
}

module.exports = CoinGeckoProvider;
