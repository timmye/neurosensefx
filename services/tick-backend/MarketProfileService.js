const EventEmitter = require('events');

class MarketProfileService extends EventEmitter {
  constructor() {
    super();
    this.profiles = new Map();
    this.sequenceNumbers = new Map();
    this.MAX_LEVELS = 3000;
  }

  subscribeToSymbol(symbol, cTraderSession) {
    if (!this.profiles.has(symbol)) {
      // Calculate appropriate bucket size based on symbol
      // Crypto symbols (BTCUSD, ETHUSD) need larger buckets
      let bucketSize = 0.0001; // Default for forex
      if (symbol.includes('BTC') || symbol.includes('ETH')) {
        bucketSize = 1; // $1 buckets for crypto
      } else if (symbol.includes('US30') || symbol.includes('NAS100')) {
        bucketSize = 1; // 1 point buckets for indices
      } else if (symbol.includes('XAU') || symbol.includes('XAG')) {
        bucketSize = 0.01; // 0.01 buckets for metals
      }

      console.log(`[MarketProfileService] Initializing ${symbol} with bucketSize=${bucketSize}`);
      this.profiles.set(symbol, {
        levels: new Map(),
        bucketSize,
        lastUpdate: null
      });
      this.sequenceNumbers.set(symbol, 0);
    }
  }

  onM1Bar(symbol, bar) {
    console.log(`[MarketProfileService] onM1Bar called for ${symbol}:`, bar);
    const profile = this.profiles.get(symbol);
    if (!profile) {
      console.warn(`[MarketProfileService] No profile found for ${symbol}`);
      return;
    }

    console.log(`[MarketProfileService] Profile levels: ${profile.levels.size}, MAX: ${this.MAX_LEVELS}, bucketSize: ${profile.bucketSize}`);

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

    console.log(`[MarketProfileService] Emitting profileUpdate for ${symbol}: seq=${seq}, added=${delta.added.length}, updated=${delta.updated.length}`);
    this.emit('profileUpdate', { symbol, delta, seq });
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

  resetSequence(symbol) {
    this.sequenceNumbers.set(symbol, 0);
  }
}

module.exports = { MarketProfileService };
