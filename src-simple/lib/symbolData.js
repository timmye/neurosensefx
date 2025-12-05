// Centralized SymbolData Structure - Crystal Clarity Compliant
// Framework-First: Direct symbol data creation for consistent renderer signatures
// Simple, Performant, Maintainable

// Mock pip position data for symbols when connectionManager doesn't have it
const MOCK_PIP_DATA = {
  'EUR/USD': { pipPosition: 4, pipSize: 0.0001 },
  'GBP/USD': { pipPosition: 4, pipSize: 0.0001 },
  'USD/JPY': { pipPosition: 2, pipSize: 0.01 },
  'BTC/USD': { pipPosition: 2, pipSize: 0.01 },
  'XAU/USD': { pipPosition: 1, pipSize: 0.1 },
  'XAG/USD': { pipPosition: 2, pipSize: 0.01 }
};

/**
 * Create symbolData structure with consistent signature for all renderers
 * @param {string} symbol - Symbol name
 * @param {Object} connectionManager - Connection manager instance (optional)
 * @param {Object} pipDataOverride - Override pip data (optional)
 * @returns {Object} Symbol data object with pip information
 */
export function createSymbolData(symbol, connectionManager = null, pipDataOverride = null) {
  // Try to get pip data from connectionManager if available
  let pipPosition, pipSize;

  if (pipDataOverride) {
    // Use provided pip data override
    pipPosition = pipDataOverride.pipPosition;
    pipSize = pipDataOverride.pipSize;
  } else if (connectionManager && typeof connectionManager.getPipPosition === 'function') {
    // Use connectionManager if it has pip methods
    pipPosition = connectionManager.getPipPosition(symbol);
    pipSize = connectionManager.getPipSize(symbol);
  } else {
    // Fall back to mock data
    const mockData = MOCK_PIP_DATA[symbol] || MOCK_PIP_DATA['EUR/USD'];
    pipPosition = mockData.pipPosition;
    pipSize = mockData.pipSize;
  }

  return {
    symbol,
    pipPosition,
    pipSize
  };
}

/**
 * Create symbolData with dimensions for canvas rendering
 * @param {string} symbol - Symbol name
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} connectionManager - Connection manager instance (optional)
 * @param {Object} pipDataOverride - Override pip data (optional)
 * @returns {Object} Symbol data object with pip information and dimensions
 */
export function createSymbolDataWithDimensions(symbol, width, height, connectionManager = null, pipDataOverride = null) {
  const baseSymbolData = createSymbolData(symbol, connectionManager, pipDataOverride);
  return {
    ...baseSymbolData,
    width,
    height
  };
}

/**
 * Extract pip data from market data response
 * @param {Object} data - Market data object with pip information
 * @returns {Object} Pip data object
 */
export function extractPipDataFromMarketData(data) {
  return {
    pipPosition: data.pipPosition,
    pipSize: data.pipSize
  };
}