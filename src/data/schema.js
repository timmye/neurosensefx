import { z } from 'zod';

// Basic data types
export const TickSchema = z.object({
  symbol: z.string(),
  bid: z.number(),
  ask: z.number(),
  timestamp: z.number(),
});

export const HistoricalBarSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  timestamp: z.number(),
});

export const MarketDataSchema = z.object({
  adr: z.number(),
  projectedHigh: z.number(),
  projectedLow: z.number(),
  todaysOpen: z.number(),
  todaysHigh: z.number(),
  todaysLow: z.number(),
});

export const SymbolDataPackageSchema = MarketDataSchema.extend({
  symbol: z.string(),
  initialPrice: z.number(),
  initialMarketProfile: z.array(HistoricalBarSchema),
});

// State schemas
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
});

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
  lastTickDirection: z.enum(['up', 'down']),
  marketProfile: MarketProfileSchema,
  projectedHigh: z.number(),
  projectedLow: z.number(),
  todaysHigh: z.number(),
  todaysLow: z.number(),
  flashEffect: FlashEffectSchema.nullable(),
});

// Configuration schema
export const VisualizationConfigSchema = z.object({
  visualizationsContentWidth: z.number(),
  meterHeight: z.number(),
  centralAxisXPosition: z.number(),
  adrRange: z.number(),
  adrProximityThreshold: z.number(),
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
  marketProfileView: z.string(),
  distributionDepthMode: z.string(),
  distributionPercentage: z.number(),
  priceBucketSize: z.number(),
  showSingleSidedProfile: z.boolean(),
  singleSidedProfileSide: z.string(),
  showMaxMarker: z.boolean(),
  adrLookbackDays: z.number(), // Add this line
});
