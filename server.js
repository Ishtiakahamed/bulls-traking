const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config/default');
const { initDatabase } = require('./database/db');
const { startSyncWorker } = require('./backend/workers/syncWorker');
const apiRoutes = require('./backend/routes');
const errorHandler = require('./backend/middleware/errorHandler');

const app = express();
const PORT = config.port;

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

// Start background market data synchronization worker
startSyncWorker();

const server = app.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 Bulls Traking Phase 1 Platform Live!`);
  console.log(`🌐 Website:     http://localhost:${PORT}`);
  console.log(`📊 Aggregator:  http://localhost:${PORT}/api/home`);
  console.log(`🔥 Top Coins:   http://localhost:${PORT}/api/tokens/top`);
  console.log(`🆕 New Coins:   http://localhost:${PORT}/api/tokens/new`);
  console.log(`⚡ Hot Coins:   http://localhost:${PORT}/api/tokens/hot`);
  console.log(`📈 Gainers:     http://localhost:${PORT}/api/tokens/gainers`);
  console.log(`=============================================================\n`);
});

module.exports = { app, server };
