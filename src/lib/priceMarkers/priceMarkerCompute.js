// Price Marker Compute Module - Pure computation for price markers
// No canvas imports — all functions return data objects for the renderer

import { formatPriceForDisplay } from './priceMarkerBase.js';

export function computeCurrentPrice(price, symbolData, config, priceScale) {
  if (!price) return null;

  const direction = symbolData?.direction || 'neutral';
  const color = direction === 'up' ? config.colors.priceUp :
                direction === 'down' ? config.colors.priceDown :
                config.colors.currentPrice;

  return {
    y: priceScale(price),
    text: formatPriceForDisplay(price, symbolData),
    color
  };
}

export function computeOpenPrice(price, symbolData, config, priceScale) {
  if (!price) return null;

  return {
    y: priceScale(price),
    text: formatPriceForDisplay(price, symbolData),
    color: config.colors.openPrice
  };
}

export function computeHighLow(todayHigh, todayLow, symbolData, config, priceScale) {
  const high = todayHigh
    ? {
        y: priceScale(todayHigh),
        text: formatPriceForDisplay(todayHigh, symbolData),
        color: config.colors.sessionPrices
      }
    : null;

  const low = todayLow
    ? {
        y: priceScale(todayLow),
        text: formatPriceForDisplay(todayLow, symbolData),
        color: config.colors.sessionPrices
      }
    : null;

  return { high, low };
}

export function computeUserMarkers(markers, selectedMarker, symbolData, priceScale) {
  if (!markers || markers.length === 0) return [];

  return markers.map(marker => {
    const isSelected = selectedMarker && selectedMarker.id === marker.id;
    return {
      y: priceScale(marker.price),
      price: marker.price,
      color: isSelected ? '#ff6b35' : marker.type.color,
      lineWidth: isSelected ? 3 : marker.type.size,
      alpha: marker.type.opacity,
      isSelected,
      formattedPrice: formatPriceForDisplay(marker.price, symbolData)
    };
  });
}

export function computeHoverPreview(hoverPrice, symbolData, priceScale) {
  if (!hoverPrice) return null;

  return {
    y: priceScale(hoverPrice),
    formattedPrice: formatPriceForDisplay(hoverPrice, symbolData)
  };
}

export function computePreviousDayOHLC(prevOHLC, symbolData, config) {
  if (!prevOHLC) return null;

  const color = config.colors.previousDay || '#414141';
  const entries = [
    { price: prevOHLC.open, label: 'PO' },
    { price: prevOHLC.high, label: 'PH' },
    { price: prevOHLC.low, label: 'PL' },
    { price: prevOHLC.close, label: 'PC' }
  ];

  const result = [];
  for (const { price, label } of entries) {
    if (!price) continue;
    result.push({ price, label, color });
  }

  return result;
}

export function computeTwapMarker(twapPrice, symbolData, config, priceScale) {
  if (twapPrice === null || twapPrice === undefined || typeof twapPrice !== 'number' || isNaN(twapPrice)) {
    return null;
  }

  return {
    y: priceScale(twapPrice),
    text: formatPriceForDisplay(twapPrice, symbolData),
    color: config.colors.twapMarker
  };
}
