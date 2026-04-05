// Data processing utilities for display components
//
// DATA CONTRACTS: See src/lib/dataContracts.js for type definitions
// - WebSocketMessage: Base message structure
// - SymbolDataPackage: Initial subscription data
// - TickData: Real-time tick updates
// - DisplayData: Normalized output format

export function getWebSocketUrl() {
  // WebSocket URL construction updated for Nginx TLS proxy (ref: DL-005).
  // When behind Nginx with HTTPS, connect to /ws path which proxies to backend.
  // In production (HTTPS), cookies are automatically sent on the upgrade request.
  // In dev (HTTP, no Nginx), connect directly to backend port.
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (window.location.port === '5174' || window.location.port === '4173') {
    return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${window.location.port === '5174' ? 8080 : 8081}`;
  }
  if (window.location.protocol === 'https:') {
    return `${window.location.protocol.replace('http', 'ws')}//${window.location.host}/ws`;
  }
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080`;
}

/**
 * Format symbol by removing slash and converting to uppercase
 * @param {string} symbol - Symbol with slash (e.g., 'BTC/USD')
 * @returns {string} Formatted symbol (e.g., 'BTCUSD')
 */
export function formatSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    if (import.meta.env.DEV) {
      console.warn('[formatSymbol] Received invalid symbol:', typeof symbol, symbol);
    }
    return '';
  }
  return symbol.replace('/', '').toUpperCase();
}
