// =============================================================================
// TEST UTILITY FOR CROSS-ENVIRONMENT COPY SYSTEM
// =============================================================================
// Comprehensive testing utilities for validating the copy system functionality

import copyUtils from './crossEnvironmentCopy.js';
import { validateEnvironment } from '../lib/utils/environmentUtils.js';

/**
 * Test suite for cross-environment copy functionality
 */
export class CopySystemTester {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
  }

  /**
   * Run all tests
   * @returns {Object} Complete test results
   */
  async runAllTests() {
    console.log('🧪 Starting Cross-Environment Copy System Tests...');

    const startTime = Date.now();
    this.testResults = [];

    // Basic validation tests
    await this.testEnvironmentValidation();
    await this.testStorageValidation();
    await this.testBackupOperations();
    await this.testCopyPresets();
    await this.testEnvironmentComparison();
    await this.testDataIntegrity();

    const endTime = Date.now();
    const duration = endTime - startTime;

    const summary = this.generateTestSummary(duration);
    console.log('✅ Test Suite Completed:', summary);

    return summary;
  }

  /**
   * Test environment validation functionality
   */
  async testEnvironmentValidation() {
    this.startTest('Environment Validation');

    try {
      // Test environment detection
      const envValidation = validateEnvironment();
      this.assert(envValidation.isValid, 'Environment validation should pass');
      this.assert(envValidation.environment, 'Should detect current environment');

      // Test copy items structure
      this.assert(Object.keys(copyUtils.COPY_ITEMS).length > 0, 'Copy items should be defined');

      // Test preset definitions
      this.assert(Object.keys(copyUtils.COPY_PRESETS).length > 0, 'Copy presets should be defined');

      this.passTest();
    } catch (error) {
      this.failTest(error.message);
    }
  }

  /**
   * Test storage validation functionality
   */
  async testStorageValidation() {
    this.startTest('Storage Validation');

    try {
      // Test current environment validation
      const validation = copyUtils.validateCurrentEnvironment();
      this.assert(validation, 'Should return validation results');
      this.assert(typeof validation.isValid === 'boolean', 'Should have isValid property');

      // Test each item validation function
      const itemKeys = Object.keys(copyUtils.COPY_ITEMS);
      for (const itemKey of itemKeys) {
        const itemConfig = copyUtils.COPY_ITEMS[itemKey];
        if (itemConfig.validator) {
          this.assert(typeof itemConfig.validator === 'function', `${itemKey} should have validator function`);
        }
      }

      this.passTest();
    } catch (error) {
      this.failTest(error.message);
    }
  }

  /**
   * Test backup operations
   */
  async testBackupOperations() {
    this.startTest('Backup Operations');

    try {
      // Create test backup
      const backupResult = copyUtils.createBackup('test-backup');
      this.assert(backupResult.success, 'Should create backup successfully');
      this.assert(backupResult.backupId, 'Should return backup ID');

      const backupId = backupResult.backupId;

      // List backups
      const backups = copyUtils.listBackups();
      this.assert(Array.isArray(backups), 'Should return array of backups');

      const createdBackup = backups.find(b => b.id === backupId);
      this.assert(createdBackup, 'Should find created backup in list');

      // Test backup cleanup (keep more than our test backup)
      const cleanupResult = copyUtils.cleanupOldBackups(10);
      this.assert(cleanupResult.success, 'Cleanup should succeed');

      // Clean up test backup
      const deleteResult = copyUtils.deleteBackup(backupId);
      this.assert(deleteResult, 'Should delete test backup');

      this.passTest();
    } catch (error) {
      this.failTest(error.message);
    }
  }

  /**
   * Test copy presets
   */
  async testCopyPresets() {
    this.startTest('Copy Presets');

    try {
      const presets = copyUtils.COPY_PRESETS;

      // Test each preset
      for (const [presetKey, preset] of Object.entries(presets)) {
        this.assert(preset.name, `${presetKey} should have name`);
        this.assert(preset.description, `${presetKey} should have description`);
        this.assert(Array.isArray(preset.items), `${presetKey} should have items array`);
        this.assert(preset.items.length > 0, `${presetKey} should have at least one item`);
      }

      // Test preset items are valid
      const validItems = Object.keys(copyUtils.COPY_ITEMS);
      for (const preset of Object.values(presets)) {
        for (const item of preset.items) {
          this.assert(validItems.includes(item), `Preset item ${item} should be valid`);
        }
      }

      this.passTest();
    } catch (error) {
      this.failTest(error.message);
    }
  }

  /**
   * Test environment comparison
   */
  async testEnvironmentComparison() {
    this.startTest('Environment Comparison');

    try {
      const comparison = await copyUtils.compareEnvironments();

      this.assert(comparison, 'Should return comparison results');
      this.assert(comparison.development, 'Should have development info');
      this.assert(comparison.production, 'Should have production info');
      this.assert(comparison.summary, 'Should have summary');

      // Test summary structure
      const { summary } = comparison;
      this.assert(Array.isArray(summary.devOnly), 'Should have devOnly array');
      this.assert(Array.isArray(summary.prodOnly), 'Should have prodOnly array');
      this.assert(Array.isArray(summary.bothPresent), 'Should have bothPresent array');
      this.assert(Array.isArray(summary.bothMissing), 'Should have bothMissing array');

      this.passTest();
    } catch (error) {
      this.failTest(error.message);
    }
  }

  /**
   * Test data integrity
   */
  async testDataIntegrity() {
    this.startTest('Data Integrity');

    try {
      // Test data loading functions
      const itemKeys = Object.keys(copyUtils.COPY_ITEMS);

      for (const itemKey of itemKeys) {
        const itemConfig = copyUtils.COPY_ITEMS[itemKey];

        // Test load function
        this.assert(typeof itemConfig.loadFunction === 'function', `${itemKey} should have load function`);

        try {
          const data = itemConfig.loadFunction();
          // Data can be null, but shouldn't throw errors
        } catch (loadError) {
          this.failTest(`${itemKey} load function should not throw: ${loadError.message}`);
          return;
        }

        // Test save function
        this.assert(typeof itemConfig.saveFunction === 'function', `${itemKey} should have save function`);
      }

      this.passTest();
    } catch (error) {
      this.failTest(error.message);
    }
  }

  /**
   * Test mock copy operation (without actually copying)
   */
  async testMockCopyOperation() {
    this.startTest('Mock Copy Operation');

    try {
      // Test copy operation validation (without executing)
      const options = {
        sourceEnv: 'development',
        targetEnv: 'production',
        items: ['layout', 'config'],
        createBackup: false,
        validateData: true,
        mergeMode: false
      };

      this.assert(options.sourceEnv, 'Should have source environment');
      this.assert(options.targetEnv, 'Should have target environment');
      this.assert(Array.isArray(options.items), 'Should have items array');
      this.assert(options.items.length > 0, 'Should have at least one item');

      // Validate items
      const validItems = Object.keys(copyUtils.COPY_ITEMS);
      for (const item of options.items) {
        this.assert(validItems.includes(item), `Copy item ${item} should be valid`);
      }

      this.passTest();
    } catch (error) {
      this.failTest(error.message);
    }
  }

  /**
   * Start a new test
   * @param {string} testName - Name of the test
   */
  startTest(testName) {
    this.currentTest = {
      name: testName,
      startTime: Date.now(),
      assertions: 0,
      passed: false,
      error: null
    };
  }

  /**
   * Pass current test
   */
  passTest() {
    if (this.currentTest) {
      this.currentTest.passed = true;
      this.currentTest.endTime = Date.now();
      this.currentTest.duration = this.currentTest.endTime - this.currentTest.startTime;
      this.testResults.push(this.currentTest);
      console.log(`✅ ${this.currentTest.name} - PASSED (${this.currentTest.duration}ms, ${this.currentTest.assertions} assertions)`);
      this.currentTest = null;
    }
  }

  /**
   * Fail current test
   * @param {string} error - Error message
   */
  failTest(error) {
    if (this.currentTest) {
      this.currentTest.passed = false;
      this.currentTest.error = error;
      this.currentTest.endTime = Date.now();
      this.currentTest.duration = this.currentTest.endTime - this.currentTest.startTime;
      this.testResults.push(this.currentTest);
      console.log(`❌ ${this.currentTest.name} - FAILED: ${error} (${this.currentTest.duration}ms, ${this.currentTest.assertions} assertions)`);
      this.currentTest = null;
    }
  }

  /**
   * Assert a condition
   * @param {boolean} condition - Condition to assert
   * @param {string} message - Assertion message
   */
  assert(condition, message) {
    if (this.currentTest) {
      this.currentTest.assertions++;
    }

    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Generate test summary
   * @param {number} totalDuration - Total test duration
   * @returns {Object} Test summary
   */
  generateTestSummary(totalDuration) {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = this.testResults.length;
    const totalAssertions = this.testResults.reduce((sum, r) => sum + r.assertions, 0);

    const summary = {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total * 100).toFixed(1) : 0,
      totalAssertions,
      duration: totalDuration,
      tests: this.testResults,
      status: failed === 0 ? 'PASSED' : 'FAILED'
    };

    console.log(`\n📊 Test Summary:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Pass Rate: ${summary.passRate}%`);
    console.log(`   Total Assertions: ${totalAssertions}`);
    console.log(`   Duration: ${totalDuration}ms`);
    console.log(`   Status: ${summary.status}`);

    return summary;
  }

  /**
   * Quick smoke test for basic functionality
   * @returns {boolean} True if basic functionality works
   */
  async smokeTest() {
    console.log('💨 Running Smoke Test...');

    try {
      // Test environment detection
      const envValidation = validateEnvironment();
      if (!envValidation.isValid) {
        throw new Error('Environment validation failed');
      }

      // Test basic copy utilities
      const comparison = await copyUtils.compareEnvironments();
      if (!comparison) {
        throw new Error('Environment comparison failed');
      }

      // Test backup creation
      const backup = copyUtils.createBackup('smoke-test');
      if (!backup.success) {
        throw new Error('Backup creation failed');
      }

      // Clean up
      copyUtils.deleteBackup(backup.backupId);

      console.log('✅ Smoke Test PASSED');
      return true;
    } catch (error) {
      console.log('❌ Smoke Test FAILED:', error.message);
      return false;
    }
  }
}

/**
 * Quick test function for development use
 */
export async function runQuickTest() {
  const tester = new CopySystemTester();
  return await tester.smokeTest();
}

/**
 * Full test function for comprehensive validation
 */
export async function runFullTest() {
  const tester = new CopySystemTester();
  return await tester.runAllTests();
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testCopySystem = {
    quick: runQuickTest,
    full: runFullTest,
    tester: CopySystemTester
  };
}

export default CopySystemTester;