import {
  TickSchema,
  MarketProfileSchema,
  VisualizationStateSchema,
  ProcessedTickSchema
} from '../data/schema.js';

let config = {};
let state = {};
let localDigits = 5;

function convertValue(value, digits) {
  if (typeof value !== 'number' || isNaN(value)) return 0;
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

    state = {
        ready: true,
        hasPrice: !!initialPrice,
        currentPrice: initialPrice,
        midPrice: convertValue(payload.todaysOpen, localDigits),
        projectedAdrHigh: convertValue(payload.projectedAdrHigh, localDigits),
        projectedAdrLow: convertValue(payload.projectedAdrLow, localDigits),
        visualHigh: convertValue(payload.projectedAdrHigh, localDigits),
        visualLow: convertValue(payload.projectedAdrLow, localDigits),
        todaysHigh: convertValue(payload.todaysHigh, localDigits),
        todaysLow: convertValue(payload.todaysLow, localDigits),
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
        lastTick: {
            bid: initialPrice,
            ask: initialPrice,
            timestamp: Date.now(),
        },
        ticks: [],
        tickMagnitudes: [],
        allTicks: (payload.initialMarketProfile || []).map(bar => ({
            price: convertValue(bar.close, localDigits),
            direction: convertValue(bar.close, localDigits) > convertValue(bar.open, localDigits) ? 1 : -1,
            magnitude: Math.abs(convertValue(bar.close, localDigits) - convertValue(bar.open, localDigits)) * Math.pow(10, localDigits),
            time: bar.timestamp,
            ticks: bar.volume ?? 1
        })),
    };

    runCalculationsAndPostUpdate();
}

function processTick(rawTick) {
    // 🔧 DEFENSIVE FIX: Ensure state is properly initialized before processing
    if (!state || !state.ready || typeof state.ticks === 'undefined' || typeof state.allTicks === 'undefined') {
        return;
    }

    const tick = TickSchema.parse(rawTick);
    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.hasPrice = true; // 🔧 FIX: Update hasPrice when we receive a valid tick
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
    state.lastTick = tick;
    state.lastTickTime = tick.timestamp; // TRADER-FOCUSED: Track real tick timestamp for data freshness
    state.todaysHigh = Math.max(state.todaysHigh, tick.bid);
    state.todaysLow = Math.min(state.todaysLow, tick.bid);
    
    const magnitude = Math.abs(state.currentPrice - lastPrice) * Math.pow(10, localDigits);
    const now = performance.now();
    const newTick = { price: state.currentPrice, direction: state.lastTickDirection === 'up' ? 1 : -1, magnitude, time: now, ticks: 1 };
    
    state.ticks.push(newTick);
    state.allTicks.push(newTick);
    state.tickMagnitudes.push(magnitude);

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
    
    updateVolatility(performance.now());
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

function postStateUpdate() {
    console.log('[WORKER_DEBUG] Posting state update, state.ready:', state.ready);
    console.log('[WORKER_DEBUG] State hasPrice:', state.hasPrice);
    console.log('[WORKER_DEBUG] State sample:', { ready: state.ready, hasPrice: state.hasPrice, currentPrice: state.currentPrice });
    
    const result = VisualizationStateSchema.safeParse(state);
    if (result.success) {
        console.log('[WORKER_DEBUG] Schema validation passed, posting message');
        self.postMessage({
            type: 'stateUpdate',
            payload: { newState: result.data }
        });
    } else {
        console.error('[WORKER_DEBUG] Invalid state detected. Aborting update.', result.error.format());
    }
}
