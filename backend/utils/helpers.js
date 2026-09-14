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
 * Validate contract address format based on chain
 */
function isValidContractAddress(chain, address) {
  if (!address || typeof address !== 'string') return false;
  const clean = address.trim();

  if (chain === 'solana-ecosystem') {
    // Solana base58 address length is typically 32-44 characters
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
  }

  // EVM (Ethereum, BSC, Base) 0x + 40 hex chars
  return /^0x[a-fA-F0-9]{40}$/.test(clean);
}

module.exports = {
  calculateTokenAge,
  isValidContractAddress
};
