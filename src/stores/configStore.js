import { writable } from 'svelte/store';
import { VisualizationConfigSchema } from '../data/schema.js';

// Define the raw default values, carefully matching the schema
const rawDefaults = {
    visualizationsContentWidth: 300,
    meterHeight: 120,
    centralAxisXPosition: 170,
    adrRange: 100,
    adrProximityThreshold: 10,
    adrPulseColor: '#3B82F6',
    adrPulseWidthRatio: 1,
    adrPulseHeight: 2,
    priceFontSize: 50,
    priceFontWeight: '600',
    priceHorizontalOffset: 4,
    priceDisplayPadding: 0,
    bigFigureFontSizeRatio: 1.2,
    pipFontSizeRatio: 1.1,
    pipetteFontSizeRatio: 0.8,
    priceUseStaticColor: true,
    priceStaticColor: '#d1d5db',
    priceUpColor: '#3b82f6',
    priceDownColor: '#ef4444',
    showPriceBoundingBox: false,
    showPriceBackground: false,
    showPipetteDigit: true,
    priceFloatWidth: 50,
    priceFloatHeight: 1,
    priceFloatXOffset: 0,
    showPriceFloatPulse: false,
    priceFloatPulseThreshold: 0.5,
    priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
    priceFloatPulseScale: 1.5,
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
    priceBucketMultiplier: 1,
    marketProfileWidthRatio: 1,
    showMaxMarker: true,
    adrLookbackDays: 14,
    frequencyMode: 'normal'
};

// Create a single, validated source of truth for the default configuration
export const defaultConfig = VisualizationConfigSchema.parse(rawDefaults);

// The writable store is initialized with this validated default object
export const vizConfig = writable(defaultConfig);
