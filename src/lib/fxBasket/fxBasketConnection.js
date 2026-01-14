// FX Basket Connection Monitoring - Crystal Clarity Compliant
// Periodic connection health checks and reconnection

// Check data freshness and reconnect if disconnected
export function checkDataFreshness(connectionStatus, refreshConnection) {
  if (connectionStatus === 'disconnected') {
    refreshConnection();
  }
}

// Reconnect to WebSocket server if not connected
export function refreshConnection(connectionManager, connectionStatus) {
  if (connectionManager && connectionStatus !== 'connected') {
    connectionManager.connect();
  }
}
