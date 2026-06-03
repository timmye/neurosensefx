// Day Range Meter Orchestrator - Crystal Clarity Compliant
// Framework-first: Main day range rendering coordination

import { renderAdrAxis, renderCenterLine, renderAdrBoundaryLines } from './dayRangeCore.js';
import { validateMarketData, createDayRangeConfig, createPriceScale, renderBackground, createMappedData } from './dayRangeRenderingUtils.js';
import { calculateAdaptiveScale, calculateDayRangePercentage } from './dayRangeCalculations.js';
import { renderCurrentPrice, renderOpenPrice, renderHighLowMarkers, renderPreviousDayOHLC, renderTwapMarker } from '../priceMarkers/priceMarkerRenderer.js';
import { renderPercentageMarkers } from '../percentageMarkerRenderer.js';
import { resolveAxisX } from '../displayCanvasRenderer.js';

/**
 * Pure computation step for Day Range rendering.
 * Returns all computed values needed for drawing — no canvas dependency.
 */
export function computeDayRange(d, s, getConfig) {
  const { width, height } = s;
  const config = createDayRangeConfig(s, width, height, getConfig);
  const adaptiveScale = calculateAdaptiveScale(d, config);
  const priceScale = createPriceScale(config, adaptiveScale, height);
  const mappedData = createMappedData(d);
  const dayRangePercentage = calculateDayRangePercentage(d);
  const midPrice = d.open || d.current;
  const adrValue = d.adrHigh - d.adrLow;
  return { config, adaptiveScale, priceScale, mappedData, dayRangePercentage, midPrice, adrValue, width, height };
}

export function renderDayRange(ctx, d, s, getConfig, options = {}) {
  const { width, height } = s;
  const { clearCanvas = true } = options;

  if (clearCanvas) {
    // The context is already DPR-scaled, so use logical dimensions
    ctx.clearRect(0, 0, width, height);
  }

  if (!validateMarketData(d, ctx, s)) {
    return;
  }

  const result = computeDayRange(d, s, getConfig);

  // Only render solid background if not in combined mode
  if (options.clearCanvas !== false) {
    renderBackground(ctx, result.width, result.height);
  }
  renderStructuralElements(ctx, result, d);

  // Render all price markers EXCEPT current price
  renderPriceElementsExceptCurrent(ctx, result, d, s);

  // Render percentage markers
  renderPercentageElements(ctx, result, d);

  // Calculate axisX for current price rendering
  let axisX = resolveAxisX(result.config.positioning.adrAxisX, result.width);

  // Render current price LAST so it's always on top of everything
  renderCurrentPrice(ctx, result.config, axisX, result.priceScale, d.current, d);
}

function renderStructuralElements(ctx, result, d) {
  const { config, width, height, priceScale, adaptiveScale, midPrice, adrValue } = result;

  renderAdrAxis(ctx, config, height, 5, width); // Use minimal padding
  renderCenterLine(ctx, config, width, priceScale(midPrice));

  if (config.features.boundaryLines) {
    // Render ASYMMETRIC ADR boundary lines
    renderAdrBoundaryLines(ctx, config, width, height, priceScale, {
      midPrice,
      adrValue
    }, adaptiveScale);
  }
}

function renderPriceElementsExceptCurrent(ctx, result, d, s) {
  const { config, priceScale, mappedData } = result;
  const { width } = s;
  let axisX = resolveAxisX(config.positioning.adrAxisX, width);

  // Render all price markers EXCEPT current price
  renderOpenPrice(ctx, config, axisX, priceScale, d.open, d);
  renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData, d);
  renderPreviousDayOHLC(ctx, config, axisX, priceScale, d.prevDayOHLC, d);
  renderTwapMarker(ctx, config, axisX, priceScale, d.twap, d);
}

function renderPercentageElements(ctx, result, d) {
  const { config, adaptiveScale, height, width } = result;

  if (config.features.percentageMarkers.static || config.features.percentageMarkers.dynamic) {
    renderPercentageMarkers(ctx, config, d, adaptiveScale, height, config.positioning.padding, width);
  }
}
