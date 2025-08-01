import { writable } from 'svelte/store';
import {
    SymbolDataPackageSchema,
    VisualizationConfigSchema
} from './schema.js';
import { defaultConfig } from '../stores/configStore.js';

const { subscribe, set, update } = writable({});
const workers = new Map();

function createNewSymbol(symbol, dataPackage) {
    const packageResult = SymbolDataPackageSchema.safeParse(dataPackage);
    if (!packageResult.success) {
        console.error('[symbolStore] Invalid data package for new symbol:', packageResult.error);
        return;
    }
    const validatedPackage = packageResult.data;

    update(symbols => {
        if (symbols[symbol]) {
            return symbols;
        }

        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => handleWorkerMessage(symbol, data);
        
        const initPayload = {
            type: 'init',
            payload: {
                config: defaultConfig,
                ...validatedPackage 
            }
        };

        worker.postMessage(initPayload);
        workers.set(symbol, worker);

        symbols[symbol] = {
            config: { ...defaultConfig },
            state: null,
            ready: false 
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
                return {
                    ...symbols,
                    [symbol]: {
                        ...existingSymbol,
                        state: payload.newState,
                        ready: true
                    }
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
        console.error('[symbolStore] Invalid config data:', JSON.stringify(configResult.error, null, 2));
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
    clear,
};

// Re-export defaultConfig to satisfy any other modules that might be using it.
export { defaultConfig };
