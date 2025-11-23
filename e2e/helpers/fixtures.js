/**
 * Test fixtures for NeuroSense FX application testing
 * Provides reusable test data and configurations
 */

export const testFixtures = {
  // Common test symbols
  symbols: {
    forex: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD'],
    indices: ['S&P 500', 'DAX', 'FTSE 100', 'Nikkei 225'],
    commodities: ['Gold', 'Silver', 'Crude Oil', 'Natural Gas']
  },

  // Viewport configurations for different display sizes
  viewports: {
    desktop: { width: 1920, height: 1080 },
    laptop: { width: 1366, height: 768 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  },

  // Canvas rendering test data
  canvasElements: {
    marketProfile: '.market-profile-canvas',
    volatilityOrb: '.volatility-orb-canvas',
    priceDisplay: '.price-display-canvas',
    chartContainer: '.chart-container'
  },

  // UI interaction elements
  uiElements: {
    contextMenu: '.context-menu',
    symbolPalette: '.symbol-palette',
    priceFloat: '.price-float',
    workspaceGrid: '.workspace-grid',
    statusPanel: '.status-panel'
  },

  // WebSocket connection data for testing
  mockMarketData: {
    'EUR/USD': {
      bid: 1.0856,
      ask: 1.0858,
      high: 1.0872,
      low: 1.0843,
      change: 0.0012,
      timestamp: Date.now()
    },
    'GBP/USD': {
      bid: 1.2743,
      ask: 1.2746,
      high: 1.2768,
      low: 1.2731,
      change: -0.0008,
      timestamp: Date.now()
    },
    'S&P 500': {
      price: 4567.18,
      change: 12.45,
      changePercent: 0.27,
      volume: 1234567,
      timestamp: Date.now()
    }
  },

  // Test configurations for different scenarios
  scenarios: {
    highLoad: {
      symbols: 50,
      updateInterval: 100, // ms
      duration: 30000 // ms
    },
    normalLoad: {
      symbols: 10,
      updateInterval: 500,
      duration: 10000
    },
    lightLoad: {
      symbols: 3,
      updateInterval: 1000,
      duration: 5000
    }
  },

  // Performance benchmarks
  benchmarks: {
    fps: { minimum: 30, target: 60 },
    renderTime: { maximum: 16.67, target: 8.33 }, // ms per frame
    memoryUsage: { maximum: 100, target: 50 }, // MB
    websocketLatency: { maximum: 100, target: 50 } // ms
  },

  // Accessibility test data
  accessibilityTests: {
    colorContrast: true,
    keyboardNavigation: true,
    screenReader: true,
    focusManagement: true
  },

  // Error scenarios to test
  errorScenarios: {
    websocketDisconnect: {
      trigger: 'websocket-close',
      expectedBehavior: 'reconnect-attempt',
      timeout: 5000
    },
    marketDataError: {
      trigger: 'invalid-symbol',
      expectedBehavior: 'error-display',
      timeout: 3000
    },
    networkTimeout: {
      trigger: 'network-timeout',
      expectedBehavior: 'loading-state',
      timeout: 8000
    }
  }
};

/**
 * Market data generator for testing
 */
export class MarketDataGenerator {
  constructor() {
    this.basePrices = {
      'EUR/USD': 1.0857,
      'GBP/USD': 1.2744,
      'USD/JPY': 149.82,
      'AUD/USD': 0.6543
    };
  }

  generateTick(symbol) {
    const basePrice = this.basePrices[symbol] || 100;
    const variation = (Math.random() - 0.5) * 0.002;
    const price = basePrice * (1 + variation);

    return {
      symbol,
      price: parseFloat(price.toFixed(5)),
      change: parseFloat((price - basePrice).toFixed(5)),
      changePercent: parseFloat(((price - basePrice) / basePrice * 100).toFixed(2)),
      timestamp: Date.now(),
      volume: Math.floor(Math.random() * 1000) + 100
    };
  }

  generateDataStream(symbols, count = 100) {
    const stream = [];
    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      stream.push(this.generateTick(symbol));
    }
    return stream;
  }
}

export const marketDataGenerator = new MarketDataGenerator();