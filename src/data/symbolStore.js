import { writable } from 'svelte/store';

// This store will hold the state and configuration for all symbols.
const { subscribe, set, update } = writable({});

// This will keep track of the data processor workers for each symbol
const workers = new Map();

// Define the default configuration in a reusable constant
export const defaultConfig = {
    // Layout & Meter
    visualizationsContentWidth: 220,
    meterHeight: 120,
    centralAxisXPosition: 170,
    adrRange: 100,
    adrProximityThreshold: 10,
    // Price Representation
    priceFontSize: 50,
    priceFontWeight: '600',
    priceHorizontalOffset: 14,
    priceDisplayPadding: 4,
    bigFigureFontSizeRatio: 1.2,
    pipFontSizeRatio: 1.1,
    pipetteFontSizeRatio: 0.8,
    priceUseStaticColor: false, 
    priceStaticColor: '#d1d5db',
    priceUpColor: '#3b82f6',
    priceDownColor: '#ef4444',
    showPriceBoundingBox: false,
    showPriceBackground: false,
    showPipetteDigit: false,
    // Price Float
    priceFloatWidth: 50,
    priceFloatHeight: 1,
    priceFloatXOffset: 20,
    // Volatility Orb
    showVolatilityOrb: true,
    volatilityColorMode: 'intensity',
    volatilityOrbBaseWidth: 70,
    volatilityOrbInvertBrightness: false,
    volatilitySizeMultiplier: 0.5,
    // Flash Effects
    showFlash: false,
    flashThreshold: 2.0,
    flashIntensity: 0.3,
    showOrbFlash: false,
    orbFlashThreshold: 2.0,
    orbFlashIntensity: 0.8,
    // Market Profile
    showMarketProfile: true,
    marketProfileView: 'bars',
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    priceBucketSize: 0.5,
    showSingleSidedProfile: false,
    singleSidedProfileSide: 'right',
    // Misc
    showMaxMarker: true,
};


function createNewSymbol(symbol) {
    console.log(`Creating new symbol: ${symbol}`);
    update(symbols => {
        if (symbols[symbol]) {
            return symbols; // Symbol already exists
        }

        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
        
        const initialState = {
            currentPrice: 0,
            midPrice: 0,
            lastTickTime: 0,
            maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
            volatility: 0,
            lastTickDirection: 'up',
            marketProfile: { levels: [] }, // Ensure marketProfile is initialized
            adrHigh: 0,
            adrLow: 0,
            flashEffect: null,
        };

        worker.onmessage = ({ data }) => {
            const { type, payload } = data;
            if (type === 'stateUpdate') {
                update(symbols => {
                    if (symbols[symbol]) {
                        // Merge new state instead of overwriting.
                        symbols[symbol].state = { ...symbols[symbol].state, ...payload.newState };
                        // Update marketProfile separately as it's a distinct data structure
                        symbols[symbol].marketProfile = payload.marketProfile;
                        
                        // CRITICAL FIX: Always update the flashEffect.
                        // If it's present, create a new object. If not, set it to null.
                        // This ensures Svelte's reactivity is correctly triggered and the effect is not "sticky".
                        symbols[symbol].state.flashEffect = payload.flashEffect 
                            ? { ...payload.flashEffect, id: performance.now() } 
                            : null;
                    }
                    return symbols;
                });
            }
        };

        worker.postMessage({ type: 'init', payload: { config: defaultConfig, midPrice: initialState.midPrice } });
        
        workers.set(symbol, worker);

        symbols[symbol] = {
            config: { ...defaultConfig },
            state: initialState,
            marketProfile: { levels: [] } // Initialize here as well
        };

        return symbols;
    });
}

function dispatchTick(symbol, tick) {
    const worker = workers.get(symbol);
    if (worker) {
        worker.postMessage({ type: 'tick', payload: tick });
    } else {
        console.warn(`No worker found for symbol: ${symbol}`);
    }
}

function updateConfig(symbol, newConfig) {
    update(symbols => {
        if (symbols[symbol]) {
            symbols[symbol].config = { ...symbols[symbol].config, ...newConfig };
            const worker = workers.get(symbol);
            if (worker) {
                worker.postMessage({ type: 'updateConfig', payload: newConfig });
            }
        }
        return symbols;
    });
}

function resetConfig(symbol) {
    update(symbols => {
        if (symbols[symbol]) {
            symbols[symbol].config = { ...defaultConfig };
            const worker = workers.get(symbol);
            if (worker) {
                worker.postMessage({ type: 'updateConfig', payload: { ...defaultConfig } });
            }
        }
        return symbols;
    });
}

// Add a remove function to remove a single symbol and terminate its worker
function removeSymbol(symbol) {
    console.log(`Removing symbol: ${symbol}`);
    update(symbols => {
        if (symbols[symbol]) {
            const worker = workers.get(symbol);
            if (worker) {
                worker.terminate();
                workers.delete(symbol);
            }
            delete symbols[symbol];
        }
        return symbols;
    });
}

// Add a clear function to remove all symbols and terminate all workers
function clear() {
    console.log('Clearing all symbols.');
    set({});
    workers.forEach(worker => worker.terminate());
    workers.clear();
}

export const symbolStore = {
    subscribe,
    createNewSymbol,
    dispatchTick,
    updateConfig,
    resetConfig,
    removeSymbol, // Export the new removeSymbol function
    clear // Export the clear function
};
