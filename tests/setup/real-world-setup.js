/**
 * Real-World Test Setup
 *
 * Setup for tests that use real browser automation,
 * live market data, and actual system validation
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test configuration for real-world testing
global.REAL_WORLD_TESTING = true;
global.LIVE_DATA_CONNECTIONS = true;
global.BROWSER_AUTOMATION = true;

// Performance monitoring globals
global.PERFORMANCE_METRICS = {
  keyboardLatency: [],
  renderTimes: [],
  memoryUsage: [],
  networkLatency: [],
  frameRates: []
};

// Professional trading requirements
global.PROFESSIONAL_TRADING_REQUIREMENTS = {
  keyboardLatencyMax: 310,      // ms
  dataToVisualLatencyMax: 100,  // ms
  fpsRenderingMin: 60,          // frames per second
  extendedSessionDuration: 28800000, // 8 hours
  memoryLeakThreshold: 52428800,    // 50MB
  maxConcurrentDisplays: 50,
  displayCreationTimeMax: 1000  // ms
};

// Test state management
global.TEST_STATE = {
  currentTest: null,
  startTime: null,
  browsers: [],
  contexts: [],
  pages: [],
  websockets: []
};

// Real-world test utilities
global.RealWorldTestUtils = {
  /**
   * Setup performance monitoring for a page
   */
  async setupPerformanceMonitoring(page) {
    await page.addInitScript(() => {
      window.realWorldMetrics = {
        frameRates: [],
        memoryUsage: [],
        keyboardLatency: [],
        renderTimes: [],
        networkLatency: []
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
        const memoryInterval = setInterval(() => {
          window.realWorldMetrics.memoryUsage.push({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: Date.now()
          });
        }, 1000);

        // Store interval reference for cleanup
        window.memoryInterval = memoryInterval;
      }

      // Monitor keyboard events
      document.addEventListener('keydown', (e) => {
        const startTime = performance.now();
        window.lastKeydownTime = startTime;
      });

      document.addEventListener('keyup', (e) => {
        if (window.lastKeydownTime) {
          const latency = performance.now() - window.lastKeydownTime;
          window.realWorldMetrics.keyboardLatency.push(latency);
        }
      });
    });
  },

  /**
   * Get performance metrics from a page
   */
  async getPerformanceMetrics(page) {
    const metrics = await page.evaluate(() => {
      if (!window.realWorldMetrics) return null;

      const metrics = window.realWorldMetrics;

      // Cleanup memory monitoring interval
      if (window.memoryInterval) {
        clearInterval(window.memoryInterval);
      }

      return {
        frameRates: metrics.frameRates.slice(-100), // Last 100 measurements
        memoryUsage: metrics.memoryUsage.slice(-60),  // Last 60 seconds
        keyboardLatency: metrics.keyboardLatency.slice(-50), // Last 50 measurements
        renderTimes: metrics.renderTimes.slice(-50),
        networkLatency: metrics.networkLatency.slice(-50)
      };
    });

    return metrics;
  },

  /**
   * Validate professional trading performance requirements
   */
  validatePerformanceRequirements(metrics) {
    if (!metrics) return { valid: false, errors: ['No metrics available'] };

    const errors = [];
    const warnings = [];

    // Check keyboard latency
    if (metrics.keyboardLatency.length > 0) {
      const avgKeyboardLatency = metrics.keyboardLatency.reduce((a, b) => a + b, 0) / metrics.keyboardLatency.length;
      const maxKeyboardLatency = Math.max(...metrics.keyboardLatency);

      if (avgKeyboardLatency > global.PROFESSIONAL_TRADING_REQUIREMENTS.keyboardLatencyMax) {
        errors.push(`Average keyboard latency ${avgKeyboardLatency.toFixed(2)}ms exceeds maximum ${global.PROFESSIONAL_TRADING_REQUIREMENTS.keyboardLatencyMax}ms`);
      }

      if (maxKeyboardLatency > global.PROFESSIONAL_TRADING_REQUIREMENTS.keyboardLatencyMax * 2) {
        warnings.push(`Maximum keyboard latency ${maxKeyboardLatency.toFixed(2)}ms is high`);
      }
    }

    // Check frame rates
    if (metrics.frameRates.length > 0) {
      const avgFps = metrics.frameRates.reduce((a, b) => a + b, 0) / metrics.frameRates.length;
      const minFps = Math.min(...metrics.frameRates);

      if (avgFps < global.PROFESSIONAL_TRADING_REQUIREMENTS.fpsRenderingMin) {
        errors.push(`Average FPS ${avgFps.toFixed(1)} below minimum ${global.PROFESSIONAL_TRADING_REQUIREMENTS.fpsRenderingMin}`);
      }

      if (minFps < global.PROFESSIONAL_TRADING_REQUIREMENTS.fpsRenderingMin * 0.5) {
        warnings.push(`Minimum FPS ${minFps.toFixed(1)} is low`);
      }
    }

    // Check memory usage
    if (metrics.memoryUsage.length > 1) {
      const initialMemory = metrics.memoryUsage[0].used;
      const finalMemory = metrics.memoryUsage[metrics.memoryUsage.length - 1].used;
      const memoryIncrease = finalMemory - initialMemory;

      if (memoryIncrease > global.PROFESSIONAL_TRADING_REQUIREMENTS.memoryLeakThreshold) {
        errors.push(`Memory increase ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(global.PROFESSIONAL_TRADING_REQUIREMENTS.memoryLeakThreshold / 1024 / 1024).toFixed(2)}MB`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  /**
   * Clean up test resources
   */
  async cleanup() {
    // Close all WebSockets
    for (const ws of global.TEST_STATE.websockets) {
      if (ws && ws.readyState === ws.OPEN) {
        ws.close();
      }
    }
    global.TEST_STATE.websockets = [];

    // Close all pages
    for (const page of global.TEST_STATE.pages) {
      if (page && !page.isClosed()) {
        await page.close();
      }
    }
    global.TEST_STATE.pages = [];

    // Close all contexts
    for (const context of global.TEST_STATE.contexts) {
      if (context) {
        await context.close();
      }
    }
    global.TEST_STATE.contexts = [];

    // Close all browsers
    for (const browser of global.TEST_STATE.browsers) {
      if (browser && browser.isConnected()) {
        await browser.close();
      }
    }
    global.TEST_STATE.browsers = [];
  }
};

// Setup hooks for real-world testing
beforeAll(async () => {
  console.log('🌐 Setting up real-world test environment...');

  // Global test setup for real-world testing
  global.TEST_STATE.startTime = Date.now();

  console.log('✅ Real-world test environment ready');
});

beforeEach(async () => {
  // Reset test state for each test
  global.TEST_STATE.currentTest = expect.getState().currentTestName;

  // Clear performance metrics
  global.PERFORMANCE_METRICS = {
    keyboardLatency: [],
    renderTimes: [],
    memoryUsage: [],
    networkLatency: [],
    frameRates: []
  };
});

afterEach(async () => {
  // Clean up after each test
  const testName = global.TEST_STATE.currentTest;
  const duration = Date.now() - (global.TEST_STATE.startTime || Date.now());

  console.log(`🧪 Test completed: ${testName} (${duration}ms)`);

  // Validate performance requirements if metrics were collected
  if (global.PERFORMANCE_METRICS && Object.keys(global.PERFORMANCE_METRICS).some(key => global.PERFORMANCE_METRICS[key].length > 0)) {
    const validation = global.RealWorldTestUtils.validatePerformanceRequirements(global.PERFORMANCE_METRICS);

    if (!validation.valid) {
      console.error(`❌ Performance validation failed for ${testName}:`);
      validation.errors.forEach(error => console.error(`  - ${error}`));
    }

    if (validation.warnings.length > 0) {
      console.warn(`⚠️ Performance warnings for ${testName}:`);
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }
});

afterAll(async () => {
  console.log('🧹 Cleaning up real-world test environment...');

  // Global cleanup
  await global.RealWorldTestUtils.cleanup();

  const totalDuration = Date.now() - global.TEST_STATE.startTime;
  console.log(`✅ Real-world test environment cleaned up (${totalDuration}ms total)`);
});

// Export for use in tests
export default global.RealWorldTestUtils;