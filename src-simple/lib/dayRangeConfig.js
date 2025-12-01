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
    priceLabels: '20px monospace',
    percentageLabels: '10px sans-serif',
    statusMessages: '12px monospace'
  },

  // Positioning
  positioning: {
    adrAxisX: 0.65 , // 90% from left (10% from right). Use null for width/3 default
    padding: 10, // Reduced from 50 to minimize black borders
    labelOffset: 12
  },

  // Features
  features: {
    percentageMarkers: {
      static: true, // Show ADR percentage markers (50%, 75%, etc.)
      dynamic: true, // Show day range percentage
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