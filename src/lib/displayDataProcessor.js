// Data processing utilities for display components
// Week 2: Market Profile integration
// Phase 2: TradingView client integration
//
// DATA CONTRACTS: See src/lib/dataContracts.js for type definitions
// - WebSocketMessage: Base message structure
// - SymbolDataPackage: Initial subscription data
// - TickData: Real-time tick updates
// - DisplayData: Normalized output format
// - ProcessResult: Function return type

import {
  validateWebSocketMessage,
  validateSymbolDataPackage,
  validateTickData,
  validateDisplayData,
  logValidationResult
} from './dataContracts.js';

/**
 * Pip Estimation Logic
 *
 * These thresholds determine pip position and size based on typical asset price ranges.
 * The logic uses price magnitude as a heuristic since we don't have explicit pip metadata.
 *
 * RATIONALE:
 * - > 10000: Crypto (BTC, ETH) and high-value stocks trade in whole numbers. Pip = 1.0
 * - > 1000: Gold (XAUUSD ~$2000) uses 0.1 pip. Also covers indices.
 * - > 10: JPY pairs (USDJPY ~150) use 0.01 pip. Standard for yen-based pairs.
 * - Default (<= 10): Most forex pairs (EURUSD ~1.08) use 0.0001 pip (4 decimal places).
 *
 * NOTE: These are fallbacks when backend doesn't provide pipPosition/pipSize.
 * TradingView typically sends explicit pip values; cTrader may not.
 */
function estimatePipPosition(price) {
  if (price > 10000) return 0;  // Crypto/stocks - whole numbers (e.g., BTCUSD ~95000)
  if (price > 1000) return 1;   // Gold (XAUUSD ~2000), indices
  if (price > 10) return 2;     // JPY pairs (USDJPY ~150)
  return 4;                     // Most forex pairs (EURUSD ~1.08, GBPUSD ~1.27)
}

/**
 * @param {number} price - Current price to estimate from
 * @returns {number} Estimated pip size
 * @see estimatePipPosition for threshold rationale
 */
function estimatePipSize(price) {
  if (price > 10000) return 1;    // Crypto/stocks: 1.0 pip
  if (price > 1000) return 0.1;   // Gold (XAUUSD): 0.1 pip
  if (price > 10) return 0.01;    // JPY pairs: 0.01 pip
  return 0.0001;              // Standard forex: 0.0001 pip (pipette = 0.00001)
}

function getDirection(currentPrice, prevPrice) {
  if (currentPrice > prevPrice) return 'up';
  if (currentPrice < prevPrice) return 'down';
  return 'neutral';
}

/**
 * Process WebSocket data into normalized display format
 *
 * @param {import('./dataContracts.js').WebSocketMessage} data - Raw WebSocket message
 * @param {string} formattedSymbol - Normalized symbol (e.g., 'BTCUSD')
 * @param {import('./dataContracts.js').DisplayData|null} lastData - Previous display data for state preservation
 * @returns {import('./dataContracts.js').ProcessResult|null} Processed result or null for unhandled types
 *
 * @see dataContracts.js for type definitions
 */
export function processSymbolData(data, formattedSymbol, lastData) {
  // Guard against null/undefined input
  if (!data || typeof data !== 'object') {
    if (import.meta.env.DEV) {
      console.warn('[processSymbolData] Received invalid input:', typeof data, data);
    }
    return null;
  }

  // Dev mode: Validate input message structure
  if (import.meta.env.DEV) {
    const inputValidation = validateWebSocketMessage(data, 'processSymbolData');
    if (!inputValidation.valid) {
      console.warn('[processSymbolData] Invalid input:', inputValidation.errors, data);
    }

    // Type-specific validation
    if (data.type === 'symbolDataPackage') {
      const pkgValidation = validateSymbolDataPackage(data);
      logValidationResult('processSymbolData:symbolDataPackage', pkgValidation);
    } else if (data.type === 'tick') {
      const tickValidation = validateTickData(data);
      logValidationResult('processSymbolData:tick', tickValidation);
    }
  }

  if (data.type === 'error') {
    return { type: 'error', message: data.message };
  }

  // Common price reference for pip estimation
  const priceRef = data.current || data.price || data.bid || data.ask || lastData?.current || 1.0;

  const displayData = data.type === 'symbolDataPackage' ? {
    high: data.high || data.todaysHigh || data.projectedAdrHigh || 1.0,
    low: data.low || data.todaysLow || data.projectedAdrLow || 1.0,
    current: data.current || data.price || data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
    open: data.open || data.todaysOpen || data.initialPrice || 1.0,
    adrHigh: data.adrHigh || data.projectedAdrHigh || (data.todaysHigh || 1.0) * 1.01,
    adrLow: data.adrLow || data.projectedAdrLow || (data.todaysLow || 1.0) * 0.99,
    pipPosition: data.pipPosition ?? estimatePipPosition(data.current || priceRef),
    pipSize: data.pipSize ?? estimatePipSize(data.current || priceRef),
    pipetteSize: data.pipetteSize,
    source: data.source || 'ctrader',
    previousPrice: data.current || data.price || data.bid || data.ask || data.initialPrice || data.todaysOpen || 1.0,
    direction: 'neutral',
    initialMarketProfile: data.initialMarketProfile || null,
    ...(data.prevDayOpen !== undefined || data.prevDayHigh !== undefined ||
      data.prevDayLow !== undefined || data.prevDayClose !== undefined ? {
      prevDayOHLC: {
        open: data.prevDayOpen,
        high: data.prevDayHigh,
        low: data.prevDayLow,
        close: data.prevDayClose
      }
    } : {}),
    // Preserve TWAP data from lastData if it exists
    ...(lastData?.twap !== undefined ? {
      twap: lastData.twap,
      twapContributions: lastData.twapContributions,
      twapUpdatedAt: lastData.twapUpdatedAt
    } : {})
  } : data.type === 'tick' && formatSymbol(data.symbol || '') === formattedSymbol ? {
    high: Math.max(lastData?.high || 0, data.high || data.ask || data.bid || 0),
    low: Math.min(lastData?.low || Infinity, data.low || data.bid || data.ask || Infinity),
    current: data.price || data.bid || data.ask || lastData?.current || 1.0,
    open: lastData?.open || data.bid || data.ask || 1.0,
    adrHigh: lastData?.adrHigh || (data.price || data.bid || data.ask || 1.0) * 1.01,
    adrLow: lastData?.adrLow || (data.price || data.bid || data.ask || 1.0) * 0.99,
    pipPosition: data.pipPosition ?? lastData?.pipPosition ?? estimatePipPosition(priceRef),
    pipSize: data.pipSize ?? lastData?.pipSize ?? estimatePipSize(priceRef),
    pipetteSize: data.pipetteSize ?? lastData?.pipetteSize,
    source: data.source || lastData?.source || 'ctrader',
    previousPrice: lastData?.current || lastData?.previousPrice || 1.0,
    direction: getDirection(
      data.price || data.bid || data.ask || lastData?.current || 1.0,
      lastData?.current || lastData?.previousPrice || 1.0
    ),
    ...(lastData?.prevDayOHLC ? { prevDayOHLC: lastData.prevDayOHLC } : {}),
    // Preserve TWAP data from lastData if it exists
    ...(lastData?.twap !== undefined ? {
      twap: lastData.twap,
      twapContributions: lastData.twapContributions,
      twapUpdatedAt: lastData.twapUpdatedAt
    } : {})
  } : data.type === 'twapUpdate' ? {
    ...lastData,
    twap: data.data.twapValue,
    twapContributions: data.data.contributions,
    twapUpdatedAt: data.data.timestamp
  } : null;

  if (displayData) {
    // Dev mode: Validate output structure
    if (import.meta.env.DEV) {
      const outputValidation = validateDisplayData(displayData);
      logValidationResult('processSymbolData:output', outputValidation, displayData);
    }
    return { type: 'data', data: displayData };
  } else if (data.type !== 'status' && data.type !== 'ready' && data.type !== 'error') {
    // Log unhandled message types in dev mode
    if (import.meta.env.DEV) {
      console.warn('[processSymbolData] Unhandled message type:', data.type, data);
    }
    return { type: 'unhandled', messageType: data.type };
  }

  return null;
}


export function getBucketSizeForSymbol(symbol, symbolData, bucketMode = 'pip') {
  // If pipSize is not available, estimate it from current price
  const priceRef = symbolData?.current || symbolData?.price || symbolData?.bid || symbolData?.ask || 1.0;

  // Return pipSize for 'pip' mode, pipetteSize for 'pipette' mode
  if (bucketMode === 'pipette' && symbolData?.pipetteSize) {
    return symbolData.pipetteSize;
  }
  if (symbolData?.pipSize) {
    return symbolData.pipSize;
  }

  // Fallback to estimation if pipSize not available (TradingView data)
  return estimatePipSize(priceRef);
}

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