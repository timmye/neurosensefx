// FX Basket visual configuration
// Centralizes colors, fonts, positioning for consistency

const defaultConfig = {
  colors: {
    baseline: '#6B7280',
    positive: '#10b981',
    negative: '#ef4444',
    background: 'transparent',
    text: '#ffffff'
  },
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
  return { ...defaultConfig, ...overrides };
}

export const fxBasketConfig = defaultConfig;

// Zone colors for ADR-based display
export const ZONE_COLORS = {
  QUIET: '#6B7280',    // Gray - below normal activity
  NORMAL: '#F59E0B',   // Yellow - typical day
  ACTIVE: '#F97316',   // Orange - elevated volatility
  EXTREME: '#EF4444'   // Red - unusual movement
};

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
