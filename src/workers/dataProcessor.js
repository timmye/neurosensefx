import {
  TickSchema,
  MarketProfileSchema,
  VisualizationStateSchema,
  VisualizationConfigSchema
} from '../data/schema.js';

let config = {};
let state = {};
let localDigits = 5;

// This function correctly applies the transformation for any value
// from the backend that represents a price or a price range.
function convertValue(value, digits) {
  const actualValue = value / 100000.0;
  return Number(actualValue.toFixed(digits));
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

    // Convert all incoming price and range values using the helper.
    const todaysOpen = convertValue(payload.todaysOpen, localDigits);
    const initialPrice = convertValue(payload.initialPrice, localDigits);
    const todaysHigh = convertValue(payload.todaysHigh, localDigits);
    const todaysLow = convertValue(payload.todaysLow, localDigits);
    const adr = convertValue(payload.adr, localDigits); // ADR must also be converted

    // Correctly calculate the ADR high and low based on half of the ADR range.
    const adrHigh = todaysOpen + (adr / 2);
    const adrLow = todaysOpen - (adr / 2);

    const initialTicks = (payload.initialMarketProfile || []).map(bar => {
        const open = convertValue(bar.open, localDigits);
        const close = convertValue(bar.close, localDigits);
        return {
            price: close,
            direction: close > open ? 1 : -1,
            magnitude: Math.abs(close - open) * Math.pow(10, localDigits),
            time: bar.timestamp
        };
    });

    state = {
        currentPrice: initialPrice,
        midPrice: todaysOpen,
        adrHigh: adrHigh,
        adrLow: adrLow,
        visualHigh: adrHigh,
        visualLow: adrLow,
        todaysHigh: todaysHigh,
        todaysLow: todaysLow,
        digits: localDigits,
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
        priceFloatPulseEffect: { active: false, magnitude: 0, color: '', scale: 1 }
    };

    state.marketProfile = generateMarketProfile();
    postStateUpdate();
}

// ... (rest of the file is unchanged)
function processTick(rawTick) {
    const tick = {
      ...rawTick,
      bid: convertValue(rawTick.bid, localDigits),
      ask: convertValue(rawTick.ask, localDigits),
    };

    const lastPrice = state.currentPrice;
    state.currentPrice = tick.bid;
    state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';

    const adrRange = state.adrHigh - state.adrLow;
    const buffer = adrRange * 0.1;

    if (state.currentPrice > state.visualHigh) {
        state.visualHigh = state.currentPrice + buffer;
    }
    if (state.currentPrice < state.visualLow) {
        state.visualLow = state.visualLow - buffer;
    }

    const magnitude = typeof lastPrice === 'number'
        ? Math.abs(state.currentPrice - lastPrice) * Math.pow(10, localDigits)
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
    const oldBucketSize = config.priceBucketSize;
    config = { ...config, ...newConfig };

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
        return { levels: [], tickCount: 0 };
    }

    const profileData = new Map();
    const relevantTicks = config.distributionDepthMode === 'all'
        ? state.allTicks
        : state.allTicks.slice(-Math.floor(state.allTicks.length * (config.distributionPercentage / 100)));

    const priceToBucketFactor = 1 / config.priceBucketSize;

    if (isNaN(priceToBucketFactor) || priceToBucketFactor === 0) {
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
        tickCount: relevantTicks.length
    };

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
