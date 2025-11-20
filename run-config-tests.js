#!/usr/bin/env node

/**
 * NeuroSense FX Configuration Inheritance Test Runner
 *
 * This script runs comprehensive tests to validate the configuration inheritance fixes.
 * It will open the development server and execute tests in the browser.
 *
 * Usage: node run-config-tests.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5174',
  timeout: 30000,
  headless: false, // Show browser for debugging
  slowMo: 100 // Slow down actions for visibility
};

async function runConfigurationTests() {
  console.log('🧪 NeuroSense FX Configuration Inheritance Test Runner');
  console.log('====================================================');
  console.log(`📍 Testing URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`⏰ Timeout: ${TEST_CONFIG.timeout}ms`);
  console.log(`👁️ Headless mode: ${TEST_CONFIG.headless}`);
  console.log('');

  let browser;
  let page;

  try {
    // Launch browser
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: TEST_CONFIG.headless,
      slowMo: TEST_CONFIG.slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      // Color-code output based on type
      const colors = {
        log: '\x1b[36m',    // Cyan
        info: '\x1b[34m',   // Blue
        warn: '\x1b[33m',   // Yellow
        error: '\x1b[31m',  // Red
        debug: '\x1b[37m'   // White
      };

      const color = colors[type] || colors.log;
      const reset = '\x1b[0m';

      console.log(`${color}[PAGE ${type.toUpperCase()}]${reset} ${text}`);
    });

    page.on('pageerror', error => {
      console.error('\x1b[31m[PAGE ERROR]\x1b[0m', error.message);
    });

    // Navigate to the application
    console.log(`📍 Navigating to ${TEST_CONFIG.baseUrl}...`);
    await page.goto(TEST_CONFIG.baseUrl, {
      waitUntil: 'networkidle2',
      timeout: TEST_CONFIG.timeout
    });

    // Wait for the app to load
    console.log('⏳ Waiting for application to load...');
    await page.waitForTimeout(3000);

    // Check if the app loaded successfully
    const appTitle = await page.title();
    console.log(`📄 Page title: ${appTitle}`);

    // Load the test script
    console.log('📝 Loading test script...');
    const testScriptPath = path.join(__dirname, 'test-configuration-inheritance.js');
    const testScript = fs.readFileSync(testScriptPath, 'utf8');

    // Execute the test script in the page
    console.log('🧪 Executing configuration inheritance tests...');
    const testResults = await page.evaluate((script) => {
      return new Promise((resolve) => {
        // Execute the test script
        eval(script);

        // The script will auto-run after 2 seconds, so we wait for results
        window.waitForTestResults = (results) => {
          resolve(results);
        };

        // Override the runAllTests function to return results
        const originalRunAllTests = window.runNeurosenseTests;
        window.runNeurosenseTests = async () => {
          const results = await originalRunAllTests();
          window.waitForTestResults(results);
          return results;
        };
      });
    }, testScript);

    // Wait for tests to complete
    console.log('⏳ Waiting for test results...');
    await page.waitForTimeout(5000);

    // Get test results from the console output
    const consoleMessages = await page.evaluate(() => {
      // Capture console output and parse results
      return new Promise((resolve) => {
        const messages = [];
        const originalLog = console.log;

        console.log = function(...args) {
          messages.push(args.join(' '));
          originalLog.apply(console, args);
        };

        setTimeout(() => {
          console.log = originalLog;
          resolve(messages);
        }, 1000);
      });
    });

    // Analyze console output for test results
    const testOutput = consoleMessages.join('\n');
    console.log('\n📊 TEST OUTPUT');
    console.log('================');
    console.log(testOutput);

    // Parse test results
    const testPassed = testOutput.includes('ALL TESTS PASSED');
    const testFailed = testOutput.includes('TESTS FAILED');
    const partialPass = testOutput.includes('TESTS PASSED') && !testOutput.includes('ALL TESTS PASSED');

    // Final results
    console.log('\n🏁 FINAL TEST RESULTS');
    console.log('====================');

    if (testPassed) {
      console.log('✅ SUCCESS: All configuration inheritance tests passed!');
      console.log('🎉 The implementation appears to be working correctly.');
    } else if (testFailed) {
      console.log('❌ FAILURE: Some tests failed');
      console.log('🔧 Check the test output above for details on what failed');
    } else if (partialPass) {
      console.log('⚠️ PARTIAL SUCCESS: Some tests passed, but not all');
      console.log('🔧 Review the individual test results above');
    } else {
      console.log('❓ UNKNOWN: Could not determine test results');
      console.log('🔍 Check the browser console for more details');
    }

    // Take a screenshot for debugging
    const screenshotPath = 'config-test-results.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);

    // Save console output to a file
    fs.writeFileSync('config-test-output.txt', testOutput);
    console.log('📄 Console output saved: config-test-output.txt');

    // Return results
    return {
      success: testPassed,
      partial: partialPass,
      output: testOutput,
      screenshot: screenshotPath
    };

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);

    // Take screenshot on error
    if (page) {
      try {
        await page.screenshot({ path: 'config-test-error.png', fullPage: true });
        console.log('📸 Error screenshot saved: config-test-error.png');
      } catch (screenshotError) {
        console.warn('Could not save error screenshot:', screenshotError.message);
      }
    }

    return {
      success: false,
      error: error.message
    };

  } finally {
    // Clean up
    if (browser) {
      console.log('\n🧹 Closing browser...');
      await browser.close();
    }
  }
}

// Check if development server is running
async function checkDevServer() {
  try {
    console.log('🔍 Checking if development server is running...');
    const response = await fetch(TEST_CONFIG.baseUrl);
    return response.ok;
  } catch (error) {
    console.error('❌ Development server is not accessible at', TEST_CONFIG.baseUrl);
    console.error('💡 Make sure the development server is running: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  try {
    // Check if Puppeteer is available
    try {
      require.resolve('puppeteer');
    } catch (error) {
      console.error('❌ Puppeteer is not installed. Please install it with:');
      console.error('   npm install puppeteer');
      process.exit(1);
    }

    // Check if development server is running
    const serverRunning = await checkDevServer();
    if (!serverRunning) {
      process.exit(1);
    }

    // Check if test script exists
    const testScriptPath = path.join(__dirname, 'test-configuration-inheritance.js');
    if (!fs.existsSync(testScriptPath)) {
      console.error('❌ Test script not found:', testScriptPath);
      process.exit(1);
    }

    // Run the tests
    const results = await runConfigurationTests();

    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runConfigurationTests, checkDevServer };