const { WebSocket } = require('ws');
const { query, queryOne, execute, transaction } = require('../../database/db');
const { broadcast } = require('./wsServer');

// Supported real-time symbol mappings from public exchange stream
const SYMBOL_MAP = {
  'BTCUSDT': 'BTC',
  'ETHUSDT': 'ETH',
  'BNBUSDT': 'BNB',
  'SOLUSDT': 'SOL',
  'XRPUSDT': 'XRP',
  'DOGEUSDT': 'DOGE',
  'ADAUSDT': 'ADA',
  'TRXUSDT': 'TRX',
  'LINKUSDT': 'LINK',
  'AVAXUSDT': 'AVAX',
  'SUIUSDT': 'SUI',
  'NEARUSDT': 'NEAR',
  'PEPEUSDT': 'PEPE',
  'SHIBUSDT': 'SHIB',
  'LTCUSDT': 'LTC',
  'WIFUSDT': 'WIF',
  'BONKUSDT': 'BONK',
  'CAKEUSDT': 'CAKE'
};

let liveWs = null;
let reconnectTimeout = null;

/**
 * Connect to public real-time price feed
 */
function startLivePriceStreamer() {
  const streamUrl = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';

  try {
    liveWs = new WebSocket(streamUrl);

    liveWs.on('open', () => {
      console.log('[PriceStreamer] Connected to live public exchange WebSocket feed.');
    });

    liveWs.on('message', (rawData) => {
      try {
        const tickers = JSON.parse(rawData);
        if (!Array.isArray(tickers)) return;

        for (const item of tickers) {
          const targetSymbol = SYMBOL_MAP[item.s];
          if (!targetSymbol) continue;

          const currentPrice = parseFloat(item.c); // close price
          const openPrice = parseFloat(item.o); // 24h open
          const change24h = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
          const volume24h = parseFloat(item.q || 0); // quote volume

          // Update database token records
          const matchingTokens = query(`SELECT id, price FROM tokens WHERE UPPER(symbol) = ? AND is_active = 1`, [targetSymbol]);
          if (matchingTokens && matchingTokens.length > 0) {
            const oldPrice = matchingTokens[0].price;
            const priceDirection = currentPrice >= oldPrice ? 'up' : 'down';

            for (const tok of matchingTokens) {
              execute(`
                UPDATE tokens SET 
                  price = ?, change_24h = ?,
                  last_data_sync = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [currentPrice, change24h, tok.id]);
            }

            // Broadcast real-time price tick to all connected frontend clients
            broadcast({
              type: 'PRICE_UPDATE',
              data: {
                tokenId: matchingTokens[0].id,
                symbol: targetSymbol,
                price: currentPrice,
                change24h: change24h,
                direction: priceDirection,
                timestamp: Date.now()
              }
            });
          }
        }
      } catch (parseErr) {
        // Non-fatal parse error
      }
    });

    liveWs.on('error', (err) => {
      console.warn('[PriceStreamer Error]', err.message);
    });

    liveWs.on('close', () => {
      console.warn('[PriceStreamer] Connection closed. Reconnecting in 5s...');
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(startLivePriceStreamer, 5000);
    });

  } catch (err) {
    console.warn('[PriceStreamer Startup Notice]', err.message);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(startLivePriceStreamer, 5000);
  }

  // Simulated live micro-tick for native community tokens (e.g. BULL, BRETT)
  setInterval(() => {
    try {
      const communityTokens = query(`SELECT id, symbol, price, change_24h FROM tokens WHERE symbol IN ('BULL', 'BRETT') AND is_active = 1`);
      for (const t of communityTokens) {
        const drift = (Math.random() - 0.49) * 0.004; // ±0.4%
        const newPrice = t.price * (1 + drift);
        const direction = newPrice >= t.price ? 'up' : 'down';
        const newChg = (t.change_24h || 0) + (drift * 10);

        execute(`UPDATE tokens SET price = ?, change_24h = ?, last_data_sync = CURRENT_TIMESTAMP WHERE id = ?`, [newPrice, newChg, t.id]);

        broadcast({
          type: 'PRICE_UPDATE',
          data: {
            tokenId: t.id,
            symbol: t.symbol,
            price: newPrice,
            change24h: newChg,
            direction,
            timestamp: Date.now()
          }
        });
      }
    } catch (e) {
      // Non-fatal
    }
  }, 4000);
}

module.exports = {
  startLivePriceStreamer
};
