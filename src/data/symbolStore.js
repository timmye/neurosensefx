import { writable } from 'svelte/store';

const { subscribe, set, update } = writable({});
const workers = new Map();

export const defaultConfig = {
    visualizationsContentWidth: 220,
    meterHeight: 120,
    centralAxisXPosition: 170,
    adrRange: 100,
    adrProximityThreshold: 10,
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
    priceFloatWidth: 50,
    priceFloatHeight: 1,
    priceFloatXOffset: 20,
    showVolatilityOrb: true,
    volatilityColorMode: 'intensity',
    volatilityOrbBaseWidth: 70,
    volatilityOrbInvertBrightness: false,
    volatilitySizeMultiplier: 0.5,
    showFlash: false,
    flashThreshold: 2.0,
    flashIntensity: 0.3,
    showOrbFlash: false,
    orbFlashThreshold: 2.0,
    orbFlashIntensity: 0.8,
    showMarketProfile: true,
    marketProfileView: 'bars',
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    priceBucketSize: 0.5,
    showSingleSidedProfile: false,
    singleSidedProfileSide: 'right',
    showMaxMarker: true,
};

function createNewSymbol(symbol, initialPrice) {
    const validatedPrice = (typeof initialPrice === 'number' && !isNaN(initialPrice)) ? initialPrice : 0;
    if (validatedPrice !== initialPrice) {
        console.warn(`Invalid initialPrice '${initialPrice}' for ${symbol}. Defaulting to 0.`);
    }

    update(symbols => {
        if (symbols[symbol]) {
            return symbols;
        }

        console.log(`Creating new symbol: ${symbol} with initial price: ${validatedPrice}`);
        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
        
        const initialState = {
            currentPrice: validatedPrice, midPrice: validatedPrice, lastTickTime: 0,
            maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
            volatility: 0, lastTickDirection: 'up', marketProfile: { levels: [] },
            projectedHigh: validatedPrice * 1.005, // Sensible default
            projectedLow: validatedPrice * 0.995, // Sensible default
            flashEffect: null,
        };

        worker.onmessage = ({ data }) => handleWorkerMessage(symbol, data);
        worker.postMessage({ type: 'init', payload: { config: defaultConfig, midPrice: validatedPrice } });
        
        workers.set(symbol, worker);

        symbols[symbol] = {
            config: { ...defaultConfig },
            state: initialState,
            marketProfile: { levels: [] } // Kept separate for now to avoid large state copies
        };
        return { ...symbols };
    });
}

function handleWorkerMessage(symbol, data) {
    const { type, payload } = data;
    if (type === 'stateUpdate') {
        update(symbols => {
            const existingSymbol = symbols[symbol];
            if (existingSymbol) {
                // NEVER mutate. Always create new objects.
                const newSymbolData = {
                    ...existingSymbol,
                    state: {
                        ...existingSymbol.state,
                        ...payload.newState, // The worker now sends the whole state
                    },
                    marketProfile: payload.marketProfile, // Get profile from worker
                    flashEffect: payload.flashEffect 
                        ? { ...payload.flashEffect, id: performance.now() } 
                        : null
                };
                
                return {
                    ...symbols,
                    [symbol]: newSymbolData
                };
            }
            return symbols;
        });
    }
}

function updateMarketData(symbol, marketData) {
    update(symbols => {
        const existingSymbol = symbols[symbol];
        if (existingSymbol) {
            // Update the main store's state
            existingSymbol.state.projectedHigh = marketData.projectedHigh;
            existingSymbol.state.projectedLow = marketData.projectedLow;
            
            // Forward this data to the worker
            const worker = workers.get(symbol);
            if (worker) {
                worker.postMessage({ type: 'marketData', payload: marketData });
            }
        }
        return { ...symbols }; // Return a new object to trigger reactivity
    });
}

function dispatchTick(symbol, tick) {
    const worker = workers.get(symbol);
    if (worker) {
        worker.postMessage({ type: 'tick', payload: tick });
    } else {
        createNewSymbol(symbol, tick.bid);
        // Retry dispatching the tick after a short delay to allow for initialization
        setTimeout(() => {
            const newWorker = workers.get(symbol);
            if(newWorker) newWorker.postMessage({ type: 'tick', payload: tick });
        }, 50);
    }
}

function dispatchMarketProfile(symbol, profileData) {
    const worker = workers.get(symbol);
    if (worker) {
        worker.postMessage({ type: 'initialProfile', payload: profileData });
    }
}

function updateConfig(symbol, newConfig) {
    update(symbols => {
        const existingSymbol = symbols[symbol];
        if (existingSymbol) {
            const updatedConfig = { ...existingSymbol.config, ...newConfig };
            const worker = workers.get(symbol);
            if (worker) {
                worker.postMessage({ type: 'updateConfig', payload: newConfig });
            }
            return {
                ...symbols,
                [symbol]: {
                    ...existingSymbol,
                    config: updatedConfig
                }
            };
        }
        return symbols;
    });
}

function resetConfig(symbol) {
    update(symbols => {
        const existingSymbol = symbols[symbol];
        if (existingSymbol) {
            const worker = workers.get(symbol);
            if (worker) {
                worker.postMessage({ type: 'updateConfig', payload: { ...defaultConfig } });
            }
            return {
                ...symbols,
                [symbol]: {
                    ...existingSymbol,
                    config: { ...defaultConfig }
                }
            };
        }
        return symbols;
    });
}

function removeSymbol(symbol) {
    update(symbols => {
        const newSymbols = { ...symbols };
        if (newSymbols[symbol]) {
            const worker = workers.get(symbol);
            if (worker) {
                worker.terminate();
                workers.delete(symbol);
            }
            delete newSymbols[symbol];
        }
        return newSymbols;
    });
}

function clear() {
    set({});
    workers.forEach(worker => worker.terminate());
    workers.clear();
}

export const symbolStore = {
    subscribe,
    createNewSymbol,
    dispatchTick,
    dispatchMarketProfile,
    updateMarketData, // Expose the new function
    updateConfig,
    resetConfig,
    removeSymbol,
    clear
};
