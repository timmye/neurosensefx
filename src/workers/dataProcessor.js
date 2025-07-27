import {
  TickSchema,
  MarketProfileSchema,
  VisualizationStateSchema,
  VisualizationConfigSchema
} from '../data/schema.js';

console.log('Worker started');

let config = {};
let state = {};

// --- Core Worker Logic ---
self.onmessage = (event) => {
    const { type, payload } = event.data;
    switch (type) {
        case 'init':
            initialize(payload);
            break;
        case 'tick':
            const tickResult = TickSchema.safeParse(payload);
            if (tickResult.success) {
                processTick(tickResult.data);
            } else {
                console.error('Invalid tick data:', tickResult.error);
            }
            break;
        case 'updateConfig':
            const configResult = VisualizationConfigSchema.partial().safeParse(payload);
            if (configResult.success) {
                config = { ...config, ...configResult.data };
            } else {
                console.error('Invalid config data:', configResult.error);
            }
            break;
    }
};

function initialize(payload) {
    const configResult = VisualizationConfigSchema.safeParse(payload.config);
    if (configResult.success) {
        config = configResult.data;
    } else {
        console.error('Invalid initial config data:', configResult.error);
    }

    state = {
        currentPrice: payload.initialPrice,
        midPrice: payload.initialPrice,
        minObservedPrice: payload.initialPrice,
        maxObservedPrice: payload.initialPrice,
        ticks: [],
        allTicks: payload.initialMarketProfile.map(bar => ({
            price: bar.close,
            direction: bar.close > bar.open ? 1 : -1,
            magnitude: Math.abs(bar.close - bar.open) * 10000,
            time: bar.timestamp,
        })),
        volatility: 0.5,
        tickMagnitudes: [],
        lastTickDirection: 'up',
        projectedHigh: payload.projectedHigh,
        projectedLow: payload.projectedLow,
        todaysHigh: payload.todaysHigh,
        todaysLow: payload.todaysLow,
        flashEffect: null,
        marketProfile: { levels: [] },
        lastTickTime: 0,
        maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
    };

    const marketProfile = generateMarketProfile();
    state.marketProfile = marketProfile;
    const stateResult = VisualizationStateSchema.safeParse(state);
    if (stateResult.success) {
        self.postMessage({
            type: 'stateUpdate',
            payload: {
                newState: stateResult.data,
                marketProfile: marketProfile,
                flashEffect: null
            }
        });
    } else {
        console.error('Invalid initial state data:', stateResult.error);
    }
}

function processTick(tick) {
    if (state.midPrice === 0) {
        state.midPrice = tick.bid;
        state.minObservedPrice = tick.bid;
        state.maxObservedPrice = tick.bid;
    }
    
    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
    const magnitude = Math.abs(state.currentPrice - lastPrice) * 10000;

    const now = performance.now();
    const tickEvent = {
        price: state.currentPrice,
        direction: state.lastTickDirection === 'up' ? 1 : -1,
        magnitude: magnitude,
        time: now,
    };
    
    state.ticks.push(tickEvent);
    state.allTicks.push(tickEvent);
    state.tickMagnitudes.push(magnitude);

    state.todaysHigh = Math.max(state.todaysHigh, tick.bid);
    state.todaysLow = Math.min(state.todaysLow, tick.bid);

    updateVolatility();
    
    const marketProfile = generateMarketProfile();
    state.marketProfile = marketProfile;

    let flashEffect = null;
    if ((config.showFlash && magnitude >= config.flashThreshold) || (config.showOrbFlash && magnitude >= config.orbFlashThreshold)) {
        flashEffect = {
            magnitude,
            direction: state.lastTickDirection,
            id: now,
        };
    }
    state.flashEffect = flashEffect;

    const stateResult = VisualizationStateSchema.safeParse(state);
    if (stateResult.success) {
        self.postMessage({
            type: 'stateUpdate',
            payload: {
                newState: stateResult.data,
                marketProfile: marketProfile,
                flashEffect: flashEffect
            }
        });
    } else {
        console.error('Invalid state data:', stateResult.error);
    }
}

function updateVolatility() {
    const lookbackPeriod = 10000;
    const now = performance.now();
    
    state.ticks = state.ticks.filter(tick => now - tick.time <= lookbackPeriod);
    if (state.tickMagnitudes.length > 50) {
        state.tickMagnitudes.shift();
    }
    
    if (state.tickMagnitudes.length < 3) {
        state.volatility = Math.max(0.1, (state.volatility || 0.1) * 0.99);
        return;
    }
    
    const avgMagnitude = state.tickMagnitudes.reduce((sum, mag) => sum + mag, 0) / state.tickMagnitudes.length;
    const tickFrequency = state.ticks.length / (lookbackPeriod / 1000);
    
    const magnitudeScore = Math.min(avgMagnitude / 2, 3);
    const frequencyScore = Math.min(tickFrequency / 2, 2);
    
    const rawVolatility = (magnitudeScore * 0.7) + (frequencyScore * 0.3);
    
    const smoothingFactor = 0.1;
    state.volatility = ((state.volatility || 0) * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    state.volatility = Math.max(0.1, state.volatility);
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

    const marketProfile = {
        levels: Array.from(profileData.entries())
            .map(([bucket, data]) => ({
                price: bucket * (config.priceBucketSize / 10000),
                volume: data.total,
                buy: data.buy,
                sell: data.sell
            }))
            .sort((a, b) => a.price - b.price)
    };

    const profileResult = MarketProfileSchema.safeParse(marketProfile);
    if (profileResult.success) {
        return profileResult.data;
    } else {
        console.error('Invalid market profile data:', profileResult.error);
        return { levels: [] };
    }
}
