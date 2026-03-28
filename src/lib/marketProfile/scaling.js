// Market Profile Scaling - Crystal Clarity Compliant
// Framework-first: Y-coordinate scaling shared with Day Range Meter
// Ensures Market Profile overlay aligns with Day Range Meter

import { calculateAdaptiveScale as calculateDayRangeScale } from '../dayRangeCalculations.js';

const ADR_AXIS_RATIO = 0.75;

export function calculateAdaptiveScale(profile, marketData, width, height) {
  const profilePrices = profile.map(d => d.price);
  const profileMinPrice = profilePrices.reduce((min, p) => p < min ? p : min, Infinity);
  const profileMaxPrice = profilePrices.reduce((max, p) => p > max ? p : max, -Infinity);

  // Merge ADR range with actual Market Profile price range
  const mergedMarketData = {
    ...marketData,
    high: Math.max(marketData.high || -Infinity, profileMaxPrice),
    low: Math.min(marketData.low || Infinity, profileMinPrice),
    adrHigh: marketData.adrHigh,
    adrLow: marketData.adrLow,
    current: marketData.current
  };

  if (mergedMarketData.adrHigh && mergedMarketData.adrLow && mergedMarketData.current) {
    const adaptiveScaleConfig = {
      scaling: {
        maxAdrPercentage: 0.5, // ADR occupies at most 50% of scale range
        progressiveDisclosure: true
      }
    };

    return calculateDayRangeScale(mergedMarketData, adaptiveScaleConfig);
  }

  // Fallback: create synthetic adaptive scale from profile data only
  return {
    min: profileMinPrice,
    max: profileMaxPrice,
    range: profileMaxPrice - profileMinPrice,
    isProgressive: false
  };
}

export function calculateDimensions(width) {
  const marketProfileStartX = width * ADR_AXIS_RATIO;
  const marketProfileWidth = width - marketProfileStartX;

  return {
    marketProfileStartX,
    marketProfileWidth
  };
}
