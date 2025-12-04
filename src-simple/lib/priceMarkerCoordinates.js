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
  const defaultMin = 0.50000;
  const defaultMax = 1.50000;
  const normalized = (h - padding - y) / (h - 2 * padding);
  return defaultMin + normalized * (defaultMax - defaultMin);
}

// Create price scaling function for coordinate conversion
export function createPriceScale(canvas, scale, data) {
  const h = canvas.height;
  const padding = 20;

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
    return (price) => {
      const normalized = (price - adaptiveScale.min) / adaptiveScale.range;
      return h - padding - normalized * (h - 2 * padding);
    };
  }

  if (scale) {
    const { min, max } = scale;
    return (price) => {
      const normalized = (price - min) / (max - min);
      return h - padding - normalized * (h - 2 * padding);
    };
  }

  // Use the same wide range as toPrice fallback
  const defaultMin = 0.50000;
  const defaultMax = 1.50000;
  return (price) => {
    const normalized = (price - defaultMin) / (defaultMax - defaultMin);
    return h - padding - normalized * (h - 2 * padding);
  };
}