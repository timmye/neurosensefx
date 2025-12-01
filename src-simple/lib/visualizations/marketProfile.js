// Market Profile Visualization - Crystal Clarity Compliant
// Framework-first: Canvas 2D API, professional trading visualization
// Essential features: Volume distribution, buy/sell pressure, Point of Control

import { renderMarketProfile } from './marketProfileCore.js';
import { processProfileLevels, createPriceScale } from './marketProfileData.js';
import { renderVolumeBars, renderPointOfControl } from './marketProfileRenderers.js';

// Re-export the main render function
export { renderMarketProfile };