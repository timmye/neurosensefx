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

// Configuration schema
export const VisualizationConfigSchema = z.object({
  visualizationsContentWidth: z.number(),
  meterHeight: z.number(),
  centralAxisXPosition: z.number(),
  adrRange: z.number(),
  adrProximityThreshold: z.number(),
  adrPulseColor: z.string().optional().default('rgba(59, 130, 246, 0.8)'),
  adrPulseWidthRatio: z.number().optional().default(1),
  adrPulseHeight: z.number().optional().default(2),
  priceFontSize: z.number(),
  priceFontWeight: z.string(),
  priceHorizontalOffset: z.number(),
  priceDisplayPadding: z.number(),
  bigFigureFontSizeRatio: z.number(),
  pipFontSizeRatio: z.number(),
  pipetteFontSizeRatio: z.number(),
  priceUseStaticColor: z.boolean(),
  priceStaticColor: z.string(),
  priceUpColor: z.string(),
  priceDownColor: z.string(),
  showPriceBoundingBox: z.boolean(),
  showPriceBackground: z.boolean(),
  showPipetteDigit: z.boolean(),
  priceFloatWidth: z.number(),
  priceFloatHeight: z.number(),
  priceFloatXOffset: z.number(),
  showPriceFloatPulse: z.boolean().optional().default(false),
  priceFloatPulseThreshold: z.number().optional().default(0.5),
  priceFloatPulseColor: z.string().optional().default('rgba(167, 139, 250, 0.8)'),
  priceFloatPulseScale: z.number().optional().default(1.5),
  showVolatilityOrb: z.boolean(),
  volatilityColorMode: z.string(),
  volatilityOrbBaseWidth: z.number(),
  volatilityOrbInvertBrightness: z.boolean(),
  volatilitySizeMultiplier: z.number(),
  showFlash: z.boolean(),
  flashThreshold: z.number(),
  flashIntensity: z.number(),
  showOrbFlash: z.boolean(),
  orbFlashThreshold: z.number(),
  orbFlashIntensity: z.number(),
  showMarketProfile: z.boolean(),
  marketProfileView: z.enum(['separate', 'combinedLeft', 'combinedRight']).default('separate'),
  distributionDepthMode: z.string(),
  distributionPercentage: z.number(),
  priceBucketMultiplier: z.number().optional().default(1),
  marketProfileWidthRatio: z.number().optional().default(1),
  showMaxMarker: z.boolean(),
  adrLookbackDays: z.number(),
  frequencyMode: z.string(),
});
