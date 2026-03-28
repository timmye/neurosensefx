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
 * @property {number|null} sentAt] - WebSocket send timestamp
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
