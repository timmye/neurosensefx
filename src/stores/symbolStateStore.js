import { writable } from 'svelte/store';

// State store - will be written to by the web worker and read by the viz components
// Initialize adrHigh and adrLow here with sensible defaults based on initial currentPrice and adrRange
export const vizState = writable({
    currentPrice: 1.25500,
    midPrice: 1.25500,
    lastTickTime: 0,
    maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
    volatility: 0,
    lastTickDirection: 'up',
    marketProfile: new Map(),
    // Initialize adrHigh and adrLow to prevent display issues on initial load
    adrHigh: 1.25500 + (100 / 20000), // initialPrice + (defaultAdrRange / 20000)
    adrLow: 1.25500 - (100 / 20000),  // initialPrice - (defaultAdrRange / 20000)
});
