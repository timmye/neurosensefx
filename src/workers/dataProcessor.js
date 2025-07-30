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
    // Test Point 3: Log the incoming payload from the backend
    console.log('--- Point of Failure 3: Incorrect Data Received by Frontend ---');
    console.log('Data Worker: Initial Payload:', payload);
    console.log('--- End of Point of Failure 3 ---');

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
        priceFloatPulseEffect: { active: false, magnitude: 0, color: '', scale: 1 },
        lastTick: {
            bid: initialPrice,
            ask: initialPrice,
            timestamp: Date.now(),
        }
    };

    state.marketProfile = generateMarketProfile();
    recalculateVisualRange();
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
    state.lastTick = tick;

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
    recalculateVisualRange();
    postStateUpdate();
}

function updateConfig(newConfig) {
    config = { ...config, ...newConfig };
    
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
    state.volatility = ((state.volatility || 0) * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    state.volatility = Math.max(0.05, state.volatility);
    state.volatilityIntensity = Math.min(1, state.volatility / 3.5);
}

function generateMarketProfile() {
    const pipetteSize = 1 / Math.pow(10, localDigits);
    const priceBucketSize = pipetteSize * (config.priceBucketMultiplier || 1);

    console.log('[MP_DEBUG | Worker] Market Profile Generation Started');
    console.log(`[MP_DEBUG | Worker]   - priceBucketSize: ${priceBucketSize}`);
    if (!priceBucketSize || priceBucketSize <= 0) {
        console.error('[MP_DEBUG | Worker] Invalid priceBucketSize. Aborting profile generation.');
        return { levels: [], tickCount: 0 };
    }

    const profileData = new Map();
    const relevantTicks = config.distributionDepthMode === 'all'
        ? state.allTicks
        : state.allTicks.slice(-Math.floor(state.allTicks.length * (config.distributionPercentage / 100)));

    const priceToBucketFactor = 1 / priceBucketSize;
    console.log(`[MP_DEBUG | Worker]   - priceToBucketFactor: ${priceToBucketFactor}`);

    if (isNaN(priceToBucketFactor) || priceToBucketFactor === 0) {
        console.error('[MP_DEBUG | Worker] Invalid priceToBucketFactor. Aborting profile generation.');
        return { levels: [], tickCount: 0 };
    }

    relevantTicks.forEach(t => {
        const priceBucket = Math.floor(t.price * priceToBucketFactor);
        if (isNaN(priceBucket)) {
            console.warn(`[MP_DEBUG | Worker] NaN priceBucket for tick: ${t.price}`);
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
    
    console.log(`[MP_DEBUG | Worker]   - Generated ${finalProfile.levels.length} profile levels.`);
    console.log('[MP_DEBUG | Worker] Market Profile Generation Finished');
    return finalProfile;
}

function recalculateVisualRange() {
    let minPrice = state.adrLow;
    let maxPrice = state.adrHigh;

    if (config.showMarketProfile && state.marketProfile && state.marketProfile.levels.length > 0) {
        const mpPrices = state.marketProfile.levels.map(l => l.price);
        minPrice = Math.min(minPrice, ...mpPrices);
        maxPrice = Math.max(maxPrice, ...mpPrices);
    }
    
    minPrice = Math.min(minPrice, state.todaysLow);
    maxPrice = Math.max(maxPrice, state.todaysHigh);

    const adrRange = state.adrHigh - state.adrLow;
    const buffer = adrRange * 0.1;

    state.visualLow = minPrice - buffer;
    state.visualHigh = maxPrice + buffer;
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
