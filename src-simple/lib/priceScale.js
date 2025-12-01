// Price scaling utilities for Day Range Meter - Crystal Clarity Compliant
// Framework-first: Direct mathematical transformations, <20 lines

export function createPriceScale(adrLow, adrHigh, height) {
  const adrValue = adrHigh - adrLow;
  const buffer = adrValue * 0.1; // 10% buffer each side
  const min = adrLow - buffer;
  const max = adrHigh + buffer;
  const range = max - min;

  return (price) => ((max - price) / range) * height;
}

export function calculateAdrPercentage(current, midPrice, adrValue) {
  if (!adrValue || adrValue === 0) return 0;
  return ((current - midPrice) / adrValue) * 100;
}

export function formatPrice(price, digits = 5) {
  if (typeof price !== 'number' || !isFinite(price)) return '0.00000';
  return price.toFixed(digits);
}