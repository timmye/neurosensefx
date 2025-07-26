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
        case 'initialProfile':
            processInitialProfile(payload);
            break;
        case 'updateConfig':
            config = { ...config, ...payload };
            break;
        case 'marketData': // New case for market data
            state.projectedHigh = payload.projectedHigh;
            state.projectedLow = payload.projectedLow;
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
        projectedHigh: initialPrice * 1.005,
        projectedLow: initialPrice * 0.995,
        flashEffect: null,
    };
}

function processInitialProfile(profileData) {
    // Convert the initial profile data into the format the worker uses
    const now = performance.now();
    state.allTicks = profileData.map(d => ({
        price: d.price,
        direction: 1, // We don't have direction for initial data, so default to buy
        magnitude: 0,
        time: now,
    }));

    // Post an update to the main thread with the initial profile
    const marketProfile = generateMarketProfile();
    self.postMessage({
        type: 'stateUpdate',
        payload: {
            newState: state,
            marketProfile: marketProfile,
            flashEffect: null
        }
    });
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

    updateVolatility();
    
    const marketProfile = generateMarketProfile();

    let flashEffect = null;
    if ((config.showFlash && magnitude >= config.flashThreshold) || (config.showOrbFlash && magnitude >= config.orbFlashThreshold)) {
        flashEffect = {
            magnitude,
            direction: state.lastTickDirection
        };
    }

    self.postMessage({
        type: 'stateUpdate',
        payload: {
            newState: state,
            marketProfile: marketProfile,
            flashEffect: flashEffect
        }
    });
}

// --- State Update & Data Generation Functions ---

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
