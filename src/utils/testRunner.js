/**
 * Test runner for NeuroSense FX functionality
 * Can be executed in the browser console to verify various features
 */

import { runAllTests, logTestResults } from './floatingPanelTest.js';
import { testConfigurationInheritance, quickConfigTest, verifyStaleDefaultsFix } from './testConfigurationInheritance.js';

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
 * Run configuration inheritance tests
 * Call this function in the browser console: window.testConfigInheritance()
 */
export function testConfigInheritance() {
  console.log('🚀 Running configuration inheritance tests...');

  try {
    const results = testConfigurationInheritance();
    return results;
  } catch (error) {
    console.error('💥 Error running configuration tests:', error);
    return null;
  }
}

/**
 * Quick configuration test
 * Call this function in the browser console: window.quickConfigTest()
 */
export function runQuickConfigTest() {
  console.log('🚀 Running quick configuration test...');

  try {
    return quickConfigTest();
  } catch (error) {
    console.error('💥 Error running quick config test:', error);
    return null;
  }
}

/**
 * Verify stale defaults fix
 * Call this function in the browser console: window.verifyStaleDefaultsFix()
 */
export function runStaleDefaultsTest() {
  console.log('🚀 Verifying stale defaults fix...');

  try {
    verifyStaleDefaultsFix();
    return true;
  } catch (error) {
    console.error('💥 Error running stale defaults test:', error);
    return false;
  }
}

/**
 * Add test runner to window object for easy access
 * This will be called when the module is imported
 */
export function initializeTestRunner() {
  if (typeof window !== 'undefined') {
    window.testFloatingPanels = testFloatingPanels;
    window.testConfigInheritance = testConfigInheritance;
    window.quickConfigTest = runQuickConfigTest;
    window.verifyStaleDefaultsFix = runStaleDefaultsTest;
    console.log('🧪 Test runner initialized. Available tests:');
    console.log('  - window.testFloatingPanels() - Test floating panel functionality');
    console.log('  - window.testConfigInheritance() - Test configuration inheritance fix');
    console.log('  - window.quickConfigTest() - Quick configuration test');
    console.log('  - window.verifyStaleDefaultsFix() - Verify stale defaults are fixed');
  }
}

// Auto-initialize when imported
initializeTestRunner();