const EventEmitter = require('events');

class MarketProfileService extends EventEmitter {
  constructor() {
    super();
    this.profiles = new Map();
    this.sequenceNumbers = new Map();
    this.symbolSources = new Map(); // Track which source each symbol uses
    this.lastBarTimestamps = new Map(); // Track last processed bar timestamp per symbol for deduplication
    this.MAX_LEVELS = 3000;
  }

  subscribeToSymbol(symbol, source = 'ctrader') {
    if (!this.profiles.has(symbol)) {
      // Calculate appropriate bucket size based on symbol
      // Crypto symbols (BTCUSD, ETHUSD) need larger buckets
      let bucketSize = 0.0001; // Default for forex
      if (symbol.includes('BTC') || symbol.includes('ETH')) {
        bucketSize = 10; // $10 buckets for crypto
      } else if (symbol.includes('US30') || symbol.includes('NAS100')) {
        bucketSize = 10; // 10 point buckets for indices
      } else if (symbol.includes('XAU') || symbol.includes('XAG')) {
        bucketSize = 1.0; // 1.0 buckets for metals (wider range)
      }

      console.log(`[MarketProfileService] Initializing ${symbol} with bucketSize=${bucketSize}, source=${source}`);
      this.profiles.set(symbol, {
        levels: new Map(),
        bucketSize,
        lastUpdate: null
      });
      this.sequenceNumbers.set(symbol, 0);
      this.symbolSources.set(symbol, source); // Track source for this symbol
    } else {
      // Update source if symbol already exists
      this.symbolSources.set(symbol, source);
    }
  }

  onM1Bar(symbol, bar) {
    const profile = this.profiles.get(symbol);
    if (!profile) {
      console.warn(`[MarketProfileService] No profile found for ${symbol}`);
      return;
    }

    // Deduplication: Skip if we've already processed this bar (same timestamp)
    const lastTimestamp = this.lastBarTimestamps.get(symbol);
    if (lastTimestamp === bar.timestamp) {
      console.log(`[MarketProfileService] Skipping duplicate bar for ${symbol} at ${new Date(bar.timestamp).toISOString()}`);
      return;
    }
    this.lastBarTimestamps.set(symbol, bar.timestamp);

    if (profile.levels.size >= this.MAX_LEVELS) {
      console.warn(`[MarketProfile] ${symbol} exceeded ${this.MAX_LEVELS} levels`);
      this.emit('profileError', {
        symbol,
        error: 'MAX_LEVELS_EXCEEDED',
        message: `Profile exceeded ${this.MAX_LEVELS} levels. Updates paused.`,
        currentLevels: profile.levels.size
      });
      return;
    }

    const delta = { added: [], updated: [] };
    const levels = this.generatePriceLevels(bar.low, bar.high, profile.bucketSize);

    console.log(`[MarketProfileService] Generated ${levels.length} price levels from ${bar.low} to ${bar.high}`);

    levels.forEach(price => {
      const currentTpo = profile.levels.get(price) || 0;
      const newTpo = currentTpo + 1;
      profile.levels.set(price, newTpo);

      if (currentTpo === 0) {
        delta.added.push({ price, tpo: newTpo });
      } else {
        delta.updated.push({ price, tpo: newTpo });
      }
    });

    profile.lastUpdate = bar.timestamp;

    const seq = (this.sequenceNumbers.get(symbol) || 0) + 1;
    this.sequenceNumbers.set(symbol, seq);

    const source = this.symbolSources.get(symbol) || 'ctrader';
    const fullProfile = this.getFullProfile(symbol);
    console.log(`[MarketProfileService] EMITTING profileUpdate for ${symbol} (${source}), seq=${seq}, levels=${fullProfile.levels.length}`);
    console.log(`[DEBUGGER:MarketProfileService:80-82] Sample levels:`, fullProfile.levels.slice(0, 3).map(l => ({price: l.price, tpo: l.tpo})));
    this.emit('profileUpdate', { symbol, profile: fullProfile, seq, source });
  }

  generatePriceLevels(low, high, bucketSize) {
    const levels = [];
    let currentPrice = Math.floor(low / bucketSize) * bucketSize;
    const maxLevels = 5000;
    let levelCount = 0;

    while (currentPrice <= high && levelCount < maxLevels) {
      levels.push(Math.round(currentPrice * 100000) / 100000);
      currentPrice += bucketSize;
      levelCount++;
    }

    return levels;
  }

  getFullProfile(symbol) {
    const profile = this.profiles.get(symbol);
    if (!profile) return null;

    return {
      levels: Array.from(profile.levels.entries())
        .map(([price, tpo]) => ({ price, tpo }))
        .sort((a, b) => a.price - b.price),
      bucketSize: profile.bucketSize
    };
  }

  initializeFromHistory(symbol, m1Bars, bucketSize, source = 'ctrader') {
    if (!m1Bars || m1Bars.length === 0) {
      console.log(`[MarketProfileService] No historical bars to initialize for ${symbol}`);
      return;
    }

    this.subscribeToSymbol(symbol, source);
    const profile = this.profiles.get(symbol);

    // Clear existing state and rebuild from historical data
    profile.levels.clear();
    profile.bucketSize = bucketSize;

    console.log(`[MarketProfileService] Initializing ${symbol} from ${m1Bars.length} historical bars`);

    for (const bar of m1Bars) {
      const levels = this.generatePriceLevels(bar.low, bar.high, bucketSize);
      for (const price of levels) {
        profile.levels.set(price, (profile.levels.get(price) || 0) + 1);
      }
    }

    console.log(`[MarketProfileService] Initialized ${symbol} with ${profile.levels.size} price levels`);
  }

  resetSequence(symbol) {
    this.sequenceNumbers.set(symbol, 0);
  }
}

// Export bucket size calculator for TradingViewSession
function calculateBucketSizeForSymbol(symbol) {
  if (symbol.includes('BTC') || symbol.includes('ETH')) {
    return 10; // $10 buckets for crypto
  } else if (symbol.includes('US30') || symbol.includes('NAS100')) {
    return 10; // 10 point buckets for indices
  } else if (symbol.includes('XAU') || symbol.includes('XAG')) {
    return 1.0; // 1.0 buckets for metals (wider range)
  }
  return 0.0001; // Default for forex
}

module.exports = { MarketProfileService, calculateBucketSizeForSymbol };
