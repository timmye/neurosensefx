// Day Range Price Marker Renderer - Crystal Clarity Compliant
// Framework-first: Current, open, and H/L price markers with Canvas 2D

import { MARKER_TYPES } from './priceMarkers.js';
import { renderMarkerLine, formatPriceForDisplay } from './priceMarkerBase.js';

// Render current price marker with color coding
export function renderCurrentPrice(ctx, config, axisX, priceScale, price, symbolData) {
  if (!price) return;

  const formattedPrice = formatPriceForDisplay(price, symbolData);
  const currentY = priceScale(price);

  // Select color based on tick direction
  const direction = symbolData?.direction || 'neutral';
  const priceColor = direction === 'up' ? config.colors.priceUp :
                     direction === 'down' ? config.colors.priceDown :
                     config.colors.currentPrice;

  renderMarkerLine(ctx, currentY, axisX, priceColor, 4, 12, {
    text: formattedPrice,
    textColor: priceColor,
    textFont: config.fonts.currentPrice,
    textBackground: true,  // Enable semi-transparent background for current price
    emphasizePips: true,    // Enable pip emphasis for current price
    pipPosition: symbolData?.pipPosition
  });
}

// Render open price marker with color coding
export function renderOpenPrice(ctx, config, axisX, priceScale, price, symbolData) {
  if (!price) return;

  const formattedPrice = formatPriceForDisplay(price, symbolData);
  const openY = priceScale(price);

  renderMarkerLine(ctx, openY, axisX, config.colors.openPrice, 2, 12, {
    text: formattedPrice,
    textColor: config.colors.openPrice,
    textFont: config.fonts.priceLabels
  });
}

// Render today's high and low price markers
export function renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData, symbolData) {
  renderHighMarker(ctx, axisX, priceScale, mappedData.todayHigh, symbolData, config);
  renderLowMarker(ctx, axisX, priceScale, mappedData.todayLow, symbolData, config);
}

// Render high price marker
function renderHighMarker(ctx, axisX, priceScale, todayHigh, symbolData, config) {
  if (!todayHigh) return;

  const formattedPrice = formatPriceForDisplay(todayHigh, symbolData);
  const highY = priceScale(todayHigh);

  renderMarkerLine(ctx, highY, axisX, config.colors.sessionPrices, 2, 12, {
    text: formattedPrice,
    textColor: config.colors.sessionPrices,
    textFont: config.fonts.priceLabels
  });
}

// Render low price marker
function renderLowMarker(ctx, axisX, priceScale, todayLow, symbolData, config) {
  if (!todayLow) return;

  const formattedPrice = formatPriceForDisplay(todayLow, symbolData);
  const lowY = priceScale(todayLow);

  renderMarkerLine(ctx, lowY, axisX, config.colors.sessionPrices, 2, 12, {
    text: formattedPrice,
    textColor: config.colors.sessionPrices,
    textFont: config.fonts.priceLabels
  });
}

// Render user-placed price markers with selection highlighting
export function renderUserPriceMarkers(ctx, config, axisX, priceScale, markers, selectedMarker, symbolData) {
  if (!markers || markers.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const markerLength = 12 / dpr;

  markers.forEach(marker => {
    const markerY = priceScale(marker.price);
    const isSelected = selectedMarker && selectedMarker.id === marker.id;

    const lineWidth = isSelected ? 3 : marker.type.size;
    const color = isSelected ? '#ff6b35' : marker.type.color;
    const alpha = marker.type.opacity;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth / dpr;
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(axisX - markerLength, markerY);
    ctx.lineTo(axisX + markerLength, markerY);
    ctx.stroke();

    if (isSelected) {
      const formattedPrice = formatPriceForDisplay(marker.price, symbolData);
      renderMarkerLine(ctx, markerY, axisX, '#ff6b35', 0, 0, {
        text: formattedPrice,
        textColor: '#ff6b35',
        textFont: config.fonts.priceLabels
      });
    }

    ctx.restore();
  });
}

// Render Alt+hover preview line at hover price
export function renderHoverPreview(ctx, config, axisX, priceScale, hoverPrice) {
  if (!hoverPrice) return;

  const hoverY = priceScale(hoverPrice);
  renderMarkerLine(ctx, hoverY, axisX, 'rgba(255, 255, 255, 0.5)', 2, 80, {
    dashed: true
  });
}