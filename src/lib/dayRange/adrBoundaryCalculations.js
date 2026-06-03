// ADR Boundary Calculation Utilities - Single Responsibility
// Framework-first: Pure calculations for ADR boundary rendering

export function calculateAdrBoundaries(adrData, adaptiveScale) {
  if (!adrData || !adrData.midPrice || !adrData.adrValue) {
    return null;
  }

  const { upperExpansion, lowerExpansion } = adaptiveScale;

  // Calculate actual price boundaries for each side
  const upperPrice = adrData.midPrice + (adrData.adrValue * upperExpansion);
  const lowerPrice = adrData.midPrice - (adrData.adrValue * lowerExpansion);

  return {
    upperPrice,
    lowerPrice,
    upperExpansion,
    lowerExpansion,
    midPrice: adrData.midPrice,
    adrValue: adrData.adrValue
  };
}

export function calculateBoundaryCoordinates(boundaries, priceScale) {
  if (!boundaries) return null;

  return {
    upperY: priceScale(boundaries.upperPrice),
    lowerY: priceScale(boundaries.lowerPrice)
  };
}

export function calculateReferenceLines(boundaries, priceScale, adrValue) {
  if (!boundaries || !adrValue) return null;

  // 50% reference line
  const fiftyPercentPrice = adrValue * 0.5;
  const fiftyUpperY = priceScale(boundaries.midPrice + fiftyPercentPrice);
  const fiftyLowerY = priceScale(boundaries.midPrice - fiftyPercentPrice);

  return {
    fiftyUpperY,
    fiftyLowerY,
    fiftyPercentPrice
  };
}

export function shouldShowReferenceLines(upperExpansion, lowerExpansion) {
  return upperExpansion > 0.5 || lowerExpansion > 0.5;
}