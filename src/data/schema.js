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
    ticks: z.number().optional(),
});

// CORRECTED: Define a clear schema for the historical data from the backend.
export const HistoricalBarSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  timestamp: z.number(),
  volume: z.number().optional(),
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
  delta: z.number(),
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
  ready: z.boolean().optional().default(true),
  hasPrice: z.boolean().optional().default(false),
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
  maxAdrPercentage: z.number(),
  ticks: z.array(ProcessedTickSchema),
  allTicks: z.array(ProcessedTickSchema),
  tickMagnitudes: z.array(z.number()),
});

// =================================================================================
// VISUALIZATION CONFIGURATION SCHEMA
// =================================================================================
// Import the auto-generated visualization configuration schema
// Simplified configuration schema - no longer needed as separate export
// VisualizationConfigSchema is now handled directly by visualizationSchema.js
