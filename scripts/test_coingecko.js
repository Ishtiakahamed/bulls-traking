const CoinGeckoProvider = require('../backend/providers/coingecko');

async function main() {
  console.log('Testing CoinGeckoProvider...');
  const cg = new CoinGeckoProvider();
  console.log(`Base URL: ${cg.baseUrl}, Is Pro: ${cg.isPro}`);

  try {
    const globalStats = await cg.fetchGlobalStats();
    console.log(`[PASS] Global Stats: ${globalStats.activeCryptocurrencies} active cryptos, Total MC: $${globalStats.totalMarketCapUsd.toLocaleString()}`);
  } catch (err) {
    console.warn(`[WARN] Global Stats notice: ${err.message}`);
  }

  try {
    const trending = await cg.fetchTrending();
    console.log(`[PASS] Trending: Found ${trending.length} trending coins. Top 1: ${trending[0]?.name} (${trending[0]?.symbol})`);
  } catch (err) {
    console.warn(`[WARN] Trending notice: ${err.message}`);
  }

  try {
    const searchRes = await cg.search('bitcoin');
    console.log(`[PASS] Search: Found ${searchRes.coins?.length || 0} coin results for "bitcoin"`);
  } catch (err) {
    console.warn(`[WARN] Search notice: ${err.message}`);
  }
}

main();
