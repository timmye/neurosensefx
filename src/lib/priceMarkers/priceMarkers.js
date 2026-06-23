// Price Marker Core Utilities - Crystal Clarity: Simple, Performant, Maintainable

export const MARKER_TYPES = {
  BIG: {
    name: 'big',
    color: '#fd4400',
    size: 4,
    opacity: 1
  },
  NORMAL: {
    name: 'normal',
    color: '#f7fa37',
    size: 2,
    opacity: 1
  },
  SMALL: {
    name: 'small',
    color: '#ffffff',
    size: 2,
    opacity: 1
  }
};

export function createMarker(type, price, displayId, optionalConfig = {}) {
  if (!isValidPrice(price)) return null;

  const markerType = MARKER_TYPES[type.toUpperCase()];
  if (!markerType) return null;

  return {
    id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: markerType,
    price: parseFloat(price),
    displayId,
    timestamp: Date.now(),
    ...optionalConfig
  };
}

export function getMarkerAtPosition(markers, yPosition, priceScale, hitThreshold = 10) {
  return markers.find(marker => {
    const markerY = priceScale(marker.price);
    const distance = Math.abs(yPosition - markerY);
    return distance <= hitThreshold;
  });
}

function isValidPrice(price) {
  return price !== null &&
         price !== undefined &&
         !isNaN(parseFloat(price)) &&
         isFinite(price);
}