// Price Marker Coordinate Utilities - Crystal Clarity Compliant
// Framework-first: All coordinate conversions route through createPriceScale

import { calculateAdaptiveScale } from './dayRangeCalculations.js';
import { createPriceScale } from './dayRangeRenderingUtils.js';

// Convert Y coordinate to price using shared price-scale system
export function toPrice(canvas, scale, data, y) {
  const h = canvas.getBoundingClientRect().height;

  // Resolve adaptive scale from market data when available
  if (data && data.adrHigh && data.adrLow && data.current) {
    const scaleData = {
      adrHigh: data.adrHigh,
      adrLow: data.adrLow,
      high: data.high,
      low: data.low,
      current: data.current,
      open: data.open
    };
    const config = { scaling: 'adaptive' };
    const adaptiveScale = calculateAdaptiveScale(scaleData, config);
    return createPriceScale(config, adaptiveScale, h).toPrice(y);
  }

  // Fallback: use provided scale range directly
  if (scale) {
    return createPriceScale({}, { min: scale.min, max: scale.max }, h).toPrice(y);
  }

  // Last resort: synthetic range around current price
  const defaultRange = data?.pipSize ? data.pipSize * 10000 : 1.0;
  const center = data?.current ?? 0;
  return createPriceScale({}, { min: center - defaultRange / 2, max: center + defaultRange / 2 }, h).toPrice(y);
}
