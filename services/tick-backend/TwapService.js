const EventEmitter = require('events');
const { normalizeSymbol } = require('./utils/normalizeSymbol');
const { createLogger } = require('./utils/Logger');
const log = createLogger('TwapService');

class TwapService extends EventEmitter {
  constructor() {
    super();
    this.twapState = new Map(); // symbol -> { sum, count, twap, sessionStart, lastUpdate }
    this.lastBarTimestamps = new Map(); // symbol -> last processed bar timestamp (dedup across sources)
    this.isInitializing = new Map(); // symbol -> boolean (guard for concurrent init/reset)
  }

  /**
   * Whether a symbol's TWAP is currently initializing. Normalizes the symbol so
   * external callers (e.g. WebSocketServer) can pass any feed's name form rather
   * than reaching into the Map directly.
   * @param {string} symbol - Symbol identifier (any feed form)
   * @returns {boolean}
   */
  isSymbolInitializing(symbol) {
    return !!this.isInitializing.get(normalizeSymbol(symbol));
  }

  // Initialize TWAP from historical M1 bars (for mid-session joins)
  // Idempotent: skips if already initialized (prevents source race overwrites)
  initializeFromHistory(symbol, initialMarketProfile, source = 'ctrader') {
    symbol = normalizeSymbol(symbol);
    if (!initialMarketProfile || initialMarketProfile.length === 0) {
      return;
    }

    // Skip if already initialized -- prevents later source from overwriting state
    if (this.twapState.has(symbol)) {
      return;
    }

    this.isInitializing.set(symbol, true);

    let sum = 0;
    let count = 0;

    // Calculate TWAP from historical M1 bars
    for (const bar of initialMarketProfile) {
      sum += bar.close;
      count += 1;
    }

    const sessionStart = initialMarketProfile[0]?.timestamp || Date.now();

    this.twapState.set(symbol, {
      sum,
      count,
      twap: count > 0 ? sum / count : null,
      sessionStart,
      lastUpdate: Date.now()
    });

    // Track last bar timestamp to avoid double-counting from live M1 feed
    const lastBarTime = initialMarketProfile[initialMarketProfile.length - 1]?.timestamp;
    if (lastBarTime) {
      this.lastBarTimestamps.set(symbol, lastBarTime);
    }

    // Emit initial TWAP -- source-agnostic, DataRouter broadcasts to all subscribers
    this.emit('twapUpdate', {
      symbol,
      twapValue: this.twapState.get(symbol).twap,
      timestamp: Date.now(),
      contributions: count,
      isHistorical: true
    });

    this.isInitializing.delete(symbol);
  }

  // Process incoming M1 bar
  onM1Bar(symbol, bar, source = 'ctrader') {
    symbol = normalizeSymbol(symbol);
    // Validate bar structure
    if (!bar || typeof bar.close !== 'number' || isNaN(bar.close)) {
      log.error(`Invalid bar data for ${symbol}:`, bar);
      this.emit('error', { symbol, error: 'Invalid bar data structure', code: 'INVALID_BAR_DATA', bar });
      return;
    }

    // Deduplication by symbol only -- both cTrader and TradingView deliver the same bar
    const lastTimestamp = this.lastBarTimestamps.get(symbol);
    if (lastTimestamp === bar.timestamp) {
      return;
    }
    this.lastBarTimestamps.set(symbol, bar.timestamp);

    // Initialize if needed
    if (!this.twapState.has(symbol)) {
      this.twapState.set(symbol, {
        sum: 0,
        count: 0,
        twap: null,
        sessionStart: bar.timestamp,
        lastUpdate: null
      });
    }

    const state = this.twapState.get(symbol);

    // Use bar close as representative price (1-minute time bucket)
    const price = bar.close;

    // Simple running average (each bar = 1 minute weight)
    state.sum += price;
    state.count += 1;
    state.twap = state.sum / state.count;
    state.lastUpdate = bar.timestamp;

    // Emit update -- source-agnostic, DataRouter broadcasts to all subscribers
    this.emit('twapUpdate', {
      symbol,
      twapValue: state.twap,
      timestamp: bar.timestamp,
      contributions: state.count,
      isHistorical: false
    });
  }

  resetDaily(symbol) {
    symbol = normalizeSymbol(symbol);
    this.twapState.delete(symbol);
    this.lastBarTimestamps.delete(symbol);
    this.isInitializing.delete(symbol);
  }

  getTwap(symbol) {
    return this.twapState.get(normalizeSymbol(symbol))?.twap || null;
  }
}

module.exports = { TwapService };
