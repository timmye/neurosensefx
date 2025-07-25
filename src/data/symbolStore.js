import { writable } from 'svelte/store';

// This store will hold the state and configuration for all symbols.
// The structure will be:
// {
//   'EURUSD': {
//     config: { ... },
//     state: { ... }
//   },
//   'GBPUSD': {
//     config: { ... },
//     state: { ... }
//   }
// }
const { subscribe, set, update } = writable({});

// This will keep track of the data processor workers for each symbol
const workers = new Map();

function createNewSymbol(symbol) {
    console.log(`Creating new symbol: ${symbol}`);
    update(symbols => {
        if (symbols[symbol]) {
            return symbols; // Symbol already exists
        }

        const worker = new Worker(new URL('../workers/dataProcessor.js', import.meta.url), { type: 'module' });

        const defaultConfig = {
            adrRange: 100,
            pulseThreshold: 0.5,
            pulseScale: 5,
            maxMarkerDecay: 10,
            flashThreshold: 2,
            adrProximityThreshold: 10,
            frequencyMode: 'normal',
            priceBucketSize: 0.5,
            showMaxMarker: true,
            showVolatilityOrb: true,
            volatilityColorMode: 'intensity',
            volatilityOrbBaseWidth: 70,
            volatilityOrbInvertBrightness: false,
            showMarketProfile: true,
            showFlash: false,
            flashIntensity: 0.3,
            showOrbFlash: false,
            orbFlashThreshold: 2,
            orbFlashIntensity: 0.8,
            distributionDepthMode: 'all',
            distributionPercentage: 50,
            marketProfileView: 'bars',
            priceFontSize: 50,
            priceFontWeight: '600',
            priceHorizontalOffset: 14,
            priceFloatWidth: 50,
            priceFloatHeight: 1,
            priceFloatXOffset: 20,
            bigFigureFontSizeRatio: 1.2,
            pipFontSizeRatio: 1.1,
            pipetteFontSizeRatio: 0.8,
            showPriceBoundingBox: false,
            showPriceBackground: false,
            priceDisplayPadding: 4,
            priceStaticColor: false,
            priceUpColor: '#3b82f6',
            priceDownColor: '#ef4444',
            visualizationsContentWidth: 220,
            centralAxisXPosition: 170,
            meterHeight: 120,
            centralMeterFixedThickness: 8,
            showPipetteDigit: false,
            showSingleSidedProfile: false,
            singleSidedProfileSide: 'right',
        };

        const initialState = {
            currentPrice: 0,
            midPrice: 0,
            lastTickTime: 0,
            maxDeflection: { up: 0, down: 0, lastUpdateTime: 0 },
            volatility: 0,
            lastTickDirection: 'up',
            marketProfile: { levels: [] },
            adrHigh: 0,
            adrLow: 0,
        };

        worker.onmessage = ({ data }) => {
            const { type, payload } = data;
            if (type === 'stateUpdate') {
                update(symbols => {
                    symbols[symbol].state = payload.newState;
                    symbols[symbol].marketProfile = payload.marketProfile;
                    return symbols;
                });
            }
        };

        worker.postMessage({
            type: 'init',
            payload: {
                config: defaultConfig,
                midPrice: 0 // Will be updated with the first tick
            }
        });
        
        workers.set(symbol, worker);

        symbols[symbol] = {
            config: defaultConfig,
            state: initialState,
            marketProfile: { levels: [] }
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


export const symbolStore = {
    subscribe,
    createNewSymbol,
    dispatchTick,
    updateConfig
};
