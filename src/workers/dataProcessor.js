import {
  TickSchema,
  MarketProfileSchema,
  VisualizationStateSchema,
  VisualizationConfigSchema
} from '../data/schema.js';

let config = {};
let state = {};

self.onmessage = (event) => {
    const { type, payload } = event.data;
    switch (type) {
        case 'init':
            console.log(`[E2E_DEBUG | dataProcessor] 13. Received 'init' payload:`, payload);
            initialize(payload);
            break;
        case 'tick':
            processTick(payload);
            break;
        case 'updateConfig':
            config = { ...config, ...payload };
            break;
    }
};

function initialize(payload) {
    config = payload.config;
    state = {
        currentPrice: payload.todaysOpen, 
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
    console.log(`[E2E_DEBUG | dataProcessor] 14. Constructed initial worker state:`, state);
    
    state.marketProfile = generateMarketProfile();
    postStateUpdate();
}

function processTick(tick) {
    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
    const magnitude = Math.abs(state.currentPrice - lastPrice) * 10000;
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

function updateVolatility(now) {
    const lookbackPeriod = 10000; // 10 seconds
    state.ticks = state.ticks.filter(tick => now - tick.time <= lookbackPeriod);
    if (state.tickMagnitudes.length > 50) state.tickMagnitudes.shift();
    
    if (state.ticks.length < 2) {
        state.volatility *= 0.95; // Dampen volatility if no recent ticks
        return;
    }
    
    const avgMagnitude = state.tickMagnitudes.reduce((sum, mag) => sum + mag, 0) / state.tickMagnitudes.length;
    const tickFrequency = state.ticks.length / (lookbackPeriod / 1000);
    
    const magnitudeScore = Math.min(avgMagnitude / 2, 3);
    const frequencyScore = Math.min(tickFrequency / 5, 3); // Adjusted for more impact
    
    const rawVolatility = (magnitudeScore * 0.6) + (frequencyScore * 0.4);
    
    // Use a more responsive smoothing factor
    const smoothingFactor = 0.2; 
    state.volatility = ((state.volatility || 0) * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    state.volatility = Math.max(0.05, state.volatility); // Lower minimum
    state.volatilityIntensity = Math.min(1, state.volatility / 3.5); // Adjusted scale
}

function generateMarketProfile() {
    if (!config.priceBucketSize || config.priceBucketSize <= 0) return { levels: [] };
    
    const profileData = new Map();
    const relevantTicks = config.distributionDepthMode === 'all' 
        ? state.allTicks 
        : state.allTicks.slice(-Math.floor(state.allTicks.length * (config.distributionPercentage / 100)));

    relevantTicks.forEach(t => {
        const priceBucket = Math.floor(t.price * (10000 / config.priceBucketSize));
        const bucket = profileData.get(priceBucket) || { buy: 0, sell: 0, total: 0 };
        if (t.direction > 0) bucket.buy++; else bucket.sell++;
        bucket.total++;
        profileData.set(priceBucket, bucket);
    });

    return {
        levels: Array.from(profileData.entries())
            .map(([bucket, data]) => ({
                price: bucket * (config.priceBucketSize / 10000),
                volume: data.total,
                buy: data.buy,
                sell: data.sell
            }))
            .sort((a, b) => a.price - b.price)
    };
}

function postStateUpdate() {
    const stateResult = VisualizationStateSchema.safeParse(state);
    if (stateResult.success) {
        self.postMessage({
            type: 'stateUpdate',
            payload: {
                newState: stateResult.data,
                marketProfile: state.marketProfile,
            }
        });
    } else {
        console.error('Worker: Invalid state data', JSON.stringify(stateResult.error, null, 2));
    }
}
