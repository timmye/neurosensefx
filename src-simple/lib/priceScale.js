// Price scaling utilities for Day Range Meter - Crystal Clarity Compliant
// Framework-first: Direct mathematical transformations, <20 lines

import { formatPrice } from './priceFormat.js';

export function createPriceScale(config, adaptiveScale, height) {
  return (price) => {
    const { min, max } = adaptiveScale;
    const normalized = (max - price) / (max - min);
    return config.positioning.padding + (normalized * (height - 2 * config.positioning.padding));
  };
}

export function calculateAdrPercentage(current, midPrice, adrValue) {
  if (!adrValue || adrValue === 0) return 0;
  return ((current - midPrice) / adrValue) * 100;
}

// Re-export centralized formatPrice
export { formatPrice };