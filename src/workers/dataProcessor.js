//data processor.js
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
            processTick(payload);
            break;
        case 'updateConfig':
            config = { ...config, ...payload };
            break;
    }
};

function initialize(payload) {
    config = payload.config;
    const initialPrice = payload.midPrice || 0;
    state = {
        currentPrice: initialPrice,
        midPrice: initialPrice,
        minObservedPrice: initialPrice,
        maxObservedPrice: initialPrice,
        ticks: [],
        allTicks: [],
        volatility: 0.5,
        tickMagnitudes: [],
        lastTickDirection: 'up',
        adrHigh: initialPrice + (config.adrRange / 20000),
        adrLow: initialPrice - (config.adrRange / 20000),
    };
}

function processTick(tick) {
    if (!tick || typeof tick.bid !== 'number') { 
        return;
    }

    if (state.midPrice === 0) {
        state.midPrice = tick.bid;
        state.minObservedPrice = tick.bid;
        state.maxObservedPrice = tick.bid;
    }
    
    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
    const magnitude = Math.abs(state.currentPrice - lastPrice) * 10000; // In pips

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

    state.minObservedPrice = Math.min(state.minObservedPrice, state.currentPrice);
    state.maxObservedPrice = Math.max(state.maxObservedPrice, state.currentPrice);

    updateADRBoundaries();
    updateVolatility();
    
    const marketProfile = generateMarketProfile();
    const flashThreshold = Math.max(0.5, config.flashThreshold || 1.5);
    const orbFlashThreshold = Math.max(0.3, config.orbFlashThreshold || 1.0);
    const significantTick = (config.showFlash && magnitude >= flashThreshold) || (config.showOrbFlash && magnitude >= orbFlashThreshold);

    self.postMessage({
        type: 'stateUpdate',
        payload: {
            newState: {
                currentPrice: state.currentPrice,
                lastTickDirection: state.lastTickDirection,
                volatility: state.volatility,
                adrHigh: state.adrHigh,
                adrLow: state.adrLow,
                meterHorizontalOffset: 0
            },
            marketProfile: marketProfile,
            significantTick: significantTick,
            tickMagnitude: magnitude,
        }
    });
}

// --- State Update & Data Generation Functions ---

function updateADRBoundaries() {
    const adrRangeInPrice = config.adrRange / 10000;
    const priceRange = state.maxObservedPrice - state.minObservedPrice;
    const dynamicRange = Math.max(adrRangeInPrice, priceRange * 1.2); // 20% buffer

    let adrHigh = state.midPrice + (dynamicRange / 2);
    let adrLow = state.midPrice - (dynamicRange / 2);

    if (state.currentPrice > adrHigh) {
        state.midPrice += (state.currentPrice - adrHigh);
    } else if (state.currentPrice < adrLow) {
        state.midPrice -= (adrLow - state.currentPrice);
    }

    state.adrHigh = state.midPrice + (dynamicRange / 2);
    state.adrLow = state.midPrice - (dynamicRange / 2);
}

function updateVolatility() {
    const lookbackPeriod = 10000; // 10 second lookback
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
    const tickFrequency = state.ticks.length / (lookbackPeriod / 1000); // Ticks per second
    
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
