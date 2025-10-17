// Global Teardown for Workflow-Based Baseline Tests
// Cleans up environment after workflow testing

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function globalTeardown(config: FullConfig) {
  console.log('\n=== Global Teardown: Workflow-Based Baseline Tests ===');
  console.log('Cleaning up after workflow testing...');
  
  // Generate test summary
  
  const testResultsDir = path.join(process.cwd(), 'test-results', 'workflows');
  const summaryPath = path.join(testResultsDir, 'test-summary.json');
  
  try {
    // Check if test results exist
    if (fs.existsSync(testResultsDir)) {
      const files = fs.readdirSync(testResultsDir);
      const testFiles = files.filter((file: string) => file.endsWith('.json'));
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: testFiles.length,
        testFiles: testFiles,
        testResultsDir: testResultsDir
      };
      
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      console.log(`✓ Test summary created: ${summaryPath}`);
    }
  } catch (error) {
    console.log(`⚠ Could not create test summary: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Clean up browser processes
  console.log('Cleaning up browser processes...');
  try {
    
    // Kill any remaining browser processes
    execSync('pkill -f chromium || true', { stdio: 'pipe' });
    execSync('pkill -f playwright || true', { stdio: 'pipe' });
    
    console.log('✓ Browser processes cleaned up');
  } catch (error) {
    console.log('⚠ Browser cleanup failed (may be expected)');
  }
  
  // Optional: Stop services if they were started for testing
  if (process.env.STOP_SERVICES_AFTER_TESTS === 'true') {
    console.log('Stopping services...');
    try {
      execSync('./run.sh stop', { stdio: 'pipe' });
      console.log('✓ Services stopped');
    } catch (error) {
      console.log('⚠ Service stop failed');
    }
  }
  
  console.log('✅ Global teardown completed');
  console.log('Workflow-based baseline tests finished\n');
}

export default globalTeardown;