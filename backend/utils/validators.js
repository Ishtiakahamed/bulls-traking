/**
 * Bulls Traking — Server-side Input Validation & Sanitization Helper
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'internal',
  'metadata.google.internal'
]);

function isPrivateIpOrHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true;

  // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
  const parts = h.split('.').map(p => parseInt(p, 10));
  if (parts.length === 4 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function validateHttpsUrl(urlStr, options = {}) {
  const { allowInternal = false, maxLen = 2048 } = options;
  if (!urlStr || typeof urlStr !== 'string') {
    throw new Error('URL is required and must be a string.');
  }

  const trimmed = urlStr.trim();
  if (trimmed.length > maxLen) {
    throw new Error(`URL exceeds maximum length of ${maxLen} characters.`);
  }

  // Check for dangerous URI schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('ftp:') ||
    lower.startsWith('//')
  ) {
    throw new Error('Dangerous or unsupported URL scheme detected.');
  }

  if (allowInternal && (trimmed.startsWith('#/') || trimmed.startsWith('/#') || trimmed.startsWith('/'))) {
    return trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    throw new Error('Malformed URL provided.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only secure https:// URLs are allowed for external destinations.');
  }

  if (isPrivateIpOrHost(parsed.hostname)) {
    throw new Error('Localhost and private network destinations are not permitted.');
  }

  return parsed.toString();
}

function validateContractAddress(address, chain = 'bsc') {
  if (!address || typeof address !== 'string') {
    throw new Error('Contract address is required.');
  }

  const cleanAddr = address.trim();
  const cleanChain = (chain || 'bsc').toLowerCase();

  if (cleanChain === 'solana' || cleanChain === 'solana-ecosystem') {
    // Solana base58 address: 32 to 44 base58 characters
    const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!solanaRegex.test(cleanAddr)) {
      throw new Error(`Invalid Solana mint address format: "${cleanAddr}". Expected 32-44 Base58 characters.`);
    }
  } else {
    // EVM address: 0x followed by 40 hex chars
    const evmRegex = /^0x[0-9a-fA-F]{40}$/;
    if (!evmRegex.test(cleanAddr)) {
      throw new Error(`Invalid EVM contract address format for ${chain}: "${cleanAddr}". Expected 0x followed by 40 hex characters.`);
    }
  }

  return cleanAddr;
}

function validateTextLength(value, maxLen, fieldName = 'Field') {
  if (value == null) return '';
  const str = String(value).trim();
  if (str.length > maxLen) {
    throw new Error(`${fieldName} exceeds maximum allowed length of ${maxLen} characters.`);
  }
  return str;
}

module.exports = {
  validateHttpsUrl,
  validateContractAddress,
  validateTextLength,
  isPrivateIpOrHost
};
