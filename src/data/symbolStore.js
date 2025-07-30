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
    priceFloatXOffset: 0,
    showVolatilityOrb: true,
    volatilityColorMode: 'intensity',
    volatilityOrbBaseWidth: 70,
    volatilityOrbInvertBrightness: false,
    volatilitySizeMultiplier: 1.5,
    showFlash: false,
    flashThreshold: 2.0,
    flashIntensity: 0.3,
    showOrbFlash: false,
    orbFlashThreshold: 2.0,
    orbFlashIntensity: 0.8,
    showMarketProfile: true,
    marketProfileView: 'separate',
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    priceBucketSize: 0.5,
    showMaxMarker: true,
    adrLookbackDays: 14,
    frequencyMode: 'normal'
});

function createNewSymbol(symbol, dataPackage) {
    const packageResult = SymbolDataPackageSchema.safeParse(dataPackage);
    if (!packageResult.success) {
        console.error('[MP_DEBUG | symbolStore] Invalid data package for new symbol:', packageResult.error);
        return;
    }
    const validatedPackage = packageResult.data;

    update(symbols => {
        if (symbols[symbol]) {
            return symbols;
        }

        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => handleWorkerMessage(symbol, data);
        
        // CRITICAL FIX: The payload sent to the worker is now the raw, validated data package.
        // The worker is responsible for all data transformations.
        const initPayload = {
            type: 'init',
            payload: {
                config: defaultConfig,
                ...validatedPackage 
            }
        };

        worker.postMessage(initPayload);
        workers.set(symbol, worker);

        // The store now only holds the config and a 'ready' flag.
        // The entire state object will be created and managed by the worker.
        symbols[symbol] = {
            config: { ...defaultConfig },
            state: null, // State will be populated by the first worker message
            ready: false 
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
                    return {
                        ...symbols,
                        [symbol]: {
                            ...existingSymbol,
                            state: stateResult.data,
                            ready: true // Set ready flag on first valid state update
                        }
                    };
                }
                return symbols;
            });
        } else {
            console.error('[MP_DEBUG | symbolStore] FATAL: Invalid state data from worker. The UI will not render.', JSON.stringify(stateResult.error, null, 2));
        }
    }
}

function dispatchTick(symbol, tick) {
    const worker = workers.get(symbol);
    if (worker) {
        worker.postMessage({ type: 'tick', payload: tick });
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
        console.error('[MP_DEBUG | symbolStore] Invalid config data:', JSON.stringify(configResult.error, null, 2));
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
