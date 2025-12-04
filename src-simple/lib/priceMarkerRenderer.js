// Day Range Price Marker Renderer - Crystal Clarity Compliant
// Framework-first: Current, open, and H/L price markers with Canvas 2D

import { setupTextRendering } from './dayRangeCore.js';
import { formatPriceWithPipPosition } from './priceFormat.js';
import { MARKER_TYPES } from './priceMarkers.js';

// Render current price marker with color coding
export function renderCurrentPrice(ctx, config, axisX, priceScale, price, symbolData) {
  if (!price) return;

  ctx.save();
  setupTextRendering(ctx, config.fonts.currentPrice, 'middle', 'right');
  ctx.fillStyle = config.colors.currentPrice;

  // Handle missing symbolData gracefully
  const pipPosition = symbolData?.pipPosition || 4;
  const pipSize = symbolData?.pipSize || 0.0001;
  const pipetteSize = symbolData?.pipetteSize || 0.00001;

  const formattedPrice = formatPriceWithPipPosition(price, pipPosition, pipSize, pipetteSize);
  const currentY = priceScale(price);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.currentPrice;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, currentY);
  ctx.lineTo(axisX + markerLength, currentY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, currentY);
  ctx.restore();
}

// Render open price marker with color coding
export function renderOpenPrice(ctx, config, axisX, priceScale, price, symbolData) {
  if (!price) return;

  ctx.save();
  setupTextRendering(ctx, config.fonts.priceLabels, 'middle', 'right');
  ctx.fillStyle = config.colors.openPrice;

  // Handle missing symbolData gracefully
  const pipPosition = symbolData?.pipPosition || 4;
  const pipSize = symbolData?.pipSize || 0.0001;
  const pipetteSize = symbolData?.pipetteSize || 0.00001;

  const formattedPrice = formatPriceWithPipPosition(price, pipPosition, pipSize, pipetteSize);
  const openY = priceScale(price);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.openPrice;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, openY);
  ctx.lineTo(axisX + markerLength, openY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, openY);
  ctx.restore();
}

// Render today's high and low price markers
export function renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData, symbolData) {
  ctx.save();
  ctx.fillStyle = config.colors.sessionPrices;
  ctx.font = config.fonts.priceLabels;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  renderHighMarker(ctx, axisX, priceScale, mappedData.todayHigh, symbolData, config);
  renderLowMarker(ctx, axisX, priceScale, mappedData.todayLow, symbolData, config);

  ctx.restore();
}

// Render high price marker
function renderHighMarker(ctx, axisX, priceScale, todayHigh, symbolData, config) {
  if (!todayHigh) return;

  // Handle missing symbolData gracefully
  const pipPosition = symbolData?.pipPosition || 4;
  const pipSize = symbolData?.pipSize || 0.0001;
  const pipetteSize = symbolData?.pipetteSize || 0.00001;

  const highY = priceScale(todayHigh);
  const formattedPrice = formatPriceWithPipPosition(todayHigh, pipPosition, pipSize, pipetteSize);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.sessionPrices;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, highY);
  ctx.lineTo(axisX + markerLength, highY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, highY);
}

// Render low price marker
function renderLowMarker(ctx, axisX, priceScale, todayLow, symbolData, config) {
  if (!todayLow) return;

  // Handle missing symbolData gracefully
  const pipPosition = symbolData?.pipPosition || 4;
  const pipSize = symbolData?.pipSize || 0.0001;
  const pipetteSize = symbolData?.pipetteSize || 0.00001;

  const lowY = priceScale(todayLow);
  const formattedPrice = formatPriceWithPipPosition(todayLow, pipPosition, pipSize, pipetteSize);

  // Draw horizontal marker line on ADR axis
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;
  ctx.strokeStyle = config.colors.sessionPrices;
  ctx.lineWidth = 2 / dpr;
  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, lowY);
  ctx.lineTo(axisX + markerLength, lowY);
  ctx.stroke();

  ctx.fillText(formattedPrice, axisX - 5, lowY);
}

// Render user-placed price markers with selection highlighting
export function renderUserPriceMarkers(ctx, config, axisX, priceScale, markers, selectedMarker, symbolData) {
  if (!markers || markers.length === 0) return;

  ctx.save();
  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;

  markers.forEach(marker => {
    const markerY = priceScale(marker.price);
    const isSelected = selectedMarker && selectedMarker.id === marker.id;

    ctx.strokeStyle = isSelected ? '#ff6b35' : marker.type.color;
    ctx.lineWidth = isSelected ? 3 / dpr : marker.type.size / dpr;
    ctx.globalAlpha = marker.type.opacity;

    ctx.beginPath();
    ctx.moveTo(axisX - markerLength, markerY);
    ctx.lineTo(axisX + markerLength, markerY);
    ctx.stroke();

    if (isSelected) {
      setupTextRendering(ctx, config.fonts.priceLabels, 'middle', 'right');
      ctx.fillStyle = '#ff6b35';

      // Handle missing symbolData gracefully
      const pipPosition = symbolData?.pipPosition || 4;
      const pipSize = symbolData?.pipSize || 0.0001;
      const pipetteSize = symbolData?.pipetteSize || 0.00001;

      const formattedPrice = formatPriceWithPipPosition(marker.price, pipPosition, pipSize, pipetteSize);
      ctx.fillText(formattedPrice, axisX - 5, markerY);
    }
  });

  ctx.restore();
}

// Render Alt+hover preview line at hover price
export function renderHoverPreview(ctx, config, axisX, priceScale, hoverPrice) {
  if (!hoverPrice) return;

  ctx.save();
  const dpr = window.devicePixelRatio || 1;
  const hoverY = priceScale(hoverPrice);
  const markerLength = 80 / dpr;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2 / dpr;
  ctx.setLineDash([6 / dpr, 4 / dpr]);

  ctx.beginPath();
  ctx.moveTo(axisX - markerLength, hoverY);
  ctx.lineTo(axisX + markerLength, hoverY);
  ctx.stroke();

  ctx.restore();
}