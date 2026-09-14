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

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

// Mount REST API layer
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 Bulls Traking Phase 1 Platform Live!`);
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

module.exports = { app, server };
