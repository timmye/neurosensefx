import { writable } from 'svelte/store';
import { VisualizationConfigSchema } from '../data/schema.js';

// NOTE: This object is the single source of truth for all default visual settings.
// Any property that is controlled by `ConfigPanel.svelte` MUST have a corresponding
// default value defined here. This ensures that all UI controls are properly initialized
// and prevents "hanging" settings where the UI doesn't reflect the actual state.
const rawDefaults = {
    // Layout & Meter
    visualizationsContentWidth: 300,
    meterHeight: 120,
    centralAxisXPosition: 230,
    adrRange: 100, // This seems to be a static value from the original context
    adrLookbackDays: 14,
    adrProximityThreshold: 10,
    adrPulseColor: '#3B82F6',
    adrPulseWidthRatio: 1,
    adrPulseHeight: 2,

    // Labels (PH/PL, OHL) - Adding all missing properties
    pHighLowLabelSide: 'right',
    ohlLabelSide: 'right',
    pHighLowLabelShowBackground: false,
    pHighLowLabelBackgroundColor: '#1f2937',
    pHighLowLabelBackgroundOpacity: 0.7,
    pHighLowLabelShowBoxOutline: false,
    pHighLowLabelBoxOutlineColor: '#4b5563',
    pHighLowLabelBoxOutlineOpacity: 1,
    ohlLabelShowBackground: false,
    ohlLabelBackgroundColor: '#1f2937',
    ohlLabelBackgroundOpacity: 0.7,
    ohlLabelShowBoxOutline: false,
    ohlLabelBoxOutlineColor: '#4b5563',
    ohlLabelBoxOutlineOpacity: 1,

    // Price Float & Display
    priceFloatWidth: 100,
    priceFloatHeight: 4,
    priceFloatXOffset: 0,
    priceFloatUseDirectionalColor: true,
    priceFloatColor: '#a78bfa', // Default purple color
    priceFloatUpColor: '#3b82f6',
    priceFloatDownColor: '#ef4444',
    showPriceFloatPulse: false,
    priceFloatPulseThreshold: 0.5,
    priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
    priceFloatPulseScale: 1.5,
    priceFontSize: 50,
    priceFontWeight: '600',
    priceHorizontalOffset: 4,
    priceDisplayPadding: 0,
    bigFigureFontSizeRatio: 1.2,
    pipFontSizeRatio: 1.1,
    pipetteFontSizeRatio: 0.8,
    showPipetteDigit: true,
    priceUseStaticColor: true,
    priceStaticColor: '#d1d5db',
    priceUpColor: '#3b82f6',
    priceDownColor: '#ef4444',
    showPriceBackground: true,
    priceBackgroundColor: '#111827',
    priceBackgroundOpacity: 0.5,
    showPriceBoundingBox: false,
    priceBoxOutlineColor: '#4b5563',
    priceBoxOutlineOpacity: 1,
    
    // Volatility Orb
    showVolatilityOrb: true,
    volatilityColorMode: 'intensity',
    volatilityOrbBaseWidth: 70,
    volatilityOrbInvertBrightness: false,
    volatilitySizeMultiplier: 1.5,
    
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
    marketProfileUpColor: '#3b82f6',
    marketProfileDownColor: '#ef4444',
    marketProfileOpacity: 0.7,
    marketProfileOutline: false,
    marketProfileOutlineShowStroke: true,
    marketProfileOutlineStrokeWidth: 1,
    marketProfileOutlineUpColor: '#3b82f6',
    marketProfileOutlineDownColor: '#ef4444',
    marketProfileOutlineOpacity: 1,
    distributionDepthMode: 'all',
    distributionPercentage: 50,
    priceBucketMultiplier: 1,
    marketProfileWidthRatio: 1,
    showMaxMarker: true,
    
    // Simulation
    frequencyMode: 'volatile'
};

// Create a single, validated source of truth for the default configuration
export const defaultConfig = VisualizationConfigSchema.parse(rawDefaults);

// The writable store is initialized with this validated default object
export const vizConfig = writable(defaultConfig);
