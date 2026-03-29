// Day Range Meter Calculations - Crystal Clarity Compliant
// Framework-first: Progressive ADR disclosure calculations

// Calculate day range percentage from ADR
export function calculateDayRangePercentage(d) {
  if (d && typeof d.high === 'number' && typeof d.low === 'number' &&
      typeof d.adrHigh === 'number' && typeof d.adrLow === 'number') {
    const dayRange = d.high - d.low;
    const adrValue = d.adrHigh - d.adrLow;
    return adrValue > 0 ? ((dayRange / adrValue) * 100).toFixed(1) : null;
  }
  return null;
}

// Progressive disclosure: Expand ADR range beyond 50% in 0.25 increments
export function calculateMaxAdrPercentage(state) {
  const adrValue = calculateAdrValue(state);

  if (!shouldCalculateMaxPercentage(state, adrValue)) {
    return 0.5; // Default to 50% if no data
  }

  // Calculate percentage movement from mid price to high and low
  const highMovement = state.todayHigh ? Math.abs(state.todayHigh - state.midPrice) / adrValue : 0;
  const lowMovement = state.todayLow ? Math.abs(state.midPrice - state.todayLow) / adrValue : 0;

  // Use the maximum movement from either side (not total)
  const maxMovement = Math.max(highMovement, lowMovement);

  // Progressive disclosure thresholds:
  // - Stay at 50% if price is within 40% ADR of mid price (50% - 10% buffer)
  // - Expand to 75% if price is between 40-60% ADR from mid price
  // - Expand to 100%+ if price is beyond 60% ADR from mid price

  if (maxMovement <= 0.4) {
    return 0.5; // Keep at 50% with 10% buffer
  } else if (maxMovement <= 0.6) {
    return 0.75; // Expand to 75% for moderate movements
  } else {
    // For large movements, round up to next 0.25 increment
    return Math.ceil((maxMovement + 0.15) * 4) / 4;
  }
}

// Calculate ADR value from high/low
function calculateAdrValue(state) {
  const { adrHigh, adrLow } = state;
  return adrHigh && adrLow ? adrHigh - adrLow : null;
}

// Check if max percentage calculation should proceed
function shouldCalculateMaxPercentage(state, adrValue) {
  return state.midPrice && adrValue && (state.todayHigh || state.todayLow);
}

// Create adaptive scale using SYMMETRIC ADR disclosure
export function calculateAdaptiveScale(d, config) {
  const { scaling } = config;
  const adrValue = d.adrHigh - d.adrLow;
  const state = createScaleState(d);
  const midPrice = state.midPrice;

  // Calculate actual movements from mid price as ADR percentages
  const highMovement = state.todayHigh ? (state.todayHigh - midPrice) / adrValue : 0;
  const lowMovement = state.todayLow ? (midPrice - state.todayLow) / adrValue : 0;
  const currentMovement = (d.current - midPrice) / adrValue;

  // SYMMETRIC SCALING: Use same expansion for both sides
  // Determine required expansion using the maximum movement on either side
  let maxExpansion = 0.5; // Default: 50% ADR on both sides

  // Calculate the maximum movement in either direction
  const maxUpwardMovement = Math.max(highMovement, currentMovement, 0);
  const maxDownwardMovement = Math.max(lowMovement, -currentMovement, 0);
  const maxMovement = Math.max(maxUpwardMovement, maxDownwardMovement);

  // Progressive disclosure thresholds:
  // - Stay at 50% if price is within 40% ADR of mid price (50% - 10% buffer)
  // - Expand to 75% if price is between 40-60% ADR from mid price
  // - Expand to 100%+ if price is beyond 60% ADR from mid price

  if (maxMovement <= 0.4) {
    maxExpansion = 0.5; // Keep at 50% with 10% buffer
  } else if (maxMovement <= 0.6) {
    maxExpansion = 0.75; // Expand to 75% for moderate movements
  } else {
    // For large movements, round up to next 0.25 increment
    maxExpansion = Math.ceil((maxMovement + 0.15) * 4) / 4;
  }

  // TRUE SYMMETRIC: Opening price stays at center regardless of today's range
  const centerPrice = midPrice;
  const totalRange = adrValue * maxExpansion * 2; // Both sides combined

  const min = centerPrice - (totalRange / 2);
  const max = centerPrice + (totalRange / 2);

  return {
    min: min,
    max: max,
    range: max - min,
    upperExpansion: maxExpansion, // Now identical for both sides
    lowerExpansion: maxExpansion, // Now identical for both sides
    maxAdrPercentage: maxExpansion,
    isProgressive: maxExpansion > 0.5
  };
}

// Create state object for scale calculations
function createScaleState(d) {
  return {
    midPrice: d.open || d.current,
    todayHigh: d.high,
    todayLow: d.low,
    adrHigh: d.adrHigh,
    adrLow: d.adrLow
  };
}

// Convert price to Y coordinate
export function getYCoordinate(price, range, height, padding) {
  const { min, max } = range;
  const normalized = (max - price) / (max - min);
  return padding + (normalized * (height - 2 * padding));
}