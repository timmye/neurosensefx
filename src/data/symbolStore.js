import { writable } from 'svelte/store';
import {
    VisualizationConfigSchema,
    VisualizationStateSchema,
    TickSchema,
    SymbolDataPackageSchema,
} from './schema.js';

const { subscribe, set, update } = writable({});
const workers = new Map();

export const defaultConfig = VisualizationConfigSchema.parse({
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
});

function createNewSymbol(symbol, dataPackage) {
    const packageResult = SymbolDataPackageSchema.safeParse(dataPackage);
    if (!packageResult.success) {
        console.error('Invalid data package for new symbol:', packageResult.error);
        return;
    }
    const validatedPackage = packageResult.data;

    update(symbols => {
        if (symbols[symbol]) {
            return symbols;
        }

        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
        
        worker.onmessage = ({ data }) => handleWorkerMessage(symbol, data);
        worker.postMessage({ type: 'init', payload: {
            config: defaultConfig,
            initialPrice: validatedPackage.initialPrice,
            projectedHigh: validatedPackage.projectedHigh,
            projectedLow: validatedPackage.projectedLow,
            todaysHigh: validatedPackage.todaysHigh,
            todaysLow: validatedPackage.todaysLow,
            initialMarketProfile: validatedPackage.initialMarketProfile,
        }});
        
        workers.set(symbol, worker);

        symbols[symbol] = {
            config: { ...defaultConfig },
            state: null, // Initial state will come from the worker
            marketProfile: { levels: [] }
        };
        return { ...symbols };
    });
}

function handleWorkerMessage(symbol, data) {
    const { type, payload } = data;
    if (type === 'stateUpdate') {
        const stateResult = VisualizationStateSchema.safeParse(payload.newState);
        if (stateResult.success) {
            update(symbols => {
                const existingSymbol = symbols[symbol];
                if (existingSymbol) {
                    const newSymbolData = {
                        ...existingSymbol,
                        state: stateResult.data,
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
        } else {
            console.error('Invalid state data from worker:', JSON.stringify(stateResult.error, null, 2));
        }
    }
}

function dispatchTick(symbol, tick) {
    const tickResult = TickSchema.safeParse(tick);
    if (tickResult.success) {
        const worker = workers.get(symbol);
        if (worker) {
            worker.postMessage({ type: 'tick', payload: tickResult.data });
        }
    } else {
        console.error('Invalid tick data:', JSON.stringify(tickResult.error, null, 2));
    }
}

function updateConfig(symbol, newConfig) {
    const configResult = VisualizationConfigSchema.partial().safeParse(newConfig);
    if (configResult.success) {
        update(symbols => {
            const existingSymbol = symbols[symbol];
            if (existingSymbol) {
                const updatedConfig = { ...existingSymbol.config, ...configResult.data };
                const worker = workers.get(symbol);
                if (worker) {
                    worker.postMessage({ type: 'updateConfig', payload: configResult.data });
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
    } else {
        console.error('Invalid config data:', JSON.stringify(configResult.error, null, 2));
    }
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
    updateConfig,
    resetConfig,
    removeSymbol,
    clear
};
