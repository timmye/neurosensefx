// Day Range Percentage Marker Renderer - Crystal Clarity Compliant
// Framework-first: Static and dynamic percentage markers with Canvas 2D

import { setupTextRendering, renderPixelPerfectLine } from './dayRangeCore.js';
import { calculateMaxAdrPercentage, calculateDayRangePercentage, getYCoordinate } from './dayRangeCalculations.js';

// Main percentage markers orchestrator
export function renderPercentageMarkers(ctx, config, d, range, height, padding) {
  ctx.save();
  setupTextRendering(ctx, config.fonts.percentageLabels, 'middle', 'right');
  ctx.fillStyle = config.colors.percentageLabels;

  renderStaticMarkers(ctx, config, d, range, height, padding);
  renderDynamicMarkers(ctx, config, d, range, height, padding);

  ctx.restore();
}

// Render static percentage markers with progressive disclosure
function renderStaticMarkers(ctx, config, d, range, height, padding) {
  if (!config.features.percentageMarkers.static) return;

  const state = createMarkerState(d);
  const maxAdrPercentage = calculateMaxAdrPercentage(state);

  for (let level = 0.25; level <= maxAdrPercentage; level += 0.25) {
    renderStaticMarker(ctx, level, config, d, range, height, padding);
  }
}

// Render dynamic day range percentage markers
function renderDynamicMarkers(ctx, config, d, range, height, padding) {
  if (!config.features.percentageMarkers.dynamic) return;

  const dayRangePct = calculateDayRangePercentage(d);
  if (dayRangePct) {
    renderDynamicMarker(ctx, dayRangePct, config, d, range, height, padding);
  }
}

// Render single static percentage marker
function renderStaticMarker(ctx, level, config, d, range, height, padding) {
  const { positioning, colors } = config;
  const midPrice = d.open || d.current;
  const adrValue = d.adrHigh - d.adrLow;

  const highPrice = midPrice + (adrValue * level);
  const lowPrice = midPrice - (adrValue * level);
  const highY = getYCoordinate(highPrice, range, height, padding);
  const lowY = getYCoordinate(lowPrice, range, height, padding);

  renderPercentageMarkerLine(ctx, positioning.adrAxisX, highY, `${(level * 100).toFixed(0)}%`, 'right', colors);
  renderPercentageMarkerLine(ctx, positioning.adrAxisX, lowY, `-${(level * 100).toFixed(0)}%`, 'right', colors);
}

// Render dynamic day range percentage at extremes
function renderDynamicMarker(ctx, dayRangePct, config, d, range, height, padding) {
  const { positioning, colors } = config;
  const midPrice = d.open || d.current;
  const todayHigh = d.high || midPrice;
  const todayLow = d.low || midPrice;
  const label = `DR ${dayRangePct}%`;

  const highY = getYCoordinate(todayHigh, range, height, padding);
  const lowY = getYCoordinate(todayLow, range, height, padding);

  ctx.fillStyle = colors.sessionPrices;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, positioning.adrAxisX + 12, highY);
  ctx.fillText(label, positioning.adrAxisX + 12, lowY);
}

// Render marker line with label
function renderPercentageMarkerLine(ctx, axisX, y, label, side, colors) {
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 8 / dpr;
  const labelOffset = 12 / dpr;

  ctx.save();
  ctx.strokeStyle = colors.markers;
  ctx.lineWidth = 1 / dpr;
  renderPixelPerfectLine(ctx, axisX - markerLength, y, axisX + markerLength, y);

  ctx.fillStyle = colors.percentageLabels;
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  const textX = side === 'right' ? axisX + labelOffset : axisX - labelOffset;
  ctx.fillText(label, textX, y);
  ctx.restore();
}

// Create marker state for calculations
function createMarkerState(d) {
  return {
    midPrice: d.open || d.current,
    todayHigh: d.high,
    todayLow: d.low,
    adrHigh: d.adrHigh,
    adrLow: d.adrLow
  };
}