// Day Range Meter Orchestrator - Crystal Clarity Compliant
// Framework-first: Main day range rendering coordination

import { renderAdrAxis, renderCenterLine, renderAdrBoundaryLines } from './dayRangeCore.js';
import { validateMarketData, createDayRangeConfig, createPriceScale, renderBackground, createMappedData } from './dayRangeRenderingUtils.js';
import { calculateAdaptiveScale, calculateDayRangePercentage } from './dayRangeCalculations.js';
import { renderCurrentPrice, renderOpenPrice, renderHighLowMarkers } from './priceMarkerRenderer.js';
import { renderPercentageMarkers } from './percentageMarkerRenderer.js';

export function renderDayRange(ctx, d, s, getConfig, options = {}) {
  const { width, height } = s;
  const { clearCanvas = true } = options;

  if (clearCanvas) {
    console.log('[DAY_RANGE_ORCHESTRATOR] Clearing canvas');
    // The context is already DPR-scaled, so use logical dimensions
    ctx.clearRect(0, 0, width, height);
  } else {
    console.log('[DAY_RANGE_ORCHESTRATOR] Skipping canvas clear for combined rendering');
  }

  if (!validateMarketData(d, ctx, s)) return;

  const config = createDayRangeConfig(s, width, height, getConfig);
  const adaptiveScale = calculateAdaptiveScale(d, config);
  const priceScale = createPriceScale(config, adaptiveScale, height);

  // Only render solid background if not in combined mode
  if (options.clearCanvas !== false) {
    renderBackground(ctx, width, height);
  }
  renderStructuralElements(ctx, config, width, height, priceScale, d, adaptiveScale);
  renderPriceElements(ctx, config, priceScale, d, s);
  renderPercentageElements(ctx, config, d, adaptiveScale, height, width);
}

function renderStructuralElements(ctx, config, width, height, priceScale, d, adaptiveScale) {
  const midPrice = d.open || d.current;
  const adrValue = d.adrHigh - d.adrLow;

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

function renderPriceElements(ctx, config, priceScale, d, s) {
  const { width } = s;
  let axisX = config.positioning.adrAxisX;

  // Handle percentage (0-1) as fraction of width
  if (typeof axisX === 'number' && axisX > 0 && axisX <= 1) {
    axisX = width * axisX;
  }

  const mappedData = createMappedData(d);

  renderCurrentPrice(ctx, config, axisX, priceScale, d.current, s);
  renderOpenPrice(ctx, config, axisX, priceScale, d.open, s);
  renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData, s);
}

function renderPercentageElements(ctx, config, d, adaptiveScale, height, width) {
  if (config.features.percentageMarkers.static || config.features.percentageMarkers.dynamic) {
    renderPercentageMarkers(ctx, config, d, adaptiveScale, height, config.positioning.padding, width);
  }
}

