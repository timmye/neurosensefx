// Day Range Rendering Utilities - Crystal Clarity Compliant
// Framework-first: Canvas 2D rendering utilities

import { renderStatusMessage } from '../canvasStatusRenderer.js';

export function validateMarketData(d, ctx, s) {
  if (!d || !d.current || !d.adrLow || !d.adrHigh) {
    renderStatusMessage(ctx, 'Waiting for market data...', s);
    return false;
  }
  return true;
}

export function createDayRangeConfig(s, width, height, getConfig) {
  const baseConfig = getConfig();
  return getConfig({
    positioning: {
      adrAxisX: baseConfig.positioning.adrAxisX || width / 3,
      padding: baseConfig.positioning.padding || 0
    },
    features: {
      ...getConfig().features,
      ...s.config?.features
    }
  });
}

export function createPriceScale(config, adaptiveScale, height) {
  const { min, max } = adaptiveScale;
  const range = Math.max(max - min, 1e-10);
  // Use full height - only minimal padding for labels (5px)
  const labelPadding = 5;

  // Forward: price → Y pixel coordinate
  const toPixel = (price) => {
    const normalized = (max - price) / range;
    return labelPadding + (normalized * (height - 2 * labelPadding));
  };

  // Inverse: Y pixel coordinate → price
  const toPrice = (y) => {
    const normalized = (y - labelPadding) / (height - 2 * labelPadding);
    return max - normalized * range;
  };

  // Return callable function with inverse attached
  const scale = toPixel;
  scale.toPixel = toPixel;
  scale.toPrice = toPrice;
  return scale;
}

export function createMappedData(d) {
  return {
    todayHigh: d.high,
    todayLow: d.low,
    current: d.current,
    adrHigh: d.adrHigh,
    adrLow: d.adrLow
  };
}

export function renderBackground(ctx, width, height) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);
}