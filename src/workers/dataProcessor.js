import {
  TickSchema,
  MarketProfileSchema,
  VisualizationStateSchema,
  VisualizationConfigSchema,
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
        }
    } catch (error) {
        console.error('[MP_DEBUG | Worker] Uncaught error in onmessage handler:', error);
    }
};

function initialize(payload) {
    config = payload.config;
    localDigits = typeof payload.digits === 'number' ? payload.digits : 5;
    const initialPrice = convertValue(payload.initialPrice, localDigits);

    state = {
        currentPrice: initialPrice,
        midPrice: convertValue(payload.todaysOpen, localDigits),
        projectedAdrHigh: convertValue(payload.projectedAdrHigh, localDigits),
        projectedAdrLow: convertValue(payload.projectedAdrLow, localDigits),
        visualHigh: convertValue(payload.projectedAdrHigh, localDigits),
        visualLow: convertValue(payload.projectedAdrLow, localDigits),
        todaysHigh: convertValue(payload.todaysHigh, localDigits),
        todaysLow: convertValue(payload.todaysLow, localDigits),
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
            time: bar.timestamp
        })),
    };

    runCalculationsAndPostUpdate();
}

function processTick(rawTick) {
    const tick = TickSchema.parse(rawTick);
    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
    state.lastTick = tick;
    state.todaysHigh = Math.max(state.todaysHigh, tick.bid);
    state.todaysLow = Math.min(state.todaysLow, tick.bid);
    
    const magnitude = Math.abs(state.currentPrice - lastPrice) * Math.pow(10, localDigits);
    const now = performance.now();
    const newTick = { price: state.currentPrice, direction: state.lastTickDirection === 'up' ? 1 : -1, magnitude, time: now };
    
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
    updateVolatility(performance.now());
    state.marketProfile = generateMarketProfile();
    recalculateVisualRange();
    postStateUpdate();
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
    state.volatility = (state.volatility * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    state.volatility = Math.max(0.05, state.volatility);
    state.volatilityIntensity = Math.min(1, state.volatility / 3.5);
}

function generateMarketProfile() {
    const pipetteSize = 1 / Math.pow(10, localDigits);
    const priceBucketSize = pipetteSize * (config.priceBucketMultiplier || 1);

    if (!priceBucketSize || priceBucketSize <= 0 || isNaN(priceBucketSize)) {
        return { levels: [], tickCount: 0 };
    }

    const profileData = new Map();
    const relevantTicks = config.distributionDepthMode === 'all'
        ? state.allTicks
        : state.allTicks.slice(-Math.floor(state.allTicks.length * (config.distributionPercentage / 100)));

    const priceToBucketFactor = 1 / priceBucketSize;

    relevantTicks.forEach(t => {
        const priceBucket = Math.floor(t.price * priceToBucketFactor);
        const bucket = profileData.get(priceBucket) || { buy: 0, sell: 0, volume: 0 };
        if (t.direction > 0) bucket.buy++; else bucket.sell++;
        bucket.volume++;
        profileData.set(priceBucket, bucket);
    });

    const finalProfile = {
        levels: Array.from(profileData.entries()).map(([bucket, data]) => ({
            price: bucket / priceToBucketFactor,
            volume: data.volume,
            buy: data.buy,
            sell: data.sell,
        })).sort((a, b) => a.price - b.price),
        tickCount: relevantTicks.length
    };
    
    return finalProfile;
}

function recalculateVisualRange() {
    // Determine the absolute min and max points we need to display by
    // comparing the actual day's range with the projected ADR.
    const minPrice = Math.min(state.todaysLow, state.projectedAdrLow);
    const maxPrice = Math.max(state.todaysHigh, state.projectedAdrHigh);
    
    // Add a 5% padding to the top and bottom for visual comfort.
    // This prevents markers from sitting at the very edge of the container.
    const padding = (maxPrice - minPrice) * 0.05; 
    
    state.visualLow = minPrice - padding;
    state.visualHigh = maxPrice + padding;
}

function postStateUpdate() {
    const result = VisualizationStateSchema.safeParse(state);
    if (result.success) {
        self.postMessage({
            type: 'stateUpdate',
            payload: { newState: result.data }
        });
    } else {
        console.error('[MP_DEBUG | Worker] Invalid state detected. Aborting update.', result.error.format());
    }
}
