import { z } from 'zod';

// Basic data types
export const TickSchema = z.object({
  symbol: z.string(),
  bid: z.number(),
  ask: z.number(),
  timestamp: z.number(),
});

// A more comprehensive representation of a tick, including calculated values.
export const ProcessedTickSchema = z.object({
    price: z.number(),
    direction: z.number(),
    magnitude: z.number(),
    time: z.number(),
});

// CORRECTED: Define a clear schema for the historical data from the backend.
export const HistoricalBarSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  timestamp: z.number(),
});

export const MarketDataSchema = z.object({
  adr: z.number(),
  projectedAdrHigh: z.number(),
  projectedAdrLow: z.number(),
  todaysOpen: z.number(),
  todaysHigh: z.number(),
  todaysLow: z.number(),
});

// CORRECTED: Use the specific HistoricalBarSchema instead of the overly-permissive z.any().
export const SymbolDataPackageSchema = MarketDataSchema.extend({
  symbol: z.string(),
  digits: z.number().int(),
  initialPrice: z.number(),
  initialMarketProfile: z.array(HistoricalBarSchema), 
});


// State schemas for the frontend
export const FlashEffectSchema = z.object({
  magnitude: z.number(),
  direction: z.enum(['up', 'down']),
  id: z.number(),
});

export const MarketProfileLevelSchema = z.object({
  price: z.number(),
  volume: z.number(),
  buy: z.number(),
  sell: z.number(),
});

export const MarketProfileSchema = z.object({
  levels: z.array(MarketProfileLevelSchema),
  tickCount: z.number().optional().default(0), // Added tickCount for diagnostics
});

export const PriceFloatPulseEffectSchema = z.object({
    active: z.boolean(),
    magnitude: z.number(),
    color: z.string(),
    scale: z.number(),
}).nullable();

export const VisualizationStateSchema = z.object({
  currentPrice: z.number(),
  midPrice: z.number(),
  lastTickTime: z.number(),
  maxDeflection: z.object({
    up: z.number(),
    down: z.number(),
    lastUpdateTime: z.number(),
  }),
  volatility: z.number(),
  volatilityIntensity: z.number(), 
  lastTickDirection: z.enum(['up', 'down']),
  marketProfile: MarketProfileSchema,
  projectedAdrHigh: z.number(),
  projectedAdrLow: z.number(),
  visualHigh: z.number(),
  visualLow: z.number(),
  todaysHigh: z.number(),
  todaysLow: z.number(),
  flashEffect: FlashEffectSchema.nullable(),
  priceFloatPulseEffect: PriceFloatPulseEffectSchema,
  digits: z.number().int(),
  lastTick: TickSchema.extend({ symbol: z.string().optional() }).nullable(),
  // Explicitly include the 'fat state' fields for debugging and flexibility.
  ticks: z.array(ProcessedTickSchema),
  allTicks: z.array(ProcessedTickSchema),
  tickMagnitudes: z.array(z.number()),
});

// =================================================================================
// VISUALIZATION CONFIGURATION SCHEMA
// =================================================================================
// This Zod schema is the single source of truth for the *shape* of the visualization configuration.
//
// CRITICAL RELATIONSHIPS:
// 1. `src/stores/configStore.js`: The `rawDefaults` object in this file is parsed
//    by this schema. If a property exists in `rawDefaults` but is not defined
//    here, the `parse()` operation will FAIL, and the entire app configuration
//    will break.
//
// 2. `src/components/ConfigPanel.svelte`: This component contains the UI controls
//    that modify the configuration. Every setting in the panel must have a
//    corresponding field in this schema and a default value in `configStore.js`.
//
// Therefore, any new configurable setting must be added in THREE places:
//    - Here, in `VisualizationConfigSchema`.
//    - In `configStore.js` with a default value.
//    - In `ConfigPanel.svelte` as a UI control.
// =================================================================================
export const VisualizationConfigSchema = z.object({
  // Layout & Meter
  visualizationsContentWidth: z.number(),
  meterHeight: z.number(),
  centralAxisXPosition: z.number(),
  adrRange: z.number(),
  adrLookbackDays: z.number(),
  adrProximityThreshold: z.number(),
  adrPulseColor: z.string(),
  adrPulseWidthRatio: z.number(),
  adrPulseHeight: z.number(),

  // Labels (PH/PL, OHL)
  pHighLowLabelSide: z.string(),
  ohlLabelSide: z.string(),
  pHighLowLabelShowBackground: z.boolean(),
  pHighLowLabelBackgroundColor: z.string(),
  pHighLowLabelBackgroundOpacity: z.number(),
  pHighLowLabelShowBoxOutline: z.boolean(),
  pHighLowLabelBoxOutlineColor: z.string(),
  pHighLowLabelBoxOutlineOpacity: z.number(),
  ohlLabelShowBackground: z.boolean(),
  ohlLabelBackgroundColor: z.string(),
  ohlLabelBackgroundOpacity: z.number(),
  ohlLabelShowBoxOutline: z.boolean(),
  ohlLabelBoxOutlineColor: z.string(),
  ohlLabelBoxOutlineOpacity: z.number(),

  // Price Float & Display
  priceFloatWidth: z.number(),
  priceFloatHeight: z.number(),
  priceFloatXOffset: z.number(),
  priceFloatUseDirectionalColor: z.boolean(),
  priceFloatColor: z.string(),
  priceFloatUpColor: z.string(),
  priceFloatDownColor: z.string(),
  showPriceFloatPulse: z.boolean(),
  priceFloatPulseThreshold: z.number(),
  priceFloatPulseColor: z.string(),
  priceFloatPulseScale: z.number(),
  priceFontSize: z.number(),
  priceFontWeight: z.string(),
  priceHorizontalOffset: z.number(),
  priceDisplayPadding: z.number(),
  bigFigureFontSizeRatio: z.number(),
  pipFontSizeRatio: z.number(),
  pipetteFontSizeRatio: z.number(),
  showPipetteDigit: z.boolean(),
  priceUseStaticColor: z.boolean(),
  priceStaticColor: z.string(),
  priceUpColor: z.string(),
  priceDownColor: z.string(),
  showPriceBackground: z.boolean(),
  priceBackgroundColor: z.string(),
  priceBackgroundOpacity: z.number(),
  showPriceBoundingBox: z.boolean(),
  priceBoxOutlineColor: z.string(),
  priceBoxOutlineOpacity: z.number(),
  
  // Volatility Orb
  showVolatilityOrb: z.boolean(),
  volatilityColorMode: z.string(),
  volatilityOrbBaseWidth: z.number(),
  volatilityOrbInvertBrightness: z.boolean(),
  volatilitySizeMultiplier: z.number(),
  
  // Event Highlighting
  showFlash: z.boolean(),
  flashThreshold: z.number(),
  flashIntensity: z.number(),
  showOrbFlash: z.boolean(),
  orbFlashThreshold: z.number(),
  orbFlashIntensity: z.number(),
  
  // Market Profile
  showMarketProfile: z.boolean(),
  marketProfileView: z.enum(['separate', 'combinedLeft', 'Righcombined']),
  marketProfileUpColor: z.string(),
  marketProfileDownColor: z.string(),
  marketProfileOpacity: z.number(),
  marketProfileOutline: z.boolean(),
  marketProfileOutlineShowStroke: z.boolean(),
  marketProfileOutlineStrokeWidth: z.number(),
  marketProfileOutlineUpColor: z.string(),
  marketProfileOutlineDownColor: z.string(),
  marketProfileOutlineOpacity: z.number(),
  distributionDepthMode: z.string(),
  distributionPercentage: z.number(),
  priceBucketMultiplier: z.number(),
  marketProfileWidthRatio: z.number(),
  showMaxMarker: z.boolean(),
  
  // Simulation
  frequencyMode: z.string(),
});
