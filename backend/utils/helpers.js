/**
 * Bulls Traking — Universal Utility Helpers
 */

/**
 * Calculate human-readable Token Age (Section 44)
 * Returns: '12m', '3h', '2d', '7d'
 */
function calculateTokenAge(firstSeenAt) {
  if (!firstSeenAt) return '1d';
  const diffMs = Date.now() - new Date(firstSeenAt).getTime();
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

/**
 * Canonical chain normalizer
 * Converts aliases (solana, bsc, eth, base) to canonical schema values
 */
function normalizeChain(chain) {
  if (!chain || typeof chain !== 'string') return 'solana-ecosystem';
  const c = chain.trim().toLowerCase();

  if (c === 'solana' || c === 'sol' || c === 'solana-ecosystem') {
    return 'solana-ecosystem';
  }
  if (c === 'bsc' || c === 'binance' || c === 'bnb' || c === 'binance-smart-chain') {
    return 'binance-smart-chain';
  }
  if (c === 'ethereum' || c === 'eth' || c === 'ethereum-ecosystem') {
    return 'ethereum-ecosystem';
  }
  if (c === 'base' || c === 'base-ecosystem') {
    return 'base-ecosystem';
  }
  return c;
}

/**
 * Get all database match aliases for a given chain filter
 */
function getChainAliases(chain) {
  if (!chain || chain === 'all') return null;
  const c = chain.trim().toLowerCase();

  if (c === 'solana' || c === 'sol' || c === 'solana-ecosystem') {
    return ['solana-ecosystem', 'solana', 'sol'];
  }
  if (c === 'bsc' || c === 'binance' || c === 'bnb' || c === 'binance-smart-chain') {
    return ['binance-smart-chain', 'bsc', 'bnb'];
  }
  if (c === 'ethereum' || c === 'eth' || c === 'ethereum-ecosystem') {
    return ['ethereum-ecosystem', 'ethereum', 'eth'];
  }
  if (c === 'base' || c === 'base-ecosystem') {
    return ['base-ecosystem', 'base'];
  }
  return [chain];
}

/**
 * Validate contract address format based on chain
 */
function isValidContractAddress(chain, address) {
  if (!address || typeof address !== 'string') return false;
  const clean = address.trim();
  const norm = normalizeChain(chain);

  if (norm === 'solana-ecosystem') {
    // Solana address: typically base58, 32-44 chars, accept alphanumeric 32-50 chars
    return /^[0-9A-Za-z]{32,50}$/.test(clean);
  }

  // EVM (Ethereum, BSC, Base) 0x + 40 hex chars
  if (/^0x[a-fA-F0-9]{40}$/.test(clean)) {
    return true;
  }

  // Permissive fallback: if user pasted Solana address into EVM or vice versa
  if (/^[0-9A-Za-z]{32,50}$/.test(clean) || /^0x[a-fA-F0-9]{40}$/.test(clean)) {
    return true;
  }

  return false;
}

module.exports = {
  calculateTokenAge,
  normalizeChain,
  getChainAliases,
  isValidContractAddress
};
