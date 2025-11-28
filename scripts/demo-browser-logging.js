#!/usr/bin/env node

/**
 * Browser Console Logging Demo for LLM Developer Experience
 *
 * Demonstrates the enhanced browser console visibility system with:
 * - Clear error classification with emojis
 * - Network request/response tracking
 * - Performance monitoring capabilities
 * - Focused log collection for debugging
 *
 * Philosophy: "Simple, Performant, Maintainable"
 */

import { test, chromium } from '@playwright/test';

async function demoBrowserLogging() {
  console.log('🚀 Starting Enhanced Browser Console Logging Demo...\n');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Import our enhanced logging utility
  const { addBrowserConsoleLogging, createLogCollector, analyzeErrors } = await import('../tests/utils/browser-console-logger.js');

  // Example 1: Basic enhanced logging
  console.log('📋 Example 1: Basic Enhanced Logging');
  console.log('=====================================');

  addBrowserConsoleLogging(page, {
    enableNetworkLogging: true,
    enableErrorLogging: true,
    enableConsoleLogging: true
  });

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);

  console.log('\n📋 Example 2: Focused Log Collection');
  console.log('=====================================');

  // Example 2: Focused log collection for keyboard debugging
  const keyboardCollector = createLogCollector(page, [
    'KEYBOARD',
    '⌨️',
    'shortcut',
    'event'
  ]);

  await page.evaluate(() => {
    console.log('⌨️ [KEYBOARD-DEBUG] Testing keyboard event logging');
    console.log('⌨️ [KEYBOARD-DEBUG] Keyboard system initialized');
    console.log('⌨️ [KEYBOARD-DEBUG] Critical shortcut handling active');
  });

  await page.waitForTimeout(1000);

  const keyboardLogs = keyboardCollector.getLogs();
  console.log(`📊 Collected ${keyboardLogs.length} keyboard-related logs:`);
  keyboardLogs.forEach((log, index) => {
    console.log(`  ${index + 1}. [${log.type}] ${log.text}`);
  });

  console.log('\n📋 Example 3: Error Analysis');
  console.log('=============================');

  // Example 3: Generate some test errors for analysis
  await page.evaluate(() => {
    console.error('❌ [JAVASCRIPT ERROR] Example TypeError for testing');
    console.warn('⚠️ [NETWORK WARNING] Connection timeout warning');
    console.log('💡 [DEBUG] Component mounting successful');
  });

  await page.waitForTimeout(500);

  // Collect all logs for error analysis
  const errorCollector = createLogCollector(page);
  await page.waitForTimeout(1000);
  const allLogs = errorCollector.getLogs();

  const errorAnalysis = analyzeErrors(allLogs);
  console.log('🔍 Error Analysis Results:');
  console.log(`  - Total errors found: ${errorAnalysis.total}`);
  errorAnalysis.summary.forEach(summary => {
    console.log(`  - ${summary.category}: ${summary.count} (${summary.percentage}%)`);
  });

  console.log('\n📋 Example 4: Performance Patterns');
  console.log('===================================');

  // Example 4: Performance monitoring patterns
  await page.evaluate(() => {
    // Simulate performance-related console output
    console.log('🚀 [PERF] Component render: 2.3ms');
    console.log('🚀 [PERF] WebSocket latency: 45ms');
    console.log('🚀 [PERF] Memory usage: 42MB');
    console.log('❌ [PERF ERROR] Frame drop detected: 55ms frame time');
  });

  await page.waitForTimeout(500);

  console.log('\n🎯 Demo Summary: Enhanced Browser Console Features');
  console.log('==================================================');
  console.log('✅ Native Playwright event handling (zero custom infrastructure)');
  console.log('✅ Emoji-based visual classification for LLM visibility');
  console.log('✅ Focused log collection with pattern matching');
  console.log('✅ Automatic error categorization and analysis');
  console.log('✅ Performance monitoring capabilities');
  console.log('✅ Network request/response tracking');

  console.log('\n🔧 Quick Commands for Developers:');
  console.log('==================================');
  console.log('npm run test:browser-logs              # Run full keyboard debug test');
  console.log('npm run test:browser-logs | grep "❌"   # Show only errors');
  console.log('npm run test:browser-logs | grep "⌨️"   # Show keyboard logs');
  console.log('npm run test:browser-logs | grep "🚀"   # Show performance logs');

  await browser.close();
  console.log('\n✨ Demo completed successfully!');
}

// Run the demo
demoBrowserLogging().catch(console.error);