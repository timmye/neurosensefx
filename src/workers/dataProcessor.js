console.log('Worker started');

let config = {};
let state = {};
let simulationInterval;

const frequencySettings = {
    calm: { baseInterval: 2000, randomness: 1500, magnitudeMultiplier: 0.5, momentumStrength: 0.05, meanReversionPoint: 0.7 },
    normal: { baseInterval: 800, randomness: 1000, magnitudeMultiplier: 1, momentumStrength: 0.1, meanReversionPoint: 0.7 },
    active: { baseInterval: 300, randomness: 400, magnitudeMultiplier: 1.5, momentumStrength: 0.15, meanReversionPoint: 0.6 },
    volatile: { baseInterval: 100, randomness: 200, magnitudeMultiplier: 2, momentumStrength: 0.2, meanReversionPoint: 0.5 },
};

function generateTick() {
    // console.log('generateTick called. Current state:', state); // Removed debug log
    const now = performance.now();
    const settings = frequencySettings[config.frequencyMode];

    if (!settings || !state || now - state.lastTickTime < (settings.baseInterval + (Math.random() * settings.randomness))) return; // Added check for state

    state.momentum = (state.momentum || 0) * 0.85;
    let bias = state.momentum * settings.momentumStrength;
    if (Math.abs(state.momentum) > settings.meanReversionPoint) {
        bias *= -0.5;
    }
    
    const direction = Math.random() < (0.5 + bias) ? 1 : -1;
    state.momentum = Math.max(-1, Math.min(1, state.momentum + direction * 0.25));

    const rand = Math.random();
    let magnitude = (rand < 0.8) ? Math.random() * 0.8 : (rand < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
    magnitude *= settings.magnitudeMultiplier;

    const newPrice = state.currentPrice + (direction * magnitude / 10000);

    state.currentPrice = newPrice;
    state.lastTickTime = now;
    state.lastTickDirection = direction;

    const newTick = { magnitude, direction, price: newPrice, time: now };
    state.ticks.push(newTick);
    state.allTicks.push(newTick);

    state.minObservedPrice = Math.min(state.minObservedPrice, newPrice);
    state.maxObservedPrice = Math.max(state.maxObservedPrice, newPrice);

    processTick(newTick);
}

function processTick(tick) {
    if (!state || !state.ticks || !state.allTicks) return;
    
    const now = performance.now();
    state.ticks = state.ticks.filter(t => now - t.time < 5000);

    const effectiveADRInPrice = Math.max(config.adrRange / 10000, state.maxObservedPrice - state.minObservedPrice);
    const currentPriceOffsetFromMid = state.currentPrice - state.midPrice;
    const halfEffectiveADR = effectiveADRInPrice / 2;

    if (currentPriceOffsetFromMid > halfEffectiveADR) {
        state.midPrice = state.currentPrice - halfEffectiveADR;
    } else if (currentPriceOffsetFromMid < -halfEffectiveADR) {
        state.midPrice = state.currentPrice + halfEffectiveADR;
    }

    updateMaxDeflection(tick);
    updateVolatility();

    let profileData = new Map();
    let relevantTicks;
    if (config.distributionDepthMode === 'all') {
        relevantTicks = state.allTicks;
    } else {
        const numTicks = Math.floor(state.allTicks.length * (config.distributionPercentage / 100));
        relevantTicks = state.allTicks.slice(Math.max(0, state.allTicks.length - numTicks));
    }

    relevantTicks.forEach(t => {
        const priceBucket = Math.floor(t.price * (10000 / config.priceBucketSize));
        if (!profileData.has(priceBucket)) {
            profileData.set(priceBucket, { buy: 0, sell: 0, total: 0 });
        }
        const bucket = profileData.get(priceBucket);
        if (t.direction > 0) {
            bucket.buy += 1;
        } else {
            bucket.sell += 1;
        }
        bucket.total += 1;
    });

    self.postMessage({
        type: 'stateUpdate',
        payload: {
            currentPrice: state.currentPrice,
            lastTickDirection: state.lastTickDirection,
            maxDeflection: { ...state.maxDeflection }, // Send a copy
            volatility: state.volatility,
            midPrice: state.midPrice,
            minObservedPrice: state.minObservedPrice,
            maxObservedPrice: state.maxObservedPrice,
            marketProfile: profileData,
        }
    });
}

function updateMaxDeflection(tick) {
    if (!state || !state.maxDeflection) return;
    const now = performance.now();
    if (now - state.maxDeflection.lastUpdateTime > (config.maxMarkerDecay * 1000)) {
        state.maxDeflection.up = 0;
        state.maxDeflection.down = 0;
    }
    let updated = false;
    if (tick.direction > 0 && tick.magnitude > state.maxDeflection.up) { state.maxDeflection.up = tick.magnitude; updated = true; }
    if (tick.direction < 0 && tick.magnitude > state.maxDeflection.down) { state.maxDeflection.down = tick.magnitude; updated = true; }
    if (updated) state.maxDeflection.lastUpdateTime = now;
}

function updateVolatility() {
    if (!state || !state.ticks) return;
    const lookback = 5000;
    const now = performance.now();
    state.ticks = state.ticks.filter(t => now - t.time < lookback);
    if (state.ticks.length < 5) { state.volatility *= 0.99; return; }
    
    const magnitudes = state.ticks.map(t => t.magnitude);
    const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const frequency = state.ticks.length / (lookback / 1000);
    
    const volScore = (avgMagnitude * 0.5) + (frequency * 0.5);
    state.volatility = state.volatility * 0.95 + volScore * 0.05;
}

self.onmessage = (event) => {
    const { type, payload } = event.data;

    switch (type) {
        case 'init':
            config = payload.config;
            state = payload.initialState || {}; // Ensure state is always an object
            console.log('Worker received init message. Payload:', payload, 'State after assignment:', state);
            
            // Ensure state has all required properties
            if (!state.lastTickTime) state.lastTickTime = performance.now();
            if (!state.currentPrice) state.currentPrice = 1.0;
            if (!state.midPrice) state.midPrice = 1.0;
            if (!state.minObservedPrice) state.minObservedPrice = 1.0;
            if (!state.maxObservedPrice) state.maxObservedPrice = 1.0;
            if (!state.ticks) state.ticks = [];
            if (!state.allTicks) state.allTicks = [];
            if (!state.maxDeflection) state.maxDeflection = { up: 0, down: 0, lastUpdateTime: 0 };
            if (!state.volatility) state.volatility = 0.5;
            if (!state.momentum) state.momentum = 0;

            if (simulationInterval) clearInterval(simulationInterval);
            simulationInterval = setInterval(generateTick, 50); // Start simulation
            break;
        case 'updateConfig':
            config = { ...config, ...payload };
            break;
        case 'stop':
            if (simulationInterval) clearInterval(simulationInterval);
            break;
    }
};
