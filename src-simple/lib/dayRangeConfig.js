// Day Range Meter Configuration - Crystal Clarity Compliant
// Framework-first: Centralized configuration system

export const defaultConfig = {
  // Visual elements
  colors: {
    axisPrimary: '#4B5563',
    axisReference: '#f66a51ff',
    currentPrice: '#6B7280',
    priceUp: '#4a9eff', //4a9eff
    priceDown: '#8f6ce0ff  ', //8f6ce0ff
    sessionPrices: '#f69051ff',
    openPrice: '#6B7280',
    adrRange: 'rgba(224, 224, 224, 0.3)',
    sessionRange: 'rgba(59, 130, 246, 0.3)',
    boundaryLine: '#854be8',
    percentageLabels: '#9CA3AF',
    markers: '#374151'
  },

  // Typography
  fonts: {
    currentPrice: 'bold 46px monospace',
    priceLabels: '20px monospace',
    percentageLabels: '10px sans-serif',
    statusMessages: '12px monospace',
    uiElements: '12px monospace',
    uiSymbol: '14px monospace',
    uiVizIndicator: '10px monospace',
    uiButtons: '14px monospace'
  },

  // Text Emphasis
  emphasis: {
    ratio: 1 // Emphasized text is 1.5x larger than base text
  },

  // Positioning
  positioning: {
    adrAxisX: 0.75 , // 90% from left (10% from right). Use null for width/3 default
    padding: 0, // Reduced from 50 to minimize black borders
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