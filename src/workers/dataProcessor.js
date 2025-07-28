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
};

function initialize(payload) {
    config = payload.config;
    digits = payload.digits || 5; 

    state = {
        currentPrice: payload.initialPrice, 
        midPrice: payload.todaysOpen,
        adrHigh: payload.projectedHigh,
        adrLow: payload.projectedLow,
        todaysHigh: payload.todaysHigh,
        todaysLow: payload.todaysLow,
        ticks: [],
        allTicks: [],
        volatility: 0.5,
        volatilityIntensity: 0.25,
        tickMagnitudes: [],
        lastTickDirection: 'up',
        marketProfile: { levels: [] },
        flashEffect: null,
        lastTickTime: 0,
        maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
    };
    
    state.marketProfile = generateMarketProfile();
    postStateUpdate();
}

function processTick(tick) {
    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
    
    // This calculation remains correct for determining volatility magnitude
    const magnitude = Math.abs(state.currentPrice - lastPrice) * Math.pow(10, digits);
    
    const now = performance.now();
    
    state.ticks.push({ price: state.currentPrice, direction: state.lastTickDirection === 'up' ? 1 : -1, magnitude, time: now });
    state.allTicks.push({ price: state.currentPrice, direction: state.lastTickDirection === 'up' ? 1 : -1, magnitude, time: now });
    state.tickMagnitudes.push(magnitude);

    state.todaysHigh = Math.max(state.todaysHigh, tick.bid);
    state.todaysLow = Math.min(state.todaysLow, tick.bid);

    updateVolatility(now);
    state.marketProfile = generateMarketProfile();
    
    postStateUpdate();
}

function updateConfig(newConfig) {
    const oldBucketSize = config.priceBucketSize;
    config = { ...config, ...newConfig };
    
    if (newConfig.priceBucketSize && newConfig.priceBucketSize !== oldBucketSize) {
        state.marketProfile = generateMarketProfile();
        postStateUpdate();
    }
}

function updateVolatility(now) {
    const lookbackPeriod = 10000; // 10 seconds
    state.ticks = state.ticks.filter(tick => now - tick.time <= lookbackPeriod);
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
    if (!config.priceBucketSize || config.priceBucketSize <= 0) return { levels: [] };
    
    const profileData = new Map();
    const relevantTicks = config.distributionDepthMode === 'all' 
        ? state.allTicks 
        : state.allTicks.slice(-Math.floor(state.allTicks.length * (config.distributionPercentage / 100)));

    const priceToBucketFactor = Math.pow(10, digits) / config.priceBucketSize;

    relevantTicks.forEach(t => {
        const priceBucket = Math.floor(t.price * priceToBucketFactor);
        const bucket = profileData.get(priceBucket) || { buy: 0, sell: 0, total: 0 };
        if (t.direction > 0) bucket.buy++; else bucket.sell++;
        bucket.total++;
        profileData.set(priceBucket, bucket);
    });

    return {
        levels: Array.from(profileData.entries())
            .map(([bucket, data]) => ({
                price: bucket / priceToBucketFactor,
                volume: data.total,
                buy: data.buy,
                sell: data.sell
            }))
            .sort((a, b) => a.price - b.price)
    };
}

function postStateUpdate() {
    if (isNaN(state.currentPrice)) {
        console.error('Worker: Invalid state detected - currentPrice is NaN. Aborting update.');
        return;
    }
    self.postMessage({
        type: 'stateUpdate',
        payload: {
            newState: state,
            marketProfile: state.marketProfile,
        }
    });
}
