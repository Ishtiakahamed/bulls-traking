try {
  process.loadEnvFile();
} catch (e) {
  // .env file loaded if present
}

process.on('uncaughtException', (err) => {
  console.warn('[Server] Uncaught exception:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[Server] Unhandled rejection:', reason?.message || reason);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config/default');
const { initDatabase } = require('./database/db');
const { startSyncWorker } = require('./backend/workers/syncWorker');
const { initWebSocketServer } = require('./backend/websocket/wsServer');
const { startLivePriceStreamer } = require('./backend/websocket/livePriceStreamer');
const apiRoutes = require('./backend/routes');
const errorHandler = require('./backend/middleware/errorHandler');
const helmet = require('helmet');
const { standardLimiter } = require('./backend/middleware/rateLimiters');

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
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(standardLimiter);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend assets (both public folder, uploads, and root)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname)));

const { validateAndDecodeImage } = require('./backend/utils/imageSecurity');

// Upload endpoint for token logos and banner images
app.post(['/api/upload-logo', '/upload-logo', '/api/upload-banner', '/upload-banner', '/api/upload'], (req, res) => {
  try {
    const { imageBase64, filename } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    const isBanner = req.path.includes('banner') || (filename && filename.toLowerCase().includes('banner'));

    // Strict raster format, magic byte, and size enforcement
    let validated;
    try {
      validated = validateAndDecodeImage(imageBase64, { isBanner });
    } catch (valErr) {
      return res.status(400).json({ success: false, error: valErr.message });
    }

    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    let publicUrl = null;

    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const prefix = isBanner ? 'banner' : 'logo';
      const cleanName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${validated.ext}`;
      const filePath = path.join(uploadsDir, cleanName);

      fs.writeFileSync(filePath, validated.buffer);
      publicUrl = `/uploads/${cleanName}`;
    } catch (fsErr) {
      console.warn('[Upload Notice] File system write fallback to verified data URL:', fsErr.message);
      publicUrl = `data:${validated.mimeType};base64,${validated.buffer.toString('base64')}`;
    }

    res.json({
      success: true,
      url: publicUrl,
      format: validated.format,
      size: validated.size,
      message: 'Image uploaded successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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
      marketStats: '/api/market-stats',
      telegram: '/api/telegram/status'
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
    const apiEndpoints = ['/tokens', '/health', '/home', '/new-pairs', '/market-stats', '/submit', '/promotions', '/telegram', '/admin'];
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
