const EventEmitter = require('events');

class TwapService extends EventEmitter {
  constructor() {
    super();
    this.twapState = new Map(); // symbol -> { sum, count, twap, sessionStart, lastUpdate, source }
    this.symbolSources = new Map(); // symbol -> source (ctrader or tradingview)
    this.lastBarTimestamps = new Map(); // Track last processed bar timestamp per symbol for deduplication
  }

  // Initialize TWAP from historical M1 bars (for mid-session joins)
  initializeFromHistory(symbol, initialMarketProfile, source = 'ctrader') {
    if (!initialMarketProfile || initialMarketProfile.length === 0) {
      console.log(`[TwapService] No history for ${symbol}, starting from scratch`);
      return;
    }

    let sum = 0;
    let count = 0;

    // Calculate TWAP from historical M1 bars
    for (const bar of initialMarketProfile) {
      sum += bar.close;
      count += 1;
    }

    const sessionStart = initialMarketProfile[0]?.timestamp || Date.now();

    // Store source for this symbol
    this.symbolSources.set(symbol, source);

    this.twapState.set(symbol, {
      sum,
      count,
      twap: count > 0 ? sum / count : null,
      sessionStart,
      lastUpdate: Date.now(),
      source
    });

    console.log(`[TwapService] Initialized ${symbol} TWAP from ${count} historical bars: ${this.twapState.get(symbol).twap}`);

    const twapData = {
      symbol,
      source, // Include source for routing
      twapValue: this.twapState.get(symbol).twap,
      timestamp: Date.now(),
      contributions: count,
      isHistorical: true
    };
    console.log(`[TwapService] Emitting twapUpdate for ${symbol}:${source}:`, JSON.stringify(twapData));

    // Emit initial TWAP
    this.emit('twapUpdate', twapData);
    console.log(`[TwapService] twapUpdate emitted for ${symbol}`);
  }

  // Process incoming M1 bar
  onM1Bar(symbol, bar, source = 'ctrader') {
    // Validate bar structure
    if (!bar || typeof bar.close !== 'number' || isNaN(bar.close)) {
      console.error(`[TwapService] Invalid bar data for ${symbol}:`, bar);
      this.emit('error', { symbol, error: 'Invalid bar data structure', code: 'INVALID_BAR_DATA', bar });
      return;
    }

    // Deduplication: Skip if we've already processed this bar (same timestamp)
    const lastTimestamp = this.lastBarTimestamps.get(`${symbol}:${source}`);
    if (lastTimestamp === bar.timestamp) {
      console.log(`[TwapService] Skipping duplicate bar for ${symbol}:${source} at ${new Date(bar.timestamp).toISOString()}`);
      return;
    }
    this.lastBarTimestamps.set(`${symbol}:${source}`, bar.timestamp);

    // Initialize if needed
    if (!this.twapState.has(symbol)) {
      this.symbolSources.set(symbol, source);
      this.twapState.set(symbol, {
        sum: 0,
        count: 0,
        twap: null,
        sessionStart: bar.timestamp,
        lastUpdate: null,
        source
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

    // Emit update
    this.emit('twapUpdate', {
      symbol,
      source: state.source || source, // Include source for routing
      twapValue: state.twap,
      timestamp: bar.timestamp,
      contributions: state.count,
      isHistorical: false
    });
  }

  resetDaily(symbol) {
    this.twapState.delete(symbol);
  }

  getTwap(symbol) {
    return this.twapState.get(symbol)?.twap || null;
  }
}

module.exports = { TwapService };
