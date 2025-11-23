/**
 * Real-World Test Configurations
 *
 * Provides configurations for real browser testing with live market data
 * No artificial data generators - uses actual cTrader API connections
 */

export const realWorldConfig = {
  // Real market symbols available on cTrader
  availableSymbols: [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF',
    'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'USD/CAD', 'NZD/USD',
    'EUR/CHF', 'EUR/AUD', 'GBP/CHF', 'AUD/JPY', 'CAD/JPY'
  ],

  // Viewport configurations for real device testing
  realViewports: {
    desktop1920: { width: 1920, height: 1080, name: 'Standard Desktop' },
    desktop1440: { width: 1440, height: 900, name: 'MacBook Pro' },
    desktop1366: { width: 1366, height: 768, name: 'Laptop' },
    tablet: { width: 768, height: 1024, name: 'iPad' },
    mobile: { width: 375, height: 667, name: 'iPhone' }
  },

  // Real canvas elements for actual rendering tests
  canvasElements: {
    marketProfile: '.market-profile-canvas',
    volatilityOrb: '.volatility-orb-canvas',
    priceDisplay: '.price-display-canvas',
    dayRangeMeter: '.day-range-meter-canvas'
  },

  // Real UI interaction elements
  uiElements: {
    symbolPalette: '.symbol-palette',
    searchInput: '.search-input',
    searchResults: '.search-results',
    searchResult: '.search-result',
    floatingDisplay: '.floating-display',
    priceDisplay: '.price-display',
    canvasContainer: '.canvas-container',
    keyboardManager: '.keyboard-manager'
  },

  // Real WebSocket connection configurations
  websocketConfig: {
    development: 'ws://localhost:8080',
    production: 'ws://localhost:8081',
    connectionTimeout: 10000,
    heartbeatInterval: 30000,
    reconnectDelay: 1000,
    maxReconnectAttempts: 5
  },

  // Real performance requirements
  performanceRequirements: {
    // Professional trading requirements
    keyboardShortcutLatency: { maximum: 310, target: 200 }, // ms
    dataToVisualLatency: { maximum: 100, target: 50 }, // ms
    fpsRendering: { minimum: 60, target: 60 }, // frames per second
    extendedSessionStability: { minimum: 8, target: 24 }, // hours

    // Memory efficiency
    memoryUsagePerDisplay: { maximum: 10, target: 5 }, // MB
    totalMemoryUsage: { maximum: 500, target: 200 }, // MB
    memoryLeakThreshold: { maximum: 50, target: 10 }, // MB over 8 hours

    // Display capabilities
    maxConcurrentDisplays: { minimum: 20, target: 50 },
    displayCreationTime: { maximum: 1000, target: 500 }, // ms
    displayUpdateFrequency: { minimum: 60, target: 60 } // Hz
  },

  // Real DPR (Device Pixel Ratio) test scenarios
  dprTestScenarios: {
    standard: { dpr: 1, name: 'Standard Displays' },
    retina: { dpr: 2, name: 'Retina/High-DPI' },
    ultraHD: { dpr: 3, name: 'Ultra HD 4K' },
    extreme: { dpr: 4, name: 'Extreme DPI' }
  },

  // Real network conditions for testing
  networkConditions: {
    fiber: { latency: 5, bandwidth: 1000, name: 'Fiber Optic' },
    cable: { latency: 20, bandwidth: 100, name: 'Cable Broadband' },
    cellular4G: { latency: 50, bandwidth: 20, name: '4G LTE' },
    cellular3G: { latency: 200, bandwidth: 5, name: '3G' }
  },

  // Real browser configurations
  browserConfigs: {
    chrome: { name: 'Chrome', headless: false, args: ['--disable-web-security'] },
    firefox: { name: 'Firefox', headless: false },
    safari: { name: 'Safari', headless: false },
    edge: { name: 'Edge', headless: false }
  },

  // Real user workflow scenarios
  userWorkflows: {
    professionalTrader: {
      description: 'Professional FX trader monitoring multiple pairs',
      symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF'],
      duration: 28800000, // 8 hours in ms
      interactions: 1000,
      expectedDisplays: 15
    },
    casualTrader: {
      description: 'Casual trader checking few pairs',
      symbols: ['EUR/USD', 'GBP/USD'],
      duration: 3600000, // 1 hour in ms
      interactions: 50,
      expectedDisplays: 3
    },
    analyst: {
      description: 'Market analyst with extensive displays',
      symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'EUR/GBP', 'EUR/JPY'],
      duration: 14400000, // 4 hours in ms
      interactions: 500,
      expectedDisplays: 25
    }
  },

  // Real error scenarios to test with live systems
  realErrorScenarios: {
    websocketDisconnect: {
      description: 'WebSocket connection lost',
      testMethod: 'simulate_connection_loss',
      expectedRecovery: 'automatic_reconnect',
      timeout: 30000
    },
    highVolatilityPeriods: {
      description: 'High market volatility with rapid price changes',
      testMethod: 'monitor_during_active_trading',
      expectedBehavior: 'maintain_60fps_rendering',
      duration: 300000 // 5 minutes
    },
    networkInstability: {
      description: 'Intermittent network connectivity',
      testMethod: 'simulate_packet_loss',
      expectedRecovery: 'graceful_degradation',
      packetLossRate: 0.05 // 5% packet loss
    },
    extendedSession: {
      description: 'Extended trading session stability',
      testMethod: 'run_8_hour_continuous_session',
      expectedBehavior: 'no_memory_leaks_or_performance_degradation',
      duration: 28800000 // 8 hours
    }
  },

  // Real accessibility testing configurations
  accessibilityConfig: {
    keyboardNavigation: {
      testShortcuts: ['Control+k', 'Escape', 'Arrow keys', 'Enter'],
      requiredResponseTime: 310, // ms
      mustWorkWithScreenReader: true
    },
    visualAccessibility: {
      minimumContrastRatio: 4.5,
      testColorBlindness: true,
      testHighContrastMode: true
    },
    cognitiveLoad: {
      maxCognitiveComplexity: 'low',
      testWithReducedMotion: true,
      testWithPrefersReducedData: true
    }
  },

  // Real stress testing configurations
  stressTestConfig: {
    maximumDisplays: 50,
    rapidSymbolChanges: 100,
    rapidKeyboardOperations: 1000,
    memoryLeakTestDuration: 3600000, // 1 hour
    performanceMonitoringInterval: 1000, // 1 second
    dprVariations: [1, 1.5, 2, 2.5, 3],
    viewportVariations: ['desktop1920', 'desktop1440', 'desktop1366', 'tablet', 'mobile']
  }
};

/**
 * Real-world test utilities that connect to actual systems
 */
export class RealWorldTestUtils {
  /**
   * Connect to live cTrader WebSocket for market data
   */
  static async connectToLiveMarketData(endpoint) {
    const ws = new WebSocket(endpoint);

    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log('✅ Connected to live cTrader market data');
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error('❌ Failed to connect to live market data:', error);
        reject(error);
      };

      ws.onclose = () => {
        console.log('🔌 Disconnected from live market data');
      };

      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
  }

  /**
   * Monitor real browser performance metrics
   */
  static async setupPerformanceMonitoring(page) {
    await page.addInitScript(() => {
      window.realWorldMetrics = {
        frameRates: [],
        memoryUsage: [],
        keyboardLatency: [],
        networkLatency: [],
        renderTimes: []
      };

      // Monitor frame rate
      let lastFrameTime = performance.now();
      const measureFrameRate = () => {
        const now = performance.now();
        const fps = 1000 / (now - lastFrameTime);
        window.realWorldMetrics.frameRates.push(fps);
        lastFrameTime = now;
        requestAnimationFrame(measureFrameRate);
      };
      requestAnimationFrame(measureFrameRate);

      // Monitor memory usage
      if (performance.memory) {
        setInterval(() => {
          window.realWorldMetrics.memoryUsage.push({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          });
        }, 1000);
      }
    });
  }

  /**
   * Test real keyboard shortcut performance
   */
  static async measureKeyboardPerformance(page, shortcut, iterations = 10) {
    const measurements = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await page.keyboard.press(shortcut);

      // Wait for UI response
      await page.waitForTimeout(300);

      const responseTime = performance.now() - startTime;
      measurements.push(responseTime);

      // Reset for next iteration
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    return {
      average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      measurements
    };
  }

  /**
   * Test real memory usage over time
   */
  static async monitorMemoryUsage(page, duration = 60000) {
    const startTime = Date.now();
    const measurements = [];

    while (Date.now() - startTime < duration) {
      const memory = await page.evaluate(() => {
        return performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          timestamp: Date.now()
        } : null;
      });

      if (memory) {
        measurements.push(memory);
      }

      await page.waitForTimeout(1000);
    }

    return measurements;
  }

  /**
   * Test real WebSocket performance and reliability
   */
  static async testWebSocketPerformance(endpoint, duration = 60000) {
    const ws = await this.connectToLiveMarketData(endpoint);
    const measurements = {
      latency: [],
      messageCount: 0,
      errors: [],
      connectedAt: Date.now()
    };

    ws.onmessage = (event) => {
      const latency = Date.now() - JSON.parse(event.data).timestamp;
      measurements.latency.push(latency);
      measurements.messageCount++;
    };

    ws.onerror = (error) => {
      measurements.errors.push({
        error: error.message,
        timestamp: Date.now()
      });
    };

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, duration));

    ws.close();

    return measurements;
  }
}

/**
 * Real market data validation utilities
 */
export class MarketDataValidator {
  static validateRealTimeData(data) {
    const required = ['symbol', 'bid', 'ask', 'timestamp'];
    const missing = required.filter(field => !(field in data));

    if (missing.length > 0) {
      return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
    }

    // Validate data types and ranges
    if (typeof data.bid !== 'number' || data.bid <= 0) {
      return { valid: false, error: 'Invalid bid price' };
    }

    if (typeof data.ask !== 'number' || data.ask <= 0) {
      return { valid: false, error: 'Invalid ask price' };
    }

    if (data.ask <= data.bid) {
      return { valid: false, error: 'Ask price must be greater than bid price' };
    }

    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      return { valid: false, error: 'Invalid timestamp' };
    }

    // Check data freshness (should be within last 10 seconds)
    const now = Date.now();
    if (now - data.timestamp > 10000) {
      return { valid: false, error: 'Stale market data' };
    }

    return { valid: true };
  }
}

export default realWorldConfig;