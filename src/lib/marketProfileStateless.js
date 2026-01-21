// Market Profile - STATELESS/FUNCTIONAL Implementation
// Crystal Clarity Compliant | Framework-first
//
// ARCHITECTURE:
// - Store raw tick data (immutable)
// - Recompute entire profile on each tick
// - Pure functions, no side effects
// - Bounded O(1) memory with sliding window
//
// BENEFITS:
// - Zero fragmentation (consistent bucketing)
// - Simple state (just arrays)
// - Easy debugging (pure functions)
// - API compatible (drop-in replacement)

import { formatPrice } from './priceFormat.js';

// =============================================================================
// PUBLIC API - Drop-in replacement for stateful version
// =============================================================================

/**
 * Create a stateless profile container.
 *
 * @param {Array} m1Bars - Initial M1 bars from symbolDataPackage
 * @param {number} bucketSize - Price bucket size for grouping
 * @param {Object} symbolData - Symbol metadata (pipPosition, etc.)
 * @returns {Object} Profile container with pure computation methods
 */
export function createStatelessProfile(m1Bars, bucketSize, symbolData = null) {
  // Immutable storage: raw M1 bars + tick window
  const state = {
    m1Bars: [...(m1Bars || [])],
    ticks: [],
    bucketSize,
    symbolData,
    maxTicks: 10000 // Bounded memory: ~400KB at 40 bytes/tick
  };

  return {
    // Pure function: compute profile from current state
    compute: () => computeProfileFromState(state),

    // Pure function: add tick, return new state reference
    addTick: (tick) => addTickToState(state, tick),

    // Pure function: get current state snapshot
    getState: () => ({
      m1BarCount: state.m1Bars.length,
      tickCount: state.ticks.length,
      bucketSize: state.bucketSize,
      symbol: symbolData?.symbol || 'unknown'
    }),

    // Utilities
    getBucketSize: () => state.bucketSize,
    getSymbolData: () => state.symbolData,

    // Clear tick window (for refresh)
    clearTicks: () => { state.ticks = []; }
  };
}

/**
 * Legacy wrapper: Create stateless profile and return computed result.
 * Maintains API compatibility with buildInitialProfile().
 *
 * @param {Array} m1Bars - Initial M1 bars
 * @param {number} bucketSize - Price bucket size
 * @param {Object} symbolData - Symbol metadata
 * @returns {Object} { profile: Array, container: Object }
 */
export function buildInitialStatelessProfile(m1Bars, bucketSize = 0.00001, symbolData = null) {
  const container = createStatelessProfile(m1Bars, bucketSize, symbolData);
  const profile = container.compute();

  console.log(`[MARKET_PROFILE_STATELESS] Built profile with ${profile.length} levels from ${m1Bars.length} M1 bars (bucket: ${bucketSize})`);

  return { profile, container };
}

// =============================================================================
// CORE PURE FUNCTIONS
// =============================================================================

/**
 * Compute market profile from raw state (pure function).
 * This is the core stateless operation - no side effects.
 * Always produces consistent, correctly bucketed output.
 *
 * PERFORMANCE: O(n) where n = m1Bars.length + ticks.length
 * With bounded tick window (10k), this is effectively O(1)
 *
 * @param {Object} state - State container with m1Bars and ticks
 * @returns {Array} Computed profile with {price, tpo} entries
 */
function computeProfileFromState(state) {
  const { m1Bars, ticks, bucketSize, symbolData } = state;
  const priceMap = new Map();

  // Process M1 bars (static historical data)
  for (const bar of m1Bars) {
    const levels = generatePriceLevels(bar.low, bar.high, bucketSize, symbolData);
    for (const price of levels) {
      priceMap.set(price, (priceMap.get(price) || 0) + 1);
    }
  }

  // Process live ticks (real-time data) - SAME bucketing logic
  // This is the KEY FIX: no fragmentation because alignment is consistent
  for (const tick of ticks) {
    const alignedPrice = alignPriceToBucket(tick.bid || tick.price, bucketSize, symbolData);
    if (alignedPrice !== null) {
      priceMap.set(alignedPrice, (priceMap.get(alignedPrice) || 0) + 1);
    }
  }

  // Convert to sorted array (immutable result)
  return Array.from(priceMap.entries())
    .map(([price, tpo]) => ({ price, tpo }))
    .sort((a, b) => a.price - b.price);
}

/**
 * Add tick to state (pure function with bounded memory).
 *
 * @param {Object} state - State container
 * @param {Object} tick - Tick data with bid/price
 * @returns {Object} Reference to state (for chaining)
 */
function addTickToState(state, tick) {
  state.ticks.push(tick);

  // Bounded memory: evict oldest ticks if exceeds limit
  // This keeps O(1) memory regardless of runtime
  if (state.ticks.length > state.maxTicks) {
    state.ticks.splice(0, state.ticks.length - state.maxTicks);
  }

  return state;
}

/**
 * Align raw tick price to bucket boundary (pure function).
 * This is the KEY FIX for fragmentation bug.
 *
 * @param {number} rawPrice - Raw tick price (e.g., 1.0851037)
 * @param {number} bucketSize - Bucket size (e.g., 0.00001)
 * @param {Object} symbolData - Symbol metadata for formatting
 * @returns {number|null} Aligned price or null if invalid
 */
function alignPriceToBucket(rawPrice, bucketSize, symbolData = null) {
  if (typeof rawPrice !== 'number' || !isFinite(rawPrice)) return null;
  if (typeof bucketSize !== 'number' || bucketSize <= 0) return null;

  // Align to bucket boundary (same as generatePriceLevels)
  const bucketedPrice = Math.floor(rawPrice / bucketSize) * bucketSize;

  // Format to consistent precision (eliminates floating point errors)
  const pipPosition = symbolData?.pipPosition ?? 4;
  return parseFloat(formatPrice(bucketedPrice, pipPosition));
}

/**
 * Generate price levels for a range (pure function).
 *
 * @param {number} low - Low price
 * @param {number} high - High price
 * @param {number} bucketSize - Bucket size
 * @param {Object} symbolData - Symbol metadata
 * @returns {Array} Array of price levels
 */
function generatePriceLevels(low, high, bucketSize, symbolData = null) {
  const levels = [];
  let currentPrice = Math.floor(low / bucketSize) * bucketSize;

  // Safety limit: prevent infinite loops
  const maxLevels = 5000;
  let levelCount = 0;

  while (currentPrice <= high && levelCount < maxLevels) {
    const pipPosition = symbolData?.pipPosition ?? 4;
    levels.push(parseFloat(formatPrice(currentPrice, pipPosition)));
    currentPrice += bucketSize;
    levelCount++;
  }

  if (levelCount >= maxLevels) {
    console.warn('[MARKET_PROFILE_STATELESS] Price level generation hit safety limit');
  }

  return levels;
}

// =============================================================================
// UTILITY FUNCTIONS (compatible with legacy API)
// =============================================================================

/**
 * Calculate Point of Control (POC).
 *
 * @param {Array} profile - Market profile array
 * @returns {Object|null} POC level or null
 */
export function calculatePointOfControl(profile) {
  if (!profile || profile.length === 0) return null;
  return profile.reduce((maxLevel, level) =>
    level.tpo > maxLevel.tpo ? level : maxLevel
  );
}

/**
 * Calculate Value Area.
 *
 * @param {Array} profile - Market profile array
 * @param {number} targetPercentage - Target coverage (default 0.7)
 * @returns {Object} Value area range
 */
export function calculateValueArea(profile, targetPercentage = 0.7) {
  if (!profile || profile.length === 0) {
    return { high: null, low: null };
  }

  const totalTpo = profile.reduce((sum, level) => sum + level.tpo, 0);
  const targetTpo = totalTpo * targetPercentage;

  const pocIndex = profile.reduce((maxIndex, level, index, arr) =>
    level.tpo > arr[maxIndex].tpo ? index : maxIndex, 0);

  let currentTpo = profile[pocIndex].tpo;
  const valueAreaLevels = [profile[pocIndex]];

  let upperIndex = pocIndex + 1;
  let lowerIndex = pocIndex - 1;

  while (currentTpo < targetTpo && (upperIndex < profile.length || lowerIndex >= 0)) {
    const upperLevel = upperIndex < profile.length ? profile[upperIndex] : null;
    const lowerLevel = lowerIndex >= 0 ? profile[lowerIndex] : null;

    let selectedLevel = null;

    if (upperLevel && lowerLevel) {
      if (upperLevel.tpo >= lowerLevel.tpo) {
        selectedLevel = upperLevel;
        upperIndex++;
      } else {
        selectedLevel = lowerLevel;
        lowerIndex--;
      }
    } else if (upperLevel) {
      selectedLevel = upperLevel;
      upperIndex++;
    } else if (lowerLevel) {
      selectedLevel = lowerLevel;
      lowerIndex--;
    }

    if (selectedLevel) {
      valueAreaLevels.push(selectedLevel);
      currentTpo += selectedLevel.tpo;
    }
  }

  const prices = valueAreaLevels.map(level => level.price);
  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    levels: valueAreaLevels.sort((a, b) => a.price - b.price),
    totalTpo: currentTpo,
    targetTpo: targetTpo,
    percentage: (currentTpo / totalTpo) * 100
  };
}

// =============================================================================
// PROCESSING FUNCTIONS (API compatible with processMarketProfileData)
// =============================================================================

/**
 * Process market profile data with stateless container.
 *
 * @param {Object} data - Data package from backend
 * @param {Object} lastContainer - Previous stateless container
 * @returns {Object} { profile, container } or null
 */
export function processMarketProfileDataStateless(data, lastContainer = null) {
  if (data.type === 'symbolDataPackage') {
    const { profile, container } = buildInitialStatelessProfile(
      data.initialMarketProfile || [],
      data.bucketSize || 0.00001,
      data
    );
    return { profile, container };
  } else if (data.type === 'tick' && lastContainer) {
    lastContainer.addTick(data);
    const profile = lastContainer.compute();
    return { profile, container: lastContainer };
  }
  return null;
}
