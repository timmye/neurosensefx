/**
 * Test Data Factory
 * Generates realistic test data for NeuroSense FX components and API integration
 */

/**
 * Factory class for creating test data
 */
export class TestDataFactory {
  
  /**
   * Create mock symbol data
   */
  static createMockSymbolData(symbol = 'EURUSD', overrides = {}) {
    const basePrice = this.getBasePriceForSymbol(symbol);
    
    return {
      symbol,
      bid: basePrice - 0.0002,
      ask: basePrice + 0.0002,
      timestamp: Date.now(),
      volume: Math.floor(Math.random() * 1000000) + 100000,
      spread: 0.0002,
      pipSize: this.getPipSizeForSymbol(symbol),
      digits: this.getDigitsForSymbol(symbol),
      ...overrides
    };
  }

  /**
   * Create mock tick data
   */
  static createMockTickData(symbol = 'EURUSD', overrides = {}) {
    const basePrice = this.getBasePriceForSymbol(symbol);
    const variation = (Math.random() - 0.5) * 0.001;
    
    return {
      symbol,
      bid: basePrice + variation,
      ask: basePrice + variation + 0.0002,
      timestamp: Date.now(),
      volume: Math.floor(Math.random() * 10000) + 1000,
      ...overrides
    };
  }

  /**
   * Create mock historical bar data
   */
  static createMockHistoricalData(symbol = 'EURUSD', count = 100, overrides = {}) {
    const basePrice = this.getBasePriceForSymbol(symbol);
    const data = [];
    
    for (let i = 0; i < count; i++) {
      const open = basePrice + (Math.random() - 0.5) * 0.002;
      const close = open + (Math.random() - 0.5) * 0.0005;
      const high = Math.max(open, close) + Math.random() * 0.0003;
      const low = Math.min(open, close) - Math.random() * 0.0003;
      
      data.push({
        symbol,
        timestamp: Date.now() - (count - i) * 60000, // 1 minute intervals
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 10000) + 1000,
        ...overrides
      });
    }
    
    return data;
  }

  /**
   * Create mock market profile data
   */
  static createMockMarketProfile(symbol = 'EURUSD', count = 100, overrides = {}) {
    const basePrice = this.getBasePriceForSymbol(symbol);
    const profile = [];
    
    for (let i = 0; i < count; i++) {
      const price = basePrice + (Math.random() - 0.5) * 0.002;
      const volume = Math.floor(Math.random() * 1000) + 100;
      
      profile.push({
        price,
        volume,
        buyVolume: Math.floor(volume * (0.3 + Math.random() * 0.4)),
        sellVolume: Math.floor(volume * (0.3 + Math.random() * 0.4)),
        timestamp: Date.now() - (count - i) * 60000,
        ...overrides
      });
    }
    
    return profile.sort((a, b) => a.price - b.price);
  }

  /**
   * Create mock symbol data package
   */
  static createMockSymbolDataPackage(symbol = 'EURUSD', overrides = {}) {
    const basePrice = this.getBasePriceForSymbol(symbol);
    const adr = this.getADRForSymbol(symbol);
    
    return {
      symbol,
      digits: this.getDigitsForSymbol(symbol),
      adr,
      todaysOpen: basePrice,
      todaysHigh: basePrice + adr * 0.3,
      todaysLow: basePrice - adr * 0.4,
      projectedAdrHigh: basePrice + adr * 0.5,
      projectedAdrLow: basePrice - adr * 0.5,
      initialPrice: basePrice,
      initialMarketProfile: this.createMockHistoricalData(symbol, 100),
      ...overrides
    };
  }

  /**
   * Create mock workspace data
   */
  static createMockWorkspace(name = 'Test Workspace', overrides = {}) {
    const timestamp = Date.now();
    
    return {
      id: `workspace_${timestamp}`,
      name,
      description: `Test workspace created at ${new Date(timestamp).toISOString()}`,
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
      layout: {
        canvases: [
          this.createMockCanvasConfig('EURUSD', { position: { x: 0, y: 0 } }),
          this.createMockCanvasConfig('GBPUSD', { position: { x: 230, y: 0 } }),
          this.createMockCanvasConfig('USDJPY', { position: { x: 0, y: 130 } })
        ],
        gridSettings: {
          columns: 4,
          rows: 3,
          gap: 10,
          padding: 20,
          snapToGrid: true,
          showGrid: true
        },
        viewSettings: {
          zoom: 1,
          panX: 0,
          panY: 0
        }
      },
      globalSettings: {
        density: 'high',
        theme: 'dark',
        autoSave: true,
        autoSaveInterval: 30000,
        showIndicators: true,
        animationSpeed: 'normal'
      },
      symbolSubscriptions: ['EURUSD', 'GBPUSD', 'USDJPY'],
      visualizationSettings: {
        showGrid: true,
        showCrosshair: true,
        showVolume: true,
        colorScheme: 'default'
      },
      ...overrides
    };
  }

  /**
   * Create mock canvas configuration
   */
  static createMockCanvasConfig(symbol = 'EURUSD', overrides = {}) {
    const timestamp = Date.now();
    
    return {
      id: `canvas_${timestamp}`,
      symbol,
      position: { x: 0, y: 0 },
      size: { width: 220, height: 120 },
      settings: {
        showPrice: true,
        showADR: true,
        showVolume: true,
        indicatorOpacity: 0.8,
        updateFrequency: 'normal'
      },
      indicators: ['priceFloat', 'marketProfile', 'volatilityOrb'],
      isVisible: true,
      zIndex: 1,
      ...overrides
    };
  }

  /**
   * Create mock performance metrics
   */
  static createMockPerformanceMetrics(overrides = {}) {
    return {
      fps: 55 + Math.random() * 10,
      renderTime: 12 + Math.random() * 8,
      memoryUsage: (40 + Math.random() * 30) * 1024 * 1024, // 40-70MB
      activeCanvases: Math.floor(Math.random() * 10) + 1,
      activeSubscriptions: Math.floor(Math.random() * 20) + 5,
      cacheHitRate: 75 + Math.random() * 20,
      dataProcessingTime: 1 + Math.random() * 3,
      networkLatency: 20 + Math.random() * 80,
      errorCount: Math.floor(Math.random() * 3),
      warningCount: Math.floor(Math.random() * 5),
      timestamp: Date.now(),
      ...overrides
    };
  }

  /**
   * Create mock connection status
   */
  static createMockConnectionStatus(overrides = {}) {
    const statuses = ['connected', 'connecting', 'disconnected', 'error'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
      status,
      timestamp: Date.now(),
      latency: status === 'connected' ? 20 + Math.random() * 50 : null,
      lastError: status === 'error' ? 'Connection timeout' : null,
      reconnectAttempts: status === 'connecting' ? Math.floor(Math.random() * 3) : 0,
      ...overrides
    };
  }

  /**
   * Create mock error data
   */
  static createMockError(type = 'network', severity = 'medium', overrides = {}) {
    const errorTypes = {
      network: 'Network connection failed',
      websocket: 'WebSocket connection lost',
      validation: 'Data validation failed',
      performance: 'Performance threshold exceeded',
      system: 'System error occurred'
    };
    
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message: errorTypes[type] || 'Unknown error',
      timestamp: new Date().toISOString(),
      context: {
        component: 'TestComponent',
        action: 'testAction',
        ...overrides.context
      },
      stack: 'Error: ' + (errorTypes[type] || 'Unknown error') + '\\n    at TestComponent.testAction',
      ...overrides
    };
  }

  /**
   * Create bulk test data
   */
  static createBulkTestData(symbols = ['EURUSD', 'GBPUSD', 'USDJPY'], count = 50) {
    const data = [];
    
    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      data.push(this.createMockTickData(symbol));
    }
    
    return data;
  }

  /**
   * Create mock API response
   */
  static createMockApiResponse(data, options = {}) {
    const {
      status = 200,
      statusText = 'OK',
      headers = {},
      delay = 0
    } = options;
    
    const response = {
      status,
      statusText,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      data,
      timestamp: Date.now()
    };
    
    if (delay > 0) {
      return new Promise(resolve => setTimeout(() => resolve(response), delay));
    }
    
    return response;
  }

  /**
   * Helper methods
   */
  static getBasePriceForSymbol(symbol) {
    const basePrices = {
      'EURUSD': 1.1234,
      'GBPUSD': 1.3456,
      'USDJPY': 110.23,
      'USDCHF': 0.9876,
      'AUDUSD': 0.7890,
      'USDCAD': 1.2345,
      'NZDUSD': 0.6789
    };
    
    return basePrices[symbol] || 1.0000;
  }

  static getPipSizeForSymbol(symbol) {
    return symbol.includes('JPY') ? 0.01 : 0.0001;
  }

  static getDigitsForSymbol(symbol) {
    return symbol.includes('JPY') ? 3 : 5;
  }

  static getADRForSymbol(symbol) {
    const adrValues = {
      'EURUSD': 0.0085,
      'GBPUSD': 0.0120,
      'USDJPY': 0.85,
      'USDCHF': 0.0095,
      'AUDUSD': 0.0075,
      'USDCAD': 0.0105,
      'NZDUSD': 0.0065
    };
    
    return adrValues[symbol] || 0.0080;
  }

  /**
   * Create test scenarios
   */
  static createTestScenarios() {
    return {
      // Normal operation scenario
      normal: {
        workspace: this.createMockWorkspace('Normal Workspace'),
        symbols: ['EURUSD', 'GBPUSD'],
        tickData: this.createBulkTestData(['EURUSD', 'GBPUSD'], 100),
        performance: this.createMockPerformanceMetrics({ errorCount: 0 }),
        connection: this.createMockConnectionStatus({ status: 'connected' })
      },
      
      // High load scenario
      highLoad: {
        workspace: this.createMockWorkspace('High Load Workspace', {
          layout: {
            canvases: Array.from({ length: 20 }, (_, i) => 
              this.createMockCanvasConfig(`SYMBOL${i}`, { 
                position: { x: (i % 5) * 230, y: Math.floor(i / 5) * 130 } 
              })
            )
          }
        }),
        symbols: Array.from({ length: 20 }, (_, i) => `SYMBOL${i}`),
        tickData: this.createBulkTestData(Array.from({ length: 20 }, (_, i) => `SYMBOL${i}`), 1000),
        performance: this.createMockPerformanceMetrics({ 
          fps: 30, 
          memoryUsage: 150 * 1024 * 1024 
        }),
        connection: this.createMockConnectionStatus({ status: 'connected', latency: 100 })
      },
      
      // Error scenario
      error: {
        workspace: this.createMockWorkspace('Error Workspace'),
        symbols: ['EURUSD'],
        tickData: [],
        performance: this.createMockPerformanceMetrics({ errorCount: 5 }),
        connection: this.createMockConnectionStatus({ status: 'error' }),
        errors: Array.from({ length: 5 }, () => this.createMockError())
      },
      
      // Network issues scenario
      networkIssues: {
        workspace: this.createMockWorkspace('Network Issues Workspace'),
        symbols: ['EURUSD', 'GBPUSD'],
        tickData: this.createBulkTestData(['EURUSD', 'GBPUSD'], 10),
        performance: this.createMockPerformanceMetrics({ networkLatency: 500 }),
        connection: this.createMockConnectionStatus({ status: 'connecting', reconnectAttempts: 3 })
      }
    };
  }
}

export default TestDataFactory;
