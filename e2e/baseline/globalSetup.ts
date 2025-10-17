// Global Setup for Workflow-Based Baseline Tests
// Prepares environment for workflow testing

import { chromium, FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function globalSetup(config: FullConfig) {
  console.log('\n=== Global Setup: Workflow-Based Baseline Tests ===');
  console.log('Preparing environment for workflow testing...');
  
  // Create test results directory if it doesn't exist
  const testResultsDir = path.join(process.cwd(), 'test-results', 'workflows');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
    console.log(`Created test results directory: ${testResultsDir}`);
  }
  
  // Create logs directory
  const logsDir = path.join(testResultsDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(`Created logs directory: ${logsDir}`);
  }
  
  // Check if services are already running before cleanup
  console.log('Checking service status...');
  try {
    const statusOutput = execSync('./run.sh status', { encoding: 'utf8', stdio: 'pipe' });
    if (statusOutput.includes('RUNNING')) {
      console.log('✓ Services are already running, skipping cleanup');
    } else {
      console.log('Services not running, cleaning up any existing processes...');
      execSync('./run.sh cleanup', { stdio: 'pipe' });
      console.log('✓ Cleanup completed');
    }
  } catch (error) {
    console.log('⚠ Could not check service status, proceeding with cleanup...');
    try {
      execSync('./run.sh cleanup', { stdio: 'pipe' });
      console.log('✓ Cleanup completed');
    } catch (cleanupError) {
      console.log('⚠ Cleanup command failed (may be expected if no processes running)');
    }
  }
  
  // Wait a moment for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ Global setup completed');
  console.log('Ready to run workflow-based baseline tests\n');
}

export default globalSetup;