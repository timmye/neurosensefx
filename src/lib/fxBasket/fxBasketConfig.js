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

export const fxBasketConfig = defaultConfig;
