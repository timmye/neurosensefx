import { writable, get } from 'svelte/store';
import { tickData } from './wsClient.js';
import { vizConfig } from '../stores.js';

// This store will hold the state for all visible symbols.
export const symbolStates = writable({});

let currentConfig = get(vizConfig);
vizConfig.subscribe(value => currentConfig = value);

// --- State Initialization ---
function createInitialState(price) {
    return {
        currentPrice: price,
        lastTickDirection: 'up',
        volatility: 0,
        adrHigh: price + (currentConfig.adrRange / 20000),
        adrLow: price - (currentConfig.adrRange / 20000),
        minObservedPrice: price,
        maxObservedPrice: price,
        ticks: [], // For volatility calculation
        marketProfile: new Map(),
    };
}

// --- Tick Processing Logic ---
function processTick(symbol, tick) {
    console.log(`symbolManager.js: Processing tick for ${symbol}`); // Log when a tick is being processed
    symbolStates.update(states => {
        let state = states[symbol];
        if (!state) {
            state = createInitialState(tick.bid);
            states[symbol] = state;
            console.log(`symbolManager.js: Created initial state for ${symbol}`, state);
        }

        // --- Update State based on the new tick ---
        const lastPrice = state.currentPrice;
        state.currentPrice = tick.bid;
        state.lastTickDirection = state.currentPrice > lastPrice ? 'up' : 'down';
        
        const now = performance.now();
        const magnitude = Math.abs(state.currentPrice - lastPrice) * 10000;
        
        state.ticks.push({ magnitude, time: now });
        state.ticks = state.ticks.filter(t => now - t.time <= 10000); // 10s lookback

        state.minObservedPrice = Math.min(state.minObservedPrice, state.currentPrice);
        state.maxObservedPrice = Math.max(state.maxObservedPrice, state.currentPrice);
        updateADRBoundaries(state);
        updateVolatility(state);
        
        return states;
    });
}

function updateADRBoundaries(state) {
    const adrRangeInPrice = currentConfig.adrRange / 10000;
    const priceRange = state.maxObservedPrice - state.minObservedPrice;
    const dynamicRange = Math.max(adrRangeInPrice, priceRange * 1.2);
    const midPrice = (state.maxObservedPrice + state.minObservedPrice) / 2;
    state.adrHigh = midPrice + (dynamicRange / 2);
    state.adrLow = midPrice - (dynamicRange / 2);
}

function updateVolatility(state) {
    if (state.ticks.length < 3) {
        state.volatility = Math.max(0.1, (state.volatility || 0.1) * 0.99);
        return;
    }
    const avgMagnitude = state.ticks.reduce((sum, t) => sum + t.magnitude, 0) / state.ticks.length;
    const tickFrequency = state.ticks.length / 10;
    const magnitudeScore = Math.min(avgMagnitude / 2, 3);
    const frequencyScore = Math.min(tickFrequency / 2, 2);
    const rawVolatility = (magnitudeScore * 0.7) + (frequencyScore * 0.3);
    const smoothingFactor = 0.1;
    state.volatility = ((state.volatility || 0) * (1 - smoothingFactor)) + (rawVolatility * smoothingFactor);
    state.volatility = Math.max(0.1, state.volatility);
}

// --- Listen for new ticks and process them ---
tickData.subscribe(ticks => {
    if (!ticks || Object.keys(ticks).length === 0) return;
    console.log('symbolManager.js: Received new data from tickData store:', ticks);
    for (const symbol in ticks) {
        processTick(symbol, ticks[symbol]);
    }
});
