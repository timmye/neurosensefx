// Market Profile Configuration - Crystal Clarity Compliant
// Framework-first: Simple configuration object
// Note: bucketSize is now calculated dynamically from symbol data (pipSize)
// This eliminates pipette complexity while maintaining trading value

export const marketProfileConfig = {
  // bucketSize removed - now calculated from symbolData.pipSize
  sessionHours: { start: 0, end: 24 },
  maxHistoryDays: 1,
  valueAreaPercentage: 0.7,
  colors: {
    background: '#0a0a0a10',
    profile: '#474747ff',
    poc: '#8d3dd7ff',
    valueArea: 'rgba(37, 83, 135, 0.9)',
    text: '#fff',
    grid: '#333'
  },
  rendering: {
    padding: 40,
    barHeight: 1,
    minBarWidth: 1,
    pocLineWidth: 2,
    pocDashPattern: [5, 3]
  }
};

export function getMarketProfileConfig(customConfig = {}) {
  return {
    ...marketProfileConfig,
    ...customConfig,
    colors: {
      ...marketProfileConfig.colors,
      ...(customConfig.colors || {})
    },
    rendering: {
      ...marketProfileConfig.rendering,
      ...(customConfig.rendering || {})
    }
  };
}

// getBucketSizeForSymbol moved to displayDataProcessor.js for centralized access
// Now uses pipSize from symbol data for efficient pip-based buckets