const { WebSocketServer, WebSocket } = require('ws');

let wss = null;
const clients = new Set();

function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    // Send initial welcome & connection ack
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to Bulls Traking Real-Time WebSocket Engine',
      timestamp: new Date().toISOString()
    }));

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.warn('[WebSocket Client Error]', err.message);
      clients.delete(ws);
    });
  });

  // Keep-alive heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    if (!wss) return;
    for (const ws of clients) {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  console.log('[WebSocket] Bulls Traking WebSocket Server initialized on path /ws');
  return wss;
}

/**
 * Broadcast message to all connected frontend clients
 */
function broadcast(payload) {
  if (!wss || clients.size === 0) return;
  const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (err) {
        // Client will be pruned on close
      }
    }
  }
}

function getConnectedClientsCount() {
  return clients.size;
}

module.exports = {
  initWebSocketServer,
  broadcast,
  getConnectedClientsCount
};
