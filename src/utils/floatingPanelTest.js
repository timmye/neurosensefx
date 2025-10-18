/**
 * Test utilities for floating panel functionality
 * Used to verify consistent behavior across all floating panels
 */

import { PositionPersistence } from './positionPersistence.js';
import { Z_INDEX_LEVELS } from '../constants/zIndex.js';

/**
 * Test position persistence for all floating panels
 * @returns {Object} Test results
 */
export function testPositionPersistence() {
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };
  
  // Test panels
  const panels = [
    'floating-debug-panel-position',
    'floating-system-panel-position',
    'floating-adr-panel-position',
    'floating-symbol-palette-position'
  ];
  
  // Test saving and loading positions
  panels.forEach(panelId => {
    try {
      const testPosition = { x: Math.random() * 500, y: Math.random() * 500 };
      
      // Save position
      PositionPersistence.savePosition(panelId, testPosition);
      
      // Load position
      const loadedPosition = PositionPersistence.loadPosition(panelId);
      
      // Verify positions match
      if (loadedPosition.x === testPosition.x && loadedPosition.y === testPosition.y) {
        results.passed++;
        results.details.push({
          panel: panelId,
          status: 'PASS',
          message: 'Position saved and loaded correctly'
        });
      } else {
        results.failed++;
        results.details.push({
          panel: panelId,
          status: 'FAIL',
          message: `Position mismatch: saved {x: ${testPosition.x}, y: ${testPosition.y}}, loaded {x: ${loadedPosition.x}, y: ${loadedPosition.y}}`
        });
      }
    } catch (error) {
      results.failed++;
      results.details.push({
        panel: panelId,
        status: 'ERROR',
        message: error.message
      });
    }
  });
  
  return results;
}

/**
 * Test z-index hierarchy
 * @returns {Object} Test results
 */
export function testZIndexHierarchy() {
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };
  
  // Expected hierarchy
  const expectedHierarchy = [
    { name: 'BACKGROUND', value: Z_INDEX_LEVELS.BACKGROUND },
    { name: 'SYMBOL_PALETTE', value: Z_INDEX_LEVELS.SYMBOL_PALETTE },
    { name: 'DEBUG_PANEL', value: Z_INDEX_LEVELS.DEBUG_PANEL },
    { name: 'SYSTEM_PANEL', value: Z_INDEX_LEVELS.SYSTEM_PANEL },
    { name: 'ADR_PANEL', value: Z_INDEX_LEVELS.ADR_PANEL },
    { name: 'FLOATING_CANVAS_BASE', value: Z_INDEX_LEVELS.FLOATING_CANVAS_BASE },
    { name: 'DRAGGING', value: Z_INDEX_LEVELS.DRAGGING },
    { name: 'CONTEXT_MENU', value: Z_INDEX_LEVELS.CONTEXT_MENU }
  ];
  
  // Verify hierarchy is in ascending order
  for (let i = 1; i < expectedHierarchy.length; i++) {
    const prev = expectedHierarchy[i - 1];
    const curr = expectedHierarchy[i];
    
    if (prev.value < curr.value) {
      results.passed++;
      results.details.push({
        test: 'Z-Index Hierarchy',
        status: 'PASS',
        message: `${prev.name} (${prev.value}) < ${curr.name} (${curr.value})`
      });
    } else {
      results.failed++;
      results.details.push({
        test: 'Z-Index Hierarchy',
        status: 'FAIL',
        message: `${prev.name} (${prev.value}) >= ${curr.name} (${curr.value})`
      });
    }
  }
  
  // Verify specific values
  const specificValues = [
    { name: 'CONTEXT_MENU', expected: 10000 },
    { name: 'DRAGGING', expected: 9999 },
    { name: 'FLOATING_CANVAS_BASE', expected: 2000 }
  ];
  
  specificValues.forEach(({ name, expected }) => {
    const actual = Z_INDEX_LEVELS[name];
    if (actual === expected) {
      results.passed++;
      results.details.push({
        test: 'Z-Index Value',
        status: 'PASS',
        message: `${name} has correct value: ${actual}`
      });
    } else {
      results.failed++;
      results.details.push({
        test: 'Z-Index Value',
        status: 'FAIL',
        message: `${name} has incorrect value: expected ${expected}, got ${actual}`
      });
    }
  });
  
  return results;
}

/**
 * Run all floating panel tests
 * @returns {Object} Combined test results
 */
export function runAllTests() {
  const positionResults = testPositionPersistence();
  const zIndexResults = testZIndexHierarchy();
  
  return {
    positionPersistence: positionResults,
    zIndexHierarchy: zIndexResults,
    summary: {
      totalPassed: positionResults.passed + zIndexResults.passed,
      totalFailed: positionResults.failed + zIndexResults.failed,
      totalTests: positionResults.passed + positionResults.failed + zIndexResults.passed + zIndexResults.failed
    }
  };
}

/**
 * Log test results to console
 * @param {Object} results - Test results from runAllTests()
 */
export function logTestResults(results) {
  console.group('🧪 Floating Panel Test Results');
  
  // Position Persistence
  console.group('📍 Position Persistence Tests');
  results.positionPersistence.details.forEach(detail => {
    const icon = detail.status === 'PASS' ? '✅' : detail.status === 'FAIL' ? '❌' : '💥';
    console.log(`${icon} ${detail.panel}: ${detail.message}`);
  });
  console.log(`Passed: ${results.positionPersistence.passed}, Failed: ${results.positionPersistence.failed}`);
  console.groupEnd();
  
  // Z-Index Hierarchy
  console.group('🔢 Z-Index Hierarchy Tests');
  results.zIndexHierarchy.details.forEach(detail => {
    const icon = detail.status === 'PASS' ? '✅' : detail.status === 'FAIL' ? '❌' : '💥';
    console.log(`${icon} ${detail.test}: ${detail.message}`);
  });
  console.log(`Passed: ${results.zIndexHierarchy.passed}, Failed: ${results.zIndexHierarchy.failed}`);
  console.groupEnd();
  
  // Summary
  console.log(`📊 Summary: ${results.summary.totalPassed}/${results.summary.totalTests} tests passed`);
  
  if (results.summary.totalFailed > 0) {
    console.warn(`⚠️ ${results.summary.totalFailed} tests failed`);
  } else {
    console.log('🎉 All tests passed!');
  }
  
  console.groupEnd();
}