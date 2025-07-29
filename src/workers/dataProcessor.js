import {
  TickSchema,
  MarketProfileSchema,
  VisualizationStateSchema,
  VisualizationConfigSchema
} from '../data/schema.js';

let config = {};
let state = {};
let digits = 5;

self.onmessage = (event) => {
    const { type, payload } = event.data;
    try {
        console.log(`[MP_DEBUG | Worker] Received message type: ${type}`, payload);
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
        }
    } catch (error) {
        console.error('[MP_DEBUG | Worker] Uncaught error in onmessage handler:', error);
    }
};

function initialize(payload) {
    console.log('[MP_DEBUG | Worker] Initializing with payload:', payload);
    config = payload.config;
    digits = typeof payload.digits === 'number' ? payload.digits : 5; 

    const initialTicks = (payload.initialMarketProfile || []).map(bar => ({
        price: bar.close,
        direction: bar.close > bar.open ? 1 : -1,
        magnitude: Math.abs(bar.close - bar.open) * Math.pow(10, digits),
        time: bar.timestamp 
    }));
    console.log('[MP_DEBUG | Worker] Mapped initialMarketProfile to initialTicks:', initialTicks.length);

    state = {
        currentPrice: payload.initialPrice, 
        midPrice: payload.todaysOpen,
        adrHigh: payload.projectedHigh,
        adrLow: payload.projectedLow,
        visualHigh: payload.projectedHigh,
        visualLow: payload.projectedLow,
        todaysHigh: payload.todaysHigh,
        todaysLow: payload.todaysLow,
        ticks: [],
        allTicks: initialTicks,
        volatility: 0.5,
        volatilityIntensity: 0.25,
        tickMagnitudes: [],
        lastTickDirection: 'up',
        marketProfile: { levels: [], tickCount: 0 },
        flashEffect: null,
        lastTickTime: 0,
        maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
    };
    console.log('[MP_DEBUG | Worker] Initial state created.');
    
    state.marketProfile = generateMarketProfile();
    postStateUpdate();
}

function processTick(tick) {
    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
    
    const adrRange = state.adrHigh - state.adrLow;
    const buffer = adrRange * 0.1;

    if (state.currentPrice > state.visualHigh) {
        state.visualHigh = state.currentPrice + buffer;
    }
    if (state.currentPrice < state.visualLow) {
        state.visualLow = state.currentPrice - buffer;
    }

    const magnitude = typeof lastPrice === 'number' 
        ? Math.abs(state.currentPrice - lastPrice) * Math.pow(10, digits)
        : 0;
    
    const now = performance.now();
    state.lastTickTime = now;
    
    const newTick = { price: state.currentPrice, direction: state.lastTickDirection === 'up' ? 1 : -1, magnitude, time: now };
    state.ticks.push(newTick);
    state.allTicks.push(newTick);
    state.tickMagnitudes.push(magnitude);

    state.todaysHigh = Math.max(state.todaysHigh, tick.bid);
    state.todaysLow = Math.min(state.todaysLow, tick.bid);

    updateVolatility(now);
    state.marketProfile = generateMarketProfile();
    
    postStateUpdate();
}

function updateConfig(newConfig) {
    console.log('[MP_DEBUG | Worker] Updating config with:', newConfig);
    const oldBucketSize = config.priceBucketSize;
    config = { ...config, ...newConfig };
    console.log('[MP_DEBUG | Worker] Updated config.');
    
    if (newConfig.priceBucketSize && newConfig.priceBucketSize !== oldBucketSize) {
        state.marketProfile = generateMarketProfile();
        postStateUpdate();
    }
}

function updateVolatility(now) {
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
    state.volatility = ((state.volatility || 0) * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    state.volatility = Math.max(0.05, state.volatility);
    state.volatilityIntensity = Math.min(1, state.volatility / 3.5);
}

function generateMarketProfile() {
    if (!config.priceBucketSize || config.priceBucketSize <= 0) {
        console.warn('[MP_DEBUG | Worker] Cannot generate profile: invalid priceBucketSize:', config.priceBucketSize);
        return { levels: [], tickCount: 0 };
    }
    
    const profileData = new Map();
    const relevantTicks = config.distributionDepthMode === 'all' 
        ? state.allTicks 
        : state.allTicks.slice(-Math.floor(state.allTicks.length * (config.distributionPercentage / 100)));

    console.log(`[MP_DEBUG | Worker] Using ${relevantTicks.length} relevant ticks for profile generation.`);

    const priceToBucketFactor = Math.pow(10, digits) / config.priceBucketSize;
    if (isNaN(priceToBucketFactor) || priceToBucketFactor === 0) {
         console.error('[MP_DEBUG | Worker] Cannot generate profile: invalid priceToBucketFactor:', priceToBucketFactor);
        return { levels: [], tickCount: 0 };
    }

    relevantTicks.forEach(t => {
        const priceBucket = Math.floor(t.price * priceToBucketFactor);
        if (isNaN(priceBucket)) {
            return;
        }
        const bucket = profileData.get(priceBucket) || { buy: 0, sell: 0, total: 0 };
        if (t.direction > 0) bucket.buy++; else bucket.sell++;
        bucket.total++;
        profileData.set(priceBucket, bucket);
    });

    const finalProfile = {
        levels: Array.from(profileData.entries())
            .map(([bucket, data]) => ({
                price: bucket / priceToBucketFactor,
                volume: data.total,
                buy: data.buy,
                sell: data.sell
            }))
            .sort((a, b) => a.price - b.price),
        tickCount: relevantTicks.length // Add the count of processed ticks
    };
    
    console.log(`[MP_DEBUG | Worker] Generated final profile with ${finalProfile.levels.length} levels from ${finalProfile.tickCount} ticks.`);
    return finalProfile;
}

function postStateUpdate() {
    if (isNaN(state.currentPrice)) {
        console.error('[MP_DEBUG | Worker] Invalid state detected - currentPrice is NaN. Aborting update.');
        return;
    }
    self.postMessage({
        type: 'stateUpdate',
        payload: {
            newState: state
        }
    });
}
