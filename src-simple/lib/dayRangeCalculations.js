// Day Range Meter Calculations - Crystal Clarity Compliant
// Framework-first: Progressive ADR disclosure calculations

// Calculate day range percentage from ADR
export function calculateDayRangePercentage(d) {
  if (typeof d.high === 'number' && typeof d.low === 'number' &&
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

  // Calculate total movement from both high and low
  const highMovement = state.todayHigh ? Math.abs(state.todayHigh - state.midPrice) / adrValue : 0;
  const lowMovement = state.todayLow ? Math.abs(state.midPrice - state.todayLow) / adrValue : 0;
  const totalMovement = highMovement + lowMovement;

  // Start with 50% minimum and add total movement
  let maxPercentage = 0.5 + totalMovement;

  // Only round up if significantly beyond current threshold to avoid premature expansion
  if (maxPercentage <= 0.6) return 0.5; // Keep at 50% for minimal movements
  if (maxPercentage <= 0.85) return 0.75; // Expand to 75% for moderate movements
  return Math.ceil(maxPercentage * 4) / 4; // Round up for large movements
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

// Update max percentage with price movement
function updateMaxPercentage(maxPercentage, price, midPrice, adrValue) {
  if (!price) return maxPercentage;
  const percentage = Math.abs(price - midPrice) / adrValue;
  return Math.max(maxPercentage, percentage);
}

// Create adaptive scale using max ADR percentage
export function calculateAdaptiveScale(d, config) {
  const { scaling } = config;
  const adrValue = d.adrHigh - d.adrLow;
  const state = createScaleState(d);
  const maxAdrPercentage = calculateMaxAdrPercentage(state);
  const buffer = adrValue * scaling.minBufferPercent;
  const maxRange = adrValue * maxAdrPercentage;

  return {
    min: d.adrLow - buffer,
    max: d.adrHigh + buffer,
    range: maxRange * 2 + (buffer * 2),
    maxAdrPercentage,
    isProgressive: maxAdrPercentage > 0.5
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