// Enhanced Browser Console Logging Test for NeuroSense FX
import { test, expect } from '@playwright/test';

test.describe('Browser Console Log Visibility', () => {
  test('comprehensive console monitoring', async ({ page }) => {
    console.log('🔍 Starting comprehensive console monitoring test...');

    // 1. CONSOLE LOG CAPTURE - Complete visibility
    const consoleMessages = [];

    page.on('console', msg => {
      const messageInfo = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        args: msg.args(),
        timestamp: new Date().toISOString()
      };

      consoleMessages.push(messageInfo);

      // Real-time output with emoji classification
      const emoji = getConsoleEmoji(msg.type());
      console.log(`${emoji} ${msg.type().toUpperCase()}: ${msg.text()}`);

      if (msg.location()) {
        console.log(`   📍 Location: ${msg.location().url}:${msg.location().lineNumber}`);
      }
    });

    // 2. PAGE ERROR CAPTURE - JavaScript errors and unhandled promises
    page.on('pageerror', error => {
      console.error('💥 PAGE ERROR:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    });

    // 3. CONSOLE EXCEPTION CAPTURE - Browser console exceptions
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('❌ CONSOLE ERROR:', msg.text());
      }
    });

    // 4. REQUEST/RESPONSE MONITORING - Network visibility
    const requests = [];
    page.on('request', request => {
      requests.push({
        method: request.method(),
        url: request.url(),
        headers: request.headers()
      });
      console.log(`📤 ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      console.log(`📥 ${response.status()} ${response.url()}`);
    });

    // Navigate to the application
    await page.goto('http://localhost:5175');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Allow for initialization

    // 5. ANALYSIS RESULTS
    console.log('\n📊 === CONSOLE LOG ANALYSIS ===');

    const logCounts = {};
    consoleMessages.forEach(msg => {
      logCounts[msg.type] = (logCounts[msg.type] || 0) + 1;
    });

    console.log('📈 Console Message Summary:');
    Object.entries(logCounts).forEach(([type, count]) => {
      console.log(`   ${getConsoleEmoji(type)} ${type.toUpperCase()}: ${count}`);
    });

    // 6. SPECIFIC MESSAGE SEARCH
    console.log('\n🔍 === SPECIFIC MESSAGE SEARCH ===');

    const systemMessages = consoleMessages.filter(msg =>
      msg.text.includes('SYSTEM') ||
      msg.text.includes('CONNECTION MANAGER') ||
      msg.text.includes('WebSocket')
    );

    console.log(`🔧 Found ${systemMessages.length} system messages:`);
    systemMessages.forEach(msg => {
      console.log(`   ${getConsoleEmoji(msg.type)} [${msg.timestamp}] ${msg.text}`);
    });

    const errorMessages = consoleMessages.filter(msg =>
      msg.type === 'error' || msg.type === 'warning'
    );

    console.log(`\n⚠️ Found ${errorMessages.length} error/warning messages:`);
    errorMessages.forEach(msg => {
      console.log(`   ${getConsoleEmoji(msg.type)} [${msg.timestamp}] ${msg.text}`);
      if (msg.location) {
        console.log(`      📍 ${msg.location.url}:${msg.location.lineNumber}`);
      }
    });

    // 7. WEBSOCKET SPECIFIC MONITORING
    console.log('\n🔌 === WEBSOCKET ANALYSIS ===');

    const wsMessages = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('websocket') ||
      msg.text.toLowerCase().includes('ws://') ||
      msg.text.toLowerCase().includes('connected') ||
      msg.text.toLowerCase().includes('disconnected')
    );

    console.log(`🔌 Found ${wsMessages.length} WebSocket-related messages:`);
    wsMessages.forEach(msg => {
      console.log(`   ${getConsoleEmoji(msg.type)} ${msg.text}`);
    });

    // 8. PERFORMANCE MONITORING
    console.log('\n⚡ === PERFORMANCE ANALYSIS ===');

    const performanceMessages = consoleMessages.filter(msg =>
      msg.text.includes('ms') ||
      msg.text.includes('performance') ||
      msg.text.includes('render') ||
      msg.text.includes('fps')
    );

    console.log(`⚡ Found ${performanceMessages.length} performance-related messages:`);
    performanceMessages.forEach(msg => {
      console.log(`   ${getConsoleEmoji(msg.type)} ${msg.text}`);
    });

    // 9. ASSERTIONS FOR TESTING
    expect(consoleMessages.length).toBeGreaterThan(0, 'Should capture console messages');
    expect(page).toHaveTitle('NeuroSense FX - Simple Implementation');

    // Optional: Check for specific error conditions
    const criticalErrors = consoleMessages.filter(msg =>
      msg.type === 'error' && !msg.text.includes('deprecated')
    );

    if (criticalErrors.length > 0) {
      console.warn(`\n🚨 CRITICAL ERRORS FOUND: ${criticalErrors.length}`);
      criticalErrors.forEach(error => {
        console.error(`   💥 ${error.text}`);
      });
    }

    console.log('\n✅ Console monitoring test completed successfully!');
  });

  test('real-time console streaming', async ({ page }) => {
    console.log('📡 Starting real-time console streaming test...');

    // Setup real-time console streaming
    page.on('console', msg => {
      const timestamp = new Date().toLocaleTimeString();
      const emoji = getConsoleEmoji(msg.type());
      console.log(`[${timestamp}] ${emoji} ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', error => {
      const timestamp = new Date().toLocaleTimeString();
      console.error(`[${timestamp}] 💥 ERROR: ${error.message}`);
    });

    await page.goto('http://localhost:5175');

    // Interact with the application to generate console activity
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Trigger keyboard shortcut to generate activity
    page.on('dialog', async dialog => {
      console.log('📝 Dialog detected:', dialog.message());
      await dialog.dismiss(); // Dismiss to continue test
    });

    console.log('⌨️ Triggering Alt+A shortcut...');
    await page.keyboard.press('Alt+A');
    await page.waitForTimeout(2000);

    console.log('✅ Real-time console streaming test completed!');
  });
});

// Helper function for console message emoji classification
function getConsoleEmoji(type) {
  const emojiMap = {
    'log': '📝',
    'info': 'ℹ️',
    'warn': '⚠️',
    'error': '❌',
    'debug': '🐛',
    'trace': '🔍',
    'dir': '📁',
    'dirxml': '📄',
    'table': '📊',
    'clear': '🧹',
    'startGroup': '📂',
    'startGroupCollapsed': '📁',
    'endGroup': '📂',
    'assert': '⚠️',
    'profile': '📈',
    'profileEnd': '📉',
    'count': '🔢',
    'timeEnd': '⏱️'
  };
  return emojiMap[type] || '📢';
}