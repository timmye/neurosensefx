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
    return tick;
}

function processTick(tick) {
    state.minObservedPrice = Math.min(state.minObservedPrice, tick.price);
    state.maxObservedPrice = Math.max(state.maxObservedPrice, tick.price);

    updateADRBoundaries();
    updateVolatility();
    
    const marketProfile = generateMarketProfile();
    const significantTick = (config.showFlash && tick.magnitude > (config.flashThreshold || 2)) || (config.showOrbFlash && tick.magnitude > (config.orbFlashThreshold || 2));

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
            significantTick: significantTick, // Event flag for the UI
            tickMagnitude: tick.magnitude, // Send the magnitude for conditional flashes in UI
        }
    });
}

// --- State Update & Data Generation Functions ---

function updateADRBoundaries() {
    const adrRangeInPrice = config.adrRange / 10000;
    const minRange = 0.0020;
    
    let adrHigh = state.midPrice + (adrRangeInPrice / 2);
    let adrLow = state.midPrice - (adrRangeInPrice / 2);

    if (adrHigh - adrLow < minRange) {
        adrHigh = state.midPrice + minRange / 2;
        adrLow = state.midPrice - minRange / 2;
    }
    
    if(state.currentPrice > adrHigh) state.midPrice += (state.currentPrice - adrHigh);
    else if (state.currentPrice < adrLow) state.midPrice -= (adrLow - state.currentPrice);

    state.adrHigh = state.midPrice + (adrRangeInPrice / 2);
    state.adrLow = state.midPrice - (adrRangeInPrice / 2);
}

function updateVolatility() {
    const lookback = 5000;
    const now = performance.now();
    const recentTicks = state.ticks.filter(t => now - t.time < lookback);

    if (recentTicks.length < 5) {
        state.volatility *= 0.99;
        return; 
    }
    
    const magnitudes = recentTicks.map(t => t.magnitude);
    const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const frequency = state.ticks.length / (lookback / 1000);
    
    const volScore = (avgMagnitude * 0.5) + (frequency * 0.5);
    state.volatility = state.volatility * 0.95 + volScore * 0.05;
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
