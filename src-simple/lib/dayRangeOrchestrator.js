// Day Range Meter Orchestrator - Crystal Clarity Compliant
// Framework-first: Main day range rendering coordination

import { renderAdrAxis, renderCenterLine, renderAdrBoundaryLines } from './dayRangeCore.js';
import { validateMarketData, createDayRangeConfig, createPriceScale, renderBackground, createMappedData } from './dayRangeRenderingUtils.js';
import { calculateAdaptiveScale, calculateDayRangePercentage } from './dayRangeCalculations.js';
import { renderCurrentPrice, renderOpenPrice, renderHighLowMarkers } from './priceMarkerRenderer.js';
import { renderPercentageMarkers } from './percentageMarkerRenderer.js';

export function renderDayRange(ctx, d, s, getConfig) {
  const { width, height } = s;

  // The context is already DPR-scaled, so use logical dimensions
  ctx.clearRect(0, 0, width, height);

  if (!validateMarketData(d, ctx, s)) return;

  const config = createDayRangeConfig(s, width, height, getConfig);
  const adaptiveScale = calculateAdaptiveScale(d, config);
  const priceScale = createPriceScale(config, adaptiveScale, height);

  renderBackground(ctx, width, height);
  renderStructuralElements(ctx, config, width, height, priceScale, d, adaptiveScale);
  renderPriceElements(ctx, config, priceScale, d);
  renderPercentageElements(ctx, config, d, adaptiveScale, height);
  logProgressiveInfo(d, adaptiveScale);
}

function renderStructuralElements(ctx, config, width, height, priceScale, d, adaptiveScale) {
  const midPrice = d.open || d.current;
  const adrValue = d.adrHigh - d.adrLow;

  renderAdrAxis(ctx, config, height, 5); // Use minimal padding
  renderCenterLine(ctx, config, width, priceScale(midPrice));

  if (config.features.boundaryLines) {
    // Render ASYMMETRIC ADR boundary lines
    renderAdrBoundaryLines(ctx, config, width, height, priceScale, {
      midPrice,
      adrValue
    }, adaptiveScale);
  }
}

function renderPriceElements(ctx, config, priceScale, d) {
  const axisX = config.positioning.adrAxisX;
  const mappedData = createMappedData(d);

  renderCurrentPrice(ctx, config, axisX, priceScale, d.current);
  renderOpenPrice(ctx, config, axisX, priceScale, d.open);
  renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData);
}

function renderPercentageElements(ctx, config, d, adaptiveScale, height) {
  if (config.features.percentageMarkers.static || config.features.percentageMarkers.dynamic) {
    renderPercentageMarkers(ctx, config, d, adaptiveScale, height, config.positioning.padding);
  }
}

function logProgressiveInfo(d, adaptiveScale) {
  const dayRangePct = calculateDayRangePercentage(d);
  if (dayRangePct) {
    const maxAdrPct = (adaptiveScale.maxAdrPercentage * 100).toFixed(0);
    console.log(`[PROGRESSIVE] Day Range: ${dayRangePct}% | Max ADR: ${maxAdrPct}% | Progressive: ${adaptiveScale.isProgressive ? 'ACTIVE' : 'STANDARD'}`);
  }
}