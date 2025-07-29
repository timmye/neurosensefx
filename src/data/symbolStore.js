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
    volatilitySizeMultiplier: 1.5,
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
    adrLookbackDays: 14,
    frequencyMode: 'normal'
});

function createNewSymbol(symbol, dataPackage) {
    console.log('[MP_DEBUG | symbolStore] createNewSymbol called for:', symbol, 'with package:', dataPackage);
    const packageResult = SymbolDataPackageSchema.safeParse(dataPackage);
    if (!packageResult.success) {
        console.error('[MP_DEBUG | symbolStore] Invalid data package for new symbol:', packageResult.error);
        return;
    }
    const validatedPackage = packageResult.data;

    update(symbols => {
        if (symbols[symbol]) {
            console.log('[MP_DEBUG | symbolStore] Symbol already exists:', symbol);
            return symbols;
        }

        console.log('[MP_DEBUG | symbolStore] Creating new worker for symbol:', symbol);
        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => handleWorkerMessage(symbol, data);
        
        const initPayload = {
            type: 'init',
            payload: {
                config: defaultConfig,
                ...validatedPackage 
            }
        };
         console.log('[MP_DEBUG | symbolStore] Posting init message to worker:', initPayload);
        worker.postMessage(initPayload);
        
        workers.set(symbol, worker);

        // CORRECTED: The store now only creates a minimal, pre-worker state.
        // The full state, including the processed market profile, will be established
        // when the worker returns its first 'stateUpdate' message.
        const initialState = {
            currentPrice: validatedPackage.initialPrice,
            midPrice: validatedPackage.todaysOpen,
            adrHigh: validatedPackage.projectedHigh,
            adrLow: validatedPackage.projectedLow,
            visualHigh: validatedPackage.projectedHigh,
            visualLow: validatedPackage.projectedLow,
            todaysHigh: validatedPackage.todaysHigh,
            todaysLow: validatedPackage.todaysLow,
            volatility: 0.5,
            volatilityIntensity: 0.25,
            lastTickDirection: 'up',
            lastTickTime: 0,
            maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
            marketProfile: { levels: [] }, // Start with an empty profile
            flashEffect: null
        };
        console.log('[MP_DEBUG | symbolStore] Initial state before worker update:', initialState);
        
        symbols[symbol] = {
            config: { ...defaultConfig },
            state: initialState,
            ready: false // This will become true on the first message from the worker.
        };
        console.log('[MP_DEBUG | symbolStore] symbolStore after adding new symbol (before worker update):', { ...symbols });
        return { ...symbols };
    });
}

function handleWorkerMessage(symbol, data) {
    console.log('[MP_DEBUG | symbolStore] Received worker message for symbol:', symbol, 'data:', data);
    const { type, payload } = data;
    if (type === 'stateUpdate') {
        console.log('[MP_DEBUG | symbolStore] Received stateUpdate from worker.', payload);
        const stateResult = VisualizationStateSchema.safeParse(payload.newState);
        if (stateResult.success) {
            update(symbols => {
                const existingSymbol = symbols[symbol];
                if (existingSymbol) {
                     console.log('[MP_DEBUG | symbolStore] Updating state for symbol:', symbol);
                    return {
                        ...symbols,
                        [symbol]: {
                            ...existingSymbol,
                            state: stateResult.data,
                            ready: true
                        }
                    };
                }
                console.warn('[MP_DEBUG | symbolStore] Received stateUpdate for non-existent symbol:', symbol);
                return symbols;
            });
        } else {
            console.error('[MP_DEBUG | symbolStore] Worker: Invalid state data from worker:', JSON.stringify(stateResult.error, null, 2));
        }
    }
}

function dispatchTick(symbol, tick) {
     console.log('[MP_DEBUG | symbolStore] dispatchTick called for:', symbol, 'tick:', tick);
    const tickResult = TickSchema.safeParse(tick);
    if (!tickResult.success) {
        console.error('[MP_DEBUG | symbolStore] Invalid tick data:', JSON.stringify(tickResult.error, null, 2));
        return;
    }
    const validatedTick = tickResult.data;

    update(symbols => {
        const existingSymbol = symbols[symbol];
        if (existingSymbol) {
            // Minimal update to the store for immediate price display
             console.log('[MP_DEBUG | symbolStore] Updating minimal state for symbol:', symbol);
            return {
                ...symbols,
                [symbol]: {
                    ...existingSymbol,
                    state: {
                        ...existingSymbol.state,
                        currentPrice: validatedTick.bid,
                        lastTickDirection: validatedTick.bid > existingSymbol.state.currentPrice ? 'up' : 'down'
                    }
                }
            };
        }
         console.warn('[MP_DEBUG | symbolStore] dispatchTick for non-existent symbol:', symbol);
        return symbols;
    });

    const worker = workers.get(symbol);
    if (worker) {
        console.log('[MP_DEBUG | symbolStore] Posting tick message to worker:', validatedTick);
        worker.postMessage({ type: 'tick', payload: validatedTick });
    } else {
         console.warn('[MP_DEBUG | symbolStore] No worker found for symbol to dispatch tick:', symbol);
    }
}

function updateConfig(symbol, newConfig) {
    console.log('[MP_DEBUG | symbolStore] updateConfig called for:', symbol, 'with config:', newConfig);
    const configResult = VisualizationConfigSchema.partial().safeParse(newConfig);
    if (configResult.success) {
        update(symbols => {
            const existingSymbol = symbols[symbol];
            if (existingSymbol) {
                const updatedConfig = { ...existingSymbol.config, ...configResult.data };
                const worker = workers.get(symbol);
                if (worker) {
                    console.log('[MP_DEBUG | symbolStore] Posting updateConfig message to worker:', configResult.data);
                    worker.postMessage({ type: 'updateConfig', payload: configResult.data });
                }
                 console.log('[MP_DEBUG | symbolStore] Updating config in store for symbol:', symbol, updatedConfig);
                return {
                    ...symbols,
                    [symbol]: {
                        ...existingSymbol,
                        config: updatedConfig
                    }
                };
            }
             console.warn('[MP_DEBUG | symbolStore] updateConfig for non-existent symbol:', symbol);
            return symbols;
        });
    } else {
        console.error('[MP_DEBUG | symbolStore] Invalid config data:', JSON.stringify(configResult.error, null, 2));
    }
}

function resetConfig(symbol) {
     console.log('[MP_DEBUG | symbolStore] resetConfig called for:', symbol);
    update(symbols => {
        const existingSymbol = symbols[symbol];
        if (existingSymbol) {
            const worker = workers.get(symbol);
            if (worker) {
                 console.log('[MP_DEBUG | symbolStore] Posting resetConfig (defaultConfig) to worker for symbol:', symbol);
                worker.postMessage({ type: 'updateConfig', payload: { ...defaultConfig } });
            }
             console.log('[MP_DEBUG | symbolStore] Resetting config in store for symbol:', symbol);
            return {
                ...symbols,
                [symbol]: {
                    ...existingSymbol,
                    config: { ...defaultConfig }
                }
            };
        }
         console.warn('[MP_DEBUG | symbolStore] resetConfig for non-existent symbol:', symbol);
        return symbols;
    });
}

function removeSymbol(symbol) {
    console.log('[MP_DEBUG | symbolStore] removeSymbol called for:', symbol);
    update(symbols => {
        const newSymbols = { ...symbols };
        if (newSymbols[symbol]) {
            const worker = workers.get(symbol);
            if (worker) {
                 console.log('[MP_DEBUG | symbolStore] Terminating worker for symbol:', symbol);
                worker.terminate();
                workers.delete(symbol);
            }
            delete newSymbols[symbol];
             console.log('[MP_DEBUG | symbolStore] Removed symbol from store:', symbol);
        }
        return newSymbols;
    });
}

function clear() {
     console.log('[MP_DEBUG | symbolStore] clear called. Terminating all workers.');
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
