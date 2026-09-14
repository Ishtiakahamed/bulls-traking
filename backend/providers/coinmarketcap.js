const config = require('../../config/default');

class CoinMarketCapProvider {
  constructor() {
    this.name = 'coinmarketcap';
    this.baseUrl = config.coinmarketcap.baseUrl;
    this.apiKey = process.env.COINMARKETCAP_API_KEY || config.coinmarketcap.apiKey;
    this.timeoutMs = config.coinmarketcap.timeoutMs;
  }

  getHeaders() {
    const key = process.env.COINMARKETCAP_API_KEY || this.apiKey;
    const headers = { 'Accept': 'application/json' };
    if (key) {
      headers['X-CMC_PRO_API_KEY'] = key;
    }
    return headers;
  }

  /**
   * Fetch market data batch and normalize
   */
  async fetchMarkets({ perPage = 50, limit = 50, start = 1 } = {}) {
    const key = process.env.COINMARKETCAP_API_KEY || this.apiKey;
    if (!key) {
      throw new Error('CoinMarketCap API key not configured.');
    }

    const count = limit || perPage || 50;
    const url = `${this.baseUrl}/cryptocurrency/listings/latest?start=${start}&limit=${count}&convert=USD`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`CoinMarketCap HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    return (json.data || []).map(item => this.normalizeToken(item));
  }

  /**
   * Normalize CoinMarketCap item to canonical format
   */
  normalizeToken(item) {
    const quote = item.quote?.USD || {};
    const cmcLogo = item.id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${item.id}.png` : null;

    return {
      providerId: String(item.id),
      name: item.name,
      symbol: (item.symbol || '').toUpperCase(),
      logo: cmcLogo,
      price: parseFloat(quote.price || 0),
      marketCap: parseFloat(quote.market_cap || 0),
      volume24h: parseFloat(quote.volume_24h || 0),
      change1h: parseFloat(quote.percent_change_1h || 0),
      change24h: parseFloat(quote.percent_change_24h || 0),
      change7d: parseFloat(quote.percent_change_7d || 0),
      rank: parseInt(item.cmc_rank, 10) || 9999,
      circulatingSupply: parseFloat(item.circulating_supply || 0),
      totalSupply: parseFloat(item.total_supply || 0),
      ath: 0,
      athDate: null,
      atl: 0,
      atlDate: null,
      chain: 'ethereum-ecosystem',
      contractAddress: null,
      websiteUrl: null,
      xUrl: null,
      telegramUrl: null
    };
  }
}

module.exports = CoinMarketCapProvider;
