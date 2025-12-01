// Market Profile Core Rendering - Crystal Clarity Compliant
// Framework-first: Canvas 2D API, professional trading visualization
// Essential features: Volume distribution, buy/sell pressure, Point of Control

import { processProfileLevels, createPriceScale } from './marketProfileData.js';
import { renderVolumeBars, renderPointOfControl } from './marketProfileRenderers.js';

/**
 * Render market profile visualization with volume distribution
 */
export function renderMarketProfile(ctx, data, s, config = {}) {
  const { width, height } = s;
  ctx.clearRect(0, 0, width, height);

  // Early exit for missing data
  if (!hasValidData(data)) {
    renderStatusMessage(ctx, 'No market profile data', s);
    return;
  }

  const cfg = getConfig(config, width);
  const processedData = processProfileLevels(data.levels);
  if (processedData.length === 0) return;

  const priceScale = createPriceScale(processedData, height);

  renderVolumeBars(ctx, processedData, priceScale, cfg);

  if (cfg.showPOC) {
    renderPointOfControl(ctx, processedData, priceScale, cfg);
  }
}

/**
 * Check if market profile data is valid
 */
function hasValidData(data) {
  return data &&
         data.levels &&
         Array.isArray(data.levels) &&
         data.levels.length > 0;
}

/**
 * Get configuration with defaults
 */
function getConfig(config, width) {
  return {
    axisX: width * 0.2,
    maxBarWidth: width * 0.6,
    minBarWidth: 2,
    opacity: 0.8,
    showPOC: true,
    barColor: '#10B981',
    sellColor: '#EF4444',
    outlineWidth: 1,
    outlineColor: '#374151',
    pocMarkerSize: 3,
    pocMarkerColor: '#F59E0B',
    positioning: 'separate',
    ...config
  };
}

/**
 * Render status message
 */
function renderStatusMessage(ctx, message, s) {
  const { width, height } = s;
  ctx.fillStyle = '#F59E0B';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
}