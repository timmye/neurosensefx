/**
 * Browser agents for container-aware testing of NeuroSense FX
 * Provides specialized configurations for financial application testing
 */

import { chromium, firefox, webkit } from '@playwright/test';

export class BrowserAgentManager {
  constructor() {
    this.defaultLaunchOptions = {
      args: [
        '--disable-dev-shm-usage',
        '--disable-setuid-sandbox',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ],
      ignoreDefaultArgs: ['--enable-automation']
    };
  }

  /**
   * Creates a Chrome browser instance optimized for financial data visualization
   */
  async createChromeAgent(options = {}) {
    const launchOptions = {
      ...this.defaultLaunchOptions,
      ...options,
      args: [
        ...this.defaultLaunchOptions.args,
        '--force-device-scale-factor=1', // For consistent rendering
        '--disable-gpu', // Disable GPU acceleration in containers
        '--disable-background-networking'
      ]
    };

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      ...options.contextOptions
    });

    return { browser, context };
  }

  /**
   * Creates a Firefox browser instance for cross-platform testing
   */
  async createFirefoxAgent(options = {}) {
    const launchOptions = {
      ...options,
      firefoxUserPrefs: {
        'dom.webaudio.enabled': true,
        'media.navigator.enabled': true,
        'media.navigator.permission.disabled': true,
        'webgl.force-enabled': true
      }
    };

    const browser = await firefox.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ...options.contextOptions
    });

    return { browser, context };
  }

  /**
   * Creates a Safari browser instance for Apple ecosystem testing
   */
  async createSafariAgent(options = {}) {
    const browser = await webkit.launch(options);
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ...options.contextOptions
    });

    return { browser, context };
  }

  /**
   * Creates a mobile browser agent for responsive testing
   */
  async createMobileAgent(deviceName = 'iPhone 12') {
    const { devices } = await import('@playwright/test');
    const device = devices[deviceName];

    const browser = await chromium.launch(this.defaultLaunchOptions);
    const context = await browser.newContext({
      ...device,
      isMobile: true,
      hasTouch: true
    });

    return { browser, context, device };
  }

  /**
   * Sets up WebSocket monitoring for market data testing
   */
  async setupWebSocketMonitoring(page) {
    const wsMessages = [];

    await page.route('**/*', async (route) => {
      if (route.request().resourceType() === 'websocket') {
        console.log('🔌 WebSocket connection detected:', route.request().url());
      }
      await route.continue();
    });

    page.on('websocket', ws => {
      console.log('📡 WebSocket frame received');
      ws.on('framesent', event => wsMessages.push({ type: 'sent', payload: event.payload }));
      ws.on('framereceived', event => wsMessages.push({ type: 'received', payload: event.payload }));
      ws.on('close', () => console.log('🔌 WebSocket connection closed'));
    });

    return wsMessages;
  }

  /**
   * Monitors console for financial application errors and warnings
   */
  async setupConsoleMonitoring(page) {
    const consoleMessages = [];

    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      };

      consoleMessages.push(message);

      // Log important messages for debugging
      if (msg.type() === 'error') {
        console.error('❌ Browser Error:', message);
      } else if (msg.type() === 'warning') {
        console.warn('⚠️ Browser Warning:', message);
      } else if (msg.text().includes('WebSocket') || msg.text().includes('market')) {
        console.log('📊 Market Data Log:', message);
      }
    });

    // Monitor page errors
    page.on('pageerror', error => {
      consoleMessages.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.error('🚨 Page Error:', error.message);
    });

    return consoleMessages;
  }

  /**
   * Sets up performance monitoring for canvas rendering
   */
  async setupPerformanceMonitoring(page) {
    const performanceMetrics = [];

    // Enable performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = [];

      // Monitor FPS
      let lastTime = performance.now();
      let frames = 0;

      function measureFPS() {
        frames++;
        const currentTime = performance.now();

        if (currentTime >= lastTime + 1000) {
          const fps = Math.round((frames * 1000) / (currentTime - lastTime));
          window.performanceMetrics.push({
            type: 'fps',
            value: fps,
            timestamp: currentTime
          });

          frames = 0;
          lastTime = currentTime;
        }

        requestAnimationFrame(measureFPS);
      }

      requestAnimationFrame(measureFPS);
    });

    // Collect metrics periodically
    const collectMetrics = async () => {
      const metrics = await page.evaluate(() => window.performanceMetrics || []);
      performanceMetrics.push(...metrics);
      return metrics;
    };

    return { performanceMetrics, collectMetrics };
  }

  /**
   * Waits for market data to load with timeout
   */
  async waitForMarketData(page, timeout = 10000) {
    try {
      await page.waitForFunction(
        () => {
          // Check for common indicators of market data loading
          const indicators = [
            document.querySelector('[data-symbol]'),
            document.querySelector('.price-display'),
            document.querySelector('.market-data'),
            window.marketDataLoaded,
            window.neurosenseReady
          ];
          return indicators.some(indicator => indicator);
        },
        { timeout }
      );
      console.log('📈 Market data loaded successfully');
    } catch (error) {
      console.warn('⏰ Market data loading timeout:', error.message);
    }
  }

  /**
   * Cleans up browser resources
   */
  async cleanup(browser, context) {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

export const browserAgentManager = new BrowserAgentManager();