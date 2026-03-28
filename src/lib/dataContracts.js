/**
 * Data Contracts for WebSocket Messages
 *
 * This module defines the implicit contracts between backend data sources
 * and frontend reactive patterns. These types document expected data shapes
 * and provide runtime validation for development mode.
 *
 * @module dataContracts
 */

// ============================================================================
// TYPE DEFINITIONS (JSDoc)
// ============================================================================

/**
 * @typedef {'symbolDataPackage'|'tick'|'profileUpdate'|'twapUpdate'|'error'|'profileError'|'status'|'ready'} MessageType
 */

/**
 * Base WebSocket message structure
 * @typedef {Object} WebSocketMessage
 * @property {string} [v] - Schema version (e.g., '1.0.0')
 * @property {MessageType} type - Message type discriminator
 * @property {string} [symbol] - Symbol identifier (e.g., 'BTCUSD', 'EUR/USD')
 * @property {string} [source] - Data source ('ctrader' | 'tradingview')
 * @property {number} [receivedAt] - Backend receive timestamp (ms since epoch)
 * @property {number} [sentAt] - WebSocket send timestamp (ms since epoch)
 */

/**
 * Initial subscription data package
 * @typedef {Object} SymbolDataPackage
 * @property {string} [v] - Schema version
 * @property {'symbolDataPackage'} type
 * @property {string} symbol - Symbol identifier
 * @property {string} [source='ctrader'] - Data source
 * @property {number} [receivedAt] - Backend receive timestamp
 * @property {number} [sentAt] - WebSocket send timestamp
 * @property {number} [current] - Current price
 * @property {number} [price] - Alternative current price field
 * @property {number} [bid] - Bid price (cTrader)
 * @property {number} [ask] - Ask price (cTrader)
 * @property {number} [initialPrice] - Initial price at subscription
 * @property {number} [todaysOpen] - Today's opening price
 * @property {number} [open] - Opening price
 * @property {number} [high] - Day's high price
 * @property {number} [todaysHigh] - Alternative high field
 * @property {number} [low] - Day's low price
 * @property {number} [todaysLow] - Alternative low field
 * @property {number} [adrHigh] - ADR high projection
 * @property {number} [adrLow] - ADR low projection
 * @property {number} [projectedAdrHigh] - Alternative ADR high
 * @property {number} [projectedAdrLow] - Alternative ADR low
 * @property {number} [pipPosition] - Decimal position of pip (0-4)
 * @property {number} [pipSize] - Size of one pip
 * @property {number} [pipetteSize] - Size of pipette (1/10 pip)
 * @property {Array<M1Bar>} [initialMarketProfile] - M1 candles for profile
 * @property {number} [bucketSize] - Market profile bucket size
 * @property {number} [prevDayOpen] - Previous day open
 * @property {number} [prevDayHigh] - Previous day high
 * @property {number} [prevDayLow] - Previous day low
 * @property {number} [prevDayClose] - Previous day close
 */

/**
 * Real-time tick update
 * @typedef {Object} TickData
 * @property {string} [v] - Schema version
 * @property {'tick'} type
 * @property {string} symbol - Symbol identifier (required for matching)
 * @property {string} [source] - Data source
 * @property {number} [receivedAt] - Backend receive timestamp
 * @property {number} [sentAt] - WebSocket send timestamp
 * @property {number} [price] - Current price
 * @property {number} [bid] - Bid price
 * @property {number} [ask] - Ask price
 * @property {number} [high] - Tick high (for running high)
 * @property {number} [low] - Tick low (for running low)
 * @property {number} [pipPosition] - Decimal position of pip
 * @property {number} [pipSize] - Size of one pip
 * @property {number} [pipetteSize] - Size of pipette
 * @property {number} [timestamp] - Unix timestamp
 */

/**
 * M1 candle bar for market profile
 * @typedef {Object} M1Bar
 * @property {number} open - Opening price
 * @property {number} high - High price
 * @property {number} low - Low price
 * @property {number} close - Closing price
 * @property {number} timestamp - Unix timestamp
 */

/**
 * Market profile level
 * @typedef {Object} ProfileLevel
 * @property {number} price - Price level
 * @property {number} tpo - Time-Price-Opportunity count
 */

/**
 * Market profile update message
 * @typedef {Object} ProfileUpdate
 * @property {'profileUpdate'} type
 * @property {string} symbol - Symbol identifier
 * @property {string} source - Data source
 * @property {number} [seq] - Sequence number
 * @property {{levels: Array<ProfileLevel>, bucketSize: number}} profile - Profile data
 */

/**
 * TWAP update message
 * @typedef {Object} TwapUpdate
 * @property {'twapUpdate'} type
 * @property {string} symbol - Symbol identifier
 * @property {string} source - Data source
 * @property {{twapValue: number, contributions: Array, timestamp: number}} data - TWAP data
 */

/**
 * Previous day OHLC data
 * @typedef {Object} PrevDayOHLC
 * @property {number} open - Previous day open
 * @property {number} high - Previous day high
 * @property {number} low - Previous day low
 * @property {number} close - Previous day close
 */

/**
 * Latency metrics for data pipeline monitoring
 * @typedef {Object} LatencyMetrics
 * @property {number|null} [backend] - Backend processing time (ms): sentAt - receivedAt
 * @property {number|null} [network] - Network transit time (ms): clientReceivedAt - sentAt
 * @property {number|null} [e2e] - End-to-end latency (ms): clientReceivedAt - receivedAt
 */

/**
 * Market data store state
 * @typedef {Object} MarketDataState
 * @property {string} symbol - Symbol identifier
 * @property {string|null} source - Data source
 * @property {number|null} current - Current price
 * @property {number|null} high - Day's high price
 * @property {number|null} low - Day's low price
 * @property {number|null} open - Day's open price
 * @property {number|null} adrHigh - ADR high projection
 * @property {number|null} adrLow - ADR low projection
 * @property {number} pipPosition - Decimal position of pip
 * @property {number} pipSize - Size of one pip
 * @property {number} pipetteSize - Size of pipette
 * @property {number|null} previousPrice - Previous tick price
 * @property {'up'|'down'|'neutral'} direction - Price movement direction
 * @property {Array|null} marketProfile - Market profile data
 * @property {number|null} receivedAt - Backend receive timestamp
 * @property {number|null} sentAt - WebSocket send timestamp
 * @property {number|null} clientReceivedAt - Frontend receive timestamp
 * @property {LatencyMetrics} latency - Latency metrics
 * @property {string|null} error - Error message if failed
 * @property {'pending'|'connected'|'error'|'stale'} status - Connection status
 * @property {number|null} lastUpdate - Last update timestamp
 * @property {string} schemaVersion - Schema version string
 */

/**
 * Normalized display data (output of processSymbolData)
 * @typedef {Object} DisplayData
 * @property {number} high - Day's high or running high
 * @property {number} low - Day's low or running low
 * @property {number} current - Current price
 * @property {number} open - Day's open price
 * @property {number} adrHigh - ADR high projection
 * @property {number} adrLow - ADR low projection
 * @property {number} pipPosition - Decimal position of pip (0-4)
 * @property {number} pipSize - Size of one pip
 * @property {number} [pipetteSize] - Size of pipette
 * @property {string} source - Data source identifier
 * @property {number} previousPrice - Previous tick price
 * @property {'up'|'down'|'neutral'} direction - Price movement direction
 * @property {Array<M1Bar>|null} initialMarketProfile - M1 candles for profile
 * @property {PrevDayOHLC} [prevDayOHLC] - Previous day OHLC (conditional)
 * @property {number} [twap] - TWAP value (preserved from lastData)
 * @property {Array} [twapContributions] - TWAP contributions (preserved)
 * @property {number} [twapUpdatedAt] - TWAP timestamp (preserved)
 */

/**
 * Result of processSymbolData
 * @typedef {Object} ProcessResult
 * @property {'data'|'error'|'unhandled'} type - Result type
 * @property {DisplayData} [data] - Normalized display data (type='data')
 * @property {string} [message] - Error message (type='error')
 * @property {string} [messageType] - Original message type (type='unhandled')
 */

// ============================================================================
// RUNTIME VALIDATION (Dev Mode Only)
// ============================================================================

/**
 * Validate WebSocket message structure
 * @param {unknown} data - Raw data to validate
 * @param {string} context - Context string for error messages
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateWebSocketMessage(data, context = 'unknown') {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push(`Expected object, got ${typeof data}`);
    return { valid: false, errors };
  }

  const msg = /** @type {Record<string, unknown>} */ (data);

  if (!msg.type || typeof msg.type !== 'string') {
    errors.push('Missing or invalid required field: type (string)');
    return { valid: false, errors };
  }

  // Type-specific validation
  const validTypes = ['symbolDataPackage', 'tick', 'profileUpdate', 'twapUpdate', 'error', 'profileError', 'status', 'ready'];
  if (!validTypes.includes(msg.type)) {
    errors.push(`Unknown message type: ${msg.type}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate SymbolDataPackage fields
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
export function validateSymbolDataPackage(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    errors.push('Expected object, got ' + typeof data);
    return { valid: false, errors, warnings };
  }

  const pkg = /** @type {Record<string, unknown>} */ (data);

  // Required fields
  if (pkg.type !== 'symbolDataPackage') {
    errors.push(`Expected type 'symbolDataPackage', got '${pkg.type}'`);
  }

  // Price field presence check (at least one should exist)
  const priceFields = ['current', 'price', 'bid', 'ask', 'initialPrice', 'todaysOpen'];
  const hasPriceField = priceFields.some(f => typeof pkg[f] === 'number');
  if (!hasPriceField) {
    warnings.push('No price field found (current, price, bid, ask, initialPrice, todaysOpen)');
  }

  // Range field presence check
  const hasHigh = typeof pkg.high === 'number' || typeof pkg.todaysHigh === 'number';
  const hasLow = typeof pkg.low === 'number' || typeof pkg.todaysLow === 'number';
  if (!hasHigh) {
    warnings.push('No high price field found (high, todaysHigh)');
  }
  if (!hasLow) {
    warnings.push('No low price field found (low, todaysLow)');
  }

  // ADR field presence check
  const hasAdrHigh = typeof pkg.adrHigh === 'number' || typeof pkg.projectedAdrHigh === 'number';
  const hasAdrLow = typeof pkg.adrLow === 'number' || typeof pkg.projectedAdrLow === 'number';
  if (!hasAdrHigh || !hasAdrLow) {
    warnings.push('Missing ADR fields - will use fallback calculation');
  }

  // Numeric validation for present fields
  const numericFields = ['current', 'price', 'bid', 'ask', 'high', 'low', 'open', 'adrHigh', 'adrLow', 'pipPosition', 'pipSize'];
  for (const field of numericFields) {
    if (pkg[field] !== undefined && typeof pkg[field] !== 'number') {
      errors.push(`Field '${field}' should be number, got ${typeof pkg[field]}`);
    }
    if (typeof pkg[field] === 'number' && !Number.isFinite(pkg[field])) {
      errors.push(`Field '${field}' is not finite: ${pkg[field]}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate TickData fields
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
export function validateTickData(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    errors.push('Expected object, got ' + typeof data);
    return { valid: false, errors, warnings };
  }

  const tick = /** @type {Record<string, unknown>} */ (data);

  if (tick.type !== 'tick') {
    errors.push(`Expected type 'tick', got '${tick.type}'`);
  }

  // Symbol is required for tick matching
  if (!tick.symbol || typeof tick.symbol !== 'string') {
    errors.push('Missing required field: symbol (string)');
  }

  // At least one price field
  const priceFields = ['price', 'bid', 'ask'];
  const hasPrice = priceFields.some(f => typeof tick[f] === 'number');
  if (!hasPrice) {
    warnings.push('No price field found (price, bid, ask)');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate DisplayData output
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, errors: string[], warnings: string[]}}
 */
export function validateDisplayData(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    errors.push('Expected object, got ' + typeof data);
    return { valid: false, errors, warnings };
  }

  const display = /** @type {Record<string, unknown>} */ (data);

  // Required numeric fields
  const requiredFields = ['high', 'low', 'current', 'open', 'adrHigh', 'adrLow', 'pipPosition', 'pipSize', 'previousPrice'];
  for (const field of requiredFields) {
    if (typeof display[field] !== 'number') {
      errors.push(`Missing or invalid required field: ${field} (number)`);
    } else if (!Number.isFinite(display[field])) {
      errors.push(`Field '${field}' is not finite: ${display[field]}`);
    }
  }

  // Direction validation
  const validDirections = ['up', 'down', 'neutral'];
  if (!validDirections.includes(String(display.direction))) {
    errors.push(`Invalid direction: ${display.direction}`);
  }

  // Sanity checks
  if (typeof display.high === 'number' && typeof display.low === 'number' && display.high < display.low) {
    warnings.push(`high (${display.high}) < low (${display.low}) - inverted range`);
  }

  if (typeof display.current === 'number' && typeof display.high === 'number' && display.current > display.high) {
    warnings.push(`current (${display.current}) > high (${display.high})`);
  }

  if (typeof display.current === 'number' && typeof display.low === 'number' && display.current < display.low) {
    warnings.push(`current (${display.current}) < low (${display.low})`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Log validation result in dev mode
 * @param {string} context - Context identifier
 * @param {{valid: boolean, errors?: string[], warnings?: string[]}} result - Validation result
 * @param {unknown} [data] - Original data (logged on error)
 */
export function logValidationResult(context, result, data) {
  if (!import.meta.env.DEV) return;

  if (!result.valid) {
    console.warn(`[${context}] Validation failed:`, result.errors, data);
  } else if (result.warnings && result.warnings.length > 0) {
    console.log(`[${context}] Validation warnings:`, result.warnings);
  }
}

/**
 * Create a validated wrapper for processSymbolData
 * @param {Function} processor - Original processSymbolData function
 * @returns {Function} Wrapped function with validation
 */
export function withValidation(processor) {
  return function validatedProcessSymbolData(data, formattedSymbol, lastData) {
    if (import.meta.env.DEV) {
      // Validate input
      const inputValidation = validateWebSocketMessage(data, 'processSymbolData');
      logValidationResult('processSymbolData:input', inputValidation, data);

      // Type-specific validation
      if (data?.type === 'symbolDataPackage') {
        const pkgValidation = validateSymbolDataPackage(data);
        logValidationResult('processSymbolData:symbolDataPackage', pkgValidation);
      } else if (data?.type === 'tick') {
        const tickValidation = validateTickData(data);
        logValidationResult('processSymbolData:tick', tickValidation);
      }
    }

    // Call original processor
    const result = processor(data, formattedSymbol, lastData);

    if (import.meta.env.DEV && result?.type === 'data') {
      // Validate output
      const outputValidation = validateDisplayData(result.data);
      logValidationResult('processSymbolData:output', outputValidation, result.data);
    }

    return result;
  };
}
