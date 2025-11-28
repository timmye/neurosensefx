import {
  TickSchema,
  MarketProfileSchema,
  VisualizationStateSchema,
  ProcessedTickSchema
} from '../data/schema.js';

let config = {};
let state = {};
let localDigits = 5;

// 🚨 WORKER PERFORMANCE API: Enhanced timing fallback for web worker context
function getWorkerTime() {
  try {
    // Worker context performance API
    if (typeof self !== 'undefined' && self.performance &&
        typeof self.performance.now === 'function') {
      return self.performance.now();
    }

    // Global context fallback
    if (typeof globalThis !== 'undefined' && globalThis.performance &&
        typeof globalThis.performance.now === 'function') {
      return globalThis.performance.now();
    }

    // Date.now() fallback
    return Date.now();
  } catch (error) {
    console.warn('[WORKER] Performance API unavailable, using Date.now() fallback:', error.message);
    return Date.now();
  }
}

function convertValue(value, digits) {
  if (value === null || value === undefined) return null; // Preserve null for missing data
  if (typeof value !== 'number' || isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

self.onmessage = (event) => {
    const { type, payload } = event.data;
    try {
        switch (type) {
            case 'init':
                initialize(payload);
                break;
            case 'tick':
                processTick(payload);
                break;
            case 'updateConfig':
                updateConfig(payload);
                break;
            default:
                console.warn('[WORKER_DEBUG] Unknown message type:', type);
        }
    } catch (error) {
        console.error('[WORKER_DEBUG] FATAL: Uncaught error in onmessage handler:', error);
    }
};

function initialize(payload) {
    config = payload.config;
    localDigits = typeof payload.digits === 'number' ? payload.digits : 5;
    const initialPrice = convertValue(payload.initialPrice, localDigits);

      // 🔧 CRITICAL FIX: Ensure we have a valid initial price for schema compliance
    const safeInitialPrice = (initialPrice !== null && initialPrice !== undefined && !isNaN(initialPrice))
        ? initialPrice
        : (convertValue(payload.todaysOpen, localDigits) || 1.0); // Fallback to todaysOpen or 1.0

    // 🔧 CRITICAL FIX: Ensure safe defaults for all required numeric fields
    const safeTodaysOpen = convertValue(payload.todaysOpen, localDigits) || safeInitialPrice;
    const safeProjectedAdrHigh = convertValue(payload.projectedAdrHigh, localDigits) || (safeInitialPrice * 1.01);
    const safeProjectedAdrLow = convertValue(payload.projectedAdrLow, localDigits) || (safeInitialPrice * 0.99);
    const safeTodaysHigh = convertValue(payload.todaysHigh, localDigits) || safeInitialPrice;
    const safeTodaysLow = convertValue(payload.todaysLow, localDigits) || safeInitialPrice;

    // 🔧 CRITICAL FIX: Filter out invalid historical bars to prevent state corruption
    const validHistoricalBars = (payload.initialMarketProfile || []).filter(bar => {
        const close = convertValue(bar.close, localDigits);
        const open = convertValue(bar.open, localDigits);
        return close !== null && open !== null && !isNaN(close) && !isNaN(open);
    });

    state = {
        ready: true,
        hasPrice: !!initialPrice, // Keep original hasPrice logic
        currentPrice: safeInitialPrice, // Use safe price for schema compliance
        midPrice: safeTodaysOpen,
        projectedAdrHigh: safeProjectedAdrHigh,
        projectedAdrLow: safeProjectedAdrLow,
        visualHigh: safeProjectedAdrHigh,
        visualLow: safeProjectedAdrLow,
        todaysHigh: safeTodaysHigh,
        todaysLow: safeTodaysLow,
        maxAdrPercentage: 0.3,
        digits: localDigits,
        lastTickDirection: 'up',
        volatility: 0.5,
        volatilityIntensity: 0.25,
        marketProfile: { levels: [], tickCount: 0 },
        flashEffect: null,
        lastTickTime: 0,
        maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
        priceFloatPulseEffect: { active: false, magnitude: 0, color: '', scale: 1 },
        // 🔧 CRITICAL FIX: Use safe initial price for lastTick schema compliance
        lastTick: {
            bid: safeInitialPrice,
            ask: safeInitialPrice,
            timestamp: Date.now(),
        },
        ticks: [],
        // 🔧 CRITICAL FIX: Initialize missing tickMagnitudes array (ROOT CAUSE #1)
        tickMagnitudes: [],
        // 🔧 CRITICAL FIX: Use filtered valid historical bars to prevent invalid data (ROOT CAUSE #3)
        allTicks: validHistoricalBars.map(bar => {
            const close = convertValue(bar.close, localDigits);
            const open = convertValue(bar.open, localDigits);
            return {
                price: close,
                direction: close > open ? 1 : -1,
                magnitude: Math.abs(close - open) * Math.pow(10, localDigits),
                time: bar.timestamp,
                ticks: bar.volume ?? 1
            };
        }),
        // 🎯 PERFORMANCE MONITORING: Initialize performance tracking fields
        lastDataReceiptTimestamp: null,
    };

    runCalculationsAndPostUpdate();
}

function processTick(rawTick) {
    // 🔧 DEFENSIVE FIX: Ensure state is properly initialized before processing
    if (!state || !state.ready || typeof state.ticks === 'undefined' || typeof state.allTicks === 'undefined') {
        return;
    }

    // 🎯 PERFORMANCE MONITORING: Track data receipt timestamp for latency measurement
    const dataReceiptTimestamp = getWorkerTime();
    const tick = TickSchema.parse(rawTick);

    // 🔧 DEFENSIVE FIX: Validate tick data before state updates
    if (typeof tick.bid !== 'number' || !isFinite(tick.bid) ||
        typeof tick.ask !== 'number' || !isFinite(tick.ask)) {
        console.warn('[WORKER_DEBUG] Invalid tick data detected, skipping:', { bid: tick.bid, ask: tick.ask });
        return;
    }

    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.hasPrice = true; // 🔧 FIX: Update hasPrice when we receive a valid tick

    // 🔧 DEFENSIVE FIX: Handle undefined lastPrice for first tick
    state.lastTickDirection = (typeof lastPrice === 'number' && isFinite(lastPrice))
        ? (state.currentPrice > lastPrice ? 'up' : 'down')
        : 'up';
    state.lastTick = tick;
    state.lastTickTime = tick.timestamp; // TRADER-FOCUSED: Track real tick timestamp for data freshness
    state.todaysHigh = Math.max(state.todaysHigh, tick.bid);
    state.todaysLow = Math.min(state.todaysLow, tick.bid);

    // 🔧 DEFENSIVE FIX: Safe magnitude calculation to prevent NaN
    const magnitude = (typeof lastPrice === 'number' && isFinite(lastPrice))
        ? Math.abs(state.currentPrice - lastPrice) * Math.pow(10, localDigits)
        : 0.01; // Default small magnitude for first tick

    const now = getWorkerTime();
    const newTick = { price: state.currentPrice, direction: state.lastTickDirection === 'up' ? 1 : -1, magnitude, time: now, ticks: 1 };

    state.ticks.push(newTick);
    state.allTicks.push(newTick);
    state.tickMagnitudes.push(magnitude);

    // 🎯 PERFORMANCE MONITORING: Include data receipt timestamp for latency tracking
    state.lastDataReceiptTimestamp = dataReceiptTimestamp;

    runCalculationsAndPostUpdate();
}

function updateConfig(newConfig) {
    config = { ...config, ...newConfig };
    runCalculationsAndPostUpdate();
}

function runCalculationsAndPostUpdate() {
    // 🔧 DEFENSIVE FIX: Ensure state is initialized before running calculations
    if (!state || !state.ready) {
        console.warn('[WORKER_DEBUG] runCalculationsAndPostUpdate called before initialization complete, skipping');
        return;
    }
    
    updateVolatility(getWorkerTime());
    state.marketProfile = generateMarketProfile();
    console.log('[WORKER_DEBUG] Market profile generated:', {
      levelsCount: state.marketProfile.levels.length,
      tickCount: state.marketProfile.tickCount,
      allTicksCount: state.allTicks.length
    });
    recalculateVisualRange();
    postStateUpdate();
}

function updateVolatility(now) {
    // 🔧 DEFENSIVE FIX: Ensure state arrays exist before accessing
    if (!state || typeof state.ticks === 'undefined' || typeof state.tickMagnitudes === 'undefined') {
        console.warn('[WORKER_DEBUG] updateVolatility called before state arrays initialized, skipping');
        return;
    }

    const lookbackPeriod = 10000;
    state.ticks = state.ticks.filter(t => now - t.time <= lookbackPeriod);
    if (state.tickMagnitudes.length > 50) state.tickMagnitudes.shift();

    if (state.ticks.length < 2) {
        state.volatility *= 0.95;
        return;
    }

    const avgMagnitude = state.tickMagnitudes.reduce((sum, mag) => sum + mag, 0) / state.tickMagnitudes.length;
    const tickFrequency = state.ticks.length / (lookbackPeriod / 1000);
    const magnitudeScore = Math.min(avgMagnitude / 2, 3);
    const frequencyScore = Math.min(tickFrequency / 5, 3);
    const rawVolatility = (magnitudeScore * 0.6) + (frequencyScore * 0.4);
    const smoothingFactor = 0.2;
    state.volatility = (state.volatility * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    state.volatility = Math.max(0.05, state.volatility);
    state.volatilityIntensity = Math.min(1, state.volatility / 3.5);
}

function generateMarketProfile() {
    // 🔧 DEFENSIVE FIX: Ensure state.allTicks exists before accessing
    if (!state || typeof state.allTicks === 'undefined') {
        console.warn('[WORKER_DEBUG] generateMarketProfile called before state.allTicks initialized, returning empty profile');
        return { levels: [], tickCount: 0 };
    }

    const pipetteSize = 1 / Math.pow(10, localDigits);
    const priceBucketSize = pipetteSize * (config.priceBucketMultiplier || 1);

    if (!priceBucketSize || priceBucketSize <= 0 || isNaN(priceBucketSize)) {
        return { levels: [], tickCount: 0 };
    }

    const profileData = new Map();
    const relevantTicks = config.distributionDepthMode === 'all'
        ? state.allTicks
        : state.allTicks.slice(-Math.floor(state.allTicks.length * ((config.distributionPercentage ?? 100) / 100)));

    const priceToBucketFactor = 1 / priceBucketSize;

    relevantTicks.forEach(t => {
        const priceBucket = Math.floor(t.price * priceToBucketFactor);
        const bucket = profileData.get(priceBucket) || { buy: 0, sell: 0, volume: 0 };
        if (t.direction > 0) bucket.buy += t.ticks; else bucket.sell += t.ticks;
        bucket.volume += t.ticks;
        profileData.set(priceBucket, bucket);
    });

    const finalProfile = {
        levels: Array.from(profileData.entries()).map(([bucket, data]) => ({
            price: bucket / priceToBucketFactor,
            volume: data.volume,
            buy: data.buy,
            sell: data.sell,
            delta: data.buy - data.sell, // Calculate delta for delta modes
        })).sort((a, b) => a.price - b.price),
        tickCount: relevantTicks.reduce((sum, t) => sum + t.ticks, 0)
    };
    
    return finalProfile;
}

function recalculateVisualRange() {
    const adrRange = state.projectedAdrHigh - state.projectedAdrLow;
    const priceDistanceFromOpen = Math.abs(state.currentPrice - state.midPrice);
    const currentAdrPercentage = priceDistanceFromOpen / adrRange;

    let targetAdrPercentage = 0.3; // Default to 30%
    if (currentAdrPercentage > 0.75) {
        targetAdrPercentage = 1.0;
    } else if (currentAdrPercentage > 0.5) {
        targetAdrPercentage = 0.75;
    } else if (currentAdrPercentage > 0.3) {
        targetAdrPercentage = 0.5;
    }

    state.maxAdrPercentage = targetAdrPercentage;

    const visualRangeHalf = (adrRange / 2) * state.maxAdrPercentage;
    const visualHigh = state.midPrice + visualRangeHalf;
    const visualLow = state.midPrice - visualRangeHalf;

    // Ensure the actual day's high/low are always visible
    const finalHigh = Math.max(visualHigh, state.todaysHigh);
    const finalLow = Math.min(visualLow, state.todaysLow);

    const padding = (finalHigh - finalLow) * 0.05;

    state.visualHigh = finalHigh + padding;
    state.visualLow = finalLow - padding;

    // ADR calculation completed
}

// 🔧 DEFENSIVE FIX: Pure state validation (no state modification)
function validateStateForSchema(state) {
    const requiredFields = ['ready', 'hasPrice', 'currentPrice', 'midPrice'];
    const requiredArrays = ['ticks', 'allTicks', 'tickMagnitudes'];

    // Check required fields exist and have correct types
    for (const field of requiredFields) {
        if (state[field] === undefined || state[field] === null) {
            return { valid: false, error: `Missing required field: ${field}` };
        }
    }

    // CRITICAL FIX: Only validate arrays, don't modify state
    for (const array of requiredArrays) {
        if (!Array.isArray(state[array])) {
            return { valid: false, error: `Invalid array field: ${array} must be an array` };
        }
    }

    // CRITICAL FIX: Only validate numeric values, don't modify state
    if (typeof state.currentPrice !== 'number' || !isFinite(state.currentPrice)) {
        return { valid: false, error: `Invalid currentPrice: must be a finite number` };
    }
    if (typeof state.midPrice !== 'number' || !isFinite(state.midPrice)) {
        return { valid: false, error: `Invalid midPrice: must be a finite number` };
    }

    return { valid: true };
}

// 🔧 DEFENSIVE FIX: Separate function for state correction when validation fails
function correctStateForSchema(state) {
    const requiredArrays = ['ticks', 'allTicks', 'tickMagnitudes'];

    // Initialize missing arrays without changing validation logic
    for (const array of requiredArrays) {
        if (!Array.isArray(state[array])) {
            console.warn(`[WORKER_DEBUG] Correcting invalid array field: ${array}`);
            state[array] = [];
        }
    }

    // Sanitize numeric values only when correction is needed
    if (typeof state.currentPrice !== 'number' || !isFinite(state.currentPrice)) {
        console.warn('[WORKER_DEBUG] Correcting invalid currentPrice');
        state.currentPrice = 0;
    }
    if (typeof state.midPrice !== 'number' || !isFinite(state.midPrice)) {
        console.warn('[WORKER_DEBUG] Correcting invalid midPrice');
        state.midPrice = state.currentPrice || 0;
    }
}

function postStateUpdate() {
    // 🔧 DEFENSIVE FIX: Validate state before schema parsing
    let stateValidation = validateStateForSchema(state);
    if (!stateValidation.valid) {
        console.error('[WORKER_DEBUG] State validation failed before schema parse:', stateValidation.error);

        // CRITICAL FIX: Attempt state correction and re-validate
        console.warn('[WORKER_DEBUG] Attempting state correction...');
        correctStateForSchema(state);
        stateValidation = validateStateForSchema(state);

        if (!stateValidation.valid) {
            console.error('[WORKER_DEBUG] State correction failed, aborting update:', stateValidation.error);
            return;
        }

        console.log('[WORKER_DEBUG] State correction successful, proceeding with update');
    }

    // Include data receipt timestamp for latency tracking
    const stateWithTimestamp = {
        ...state,
        lastDataReceiptTimestamp: state.lastDataReceiptTimestamp || null
    };

    const result = VisualizationStateSchema.safeParse(stateWithTimestamp);
    if (result.success) {
        self.postMessage({
            type: 'stateUpdate',
            payload: { newState: result.data }
        });
    } else {
        console.error('[WORKER_DEBUG] Invalid state detected. Aborting update.', result.error.format());
    }
}
