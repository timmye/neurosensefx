/**
 * Test Fixtures for Playwright Testing
 *
 * Common test data, configurations, and benchmarks for E2E tests.
 */

export const testFixtures = {
  /**
   * Viewport configurations for responsive testing
   */
  viewports: {
    desktop: { width: 1920, height: 1080 },
    tablet: { width: 768, height: 1024 },
    mobile: { width: 375, height: 667 }
  },

  /**
   * Performance benchmarks for trading system validation
   */
  benchmarks: {
    /**
     * Memory usage benchmarks (in MB)
     */
    memoryUsage: {
      maximum: 500, // Maximum memory increase allowed
      warning: 300  // Warning threshold
    },

    /**
     * FPS (Frames Per Second) benchmarks for smooth rendering
     */
    fps: {
      minimum: 55,  // Minimum FPS for trading operations
      target: 60    // Target FPS for smooth visualization
    },

    /**
     * Render time benchmarks (in milliseconds)
     */
    renderTime: {
      maximum: 16.67, // 60fps = 16.67ms per frame
      warning: 13.33  // Warning threshold
    }
  },

  /**
   * Test data for symbol and market scenarios
   */
  testData: {
    symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF'],
    forexPairs: [
      { symbol: 'EUR/USD', category: 'major' },
      { symbol: 'GBP/USD', category: 'major' },
      { symbol: 'USD/JPY', category: 'major' },
      { symbol: 'USD/CHF', category: 'major' }
    ]
  },

  /**
   * Timeout configurations for different operations
   */
  timeouts: {
    pageLoad: 30000,      // 30 seconds for page load
    elementAppear: 10000, // 10 seconds for element to appear
    canvasRender: 5000,   // 5 seconds for canvas rendering
    websocketConnect: 15000 // 15 seconds for WebSocket connection
  },

  /**
   * selectors for common UI elements
   */
  selectors: {
    // Main application containers
    app: '#app',
    workspace: '.workspace',

    // Symbol palette elements
    symbolPalette: '.symbol-palette',
    symbolSearch: '#symbol-search',
    searchResults: '.search-results',

    // Display elements
    floatingDisplay: '.floating-display',
    canvas: 'canvas',

    // Status and monitoring elements
    statusPanel: '.status-panel',
    connectivityStatus: '.connectivity-status',

    // Context menu elements
    contextMenu: '.unified-context-menu',

    // Icon elements
    floatingIcon: '.floating-icon',
    symbolPaletteIcon: '#symbol-palette-icon'
  },

  /**
   * Test scenarios configuration
   */
  scenarios: {
    basicLoad: {
      url: '/',
      title: 'NeuroSense FX'
    },
    displayCreation: {
      defaultPosition: { x: 100, y: 100 },
      defaultSize: { width: 400, height: 300 }
    }
  }
};