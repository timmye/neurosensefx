// Day Range Percentage Marker Renderer - Crystal Clarity Compliant
// Framework-first: Static and dynamic percentage markers with Canvas 2D

import { setupTextRendering, renderPixelPerfectLine } from './dayRangeCore.js';
import { calculateMaxAdrPercentage, calculateDayRangePercentage, getYCoordinate } from './dayRangeCalculations.js';

// Main percentage markers orchestrator
export function renderPercentageMarkers(ctx, config, d, adaptiveScale, height, padding, width) {
  ctx.save();
  setupTextRendering(ctx, config.fonts.percentageLabels, 'middle', 'right');
  ctx.fillStyle = config.colors.percentageLabels;

  renderStaticMarkers(ctx, config, d, adaptiveScale, height, padding, width);
  renderDynamicMarkers(ctx, config, d, adaptiveScale, height, padding, width);

  ctx.restore();
}

// Render static percentage markers with progressive disclosure
function renderStaticMarkers(ctx, config, d, adaptiveScale, height, padding, width) {
  if (!config.features.percentageMarkers.static) return;

  const { upperExpansion, lowerExpansion } = adaptiveScale;
  const maxAdrPercentage = Math.max(upperExpansion, lowerExpansion);

  for (let level = 0.25; level <= maxAdrPercentage; level += 0.25) {
    renderStaticMarker(ctx, level, config, d, adaptiveScale, height, padding, width);
  }
}

// Render dynamic day range percentage markers
function renderDynamicMarkers(ctx, config, d, adaptiveScale, height, padding, width) {
  if (!config.features.percentageMarkers.dynamic) return;

  const dayRangePct = calculateDayRangePercentage(d);
  if (dayRangePct) {
    renderDynamicMarker(ctx, dayRangePct, config, d, adaptiveScale, height, padding, width);
  }
}

// Render single static percentage marker
function renderStaticMarker(ctx, level, config, d, adaptiveScale, height, padding, width) {
  const { positioning, colors } = config;
  let axisX = positioning.adrAxisX;

  // Handle percentage (0-1) as fraction of width
  if (typeof axisX === 'number' && axisX > 0 && axisX <= 1 && width) {
    axisX = width * axisX;
  }

  const midPrice = d.open || d.current;
  const adrValue = d.adrHigh - d.adrLow;

  // Create price scale using same parameters as main visualization
  const { min, max } = adaptiveScale;
  const labelPadding = 5;

  const priceScale = (price) => {
    const normalized = (max - price) / (max - min);
    return labelPadding + (normalized * (height - 2 * labelPadding));
  };

  const highPrice = midPrice + (adrValue * level);
  const lowPrice = midPrice - (adrValue * level);
  const highY = priceScale(highPrice);
  const lowY = priceScale(lowPrice);

  renderPercentageMarkerLine(ctx, axisX, highY, `+${(level * 100).toFixed(0)}%`, 'right', colors);
  renderPercentageMarkerLine(ctx, axisX, lowY, `-${(level * 100).toFixed(0)}%`, 'right', colors);
}

// Render dynamic day range percentage centered on 0 line
function renderDynamicMarker(ctx, dayRangePct, config, d, adaptiveScale, height, padding, width) {
  const { positioning, colors } = config;
  let axisX = positioning.adrAxisX;

  // Handle percentage (0-1) as fraction of width
  if (typeof axisX === 'number' && axisX > 0 && axisX <= 1 && width) {
    axisX = width * axisX;
  }

  const midPrice = d.open || d.current;
  const label = `DR ${dayRangePct}%`;

  // Create price scale using same parameters as main visualization
  const { min, max } = adaptiveScale;
  const labelPadding = 5;

  const priceScale = (price) => {
    const normalized = (max - price) / (max - min);
    return labelPadding + (normalized * (height - 2 * labelPadding));
  };

  // Center on 0 line (mid price) and align to right edge like main ADR labels
  const midY = priceScale(midPrice);

  ctx.fillStyle = colors.sessionPrices;
  ctx.font = colors.fonts?.percentageLabels || '10px sans-serif';
  ctx.textAlign = 'right';

  // Add semi-transparent background for DR% text
  const textMetrics = ctx.measureText(label);
  const textX = ctx.canvas.width - 5;
  const backgroundPadding = 3;
  const backgroundOpacity = 0.6;

  // Use actual Canvas font metrics instead of approximate height
  const actualHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent;

  // Draw background rectangle using precise text measurements
  ctx.fillStyle = `rgba(0, 0, 0, ${backgroundOpacity})`;
  ctx.fillRect(
    textX - textMetrics.width - backgroundPadding,
    midY - actualHeight / 2 - backgroundPadding / 2,
    textMetrics.width + backgroundPadding * 2,
    actualHeight + backgroundPadding
  );

  // Redraw text on top
  ctx.fillStyle = colors.sessionPrices;
  ctx.fillText(label, textX, midY);
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