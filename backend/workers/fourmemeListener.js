const { ethers } = require('ethers');
const { execute, queryOne } = require('../../database/db');

const FOURMEME_CONTRACT = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
const BSC_WS_RPC = 'wss://bsc-rpc.publicnode.com';
const BSC_HTTP_RPCS = [
  'https://bsc-rpc.publicnode.com',
  'https://1rpc.io/bnb',
  'https://rpc.ankr.com/bsc'
];

const FOURMEME_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: 'address', name: 'creator', type: 'address' },
      { indexed: false, internalType: 'address', name: 'token', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'requestId', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      { indexed: false, internalType: 'string', name: 'symbol', type: 'string' },
      { indexed: false, internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'launchTime', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'launchFee', type: 'uint256' }
    ],
    name: 'TokenCreate',
    type: 'event'
  }
];

const iface = new ethers.Interface(FOURMEME_ABI);
const TOKEN_CREATE_TOPIC = iface.getEvent('TokenCreate').topicHash;

let wsProvider = null;
let reconnectTimer = null;
let pollInterval = null;
let lastProcessedBlock = 0;
let isStopping = false;
let currentBackoffMs = 2000;
const MAX_BACKOFF_MS = 30000;

/**
 * Fetch off-chain token enrichment from four.meme private API
 */
async function enrichFourmemeToken(tokenAddress) {
  if (!tokenAddress) return null;
  try {
    const res = await fetch(`https://four.meme/meme-api/v1/private/token/get?address=${tokenAddress}`, {
      signal: AbortSignal.timeout(4000),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BullsTraking/1.0'
      }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.code === 0 && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    // Best-effort enrichment: non-fatal
    return null;
  }
}

/**
 * Process a decoded or raw TokenCreate log
 */
async function processTokenCreateLog(log) {
  try {
    let decoded;
    try {
      decoded = iface.decodeEventLog('TokenCreate', log.data, log.topics);
    } catch (dErr) {
      return;
    }

    const tokenAddress = decoded.token;
    const creator = decoded.creator;
    const rawName = decoded.name || 'four.meme Token';
    const rawSymbol = decoded.symbol || 'FOUR';

    // Optional best-effort enrichment
    const enrich = await enrichFourmemeToken(tokenAddress);

    const name = (enrich?.name || rawName).slice(0, 150);
    const symbol = (enrich?.symbol || rawSymbol).slice(0, 50);
    const logoUrl = enrich?.image || null;
    const websiteUrl = enrich?.webUrl || null;
    const twitterUrl = enrich?.twitterUrl || null;
    const telegramUrl = enrich?.telegramUrl || null;

    // Get current BNB price for USD conversion
    const bnbRow = queryOne("SELECT price FROM tokens WHERE (symbol = 'BNB' OR symbol = 'WBNB') AND (chain = 'bsc' OR chain = 'binance-smart-chain')");
    const bnbPrice = (bnbRow && bnbRow.price > 0) ? bnbRow.price : 600.0;

    let priceUsd = 0;
    let liquidityUsd = 0;
    let volume24h = 0;

    if (enrich?.tokenPrice) {
      const priceBnb = parseFloat(enrich.tokenPrice.price || 0);
      const bamountBnb = parseFloat(enrich.tokenPrice.bamount || 20.0);
      const tradingBnb = parseFloat(enrich.tokenPrice.trading || 0);

      priceUsd = priceBnb * bnbPrice;
      liquidityUsd = bamountBnb * bnbPrice;
      volume24h = tradingBnb * bnbPrice;
    } else {
      // Default initial bonding curve liquidity ~20 BNB
      liquidityUsd = 20.0 * bnbPrice;
      priceUsd = 0.00000002 * bnbPrice;
    }

    const pairCreatedAt = enrich?.createDate 
      ? new Date(parseInt(enrich.createDate, 10)).toISOString()
      : new Date().toISOString();

    const metaJson = JSON.stringify({
      creator,
      requestId: decoded.requestId ? decoded.requestId.toString() : null,
      totalSupply: decoded.totalSupply ? decoded.totalSupply.toString() : null,
      launchFee: decoded.launchFee ? decoded.launchFee.toString() : null,
      txHash: log.transactionHash || null,
      blockNumber: log.blockNumber || null,
      descr: enrich?.descr || null
    });

    execute(`
      INSERT INTO new_pairs (
        chain, pair_address, token_address, name, symbol, logo_url,
        price, liquidity, volume_24h, txn_count_24h, pair_created_at,
        status, source, website_url, twitter_url, telegram_url, metadata,
        first_discovered_at, last_synced_at
      ) VALUES (
        'bsc', ?, ?, ?, ?, ?,
        ?, ?, ?, 1, ?,
        'latest', 'fourmeme', ?, ?, ?, ?,
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
      tokenAddress, tokenAddress, name, symbol, logoUrl,
      priceUsd, liquidityUsd, volume24h, pairCreatedAt,
      websiteUrl, twitterUrl, telegramUrl, metaJson
    ]);

    // If logo was not available on immediate block creation, schedule a delayed retry to fetch after indexation
    if (!logoUrl) {
      setTimeout(async () => {
        try {
          const retryEnrich = await enrichFourmemeToken(tokenAddress);
          if (retryEnrich && retryEnrich.image) {
            execute(`
              UPDATE new_pairs SET 
                logo_url = ?, 
                website_url = COALESCE(?, website_url),
                twitter_url = COALESCE(?, twitter_url),
                telegram_url = COALESCE(?, telegram_url)
              WHERE chain = 'bsc' AND pair_address = ?
            `, [retryEnrich.image, retryEnrich.webUrl || null, retryEnrich.twitterUrl || null, retryEnrich.telegramUrl || null, tokenAddress]);
          }
        } catch (_) {}
      }, 4000);
    }

    console.log(`[FourMemeListener] Indexed four.meme launch: ${symbol} (${name}) [${tokenAddress.slice(0, 8)}...]`);
  } catch (err) {
    console.warn('[FourMemeListener] Failed to process log:', err.message);
  }
}

/**
 * Fallback polling of eth_getLogs over HTTPS BSC RPC
 */
async function pollFourmemeLogs() {
  if (isStopping) return;

  try {
    const rpcUrl = 'https://bsc-rpc.publicnode.com';
    const blockRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(4000)
    });
    if (!blockRes.ok) return;
    const blockData = await blockRes.json();
    const currentBlock = parseInt(blockData.result, 16);
    if (!currentBlock || isNaN(currentBlock)) return;

    if (lastProcessedBlock === 0) {
      lastProcessedBlock = currentBlock - 20;
    }

    const fromBlock = lastProcessedBlock + 1;
    const toBlock = currentBlock;
    if (fromBlock > toBlock) return;

    const logsRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getLogs',
        params: [{
          address: FOURMEME_CONTRACT,
          topics: [TOKEN_CREATE_TOPIC],
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: '0x' + toBlock.toString(16)
        }]
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!logsRes.ok) return;
    const logsData = await logsRes.json();
    const logs = logsData.result || [];
    lastProcessedBlock = toBlock;

    for (const log of logs) {
      await processTokenCreateLog(log);
    }
  } catch (err) {
    // Non-fatal
  }
}

/**
 * Start WebSocket listener with fallback to polling
 */
async function connectFourmemeWs() {
  if (isStopping) return;

  console.log('[FourMemeListener] Connecting to BSC RPC WebSocket...');

  try {
    wsProvider = new ethers.WebSocketProvider(BSC_WS_RPC);

    const filter = {
      address: FOURMEME_CONTRACT,
      topics: [TOKEN_CREATE_TOPIC]
    };

    wsProvider.on(filter, async (log) => {
      await processTokenCreateLog(log);
    });

    console.log('[FourMemeListener] Subscribed to TokenCreate events on 0x5c952063c7fc8610ffdb798152d69f0b9550762b');
    currentBackoffMs = 2000;

    // Listen for provider drops
    wsProvider.websocket.onclose = () => {
      console.warn(`[FourMemeListener] WS dropped. Reconnecting in ${currentBackoffMs / 1000}s...`);
      scheduleWsReconnect();
    };

    wsProvider.websocket.onerror = (e) => {
      console.warn('[FourMemeListener] WS provider error:', e.message || 'unknown');
    };

  } catch (err) {
    console.warn('[FourMemeListener] WS connection failed:', err.message);
    scheduleWsReconnect();
  }
}

function scheduleWsReconnect() {
  if (isStopping) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectTimer = setTimeout(() => {
    currentBackoffMs = Math.min(currentBackoffMs * 1.5, MAX_BACKOFF_MS);
    connectFourmemeWs();
  }, currentBackoffMs);
}

function startFourmemeListener() {
  isStopping = false;
  // 1. Start live WebSocket listener
  connectFourmemeWs();

  // 2. Start periodic fallback poller (every 35s) to guarantee no events are missed on WS reconnects
  pollFourmemeLogs();
  pollInterval = setInterval(pollFourmemeLogs, 35000);
}

function stopFourmemeListener() {
  isStopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pollInterval) clearInterval(pollInterval);
  if (wsProvider) {
    try {
      wsProvider.destroy();
    } catch (_) {}
    wsProvider = null;
  }
  console.log('[FourMemeListener] Stopped.');
}

module.exports = {
  startFourmemeListener,
  stopFourmemeListener,
  pollFourmemeLogs,
  processTokenCreateLog,
  enrichFourmemeToken
};
