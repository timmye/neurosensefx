// Market Profile Configuration - Crystal Clarity Compliant
// Framework-first: Simple configuration object

export const marketProfileConfig = {
  bucketSize: 0.00001,
  sessionHours: { start: 0, end: 24 },
  maxHistoryDays: 1,
  valueAreaPercentage: 0.7,
  colors: {
    background: '#0a0a0a10',
    profile: '#474747ff',
    poc: '#4a9eff',
    valueArea: 'rgba(74, 158, 255, 0.1)',
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

export function getBucketSizeForSymbol(symbol) {
  const symbolConfigs = {
    'EURUSD': 0.00001,
    'GBPUSD': 0.00001,
    'USDJPY': 0.001,
    'USDCHF': 0.00001,
    'BTCUSD': 1.0,    // Crypto needs much larger bucket size
    'ETHUSD': 0.01,   // Crypto intermediate bucket size
    'XRPUSD': 0.0001  // Crypto small bucket size
  };

  return symbolConfigs[symbol] || marketProfileConfig.bucketSize;
}