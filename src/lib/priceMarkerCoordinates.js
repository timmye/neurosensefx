// Price Marker Coordinate Utilities - Crystal Clarity Compliant
// Framework-first: Direct coordinate calculations with no abstraction

import { calculateAdaptiveScale } from './dayRangeCalculations.js';

// Convert Y coordinate to price using day range coordinate system
export function toPrice(canvas, scale, data, y) {
  const h = canvas.height;
  const padding = 5; // CRITICAL: Use 5px padding to match day range meter exactly

  // If we have current market data, use the adaptive scale from day range
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

    const normalized = (h - padding - y) / (h - 2 * padding);
    return adaptiveScale.min + normalized * adaptiveScale.range;
  }

  // Fallback: Use the provided scale if available
  if (scale) {
    const { min, max } = scale;
    const normalized = (h - padding - y) / (h - 2 * padding);
    return min + normalized * (max - min);
  }

  // Last resort: Create a wide range that allows ANY price placement
  const defaultRange = data?.pipSize ? data.pipSize * 10000 : 1.0;
  const fallbackLow = (data?.current ?? 0) - defaultRange / 2;
  const fallbackHigh = (data?.current ?? 0) + defaultRange / 2;
  const normalized = (h - padding - y) / (h - 2 * padding);
  return fallbackLow + normalized * (fallbackHigh - fallbackLow);
}

