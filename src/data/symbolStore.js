import { writable } from 'svelte/store';
import {
    SymbolDataPackageSchema,
    VisualizationConfigSchema
} from './schema.js';

// Reference Canvas Pattern - Base reference dimensions
const REFERENCE_CANVAS = { width: 220, height: 120 };

// Default configuration (Reference Canvas Pattern - absolute reference values)
const defaultConfig = {
    // Layout & Meter - Reference Canvas Pattern (percentage-based values)
    visualizationsContentWidth: 100,  // 100% of reference width (220px)
    meterHeight: 100,                  // 100% of reference height (120px)
    centralAxisXPosition: 50,         // 50% of reference width (110px)
    adrRange: 100,
    adrLookbackDays: 14,
    adrProximityThreshold: 10,
    adrPulseColor: '#3B82F6',
    adrPulseWidthRatio: 1,
    adrPulseHeight: 2,

    // ADR Range Indicator
    showAdrRangeIndicatorLines: true,
    adrRangeIndicatorLinesColor: '#9CA3AF',
    adrRangeIndicatorLinesThickness: 1,
    showAdrRangeIndicatorLabel: true,
    adrRangeIndicatorLabelColor: '#E5E7EB',
    adrRangeIndicatorLabelShowBackground: true,
    adrRangeIndicatorLabelBackgroundColor: '#1F2937',
    adrRangeIndicatorLabelBackgroundOpacity: 0.8,
    adrLabelType: 'dynamicPercentage',
    adrRangeIndicatorLabelShowBoxOutline: true,
    adrRangeIndicatorLabelBoxOutlineColor: '#4B5563',
    adrRangeIndicatorLabelBoxOutlineOpacity: 1,

    // Labels (PH/PL, OHL)
    pHighLowLabelSide: 'right',
    ohlLabelSide: 'right',
    pHighLowLabelShowBackground: true,
    pHighLowLabelBackgroundColor: '#1f2937',
    pHighLowLabelBackgroundOpacity: 0.7,
    pHighLowLabelShowBoxOutline: false,
    pHighLowLabelBoxOutlineColor: '#4b5563',
    pHighLowLabelBoxOutlineOpacity: 1,
    ohlLabelShowBackground: true,
    ohlLabelBackgroundColor: '#1f2937',
    ohlLabelBackgroundOpacity: 0.7,
    ohlLabelShowBoxOutline: false,
    ohlLabelBoxOutlineColor: '#4b5563',
    ohlLabelBoxOutlineOpacity: 1,

    // Price Float & Display - Reference Canvas Pattern (percentage-based values)
    priceFloatWidth: 45.5,              // 45.5% of reference width (100px ÷ 220px)
    priceFloatHeight: 3.3,              // 3.3% of reference height (4px ÷ 120px)
    priceFloatXOffset: 0,               // 0% of reference width
    priceFloatUseDirectionalColor: false,
    priceFloatColor: '#FFFFFF',
    priceFloatUpColor: '#3b82f6',
    priceFloatDownColor: '#ef4444',
    showPriceFloatPulse: false,
    priceFloatPulseThreshold: 0.5,
    priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
    priceFloatPulseScale: 1.5,
    priceFontSize: 54.2,               // 54.2% of reference height (65px ÷ 120px)
    priceFontWeight: '600',
    priceHorizontalOffset: 1.8,        // 1.8% of reference width (4px ÷ 220px)
    priceDisplayPadding: 0,             // 0% of reference dimensions
    bigFigureFontSizeRatio: 0.7,
    pipFontSizeRatio: 1.0,
    pipetteFontSizeRatio: 0.4,
    showPipetteDigit: true,
    priceUseStaticColor: false,
    priceStaticColor: '#d1d5db',
    priceUpColor: '#3b82f6',
    priceDownColor: '#ef4444',
    showPriceBackground: true,
    priceBackgroundColor: '#111827',
    priceBackgroundOpacity: 0.5,
    showPriceBoundingBox: false,
    priceBoxOutlineColor: '#4b5563',
    priceBoxOutlineOpacity: 1,
    
    // Volatility Orb - Reference Canvas Pattern (percentage-based values)
    showVolatilityOrb: true,
    volatilityColorMode: 'directional',
    volatilityOrbBaseWidth: 90.9,       // 90.9% of reference width (200px ÷ 220px)
    volatilityOrbInvertBrightness: false,
    volatilitySizeMultiplier: 1.5,
    showVolatilityMetric: true,
    
    // Event Highlighting
    showFlash: false,
    flashThreshold: 2.0,
    flashIntensity: 0.3,
    showOrbFlash: false,
    orbFlashThreshold: 2.0,
    orbFlashIntensity: 0.8,
    
    // Market Profile
    showMarketProfile: true,
    marketProfileView: 'combinedRight',
    marketProfileUpColor: '#a78bfa',
    marketProfileDownColor: '#a78bfa',
    marketProfileOpacity: 0.7,
    marketProfileOutline: true,
    marketProfileOutlineShowStroke: true,
    marketProfileOutlineStrokeWidth: 1,
    marketProfileOutlineUpColor: '#a78bfa',
    marketProfileOutlineDownColor: '#a78bfa',
    marketProfileOutlineOpacity: 1,
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    priceBucketMultiplier: 1,
    marketProfileWidthRatio: 1,
    showMaxMarker: true,

    // Price Markers
    markerLineColor: '#FFFFFF',
    markerLineThickness: 2,

    // Hover Indicator
    hoverLabelShowBackground: true,
    hoverLabelBackgroundColor: '#000000',
    hoverLabelBackgroundOpacity: 0.7,

    // Simulation
    frequencyMode: 'normal'
};

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
