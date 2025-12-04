// Centralized Price Formatting - Crystal Clarity Compliant
// Framework-First: Uses native JavaScript toFixed() directly
// Simple, Performant, Maintainable

export function formatPrice(price, digits = 5) {
  if (typeof price !== 'number' || !isFinite(price)) return 'N/A';
  return price.toFixed(digits);
}

export function formatPriceSimple(price, digits = 5) {
  return formatPrice(price, digits);
}

export function formatPriceCompact(price, digits = 5, pipPosition) {
  if (typeof price !== 'number' || !isFinite(price)) return 'N/A';
  if (price >= 1000) return Math.floor(price).toString();

  // pipPosition integration: use pipPosition for optimal digit calculation
  if (pipPosition !== undefined && pipPosition !== null) {
    // Show one extra digit beyond pipPosition for better precision
    const optimalDigits = pipPosition + 1;
    return price.toFixed(optimalDigits);
  }

  return price.toFixed(digits);
}

// pipPosition integration: intelligent price formatting using symbol's pipPosition
export function formatPriceWithPipPosition(price, pipPosition, pipSize, pipetteSize) {
  if (typeof price !== 'number' || !isFinite(price)) return 'N/A';

  // Use pipPosition to determine optimal formatting precision
  if (pipPosition !== undefined && pipPosition !== null) {
    // Format to pipPosition digits for pip-level precision (no pipette)
    const digits = pipPosition;
    const formatted = price.toFixed(digits);
    // Remove trailing zeros after decimal point
    return formatted.replace(/\.?0+$/, '');
  }

  // Fallback to 4 digits if no pipPosition available
  const formatted = price.toFixed(4);
  return formatted.replace(/\.?0+$/, '');
}

// Format price to pip level only (no pipette)
export function formatPriceToPipLevel(price, pipPosition, pipSize) {
  if (typeof price !== 'number' || !isFinite(price)) return null;

  // If we have pip info, round to nearest pip
  if (pipPosition !== undefined && pipPosition !== null && pipSize) {
    // Divide by pipSize to get pips, round, then multiply back
    const pips = Math.round(price / pipSize);
    return pips * pipSize;
  }

  // Fallback: round to 4 decimal places for most forex pairs
  return Math.round(price * 10000) / 10000;
}

export function formatPriceLabel(price, digits = 5) {
  const formatted = formatPrice(price, digits);

  // Truncate very long labels for UI space
  if (formatted.length > 12) {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + 'M';
    if (price >= 1000) return (price / 1000).toFixed(1) + 'K';
  }

  return formatted;
}

export function calculatePipValue(priceChange, pipPosition) {
  if (typeof priceChange !== 'number' || !isFinite(priceChange)) return 0;
  return priceChange / Math.pow(10, -pipPosition);
}

export function formatPipMovement(priceChange, pipPosition) {
  const pipValue = calculatePipValue(priceChange, pipPosition);
  return `${pipValue > 0 ? '+' : ''}${pipValue.toFixed(1)} pips`;
}

export function formatPriceWithPips(price, digits, pipPosition) {
  if (typeof price !== 'number' || !isFinite(price)) return 'N/A';
  return price.toFixed(digits);
}