// Day Range Rendering Utilities - Crystal Clarity Compliant
// Framework-first: Canvas 2D rendering utilities

export function validateMarketData(d, ctx, s) {
  if (!d || !d.current || !d.adrLow || !d.adrHigh) {
    const { renderStatusMessage } = require('./canvasStatusRenderer.js');
    renderStatusMessage(ctx, 'Waiting for market data...', s);
    return false;
  }
  return true;
}

export function createDayRangeConfig(s, width, height, getConfig) {
  return getConfig({
    positioning: {
      adrAxisX: width / 3,
      padding: 50
    },
    features: {
      ...getConfig().features,
      ...s.config?.features
    }
  });
}

export function createPriceScale(config, adaptiveScale, height) {
  return (price) => {
    const { min, max } = adaptiveScale;
    const normalized = (max - price) / (max - min);
    // Use full height - only minimal padding for labels (5px)
    const labelPadding = 5;
    return labelPadding + (normalized * (height - 2 * labelPadding));
  };
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