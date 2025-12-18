// Day Range Meter Markers - Crystal Clarity Compliant
// Framework-first: Refactored modular structure for progressive ADR disclosure

// Re-export from new modular structure
export {
  calculateDayRangePercentage,
  calculateAdaptiveScale,
  getYCoordinate
} from './dayRangeCalculations.js';

export {
  renderPercentageMarkers
} from './percentageMarkerRenderer.js';

export {
  renderCurrentPrice,
  renderOpenPrice,
  renderHighLowMarkers
} from './priceMarkerRenderer.js';