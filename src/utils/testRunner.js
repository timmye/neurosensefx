/**
 * Test runner for floating panel functionality
 * Can be executed in the browser console to verify standardization
 */

import { runAllTests, logTestResults } from './floatingPanelTest.js';

/**
 * Run tests and log results to console
 * Call this function in the browser console: window.testFloatingPanels()
 */
export function testFloatingPanels() {
  console.log('🚀 Running floating panel tests...');
  
  try {
    const results = runAllTests();
    logTestResults(results);
    
    // Store results globally for inspection
    window.lastTestResults = results;
    
    return results;
  } catch (error) {
    console.error('💥 Error running tests:', error);
    return null;
  }
}

/**
 * Add test runner to window object for easy access
 * This will be called when the module is imported
 */
export function initializeTestRunner() {
  if (typeof window !== 'undefined') {
    window.testFloatingPanels = testFloatingPanels;
    console.log('🧪 Test runner initialized. Run window.testFloatingPanels() to test floating panels.');
  }
}

// Auto-initialize when imported
initializeTestRunner();