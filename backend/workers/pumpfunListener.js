const WebSocket = require('ws');
const { execute, queryOne } = require('../../database/db');

const PUMPPORTAL_WS_URL = 'wss://pumpportal.fun/api/data';
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

let wsClient = null;
let reconnectTimer = null;
let currentBackoffMs = INITIAL_BACKOFF_MS;
let isStopping = false;

/**
 * Resolve IPFS or HTTP metadata URL with fast Pinata/Cloudflare gateways
 */
function normalizeIpfsUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  const hashMatch = trimmed.match(/(?:ipfs\/|ipfs:\/\/)([a-zA-Z0-9_-]+)/);
  if (hashMatch && hashMatch[1]) {
    return `https://pump.mypinata.cloud/ipfs/${hashMatch[1]}`;
  }
  return trimmed;
}

/**
 * Fetch off-chain metadata JSON with high-reliability IPFS gateway fallback
 */
async function fetchTokenMetadata(uri) {
  if (!uri) return null;
  const hashMatch = uri.match(/(?:ipfs\/|ipfs:\/\/)([a-zA-Z0-9_-]+)/);
  const hash = hashMatch ? hashMatch[1] : null;

  const gateways = hash
    ? [
        `https://pump.mypinata.cloud/ipfs/${hash}`,
        `https://cf-ipfs.com/ipfs/${hash}`,
        `https://gateway.pinata.cloud/ipfs/${hash}`,
        `https://ipfs.tribecap.co/ipfs/${hash}`
      ]
    : [uri];

  for (const gw of gateways) {
    try {
      const res = await fetch(gw, {
        signal: AbortSignal.timeout(3500),
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (_) {
      // Continue to next gateway
    }
  }
  return null;
}

/**
 * Process new token event from PumpPortal
 */
async function handleNewTokenEvent(event) {
  if (!event || !event.mint) return;

  try {
    const mint = event.mint;
    const pairAddress = event.bondingCurveKey || mint;
    const rawName = (event.name || '').trim() || 'Pump Token';
    const rawSymbol = (event.symbol || '').trim() || 'PUMP';

    // Fetch off-chain metadata if uri provided
    let metadata = null;
    if (event.uri) {
      metadata = await fetchTokenMetadata(event.uri);
    }

    const name = (metadata?.name || rawName).slice(0, 150);
    const symbol = (metadata?.symbol || rawSymbol).slice(0, 50);
    const logoUrl = normalizeIpfsUri(metadata?.image || metadata?.icon) || null;
    const websiteUrl = metadata?.website || metadata?.external_url || null;
    const twitterUrl = metadata?.twitter || null;
    const telegramUrl = metadata?.telegram || null;

    // Get current SOL price estimate
    const solRow = queryOne("SELECT price FROM tokens WHERE symbol = 'SOL' AND chain = 'solana'");
    const solPrice = (solRow && solRow.price > 0) ? solRow.price : 150.0;

    const vSol = parseFloat(event.vSolInBondingCurve || 30.0);
    const mCapSol = parseFloat(event.marketCapSol || 28.0);
    const liquidityUsd = vSol * solPrice;
    const mCapUsd = mCapSol * solPrice;
    // Standard pump.fun initial token supply is 1,000,000,000
    const priceUsd = mCapUsd > 0 ? (mCapUsd / 1000000000) : 0.00003;
    const initialBuyVol = parseFloat(event.solAmount || 0) * solPrice;

    const pairCreatedAt = new Date().toISOString();
    const metaJson = JSON.stringify({
      uri: event.uri || null,
      marketCapSol: event.marketCapSol || null,
      vSolInBondingCurve: event.vSolInBondingCurve || null,
      signature: event.signature || null,
      bondingCurveKey: event.bondingCurveKey || null,
      traderPublicKey: event.traderPublicKey || null
    });

    execute(`
      INSERT INTO new_pairs (
        chain, pair_address, token_address, name, symbol, logo_url,
        price, liquidity, volume_24h, txn_count_24h, pair_created_at,
        status, source, website_url, twitter_url, telegram_url, metadata,
        first_discovered_at, last_synced_at
      ) VALUES (
        'solana', ?, ?, ?, ?, ?,
        ?, ?, ?, 1, ?,
        'latest', 'pumpfun', ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT(chain, pair_address) DO UPDATE SET
        price = excluded.price,
        liquidity = excluded.liquidity,
        volume_24h = excluded.volume_24h,
        logo_url = COALESCE(excluded.logo_url, new_pairs.logo_url),
        website_url = COALESCE(excluded.website_url, new_pairs.website_url),
        twitter_url = COALESCE(excluded.twitter_url, new_pairs.twitter_url),
        telegram_url = COALESCE(excluded.telegram_url, new_pairs.telegram_url),
        last_synced_at = CURRENT_TIMESTAMP
    `, [
      pairAddress, mint, name, symbol, logoUrl,
      priceUsd, liquidityUsd, initialBuyVol, pairCreatedAt,
      websiteUrl, twitterUrl, telegramUrl, metaJson
    ]);

    try {
      const { broadcast } = require('../websocket/wsServer');
      broadcast({
        type: 'NEW_PAIR',
        data: {
          chain: 'solana',
          pair_address: pairAddress,
          token_address: mint,
          name,
          symbol,
          logo_url: logoUrl,
          price: priceUsd,
          liquidity: liquidityUsd,
          volume_24h: initialBuyVol,
          txn_count_24h: 1,
          pair_created_at: pairCreatedAt,
          status: 'latest',
          source: 'pumpfun',
          website_url: websiteUrl,
          twitter_url: twitterUrl,
          telegram_url: telegramUrl
        }
      });
    } catch (_) {}

    console.log(`[PumpFunListener] Indexed new pump.fun launch: ${symbol} (${name}) [${mint.slice(0, 8)}...]`);
  } catch (err) {
    console.warn('[PumpFunListener] Error processing token:', err.message);
  }
}

/**
 * Connect to PumpPortal WebSocket with exponential backoff
 */
function connectPumpfunWs() {
  if (isStopping) return;

  console.log('[PumpFunListener] Connecting to PumpPortal stream...');

  try {
    wsClient = new WebSocket(PUMPPORTAL_WS_URL);

    wsClient.on('open', () => {
      console.log('[PumpFunListener] WebSocket connected. Subscribing to new token creation events...');
      currentBackoffMs = INITIAL_BACKOFF_MS; // reset backoff on success
      wsClient.send(JSON.stringify({ method: 'subscribeNewToken' }));
    });

    wsClient.on('message', (rawData) => {
      try {
        const payload = JSON.parse(rawData.toString());
        if (payload.txType === 'create' && payload.mint) {
          handleNewTokenEvent(payload);
        }
      } catch (parseErr) {
        // Ignore unparseable or ping frames
      }
    });

    wsClient.on('close', (code, reason) => {
      console.warn(`[PumpFunListener] Connection closed (${code}). Reconnecting in ${currentBackoffMs / 1000}s...`);
      scheduleReconnect();
    });

    wsClient.on('error', (err) => {
      console.warn('[PumpFunListener] WebSocket error:', err.message);
      // 'close' handler will trigger reconnect
    });

  } catch (err) {
    console.warn('[PumpFunListener] Connection attempt failed:', err.message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (isStopping) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectTimer = setTimeout(() => {
    currentBackoffMs = Math.min(currentBackoffMs * 1.5, MAX_BACKOFF_MS);
    connectPumpfunWs();
  }, currentBackoffMs);
}

function startPumpfunListener() {
  isStopping = false;
  connectPumpfunWs();
}

function stopPumpfunListener() {
  isStopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (wsClient) {
    try {
      wsClient.close();
    } catch (_) {}
    wsClient = null;
  }
  console.log('[PumpFunListener] Stopped.');
}

module.exports = {
  startPumpfunListener,
  stopPumpfunListener,
  handleNewTokenEvent,
  fetchTokenMetadata
};
