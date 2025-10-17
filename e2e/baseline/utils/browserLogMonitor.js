// Enhanced Browser Log Monitoring Utility
// Comprehensive log capture for workflow-based testing

export class BrowserLogMonitor {
  constructor(page) {
    this.page = page;
    this.logs = {
      console: [],
      network: [],
      errors: [],
      warnings: [],
      performance: []
    };
    this.startTime = Date.now();
    
    this.setupLogCapture();
  }

  setupLogCapture() {
    // Capture all console messages with context
    this.page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now(),
        time: this.getElapsedTime()
      };
      
      this.logs.console.push(logEntry);
      
      // Categorize by type
      if (msg.type() === 'error') {
        this.logs.errors.push(logEntry);
      } else if (msg.type() === 'warning') {
        this.logs.warnings.push(logEntry);
      }
      
      // Log to console with context
      console.log(`[${msg.type().toUpperCase()}] ${logEntry.time}s: ${msg.text()}`);
    });

    // Capture page errors (JavaScript errors)
    this.page.on('pageerror', error => {
      const errorEntry = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        time: this.getElapsedTime()
      };
      
      this.logs.errors.push(errorEntry);
      console.error(`[PAGE ERROR] ${errorEntry.time}s: ${error.name}: ${error.message}`);
    });

    // Capture network requests
    this.page.on('request', request => {
      const requestEntry = {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        timestamp: Date.now(),
        time: this.getElapsedTime()
      };
      
      this.logs.network.push(requestEntry);
    });

    // Capture network responses
    this.page.on('response', response => {
      const responseEntry = {
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
        timestamp: Date.now(),
        time: this.getElapsedTime()
      };
      
      this.logs.network.push(responseEntry);
    });
  }

  getElapsedTime() {
    return ((Date.now() - this.startTime) / 1000).toFixed(2);
  }

  // Validate no critical errors occurred
  validateNoErrors() {
    const errors = this.logs.errors;
    const warnings = this.logs.warnings;
    
    console.log(`\n=== Browser Log Validation ===`);
    console.log(`Total Console Messages: ${this.logs.console.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Network Requests: ${this.logs.network.length}`);
    
    if (errors.length > 0) {
      console.log('\n=== ERRORS FOUND ===');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.time}s] ${error.name || error.type}: ${error.message}`);
        if (error.stack) {
          console.log(`   Stack: ${error.stack.split('\n')[0]}`);
        }
        if (error.location) {
          console.log(`   Location: ${error.location.url}:${error.location.lineNumber}`);
        }
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n=== WARNINGS FOUND ===');
      warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.time}s] ${warning.text}`);
        if (warning.location) {
          console.log(`   Location: ${warning.location.url}:${warning.location.lineNumber}`);
        }
      });
    }
    
    return {
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings
    };
  }

  // Check for specific error patterns
  checkForErrorPatterns(patterns) {
    const errors = this.logs.errors;
    const matches = [];
    
    patterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'i');
      errors.forEach(error => {
        const text = error.message || error.text || '';
        if (regex.test(text)) {
          matches.push({
            pattern,
            error,
            match: text.match(regex)[0]
          });
        }
      });
    });
    
    return matches;
  }

  // Get logs by time range
  getLogsByTimeRange(startTime, endTime) {
    const start = startTime || 0;
    const end = endTime || Infinity;
    
    return {
      console: this.logs.console.filter(log => log.time >= start && log.time <= end),
      errors: this.logs.errors.filter(log => log.time >= start && log.time <= end),
      warnings: this.logs.warnings.filter(log => log.time >= start && log.time <= end),
      network: this.logs.network.filter(log => log.time >= start && log.time <= end)
    };
  }

  // Get performance metrics
  async getPerformanceMetrics() {
    try {
      const metrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          totalLoadTime: navigation.loadEventEnd - navigation.fetchStart
        };
      });
      
      this.logs.performance = metrics;
      return metrics;
    } catch (error) {
      console.log(`[WARN] Could not get performance metrics: ${error.message}`);
      return null;
    }
  }

  // Export logs for analysis
  exportLogs() {
    return {
      summary: {
        totalConsoleMessages: this.logs.console.length,
        errorCount: this.logs.errors.length,
        warningCount: this.logs.warnings.length,
        networkRequestCount: this.logs.network.length,
        testDuration: this.getElapsedTime()
      },
      logs: this.logs,
      performance: this.logs.performance
    };
  }

  // Reset logs for new test
  reset() {
    this.logs = {
      console: [],
      network: [],
      errors: [],
      warnings: [],
      performance: []
    };
    this.startTime = Date.now();
  }
}

// Helper function to create log monitor
export function createLogMonitor(page) {
  return new BrowserLogMonitor(page);
}

// Common error patterns to check for
export const COMMON_ERROR_PATTERNS = [
  'TypeError',
  'ReferenceError',
  'Network error',
  'Failed to fetch',
  'WebSocket',
  'Connection refused',
  '404',
  '500',
  'Cannot read property',
  'Cannot access property',
  'undefined is not',
  'null is not'
];