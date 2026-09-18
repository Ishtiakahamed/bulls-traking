try {
  process.loadEnvFile();
} catch (e) {
  // .env file loaded if present
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/default');
const { initDatabase } = require('./database/db');
const { startSyncWorker } = require('./backend/workers/syncWorker');
const { initWebSocketServer } = require('./backend/websocket/wsServer');
const { startLivePriceStreamer } = require('./backend/websocket/livePriceStreamer');
const apiRoutes = require('./backend/routes');
const errorHandler = require('./backend/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || config.port || 5000;

// Initialize Database Schema
try {
  initDatabase();
} catch (e) {
  console.error('[Startup] Database initialization notice:', e.message);
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets (both public folder and root)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// Root API status endpoint
app.get(['/api', '/api/'], (req, res) => {
  res.json({
    success: true,
    platform: 'Bulls Traking API',
    version: '1.0.0',
    status: 'ok',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      home: '/api/home',
      tokens: '/api/tokens',
      newPairs: '/api/new-pairs',
      signals: '/api/signals',
      marketStats: '/api/market-stats',
      security: '/api/security/scan'
    }
  });
});

// Edge CDN Caching headers for high-speed delivery on Vercel & Proxies
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path.startsWith('/api') || process.env.VERCEL)) {
    // Exclude private admin, payment, or order endpoints from caching
    if (req.path.includes('/admin') || req.path.includes('/pay') || req.path.includes('/order')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else {
      // Allow Vercel Edge CDN to serve cached responses instantly in 15-30ms,
      // and revalidate in background every 5 seconds.
      res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=59');
    }
  }
  next();
});

// Mount REST API layer
app.use('/api', apiRoutes);

// Serverless fallback: if request arrived without /api prefix on Vercel
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const apiEndpoints = ['/tokens', '/health', '/home', '/new-pairs', '/signals', '/market-stats', '/submit', '/promotions', '/security', '/admin'];
    if (apiEndpoints.some(p => req.path.startsWith(p))) {
      return apiRoutes(req, res, next);
    }
    next();
  });
}

// SPA fallback for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use(errorHandler);

// Start server only if not running inside a serverless environment (e.g. Vercel)
let server = null;
if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`🚀 Bulls Traking Platform Live!`);
    console.log(`🌐 Website:     http://localhost:${PORT}`);
    console.log(`⚡ WebSocket:   ws://localhost:${PORT}/ws`);
    console.log(`📊 CMC Active:  ${process.env.COINMARKETCAP_API_KEY ? 'YES (Pro Key Enabled)' : 'NO'}`);
    console.log(`=============================================================\n`);
  });

  // Initialize WebSocket Engine & Live Price Streamer
  initWebSocketServer(server);
  startLivePriceStreamer();

  // Start background market data synchronization worker (CMC/CoinGecko)
  startSyncWorker();
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
