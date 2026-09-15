const config = require('../../config/default');

class CoinGeckoProvider {
  constructor() {
    this.name = 'coingecko';
    
    // Support Pro API Key, Demo API Key, or Free Keyless
    const proKey = process.env.COINGECKO_PRO_API_KEY || (process.env.COINGECKO_PLAN === 'pro' ? process.env.COINGECKO_API_KEY : null);
    const demoKey = process.env.COINGECKO_DEMO_API_KEY || (process.env.COINGECKO_PLAN !== 'pro' ? (process.env.COINGECKO_API_KEY || config.coingecko.apiKey) : null);

    if (proKey) {
      this.baseUrl = 'https://pro-api.coingecko.com/api/v3';
      this.authHeader = { 'x-cg-pro-api-key': proKey };
      this.isPro = true;
    } else if (demoKey) {
      this.baseUrl = 'https://api.coingecko.com/api/v3';
      this.authHeader = { 'x-cg-demo-api-key': demoKey };
      this.isPro = false;
    } else {
      this.baseUrl = config.coingecko.baseUrl || 'https://api.coingecko.com/api/v3';
      this.authHeader = {};
      this.isPro = false;
    }

    this.timeoutMs = config.coingecko.timeoutMs || 8000;
  }

  getHeaders() {
    return {
      'Accept': 'application/json',
      ...this.authHeader
    };
  }

  /**
   * Fetch market data batch and normalize
   */
  async fetchMarkets({ vsCurrency = 'usd', perPage = 50, page = 1, ids = null, category = null } = {}) {
    let url = `${this.baseUrl}/coins/markets?vs_currency=${vsCurrency}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false&price_change_percentage=1h,24h,7d`;
    if (ids) url += `&ids=${encodeURIComponent(ids)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;

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
   * Fetch Trending Search Coins (Top 15 trending coins on CoinGecko)
   */
  async fetchTrending() {
    const url = `${this.baseUrl}/search/trending`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`CoinGecko Trending HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.coins || []).map(entry => {
      const coin = entry.item;
      return {
        id: coin.id,
        name: coin.name,
        symbol: (coin.symbol || '').toUpperCase(),
        marketCapRank: coin.market_cap_rank,
        thumb: coin.thumb,
        large: coin.large,
        priceBtc: coin.price_btc,
        data: coin.data || {}
      };
    });
  }

  /**
   * Fetch Global Cryptocurrency Market Statistics
   */
  async fetchGlobalStats() {
    const url = `${this.baseUrl}/global`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`CoinGecko Global HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const g = data.data || {};
    return {
      activeCryptocurrencies: g.active_cryptocurrencies || 0,
      totalMarketCapUsd: g.total_market_cap?.usd || 0,
      totalVolume24hUsd: g.total_volume?.usd || 0,
      marketCapPercentageBtc: g.market_cap_percentage?.btc || 0,
      marketCapPercentageEth: g.market_cap_percentage?.eth || 0,
      marketCapChangePercentage24hUsd: g.market_cap_change_percentage_24h_usd || 0
    };
  }

  /**
   * Search for coins, categories, and markets
   */
  async search(query) {
    const url = `${this.baseUrl}/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`CoinGecko Search HTTP ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * GeckoTerminal / On-chain Pool Data
   */
  async fetchOnchainPools(network, poolAddress) {
    const url = `${this.baseUrl}/onchain/networks/${encodeURIComponent(network)}/pools/${encodeURIComponent(poolAddress)}`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`CoinGecko Onchain HTTP ${res.status}: ${res.statusText}`);
    }

    return await res.json();
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
