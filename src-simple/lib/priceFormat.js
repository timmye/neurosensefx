// Centralized Price Formatting - Crystal Clarity Compliant
// Framework-First: Uses native JavaScript toFixed() only
// Simple, Performant, Maintainable

export function formatPrice(price, pipPosition) {
  if (typeof price !== 'number' || !isFinite(price)) return 'N/A';
  if (pipPosition === null || pipPosition === undefined) return price.toFixed(4);
  return price.toFixed(pipPosition);
}

// Legacy alias for backward compatibility - DEPRECATED
export function formatPriceWithPipPosition(price, pipPosition) {
  return formatPrice(price, pipPosition);
}

// Format price to pip level only (no pipette)
export function formatPriceToPipLevel(price, pipPosition, pipSize) {
  if (typeof price !== 'number' || !isFinite(price)) return null;
  if (pipPosition !== undefined && pipPosition !== null && pipSize) {
    const pips = Math.round(price / pipSize);
    return pips * pipSize;
  }
  return Math.round(price * 10000) / 10000;
}

export function formatPipMovement(priceChange, pipPosition) {
  if (typeof priceChange !== 'number' || !isFinite(priceChange)) return '0 pips';
  const pipValue = priceChange / Math.pow(10, -pipPosition);
  return `${pipValue > 0 ? '+' : ''}${pipValue.toFixed(1)} pips`;
}