const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture all console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const message = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString()
    };
    consoleMessages.push(message);

    // Log errors and warnings immediately
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`\n[${msg.type().toUpperCase()}] ${msg.text()}`);
      if (msg.location()) {
        console.log(`  → ${msg.location().url}:${msg.location().lineNumber}`);
      }
    }
  });

  // Capture unhandled JavaScript errors
  const pageErrors = [];
  page.on('pageerror', error => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    pageErrors.push(errorInfo);
    console.log(`\n[JAVASCRIPT ERROR] ${error.message}`);
    if (error.stack) {
      console.log(`Stack: ${error.stack.split('\n')[0]}`);
    }
  });

  // Capture request failures
  const requestFailures = [];
  page.on('requestfailed', request => {
    const failure = {
      url: request.url(),
      failure: request.failure(),
      timestamp: new Date().toISOString()
    };
    requestFailures.push(failure);
    console.log(`\n[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    console.log('🔍 Loading NeuroSense FX application...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

    // Wait a bit for any delayed errors
    await page.waitForTimeout(5000);

    console.log('\n=== BROWSER CONSOLE SUMMARY ===');

    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');

    console.log(`\nErrors: ${errors.length}`);
    errors.forEach(err => {
      console.log(`  • ${err.text}`);
    });

    console.log(`\nWarnings: ${warnings.length}`);
    warnings.forEach(warn => {
      console.log(`  • ${warn.text}`);
    });

    console.log(`\nJavaScript Errors: ${pageErrors.length}`);
    pageErrors.forEach(err => {
      console.log(`  • ${err.message}`);
    });

    console.log(`\nRequest Failures: ${requestFailures.length}`);
    requestFailures.forEach(req => {
      console.log(`  • ${req.url} - ${req.failure?.errorText}`);
    });

    if (errors.length === 0 && warnings.length === 0 && pageErrors.length === 0) {
      console.log('\n✅ No error-level messages found in browser console!');
    }

  } catch (error) {
    console.error(`\n❌ Failed to load page: ${error.message}`);
  }

  await browser.close();
})();