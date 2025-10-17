import { writable } from 'svelte/store';
import { VisualizationConfigSchema } from '../data/schema.js';

// NOTE: This object is the single source of truth for all default visual settings.
// Any property that is controlled by the UI components MUST have a corresponding
// default value defined here. This ensures that all UI controls are properly initialized
// and prevents "hanging" settings where the UI doesn't reflect the actual state.
//
// Visual settings are controlled by:
// - CanvasContextMenu (right-click on canvas) - all 85+ visualization parameters
// - System settings are controlled by FloatingSystemPanel
// - Debug information is displayed in FloatingDebugPanel
const rawDefaults = {
    // Layout & Meter
    visualizationsContentWidth: 300,
    meterHeight: 120,
    centralAxisXPosition: 220,
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

    // Price Float & Display
    priceFloatWidth: 100,
    priceFloatHeight: 4,
    priceFloatXOffset: 0,
    priceFloatUseDirectionalColor: false,
    priceFloatColor: '#FFFFFF', // CORRECTED: Default to white
    priceFloatUpColor: '#3b82f6',
    priceFloatDownColor: '#ef4444',
    showPriceFloatPulse: false,
    priceFloatPulseThreshold: 0.5,
    priceFloatPulseColor: 'rgba(167, 139, 250, 0.8)',
    priceFloatPulseScale: 1.5,
    priceFontSize: 65,
    priceFontWeight: '600',
    priceHorizontalOffset: 4,
    priceDisplayPadding: 0,
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
    
    // Volatility Orb
    showVolatilityOrb: true,
    volatilityColorMode: 'directional',
    volatilityOrbBaseWidth: 200,
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
    marketProfileUpColor: '#a78bfa', // CORRECTED: Default to purple
    marketProfileDownColor: '#a78bfa', // CORRECTED: Default to purple
    marketProfileOpacity: 0.7,
    marketProfileOutline: true,
    marketProfileOutlineShowStroke: true,
    marketProfileOutlineStrokeWidth: 1,
    marketProfileOutlineUpColor: '#a78bfa', // CORRECTED: Default to purple
    marketProfileOutlineDownColor: '#a78bfa', // CORRECTED: Default to purple
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

// Create a single, validated source of truth for the default configuration
export const defaultConfig = VisualizationConfigSchema.parse(rawDefaults);

// The writable store is initialized with this validated default object
export const vizConfig = writable(defaultConfig);
