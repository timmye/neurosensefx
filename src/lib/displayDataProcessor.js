// Data processing utilities for display components
//
// DATA CONTRACTS: See src/lib/dataContracts.js for type definitions
// - WebSocketMessage: Base message structure
// - SymbolDataPackage: Initial subscription data
// - TickData: Real-time tick updates
// - DisplayData: Normalized output format

export function getWebSocketUrl() {
  // Use environment variable or default to development/production ports
  const wsUrl = import.meta.env.VITE_BACKEND_URL ||
    (window.location.port === '5174' || window.location.port === '4173'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:${window.location.port === '5174' ? '8080' : '8081'}`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8080`);
  return wsUrl;
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
