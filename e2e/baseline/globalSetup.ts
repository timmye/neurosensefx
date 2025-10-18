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
  
  // Initialize test state isolation utilities
  console.log('Initializing test state isolation utilities...');
  try {
    // Launch a browser to set up test environment
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the application
    await page.goto('http://localhost:5173');
    
    // Wait for application to load
    await page.waitForSelector('.workspace-container', { timeout: 10000 });
    
    // Set up global test state isolation
    await page.evaluate(() => {
      // Extend window interface for test utilities
      (window as any).testCleanup = () => {
        // Clear workspace state
        if ((window as any).workspaceActions && (window as any).workspaceActions.clearWorkspace) {
          (window as any).workspaceActions.clearWorkspace();
        }
        
        // Reset symbol store to default state
        if ((window as any).symbolStore && (window as any).symbolStore.set) {
          (window as any).symbolStore.set({});
        }
        
        // Reset UI state
        if ((window as any).uiActions && (window as any).uiActions.hideAllPanels) {
          (window as any).uiActions.hideAllPanels();
        }
        
        // Clear any test-specific event listeners
        window.dispatchEvent(new CustomEvent('clearTestState'));
      };
      
      // Store test utilities for use in tests
      (window as any).testUtils = {
        cleanup: (window as any).testCleanup,
        resetState: (window as any).testCleanup
      };
    });
    
    await context.close();
    await browser.close();
    console.log('✓ Test state isolation utilities initialized');
  } catch (error) {
    console.log('⚠ Could not initialize test utilities (will be initialized in tests):', (error as Error).message);
  }
  
  console.log('✅ Global setup completed');
  console.log('Ready to run workflow-based baseline tests\n');
}

export default globalSetup;