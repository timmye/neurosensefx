const EventEmitter = require('events');

class MarketProfileService extends EventEmitter {
  constructor() {
    super();
    this.profiles = new Map();
    this.sequenceNumbers = new Map();
    this.symbolSources = new Map(); // Track which source each symbol uses
    this.lastBarTimestamps = new Map(); // Track last processed bar timestamp per symbol for deduplication
    this.pendingBars = new Map(); // symbol -> Array of buffered bars during initialization
    this.isProcessingPending = new Map(); // Track if currently processing pending bars for a symbol
    this.isInitializing = new Map(); // Track if currently initializing a symbol
    this.MAX_LEVELS = 3000;
    this.MAX_PENDING_BARS = 1000;
  }

  subscribeToSymbol(symbol, source = 'ctrader', currentPrice = null) {
    if (!this.profiles.has(symbol)) {
      // Use price-based bucket size if available, otherwise use default
      const bucketSize = calculateBucketSizeForSymbol(symbol, currentPrice);

      console.log(`[MarketProfileService] Initializing ${symbol} with bucketSize=${bucketSize}${currentPrice ? ` (price: ${currentPrice})` : ''}, source=${source}`);
      this.profiles.set(symbol, {
        levels: new Map(),
        bucketSize,
        lastUpdate: null
      });
      this.sequenceNumbers.set(symbol, 0);
      this.symbolSources.set(symbol, source); // Track source for this symbol
      this.pendingBars.set(symbol, []); // Initialize pending buffer
    } else {
      // Update source if symbol already exists
      this.symbolSources.set(symbol, source);
    }
  }

  cleanupSymbol(symbol) {
    // Remove pending bars buffer
    this.pendingBars.delete(symbol);
    // Remove last bar timestamp tracking
    this.lastBarTimestamps.delete(symbol);
    // Clear processing guards
    this.isProcessingPending.delete(symbol);
    this.isInitializing.delete(symbol);
    // Note: profile and sequenceNumbers persist - they are not cleaned up
    console.log(`[MarketProfileService] Cleaned up state for ${symbol}`);
  }

  onM1Bar(symbol, bar) {
    const profile = this.profiles.get(symbol);
    if (!profile) {
      console.warn(`[MarketProfileService] No profile found for ${symbol}`);
      return;
    }

    // Guard: Skip if already processing pending bars for this symbol
    if (this.isProcessingPending.get(symbol)) {
      console.log(`[MarketProfileService] Skipping bar for ${symbol} - currently processing pending bars`);
      return 0;
    }

    // Check if profile is in "initializing" state (exists but has 0 levels)
    // If so, buffer the bar instead of processing it
    if (profile.levels.size === 0) {
      const pending = this.pendingBars.get(symbol);
      if (pending) {
        // Enforce maximum pending bars limit to prevent unbounded memory growth
        if (pending.length >= this.MAX_PENDING_BARS) {
          console.error(`[MarketProfileService] Pending bars limit exceeded (${this.MAX_PENDING_BARS}) for ${symbol}, dropping oldest bar`);
          pending.shift();
        }
        console.log(`[MarketProfileService] Buffering bar for ${symbol} during initialization (timestamp: ${new Date(bar.timestamp).toISOString()})`);
        pending.push(bar);
        return;
      }
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

    const seq = this._incrementSequence(symbol);
    const source = this.symbolSources.get(symbol) || 'ctrader';
    const fullProfile = this.getFullProfile(symbol);
    console.log(`[MarketProfileService] EMITTING profileUpdate for ${symbol} (${source}), seq=${seq}, levels=${fullProfile.levels.length}`);
    console.log(`[DEBUGGER:MarketProfileService:80-82] Sample levels:`, fullProfile.levels.slice(0, 3).map(l => ({price: l.price, tpo: l.tpo})));
    this.emit('profileUpdate', { symbol, profile: fullProfile, seq, source });
  }

  generatePriceLevels(low, high, bucketSize) {
    // Validate inputs to prevent corrupted price levels
    if (!isFinite(low) || !isFinite(high) || !isFinite(bucketSize) || bucketSize <= 0) {
      console.error(`[MarketProfileService] Invalid price level inputs: low=${low}, high=${high}, bucketSize=${bucketSize}`);
      return [];
    }

    // Sanity check: price range should be reasonable
    const priceRange = high - low;
    if (priceRange < 0 || priceRange > 1000000) {
      console.warn(`[MarketProfileService] Suspicious price range: ${priceRange} (low=${low}, high=${high})`);
    }

    const levels = [];
    let currentPrice = Math.floor(low / bucketSize) * bucketSize;
    const maxLevels = 5000;
    let levelCount = 0;

    while (currentPrice <= high && levelCount < maxLevels) {
      levels.push(Math.round(currentPrice * 100000) / 100000);
      currentPrice += bucketSize;
      levelCount++;
    }

    // Log sample generated levels for debugging
    if (levels.length > 0) {
      console.log(`[DEBUGGER:MarketProfileService:generatePriceLevels] Generated ${levels.length} levels from low=${low}, high=${high}, bucketSize=${bucketSize}`);
      console.log(`[DEBUGGER:MarketProfileService:generatePriceLevels] Sample levels:`, levels.slice(0, 3), '...', levels.slice(-1));
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

  processPendingBars(symbol) {
    const pending = this.pendingBars.get(symbol);
    if (!pending || pending.length === 0) {
      return 0;
    }

    // Guard: Prevent re-entrant processing
    if (this.isProcessingPending.get(symbol)) {
      console.log(`[MarketProfileService] Already processing pending bars for ${symbol}, skipping`);
      return 0;
    }

    // Set processing guard
    this.isProcessingPending.set(symbol, true);

    try {
      console.log(`[MarketProfileService] Processing ${pending.length} pending bars for ${symbol}`);
      const processedCount = pending.length;

      // Process each buffered bar through the normal onM1Bar flow
      for (const bar of pending) {
        // Skip the initialization check since we're now initialized
        const profile = this.profiles.get(symbol);
        if (!profile || profile.levels.size === 0) {
          console.warn(`[MarketProfileService] Profile not initialized while processing pending bars for ${symbol}`);
          this.pendingBars.delete(symbol);
          return 0;
        }

        // Deduplication: Skip if we've already processed this bar (same timestamp)
        const lastTimestamp = this.lastBarTimestamps.get(symbol);
        if (lastTimestamp === bar.timestamp) {
          console.log(`[MarketProfileService] Skipping duplicate pending bar for ${symbol} at ${new Date(bar.timestamp).toISOString()}`);
          continue;
        }
        this.lastBarTimestamps.set(symbol, bar.timestamp);

        if (profile.levels.size >= this.MAX_LEVELS) {
          console.warn(`[MarketProfile] ${symbol} exceeded ${this.MAX_LEVELS} levels while processing pending bars`);
          this.emit('profileError', {
            symbol,
            error: 'MAX_LEVELS_EXCEEDED',
            message: `Profile exceeded ${this.MAX_LEVELS} levels. Updates paused.`,
            currentLevels: profile.levels.size
          });
          break;
        }

        const levels = this.generatePriceLevels(bar.low, bar.high, profile.bucketSize);

        levels.forEach(price => {
          const currentTpo = profile.levels.get(price) || 0;
          const newTpo = currentTpo + 1;
          profile.levels.set(price, newTpo);
        });

        profile.lastUpdate = bar.timestamp;
      }

      // Clear the pending buffer
      this.pendingBars.delete(symbol);

      // Emit the updated profile after processing all pending bars
      const seq = this._incrementSequence(symbol);
      const source = this.symbolSources.get(symbol) || 'ctrader';
      const fullProfile = this.getFullProfile(symbol);
      console.log(`[MarketProfileService] EMITTING profileUpdate after processing pending bars for ${symbol} (${source}), seq=${seq}, levels=${fullProfile.levels.length}`);
      this.emit('profileUpdate', { symbol, profile: fullProfile, seq, source });

      return processedCount;
    } finally {
      // Always clear the processing guard, even if an error occurred
      this.isProcessingPending.set(symbol, false);
    }
  }

  initializeFromHistory(symbol, m1Bars, bucketSize, source = 'ctrader') {
    // Guard: Prevent concurrent initialization for the same symbol
    if (this.isInitializing.get(symbol)) {
      console.warn(`[MarketProfileService] Already initializing ${symbol}, skipping duplicate initialization request`);
      return;
    }

    // Set initialization guard
    this.isInitializing.set(symbol, true);

    try {
      // Clear deduplication state for this initialization (handles reconnection scenarios)
      // IMPORTANT: Do NOT reset sequence numbers - they should only ever increase
      this.lastBarTimestamps.delete(symbol);

      // Subscribe to symbol FIRST so profile exists to receive live M1 bars
      // This is critical: even without historical data, we need to receive live bars
      this.subscribeToSymbol(symbol, source);
      const profile = this.profiles.get(symbol);

      // Always set the bucket size from the parameter (most accurate value)
      profile.bucketSize = bucketSize;

      if (!m1Bars || m1Bars.length === 0) {
        console.log(`[MarketProfileService] No historical bars for ${symbol} - will build from live M1 bars`);
        // Emit initial empty profile so frontend knows profile is ready
        const seq = this._incrementSequence(symbol);
        const fullProfile = this.getFullProfile(symbol);
        console.log(`[MarketProfileService] EMITTING initial empty profile for ${symbol} (${source}), levels=${fullProfile.levels.length}, seq=${seq}`);
        this.emit('profileUpdate', { symbol, profile: fullProfile, seq, source });
        return;
      }

      // Clear existing state and rebuild from historical data
      profile.levels.clear();

      console.log(`[MarketProfileService] Initializing ${symbol} from ${m1Bars.length} historical bars`);

      for (const bar of m1Bars) {
        const levels = this.generatePriceLevels(bar.low, bar.high, bucketSize);
        for (const price of levels) {
          profile.levels.set(price, (profile.levels.get(price) || 0) + 1);
        }
      }

      console.log(`[MarketProfileService] Initialized ${symbol} with ${profile.levels.size} price levels`);

      // Process any bars that arrived during initialization
      const pendingCount = this.processPendingBars(symbol);
      if (pendingCount > 0) {
        console.log(`[MarketProfileService] Processed ${pendingCount} pending bars that arrived during initialization for ${symbol}`);
      }

      // Emit profileUpdate so frontend receives the initialized profile
      const seq = this._incrementSequence(symbol);
      const fullProfile = this.getFullProfile(symbol);
      console.log(`[MarketProfileService] EMITTING profileUpdate after initializeFromHistory for ${symbol} (${source}), levels=${fullProfile.levels.length}`);
      this.emit('profileUpdate', { symbol, profile: fullProfile, seq, source });
    } finally {
      // Always clear the initialization guard, even if an error occurred
      this.isInitializing.set(symbol, false);
    }
  }

  resetSequence(symbol) {
    this.sequenceNumbers.set(symbol, 0);
  }

  /**
   * Increment and return the next sequence number for a symbol
   * Sequence numbers should ONLY ever increase - never reset during normal operation
   * @param {string} symbol - Symbol identifier
   * @returns {number} The new sequence number
   * @private
   */
  _incrementSequence(symbol) {
    const seq = (this.sequenceNumbers.get(symbol) || 0) + 1;
    this.sequenceNumbers.set(symbol, seq);
    return seq;
  }

  /**
   * Re-emit the current profile for a symbol (used for refresh)
   * @param {string} symbol - Symbol identifier
   */
  reemitProfile(symbol) {
    const profile = this.profiles.get(symbol);
    if (!profile || profile.levels.size === 0) {
      console.log(`[MarketProfileService] No profile to re-emit for ${symbol}`);
      return;
    }

    const source = this.symbolSources.get(symbol) || 'ctrader';
    const seq = this._incrementSequence(symbol);
    const fullProfile = this.getFullProfile(symbol);
    console.log(`[MarketProfileService] RE-EMITTING profileUpdate for ${symbol} (${source}), seq=${seq}, levels=${fullProfile.levels.length}`);
    this.emit('profileUpdate', { symbol, profile: fullProfile, seq, source });
  }
}

/**
 * Calculate bucket size based on price magnitude
 * Targets ~50-200 levels for typical daily range (2-5% of price)
 * @param {string} symbol - Symbol identifier
 * @param {number|null} currentPrice - Current price (if available)
 * @returns {number} Bucket size to use
 */
function calculateBucketSizeForSymbol(symbol, currentPrice = null) {
  // If we have actual price, use percentage-based bucket sizing
  if (currentPrice !== null && currentPrice > 0) {
    return getBucketSizeForPrice(currentPrice);
  }

  // Fallback: symbol-based rules (for when price not yet available)
  // Uses estimated prices to calculate percentage-based buckets (0.1% of price)
  if (symbol.includes('US30') || symbol.includes('NAS100')) {
    return 50;  // ~$35k price * 0.1% = $35 bucket
  }
  if (symbol.includes('XAU') || symbol.includes('XAG')) {
    return 2.5; // ~$2500 gold * 0.1% = $2.5 bucket
  }

  // Crypto fallback - use 0.1% of estimated typical price
  if (symbol.includes('BTC')) return 70;      // ~$70k * 0.1% = $70
  if (symbol.includes('ETH')) return 2.5;     // ~$2500 * 0.1% = $2.50
  if (symbol.includes('BNB')) return 0.60;    // ~$600 * 0.1% = $0.60
  if (symbol.includes('BCH')) return 0.40;    // ~$400 * 0.1% = $0.40
  if (symbol.includes('SOL')) return 0.15;    // ~$150 * 0.1% = $0.15
  if (symbol.includes('XRP')) return 0.0006;  // ~$0.60 * 0.1% = $0.0006
  if (symbol.includes('ADA')) return 0.0005;  // ~$0.50 * 0.1% = $0.0005
  if (symbol.includes('DOGE')) return 0.0001; // ~$0.10 * 0.1% = $0.0001
  if (symbol.includes('DOT')) return 0.007;   // ~$7 * 0.1% = $0.007
  if (symbol.includes('LINK')) return 0.015;  // ~$15 * 0.1% = $0.015
  if (symbol.includes('AVAX')) return 0.035;  // ~$35 * 0.1% = $0.035
  if (symbol.includes('MATIC')) return 0.0005;// ~$0.50 * 0.1% = $0.0005
  if (symbol.includes('UNI')) return 0.007;   // ~$7 * 0.1% = $0.007
  if (symbol.includes('ATOM')) return 0.008;  // ~$8 * 0.1% = $0.008
  if (symbol.includes('LTC')) return 0.10;    // ~$100 * 0.1% = $0.10

  // Check for USD-quoted crypto (generic fallback)
  if (symbol.includes('USD')) {
    return 0.01; // Generic crypto fallback
  }

  return 0.0001; // Default for forex
}

/**
 * Calculate bucket size based on price using percentage-based method
 * Bucket size = 0.1% of price
 * This ensures ~100 levels for 10% daily move (typical crypto volatility)
 * @param {number} price - Current price
 * @returns {number} Bucket size
 */
function getBucketSizeForPrice(price) {
  // Percentage of price to use as bucket size
  // 0.001 = 0.1% -> ~100 levels for 10% daily move
  const BUCKET_PERCENTAGE = 0.0001;

  // Calculate bucket as percentage of price
  let bucket = price * BUCKET_PERCENTAGE;

  // Round to appropriate precision based on price magnitude
  if (price > 1000) {
    // Large prices (BTC, indices): round to nearest 0.1
    bucket = Math.round(bucket * 10) / 10;
  } else if (price > 100) {
    // Medium prices (LTC, AVAX): round to 2 decimal places
    bucket = Math.round(bucket * 100) / 100;
  } else if (price > 1) {
    // Small prices (DOT, LINK): round to 4 decimal places
    bucket = Math.round(bucket * 10000) / 10000;
  } else {
    // Tiny prices (DOGE, SHIB): round to 6 decimal places
    bucket = Math.round(bucket * 1000000) / 1000000;
  }

  // Ensure minimum bucket size to prevent excessive levels
  const MIN_BUCKET = 0.00001;
  return Math.max(bucket, MIN_BUCKET);
}

module.exports = { MarketProfileService, calculateBucketSizeForSymbol };
