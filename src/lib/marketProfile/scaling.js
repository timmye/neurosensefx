// Market Profile Scaling - Crystal Clarity Compliant
// Framework-first: Y-coordinate scaling shared with Day Range Meter
// Ensures Market Profile overlay aligns with Day Range Meter

import { calculateAdaptiveScale as calculateDayRangeScale } from '../dayRangeCalculations.js';
import { createPriceScale as createDayRangePriceScale, createDayRangeConfig } from '../dayRangeRenderingUtils.js';
import { getConfig } from '../dayRangeConfig.js';

export function calculateAdaptiveScale(profile, marketData, width, height) {
  const profilePrices = profile.map(d => d.price);
  const profileMinPrice = Math.min(...profilePrices);
  const profileMaxPrice = Math.max(...profilePrices);

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
        maxAdrPercentage: 0.5,
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

export function createPriceScale(config, adaptiveScale, height) {
  return createDayRangePriceScale(config, adaptiveScale, height);
}

export function priceToY(price, priceScale) {
  return priceScale(price);
}

export function yToPrice(y, adaptiveScale, height) {
  const { min, max } = adaptiveScale;
  const labelPadding = 5;
  const normalized = (y - labelPadding) / (height - 2 * labelPadding);
  return max - (normalized * (max - min));
}

export function calculateDimensions(width, height, config) {
  const marketData = config.marketData || {};
  const baseConfig = createDayRangeConfig({ marketData }, width, height, getConfig);
  const positioning = baseConfig.positioning;

  const adrAxisX = width * 0.75;
  const marketProfileStartX = adrAxisX;
  const marketProfileWidth = width - adrAxisX;
  const padding = positioning.padding;

  return {
    adrAxisX,
    marketProfileStartX,
    marketProfileWidth,
    padding,
    profileHeight: height - (padding * 2)
  };
}
