/**
 * Bulls Traking — Auto-Trading Link Generator
 * Automatically constructs verified 1-click DEX swap and pool telemetry links
 * based on the token's network chain and contract address.
 */

function normalizeChain(chain = '') {
  const c = (chain || '').toLowerCase().trim();
  if (c.includes('solana') || c === 'sol') return 'solana';
  if (c.includes('bsc') || c.includes('binance')) return 'bsc';
  if (c.includes('eth') || c === 'ethereum') return 'ethereum';
  if (c.includes('base')) return 'base';
  return c;
}

/**
 * Generate full suite of swap and analytics links for a token contract
 */
function generateAutoTradeLinks(chain, contractAddress) {
  if (!contractAddress) return null;
  const ca = contractAddress.trim();
  const c = normalizeChain(chain);

  let primaryDexName = 'DEX Swap';
  let primarySwapUrl = `https://dexscreener.com/search?q=${encodeURIComponent(ca)}`;
  const dexLinks = [];

  switch (c) {
    case 'solana':
      primaryDexName = 'Raydium';
      primarySwapUrl = `https://raydium.io/swap/?inputMint=sol&outputMint=${ca}`;
      dexLinks.push({
        name: 'Raydium',
        url: `https://raydium.io/swap/?inputMint=sol&outputMint=${ca}`,
        type: 'swap'
      });
      dexLinks.push({
        name: 'Jupiter',
        url: `https://jup.ag/swap/SOL-${ca}`,
        type: 'swap'
      });
      dexLinks.push({
        name: 'DexScreener',
        url: `https://dexscreener.com/solana/${ca}`,
        type: 'chart'
      });
      break;

    case 'bsc':
      primaryDexName = 'PancakeSwap';
      primarySwapUrl = `https://pancakeswap.finance/swap?outputCurrency=${ca}`;
      dexLinks.push({
        name: 'PancakeSwap',
        url: `https://pancakeswap.finance/swap?outputCurrency=${ca}`,
        type: 'swap'
      });
      dexLinks.push({
        name: 'DexScreener',
        url: `https://dexscreener.com/bsc/${ca}`,
        type: 'chart'
      });
      break;

    case 'ethereum':
      primaryDexName = 'Uniswap';
      primarySwapUrl = `https://app.uniswap.org/swap?outputCurrency=${ca}&chain=ethereum`;
      dexLinks.push({
        name: 'Uniswap',
        url: `https://app.uniswap.org/swap?outputCurrency=${ca}&chain=ethereum`,
        type: 'swap'
      });
      dexLinks.push({
        name: 'DexScreener',
        url: `https://dexscreener.com/ethereum/${ca}`,
        type: 'chart'
      });
      break;

    case 'base':
      primaryDexName = 'Aerodrome';
      primarySwapUrl = `https://aerodrome.finance/swap?outputCurrency=${ca}`;
      dexLinks.push({
        name: 'Aerodrome',
        url: `https://aerodrome.finance/swap?outputCurrency=${ca}`,
        type: 'swap'
      });
      dexLinks.push({
        name: 'Uniswap (Base)',
        url: `https://app.uniswap.org/swap?outputCurrency=${ca}&chain=base`,
        type: 'swap'
      });
      dexLinks.push({
        name: 'DexScreener',
        url: `https://dexscreener.com/base/${ca}`,
        type: 'chart'
      });
      break;

    default:
      dexLinks.push({
        name: 'DexScreener',
        url: `https://dexscreener.com/search?q=${encodeURIComponent(ca)}`,
        type: 'chart'
      });
  }

  return {
    primaryDexName,
    primarySwapUrl,
    dexLinks
  };
}

module.exports = {
  normalizeChain,
  generateAutoTradeLinks
};
