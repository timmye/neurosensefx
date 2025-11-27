#!/usr/bin/env node

/**
 * Browser Log Viewer for NeuroSense FX
 *
 * Robust standalone browser log capture for LLM developer use.
 * Features comprehensive error handling, timeouts, and process cleanup.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class BrowserLogViewer {
  constructor(options = {}) {
    this.options = {
      headless: true,
      devServerUrl: 'http://localhost:5174',
      captureDuration: 30000, // 30 seconds default
      outputToFile: true,
      outputDir: 'test-results',
      followMode: false,
      startupTimeout: 15000, // 15 seconds to start
      connectionTimeout: 10000, // 10 seconds for page load
      browserTimeout: 5000, // 5 seconds for browser launch
      healthCheckInterval: 2000, // 2 seconds between health checks
      maxRetries: 3,
      ...options
    };

    this.browser = null;
    this.context = null;
    this.page = null;
    this.logBuffer = [];
    this.startTime = new Date();
    this.retryCount = 0;
    this.isShuttingDown = false;
    this.healthCheckTimer = null;

    this.initializeColors();
    this.setupGracefulShutdown();
  }

  initializeColors() {
    this.colors = {
      reset: '\x1b[0m',
      dim: '\x1b[2m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m'
    };
  }

  formatTimestamp() {
    const now = new Date();
    const elapsed = now - this.startTime;
    return `${this.colors.cyan}[${now.toISOString()}][+${elapsed}ms]${this.colors.reset} `;
  }

  formatSource(type, level = 'info') {
    const typeColors = {
      'CONSOLE': this.colors.blue,
      'ERROR': this.colors.red,
      'WARN': this.colors.yellow,
      'NETWORK': this.colors.magenta,
      'PAGE': this.colors.green
    };

    const color = typeColors[type] || this.colors.gray;
    return `${color}[${type}]${this.colors.reset} `;
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(`\n${this.formatTimestamp()}${this.formatSource('SYSTEM')}🛑 Received ${signal}, shutting down gracefully...`);

      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
    process.on('uncaughtException', async (error) => {
      console.error(`${this.formatTimestamp()}${this.formatSource('ERROR')}💥 Uncaught Exception:`, error.message);
      await this.cleanup();
      process.exit(1);
    });
    process.on('unhandledRejection', async (reason) => {
      console.error(`${this.formatTimestamp()}${this.formatSource('ERROR')}💥 Unhandled Rejection:`, reason);
      await this.cleanup();
      process.exit(1);
    });
  }

  async start() {
    try {
      console.log(`${this.colors.cyan}🚀 Browser Log Viewer Starting (Robust Mode)${this.colors.reset}`);
      console.log(`${this.colors.gray}📡 Connecting to: ${this.options.devServerUrl}${this.colors.reset}`);
      console.log(`${this.colors.gray}⏱️  Startup timeout: ${this.options.startupTimeout}ms${this.colors.reset}`);

      // Create output directory if needed
      if (this.options.outputToFile && !fs.existsSync(this.options.outputDir)) {
        fs.mkdirSync(this.options.outputDir, { recursive: true });
      }

      // Check if dev server is running with timeout
      await this.waitForDevServer();

      // Launch browser with timeout and retry logic
      await this.launchBrowserWithRetry();

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });

      this.page = await this.context.newPage();

      // Set up console logging
      await this.setupConsoleCapture();

      // Set up network monitoring
      await this.setupNetworkCapture();

      // Navigate to the application with timeout
      console.log(`${this.formatTimestamp()}${this.formatSource('PAGE')}Navigating to application...`);
      await this.page.goto(this.options.devServerUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.options.connectionTimeout
      });

      console.log(`${this.formatTimestamp()}${this.formatSource('PAGE')}✅ Application loaded successfully`);
      console.log(`${this.formatTimestamp()}${this.formatSource('CONSOLE')}🎯 Capturing browser logs... (Press Ctrl+C to stop)`);

      // Start health monitoring
      this.startHealthMonitoring();

      if (this.options.followMode) {
        // Continuous capture mode
        await this.continuousCapture();
      } else {
        // Timed capture mode
        await this.timedCapture();
      }

    } catch (error) {
      console.error(`${this.formatTimestamp()}${this.formatSource('ERROR')}❌ Failed to start browser log viewer:`, error.message);
      console.error(`${this.formatTimestamp()}${this.formatSource('ERROR')}📋 Stack trace:`, error.stack);
      await this.cleanup();
      process.exit(1);
    }
  }

  async waitForDevServer() {
    const http = require('http');
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkServer = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed > this.options.startupTimeout) {
          reject(new Error(`Dev server not reachable within ${this.options.startupTimeout}ms`));
          return;
        }

        const req = http.get(this.options.devServerUrl, (res) => {
          if (res.statusCode === 200) {
            console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}✅ Dev server is reachable`);
            resolve();
          } else {
            setTimeout(checkServer, 1000);
          }
        });

        req.on('error', () => {
          console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}⏳ Waiting for dev server... (${Math.round(elapsed/1000)}s)`);
          setTimeout(checkServer, 1000);
        });

        req.setTimeout(3000, () => {
          req.destroy();
          setTimeout(checkServer, 1000);
        });
      };

      checkServer();
    });
  }

  async launchBrowserWithRetry() {
    while (this.retryCount < this.options.maxRetries) {
      try {
        console.log(`${this.formatTimestamp()}${this.formatSource('BROWSER')}🌐 Launching browser (attempt ${this.retryCount + 1}/${this.options.maxRetries})`);

        const launchPromise = chromium.launch({
          headless: this.options.headless,
          timeout: this.options.browserTimeout
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Browser launch timeout')), this.options.browserTimeout)
        );

        this.browser = await Promise.race([launchPromise, timeoutPromise]);

        console.log(`${this.formatTimestamp()}${this.formatSource('BROWSER')}✅ Browser launched successfully`);
        return;

      } catch (error) {
        this.retryCount++;
        console.error(`${this.formatTimestamp()}${this.formatSource('ERROR')}❌ Browser launch failed (attempt ${this.retryCount}):`, error.message);

        if (this.retryCount >= this.options.maxRetries) {
          throw new Error(`Failed to launch browser after ${this.options.maxRetries} attempts: ${error.message}`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      try {
        if (this.page && !this.page.isClosed()) {
          // Check if page is still responsive
          await this.page.evaluate(() => document.title);
        } else {
          console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}⚠️  Page appears to be closed, stopping...`);
          await this.stop();
        }
      } catch (error) {
        console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}⚠️  Health check failed:`, error.message);
        await this.stop();
      }
    }, this.options.healthCheckInterval);
  }

  async setupConsoleCapture() {
    this.page.on('console', (msg) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        args: msg.args().length
      };

      this.logBuffer.push(logEntry);

      const levelColor = msg.type() === 'error' ? this.colors.red :
                        msg.type() === 'warning' ? this.colors.yellow :
                        this.colors.blue;

      console.log(`${this.formatTimestamp()}${this.formatSource('CONSOLE', msg.type())}${levelColor}${msg.type().toUpperCase()}${this.colors.reset}: ${msg.text()}`);
    });

    this.page.on('pageerror', (error) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'pageerror',
        message: error.message,
        stack: error.stack
      };

      this.logBuffer.push(logEntry);
      console.log(`${this.formatTimestamp()}${this.formatSource('ERROR')}${this.colors.red}PAGE ERROR${this.colors.reset}: ${error.message}`);
    });
  }

  async setupNetworkCapture() {
    this.page.on('request', (request) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'request',
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      };

      this.logBuffer.push(logEntry);

      if (request.resourceType() === 'websocket' || request.url().includes('api')) {
        console.log(`${this.formatTimestamp()}${this.formatSource('NETWORK')}${this.colors.magenta}${request.method()}${this.colors.reset}: ${request.url()}`);
      }
    });

    this.page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          type: 'response_error',
          url: response.url(),
          status: status,
          statusText: response.statusText()
        };

        this.logBuffer.push(logEntry);
        console.log(`${this.formatTimestamp()}${this.formatSource('ERROR')}${this.colors.red}HTTP ${status}${this.colors.reset}: ${response.url()}`);
      }
    });
  }

  async continuousCapture() {
    return new Promise((resolve) => {
      // Keep running until interrupted
      this.keepRunning = true;
    });
  }

  async timedCapture() {
    await new Promise(resolve => setTimeout(resolve, this.options.captureDuration));
    await this.stop();
  }

  async cleanup() {
    try {
      console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}🧹 Starting cleanup...`);

      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }

      if (this.options.outputToFile && this.logBuffer.length > 0) {
        const outputFile = path.join(this.options.outputDir, `browser-logs-${Date.now()}.json`);
        try {
          fs.writeFileSync(outputFile, JSON.stringify(this.logBuffer, null, 2));
          console.log(`${this.formatTimestamp()}${this.formatSource('CONSOLE')}💾 Logs saved to: ${outputFile}`);
        } catch (error) {
          console.error(`${this.formatTimestamp()}${this.formatSource('ERROR')}❌ Failed to save logs:`, error.message);
        }
      }

      console.log(`${this.formatTimestamp()}${this.formatSource('CONSOLE')}📊 Total logs captured: ${this.logBuffer.length}`);

      // Close browser context and page with timeout
      if (this.context) {
        try {
          await Promise.race([
            this.context.close(),
            new Promise(resolve => setTimeout(resolve, 3000))
          ]);
        } catch (error) {
          console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}⚠️  Context cleanup error:`, error.message);
        }
      }

      // Close browser with timeout
      if (this.browser) {
        try {
          await Promise.race([
            this.browser.close(),
            new Promise(resolve => setTimeout(resolve, 5000))
          ]);
        } catch (error) {
          console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}⚠️  Browser cleanup error:`, error.message);
        }
      }

      console.log(`${this.formatTimestamp()}${this.formatSource('SYSTEM')}✅ Cleanup completed`);

    } catch (error) {
      console.error(`${this.formatTimestamp()}${this.formatSource('ERROR')}❌ Cleanup error:`, error.message);
    }
  }

  async stop() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log(`\n${this.formatTimestamp()}${this.formatSource('PAGE')}🛑 Stopping browser log viewer...`);

    await this.cleanup();

    console.log(`${this.formatTimestamp()}${this.formatSource('PAGE')}✅ Browser log viewer stopped`);
    process.exit(0);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  const options = {
    headless: !args.includes('--headless=false'),
    followMode: args.includes('--follow'),
    captureDuration: parseInt(args.find(arg => arg.startsWith('--duration='))?.split('=')[1]) || 30000,
    outputToFile: !args.includes('--no-file')
  };

  const viewer = new BrowserLogViewer(options);
  await viewer.start();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BrowserLogViewer;