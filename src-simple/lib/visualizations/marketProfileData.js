// Market Profile Data Processing - Crystal Clarity Compliant
// Essential data transformation for market profile visualization

/**
 * Process raw market profile levels for rendering
 */
export function processProfileLevels(levels) {
  return levels
    .filter(level => level && level.price && (level.volume > 0 || level.buy > 0 || level.sell > 0))
    .map(level => ({
      price: level.price,
      volume: level.volume || 0,
      buy: level.buy || 0,
      sell: level.sell || 0,
      delta: (level.buy || 0) - (level.sell || 0),
      isPositive: (level.buy || 0) >= (level.sell || 0)
    }))
    .sort((a, b) => a.price - b.price);
}

/**
 * Create linear price scale for Y-coordinates
 */
export function createPriceScale(levels, height) {
  const prices = levels.map(level => level.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = height * 0.05; // 5% padding

  return (price) => {
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    return padding + (height - 2 * padding) * (1 - ratio); // Invert Y-axis
  };
}