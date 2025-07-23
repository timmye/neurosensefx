console.log('Worker started');

let config = {};
let state = {};
let simulationInterval;

// --- Simulation Settings ---
const frequencySettings = {
    calm: { baseInterval: 2000, randomness: 1500, magnitudeMultiplier: 0.5, momentumStrength: 0.05, meanReversionPoint: 0.7 },
    normal: { baseInterval: 800, randomness: 1000, magnitudeMultiplier: 1, momentumStrength: 0.1, meanReversionPoint: 0.7 },
    active: { baseInterval: 300, randomness: 400, magnitudeMultiplier: 1.5, momentumStrength: 0.15, meanReversionPoint: 0.6 },
    volatile: { baseInterval: 100, randomness: 200, magnitudeMultiplier: 2, momentumStrength: 0.2, meanReversionPoint: 0.5 },
};

// --- Core Worker Logic ---
self.onmessage = (event) => {
    const { type, payload } = event.data;
    switch (type) {
        case 'init': initialize(payload); break;
        case 'startSimulation': startSimulation(); break;
        case 'stop': stopSimulation(); break;
        case 'updateConfig': config = { ...config, ...payload }; break;
    }
};

function initialize(payload) {
    config = payload.config;
    const initialPrice = payload.midPrice || 1.25500;
    state = {
        lastTickTime: performance.now(),
        currentPrice: initialPrice,
        midPrice: initialPrice,
        minObservedPrice: initialPrice,
        maxObservedPrice: initialPrice,
        ticks: [],
        allTicks: [],
        volatility: 0.5,
        momentum: 0,
        lastTickDirection: 'up',
        tickMagnitudes: [], // For rolling volatility calculation
    };
    console.log('Worker initialized');
}

function startSimulation() {
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = setInterval(generateAndProcessTick, 50);
}

function stopSimulation() {
    if (simulationInterval) clearInterval(simulationInterval);
}

function generateAndProcessTick() {
    const newTick = generateTick();
    if (newTick) {
        processTick(newTick);
    }
}

function generateTick() {
    const now = performance.now();
    const settings = frequencySettings[config.frequencyMode];
    if (now - state.lastTickTime < (settings.baseInterval + (Math.random() * settings.randomness))) return null;

    state.momentum = (state.momentum || 0) * 0.85;
    const bias = state.momentum * settings.momentumStrength;
    const direction = Math.random() < (0.5 + bias) ? 1 : -1;
    state.momentum = Math.max(-1, Math.min(1, state.momentum + direction * 0.25));

    const rand = Math.random();
    let magnitude = (rand < 0.8) ? Math.random() * 0.8 : (rand < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
    magnitude *= settings.magnitudeMultiplier;

    const newPrice = state.currentPrice + (direction * magnitude / 10000);

    state.lastTickTime = now;
    state.lastTickDirection = direction > 0 ? 'up' : 'down';
    state.currentPrice = newPrice;
    
    const tick = { magnitude, direction, price: newPrice, time: now };
    state.ticks.push(tick);
    state.allTicks.push(tick);
    
    // Store magnitude for volatility calculation
    state.tickMagnitudes.push(magnitude);
    
    return tick;
}

function processTick(tick) {
    state.minObservedPrice = Math.min(state.minObservedPrice, tick.price);
    state.maxObservedPrice = Math.max(state.maxObservedPrice, tick.price);

    updateADRBoundaries();
    updateVolatility();
    
    const marketProfile = generateMarketProfile();
    // Lower thresholds for more frequent significant ticks
    const flashThreshold = Math.max(0.5, config.flashThreshold || 1.5);
    const orbFlashThreshold = Math.max(0.3, config.orbFlashThreshold || 1.0);
    const significantTick = (config.showFlash && tick.magnitude >= flashThreshold) || (config.showOrbFlash && tick.magnitude >= orbFlashThreshold);

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
            tickMagnitude: tick.magnitude,
        }
    });
}

// --- State Update & Data Generation Functions ---

function updateADRBoundaries() {
    const adrRangeInPrice = config.adrRange / 10000;
    const minRange = 0.0020;
    
    // Dynamic ADR that encompasses all observed prices
    const priceRange = state.maxObservedPrice - state.minObservedPrice;
    const dynamicRange = Math.max(adrRangeInPrice, priceRange * 1.2); // 20% buffer
    
    let adrHigh = state.midPrice + (dynamicRange / 2);
    let adrLow = state.midPrice - (dynamicRange / 2);

    if (adrHigh - adrLow < minRange) {
        adrHigh = state.midPrice + minRange / 2;
        adrLow = state.midPrice - minRange / 2;
    }
    
    // Ensure current price is always within ADR range
    if (state.currentPrice > adrHigh) {
        state.midPrice += (state.currentPrice - adrHigh) + (dynamicRange * 0.05);
    } else if (state.currentPrice < adrLow) {
        state.midPrice -= (adrLow - state.currentPrice) + (dynamicRange * 0.05);
    }

    state.adrHigh = state.midPrice + (dynamicRange / 2);
    state.adrLow = state.midPrice - (dynamicRange / 2);
}

function updateVolatility() {
    const lookbackPeriod = 10000; // 10 second lookback
    const now = performance.now();
    
    // Remove old ticks outside lookback period
    state.ticks = state.ticks.filter(tick => now - tick.time <= lookbackPeriod);
    state.tickMagnitudes = state.tickMagnitudes.slice(-50); // Keep last 50 magnitudes max
    
    if (state.tickMagnitudes.length < 3) {
        state.volatility = Math.max(0.1, state.volatility * 0.99);
        return;
    }
    
    // Calculate average magnitude over lookback period
    const recentMagnitudes = state.tickMagnitudes.slice(-20); // Last 20 ticks
    const avgMagnitude = recentMagnitudes.reduce((sum, mag) => sum + mag, 0) / recentMagnitudes.length;
    
    // Calculate tick frequency (ticks per second)
    const tickFrequency = state.ticks.length / (lookbackPeriod / 1000);
    
    // Combine magnitude and frequency for volatility score
    const magnitudeScore = Math.min(avgMagnitude / 2, 3); // Cap at 3
    const frequencyScore = Math.min(tickFrequency / 2, 2); // Cap at 2
    
    const rawVolatility = (magnitudeScore * 0.7) + (frequencyScore * 0.3);
    
    // Smooth the volatility with exponential moving average
    const smoothingFactor = 0.1;
    state.volatility = (state.volatility * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    
    // Ensure minimum volatility floor
    state.volatility = Math.max(0.1, state.volatility);
}

function generateMarketProfile() {
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