/**
 * Zero-Tolerance Error Monitoring System
 *
 * CRITICAL: Any JavaScript error immediately causes test failure
 * No exceptions, no silent logging, immediate test termination
 *
 * This eliminates "false confidence" where tests pass despite
 * application-breaking JavaScript errors.
 */

export class ZeroToleranceErrorMonitor {
  constructor() {
    this.errorCount = 0;
    this.errors = [];
  }

  /**
   * Setup comprehensive error monitoring for immediate test failure
   *
   * ZERO TOLERANCE: Any critical JavaScript error = immediate test failure
   */
  async setup(page) {
    console.log('🛡️ [ZERO_TOLERANCE] Setting up comprehensive error monitoring...');

    // 1. Uncaught JavaScript errors - IMMEDIATE TEST FAILURE
    page.on('error', (error) => {
      this.errorCount++;
      const errorInfo = {
        type: 'JavaScript Error',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      this.errors.push(errorInfo);

      console.error('❌ FATAL: JavaScript error detected, failing test:', error.message);
      console.error('Stack:', error.stack);

      // IMMEDIATE TEST FAILURE - no tolerance for JavaScript errors
      throw new Error(`Application JavaScript error: ${error.message}`);
    });

    // 2. Console error monitoring - IMMEDIATE TEST FAILURE
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.errorCount++;
        const errorInfo = {
          type: 'Console Error',
          message: msg.text(),
          location: msg.location(),
          timestamp: new Date().toISOString()
        };
        this.errors.push(errorInfo);

        console.error('❌ CRITICAL: Console error detected:', msg.text());
        if (msg.location()) {
          console.error('Location:', `${msg.location().url}:${msg.location().lineNumber}`);
        }

        // IMMEDIATE TEST FAILURE - no tolerance for console errors
        throw new Error(`Console error detected: ${msg.text()}`);
      }
    });

    // 3. Unhandled promise rejections - IMMEDIATE TEST FAILURE
    page.on('pageerror', (error) => {
      this.errorCount++;
      const errorInfo = {
        type: 'Unhandled Promise Rejection',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      this.errors.push(errorInfo);

      console.error('❌ FATAL: Unhandled promise rejection:', error.message);
      console.error('Stack:', error.stack);

      // IMMEDIATE TEST FAILURE - no tolerance for unhandled rejections
      throw new Error(`Unhandled promise rejection: ${error.message}`);
    });

    // 4. Inject JavaScript error capture for runtime validation
    await page.addInitScript(() => {
      window.jsErrors = [];
      window.testErrorCount = 0;

      // Capture JavaScript errors that might not trigger page.on('error')
      window.addEventListener('error', (event) => {
        window.testErrorCount++;
        const errorInfo = {
          type: 'Runtime Error',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          timestamp: new Date().toISOString()
        };
        window.jsErrors.push(errorInfo);

        console.error('❌ RUNTIME: JavaScript error captured:', errorInfo);
      });

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        window.testErrorCount++;
        const errorInfo = {
          type: 'Runtime Promise Rejection',
          message: event.reason?.message || event.reason,
          timestamp: new Date().toISOString()
        };
        window.jsErrors.push(errorInfo);

        console.error('❌ RUNTIME: Unhandled promise rejection captured:', errorInfo);
      });
    });

    console.log('✅ [ZERO_TOLERANCE] Error monitoring activated - tests will fail on ANY JavaScript error');
  }

  /**
   * Validate no errors occurred during test execution
   */
  async validateNoErrors(page) {
    console.log('🔍 [ZERO_TOLERANCE] Validating no JavaScript errors occurred...');

    // Check for injected script errors
    const injectedErrors = await page.evaluate(() => {
      return {
        jsErrors: window.jsErrors || [],
        errorCount: window.testErrorCount || 0
      };
    });

    const totalErrors = this.errorCount + injectedErrors.errorCount;

    if (totalErrors > 0) {
      const errorSummary = {
        monitorErrors: this.errors,
        injectedErrors: injectedErrors.jsErrors,
        totalErrorCount: totalErrors
      };

      console.error('❌ [ZERO_TOLERANCE] JavaScript errors detected during test:', errorSummary);
      throw new Error(`Test validation failed: ${totalErrors} JavaScript errors detected during test execution`);
    }

    console.log('✅ [ZERO_TOLERANCE] No JavaScript errors detected - test validation passed');
    return true;
  }

  /**
   * Get error report for debugging
   */
  getErrorReport() {
    return {
      errorCount: this.errorCount,
      errors: this.errors,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset error state (for between test phases)
   */
  reset() {
    this.errorCount = 0;
    this.errors = [];
    console.log('🔄 [ZERO_TOLERANCE] Error monitor reset');
  }
}

/**
 * Convenience function to create and setup error monitor
 */
export async function setupZeroToleranceMonitoring(page) {
  const monitor = new ZeroToleranceErrorMonitor();
  await monitor.setup(page);
  return monitor;
}

/**
 * Critical error patterns that should cause immediate test failure
 */
export const CRITICAL_ERROR_PATTERNS = [
  /Uncaught TypeError/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /WebSocket connection error/i,
  /Critical rendering error/i,
  /Cannot read property/i,
  /Failed to load module/i,
  /UnhandledPromiseRejectionWarning/i,
  /displayContextEnhancer is not defined/i,
  /currentStore\.displays is not iterable/i,
  /workspacePersistenceManager\.load is not a function/i,
  /Cannot convert undefined or null to object/i
];

/**
 * Validate error patterns in page content
 */
export async function validateErrorPatterns(page) {
  const pageContent = await page.content();

  for (const pattern of CRITICAL_ERROR_PATTERNS) {
    if (pattern.test(pageContent)) {
      throw new Error(`Critical error pattern detected: ${pattern.source}`);
    }
  }

  return true;
}

export default ZeroToleranceErrorMonitor;