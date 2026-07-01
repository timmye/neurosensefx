// FX Basket visual configuration
// Centralizes fonts, positioning for consistency.
// Colors are injected by getConfig() from the centralized shell-canvas theme
// resolver (canvasTheme.js) so the basket reads the workspace theme at paint
// time. The volatility-zone ramp (ZONE_COLORS) is theme-invariant by design —
// hue IS the information — but is sourced from the resolver so the values stay
// centralized there.

import { getCanvasColors } from '../canvasTheme.js';

const defaultConfig = {
  fonts: {
    basketLabel: '600 16px "Georgia Pro", Georgia, serif',
    basketValue: '400 11px "Georgia Pro", Georgia, serif',
    anchorTime: '400 11px "Georgia Pro", Georgia, serif'
  },
  positioning: {
    padding: 8,
    verticalPadding: 20,
    markerWidth: 2,
    labelOffset: 8
  }
};

export function getConfig(overrides = {}) {
  const { colors: _colorOverrides, ...rest } = overrides;
  return {
    ...defaultConfig,
    colors: { ...getCanvasColors().fxBasket, ...(_colorOverrides || {}) },
    ...rest
  };
}

// Volatility-zone ramp — theme-invariant encoding (gray→amber→orange→red),
// but sourced from the resolver (fxBasketZones) so the values live in one place.
export const ZONE_COLORS = (() => {
  const zones = getCanvasColors().fxBasketZones;
  return {
    QUIET: zones.quiet,    // Gray - below normal activity
    NORMAL: zones.normal,  // Amber - typical day
    ACTIVE: zones.active,  // Orange - elevated volatility
    EXTREME: zones.extreme // Red - unusual movement
  };
})();

// Zone thresholds per basket (from 65-day empirical analysis)
// Thresholds are absolute daily ranges: |close - open|
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD'];

export const BASKET_ZONES = {
  'USD': { quiet: 0.07, normal: 0.25, active: 0.40 },
  'EUR': { quiet: 0.05, normal: 0.18, active: 0.22 },
  'JPY': { quiet: 0.12, normal: 0.40, active: 0.60 },
  'GBP': { quiet: 0.07, normal: 0.25, active: 0.45 },
  'AUD': { quiet: 0.11, normal: 0.35, active: 0.50 },
  'CAD': { quiet: 0.05, normal: 0.25, active: 0.35 },
  'CHF': { quiet: 0.07, normal: 0.30, active: 0.42 },
  'NZD': { quiet: 0.08, normal: 0.30, active: 0.48 }
};
