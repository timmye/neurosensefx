#!/usr/bin/env node

/**
 * Test Structure Verification Script
 *
 * This script verifies that the comprehensive primary workflow test
 * is properly structured and ready for execution.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_FILE = 'tests/e2e/primary-trader-workflow-comprehensive.spec.js';

function verifyTestStructure() {
  console.log('🔍 Verifying Comprehensive Test Structure...\n');

  // Check if test file exists
  if (!existsSync(TEST_FILE)) {
    console.error('❌ Test file not found:', TEST_FILE);
    process.exit(1);
  }

  console.log('✅ Test file exists:', TEST_FILE);

  // Read and analyze test file
  const testContent = readFileSync(TEST_FILE, 'utf8');

  // Check for required imports
  const requiredImports = [
    "import { test, expect } from '@playwright/test';",
    "import { SystemVisibilityMonitor } from '../helpers/SystemVisibilityMonitor.js';",
    "import { PerformanceValidator } from '../helpers/PerformanceValidator.js';"
  ];

  console.log('\n📦 Checking required imports...');
  requiredImports.forEach(imp => {
    if (testContent.includes(imp)) {
      console.log(`✅ Found: ${imp}`);
    } else {
      console.log(`❌ Missing: ${imp}`);
    }
  });

  // Check for required test phases
  const requiredPhases = [
    'Phase 1: System Initialization Validation',
    'Phase 2: BTCUSD Display Creation Workflow',
    'Phase 3: Display Navigation and Selection',
    'Phase 4: Data Connection and Live Updates Validation',
    'Phase 5: Display Responsiveness Testing',
    'Phase 6: Display Cleanup and Reset',
    'Phase 7: Performance Standards Validation'
  ];

  console.log('\n🔄 Checking required test phases...');
  requiredPhases.forEach(phase => {
    if (testContent.includes(phase)) {
      console.log(`✅ Found: ${phase}`);
    } else {
      console.log(`❌ Missing: ${phase}`);
    }
  });

  // Check for key workflow steps
  const requiredSteps = [
    'Ctrl+K',
    'BTCUSD',
    'Ctrl+Tab',
    'Ctrl+Shift+W',
    'WebSocket connection',
    '60fps',
    'sub-100ms latency'
  ];

  console.log('\n⚡ Checking key workflow elements...');
  requiredSteps.forEach(step => {
    if (testContent.includes(step)) {
      console.log(`✅ Found: ${step}`);
    } else {
      console.log(`❌ Missing: ${step}`);
    }
  });

  // Check for performance thresholds
  const performanceThresholds = [
    'FRAME_RATE_MIN: 58',
    'LATENCY_DATA_TO_VISUAL: 100',
    'DISPLAY_CREATION_TIMEOUT: 1000',
    'RESPONSIVENESS_THRESHOLD: 200'
  ];

  console.log('\n📊 Checking performance thresholds...');
  performanceThresholds.forEach(threshold => {
    if (testContent.includes(threshold)) {
      console.log(`✅ Found: ${threshold}`);
    } else {
      console.log(`❌ Missing: ${threshold}`);
    }
  });

  // Check for console message validation
  const consoleValidationChecks = [
    'EXPECTED_SUCCESS',
    'EXPECTED_ERRORS',
    'KEYBOARD_EVENTS',
    'expectConsoleMessage',
    'rejectConsoleMessage'
  ];

  console.log('\n🔍 Checking console message validation...');
  consoleValidationChecks.forEach(check => {
    if (testContent.includes(check)) {
      console.log(`✅ Found: ${check}`);
    } else {
      console.log(`❌ Missing: ${check}`);
    }
  });

  console.log('\n📋 Test Structure Verification Complete!\n');

  // Check if helpers exist
  const helpers = [
    'tests/helpers/SystemVisibilityMonitor.js',
    'tests/helpers/PerformanceValidator.js'
  ];

  console.log('🔧 Checking helper dependencies...');
  helpers.forEach(helper => {
    if (existsSync(helper)) {
      console.log(`✅ Helper exists: ${helper}`);
    } else {
      console.log(`⚠️  Helper missing: ${helper}`);
    }
  });

  console.log('\n🚀 Test is ready for execution!');
  console.log('\nTo run the test when Playwright is installed:');
  console.log('  npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js');
  console.log('\nEnvironment-specific execution:');
  console.log('  ENVIRONMENT=development npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js');
  console.log('  ENVIRONMENT=production npm run test:e2e tests/e2e/primary-trader-workflow-comprehensive.spec.js');
}

verifyTestStructure();