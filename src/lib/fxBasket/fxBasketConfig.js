// FX Basket visual configuration
// Centralizes colors, fonts, positioning for consistency

export const CURRENCY_COLORS = {
  'USD': '#4a9eff',
  'EUR': '#ef4444',
  'JPY': '#f59e0b',
  'GBP': '#8b5cf6',
  'AUD': '#10b981',
  'CAD': '#14b8a6',
  'CHF': '#dc2626',
  'NZD': '#84cc16'
};

export const ANCHOR_CONFIG = {
  defaultTime: '17:00',
  timezone: 'America/New_York'
};

const defaultConfig = {
  colors: {
    baseline: '#6B7280',
    positive: '#10b981',
    negative: '#ef4444',
    background: 'transparent',
    text: '#ffffff'
  },
  fonts: {
    basketLabel: 'bold 14px monospace',
    basketValue: '12px monospace',
    anchorTime: '10px sans-serif'
  },
  positioning: {
    padding: 16,
    verticalPadding: 20,
    markerWidth: 4,
    labelOffset: 8
  }
};

export function getConfig(overrides = {}) {
  return { ...defaultConfig, ...overrides };
}

export const STATE_CONFIG = {
  colors: {
    waiting: '#F59E0B',
    error: '#EF4444',
    ready: '#10B981'
  },
  messages: {
    waiting: (progress) => `Initializing... (${progress.received}/${progress.total} pairs)`,
    error: (missing) => `Unable to initialize - missing ${missing.length} pairs`,
    timeout: 'Initialization timeout - some pairs failed to arrive'
  },
  timeout: 30000
};

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
