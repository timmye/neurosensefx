// Day Range Price Marker Renderer - Crystal Clarity Compliant
// Framework-first: Current, open, and H/L price markers with Canvas 2D

import { MARKER_TYPES } from './priceMarkers.js';
import { renderMarkerLine, formatPriceForDisplay } from './priceMarkerBase.js';
import {
  computeCurrentPrice,
  computeOpenPrice,
  computeHighLow,
  computeUserMarkers,
  computeHoverPreview,
  computePreviousDayOHLC,
  computeTwapMarker
} from './priceMarkerCompute.js';

// Render current price marker with color coding
export function renderCurrentPrice(ctx, config, axisX, priceScale, price, symbolData) {
  const result = computeCurrentPrice(price, symbolData, config, priceScale);
  if (!result) return;

  renderMarkerLine(ctx, result.y, axisX, result.color, 4, 12, {
    text: result.text,
    textColor: result.color,
    textFont: config.fonts.currentPrice,
    textBackground: true,  // Enable semi-transparent background for current price
    emphasizePips: true,    // Enable pip emphasis for current price
    pipPosition: symbolData?.pipPosition
  });
}

// Render open price marker with color coding
export function renderOpenPrice(ctx, config, axisX, priceScale, price, symbolData) {
  const result = computeOpenPrice(price, symbolData, config, priceScale);
  if (!result) return;

  renderMarkerLine(ctx, result.y, axisX, result.color, 2, 12, {
    text: result.text,
    textColor: result.color,
    textFont: config.fonts.priceLabels
  });
}

// Render today's high and low price markers
export function renderHighLowMarkers(ctx, config, axisX, priceScale, mappedData, symbolData) {
  const { high, low } = computeHighLow(mappedData.todayHigh, mappedData.todayLow, symbolData, config, priceScale);

  if (high) {
    renderMarkerLine(ctx, high.y, axisX, high.color, 2, 12, {
      text: high.text,
      textColor: high.color,
      textFont: config.fonts.priceLabels
    });
  }

  if (low) {
    renderMarkerLine(ctx, low.y, axisX, low.color, 2, 12, {
      text: low.text,
      textColor: low.color,
      textFont: config.fonts.priceLabels
    });
  }
}

// Render user-placed price markers with selection highlighting
export function renderUserPriceMarkers(ctx, config, axisX, priceScale, markers, selectedMarker, symbolData) {
  const computed = computeUserMarkers(markers, selectedMarker, symbolData, priceScale);
  if (computed.length === 0) return;

  const markerLength = 24;

  computed.forEach(({ y, color, lineWidth, alpha, isSelected, formattedPrice }) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(axisX - markerLength, y);
    ctx.lineTo(axisX + markerLength, y);
    ctx.stroke();

    if (isSelected) {
      renderMarkerLine(ctx, y, axisX, '#ff6b35', 0, 0, {
        text: formattedPrice,
        textColor: '#ff6b35',
        textFont: config.fonts.priceLabels
      });
    }

    ctx.restore();
  });
}

// Render Alt+hover preview line at hover price
export function renderHoverPreview(ctx, config, axisX, priceScale, hoverPrice, symbolData) {
  const result = computeHoverPreview(hoverPrice, symbolData, priceScale);
  if (!result) return;

  renderMarkerLine(ctx, result.y, axisX, 'rgba(255, 255, 255, 0.5)', 2, 80, {
    dashed: true,
    text: result.formattedPrice,
    textColor: 'rgba(255, 255, 255, 0.8)',
    textFont: config.fonts.priceLabels
  });
}

// Render previous day OHLC markers (Open, High, Low, Close)
export function renderPreviousDayOHLC(ctx, config, axisX, priceScale, prevOHLC, symbolData) {
  const entries = computePreviousDayOHLC(prevOHLC, symbolData, config);
  if (!entries || entries.length === 0) return;

  const axisXLeft = 0;

  entries.forEach(({ price, label, color }) => {
    const y = priceScale(price);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(axisXLeft, y);
    ctx.lineTo(axisXLeft + 10, y);
    ctx.stroke();

    ctx.font = '600 14px "Georgia Pro", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(label, axisXLeft + 15, y);

    ctx.restore();
  });
}

// Render TWAP (Time-Weighted Average Price) marker
export function renderTwapMarker(ctx, config, axisX, priceScale, twapPrice, symbolData) {
  const result = computeTwapMarker(twapPrice, symbolData, config, priceScale);
  if (!result) return;

  renderMarkerLine(ctx, result.y, axisX, result.color, 2, 12, {
    dashed: true
  });
}
