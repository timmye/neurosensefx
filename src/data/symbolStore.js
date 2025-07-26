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
            adrHigh: 0, adrLow: 0, flashEffect: null,
        };

        worker.onmessage = ({ data }) => handleWorkerMessage(symbol, data);
        worker.postMessage({ type: 'init', payload: { config: defaultConfig, midPrice: validatedPrice } });
        
        workers.set(symbol, worker);

        symbols[symbol] = {
            config: { ...defaultConfig },
            state: initialState,
            marketProfile: { levels: [] }
        };
        return symbols;
    });
}

function handleWorkerMessage(symbol, data) {
    const { type, payload } = data;
    if (type === 'stateUpdate') {
        update(symbols => {
            const existingSymbol = symbols[symbol];
            if (existingSymbol) {
                const newSymbolData = {
                    ...existingSymbol,
                    state: {
                        ...existingSymbol.state,
                        ...payload.newState
                    },
                    marketProfile: payload.marketProfile,
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

function dispatchTick(symbol, tick) {
    const worker = workers.get(symbol);
    if (worker) {
        worker.postMessage({ type: 'tick', payload: tick });
    } else {
        console.warn(`Ignoring tick for uninitialized symbol: ${symbol}`);
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

function removeSymbol(symbol) {
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
    updateConfig,
    resetConfig,
    removeSymbol,
    clear
};
