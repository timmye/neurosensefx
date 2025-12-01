// Day Range Meter Configuration - Crystal Clarity Compliant
// Framework-first: Centralized configuration system

export const defaultConfig = {
  // Visual elements
  colors: {
    axisPrimary: '#4B5563',
    axisReference: '#6B7280',
    currentPrice: '#10B981',
    sessionPrices: '#F59E0B',
    openPrice: '#6B7280',
    adrRange: 'rgba(224, 224, 224, 0.3)',
    sessionRange: 'rgba(59, 130, 246, 0.3)',
    boundaryLine: '#EF4444',
    percentageLabels: '#9CA3AF',
    markers: '#374151'
  },

  // Typography
  fonts: {
    priceLabels: '10px monospace',
    percentageLabels: '10px sans-serif',
    statusMessages: '12px monospace'
  },

  // Positioning
  positioning: {
    adrAxisX: null, // Will calculate as width/3 if null
    padding: 50,
    labelOffset: 12
  },

  // Features
  features: {
    percentageMarkers: {
      static: true,
      dynamic: true,
      adaptiveScaling: true // Enable auto scaling for ADR 50%+ visibility
    },
    boundaryLines: true,
    dprAwareRendering: true,
    professionalTypography: true
  },

  // Progressive disclosure parameters
  scaling: {
    minBufferPercent: 0.1, // 10% minimum buffer
    defaultMaxAdrPercentage: 0.5 // Default 50% ADR if no data
  }
};

export function getConfig(overrides = {}) {
  return { ...defaultConfig, ...overrides };
}