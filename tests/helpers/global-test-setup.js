/**
 * Global Test Setup
 *
 * Sets up the environment for comprehensive real-world testing
 * with complete system visibility and professional trading scenarios.
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import os from 'os';

async function globalSetup(config) {
  console.log('🌟 Global Test Setup - Initializing Real-World Testing Environment');
  console.log('='.repeat(70));

  // Verify environment prerequisites
  try {
    console.log('🔍 Verifying environment prerequisites...');

    // Check if application is running
    const appCheck = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:5174', { encoding: 'utf8' });
    if (appCheck !== '200') {
      console.log('⚠️ Application not accessible at http://localhost:5174');
      console.log('   Starting application with ./run.sh dev...');

      try {
        execSync('./run.sh status', { encoding: 'utf8' });
        console.log('✅ Services are running');
      } catch (error) {
        console.log('❌ Services not running. Please start with: ./run.sh dev');
        process.exit(1);
      }
    } else {
      console.log('✅ Application is accessible');
    }

    // Check WebSocket backend
    try {
      const wsCheck = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080', { encoding: 'utf8' });
      if (wsCheck === '200') {
        console.log('✅ WebSocket backend is accessible');
      } else {
        console.log('⚠️ WebSocket backend not accessible - tests may have limited data connectivity');
      }
    } catch (error) {
      console.log('⚠️ WebSocket backend check failed - continuing with tests');
    }

    // Create test results directory
    try {
      execSync('mkdir -p test-results/videos test-results/screenshots test-results/traces', { encoding: 'utf8' });
      console.log('✅ Test results directories created');
    } catch (error) {
      console.log('⚠️ Could not create test results directories');
    }

    // Initialize system monitoring
    console.log('📊 Initializing system monitoring...');

    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      timestamp: new Date().toISOString()
    };

    console.log(`System Info:`);
    console.log(`  Node.js: ${systemInfo.nodeVersion}`);
    console.log(`  Platform: ${systemInfo.platform} (${systemInfo.arch})`);
    console.log(`  CPUs: ${systemInfo.cpus}`);
    console.log(`  Total Memory: ${(systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  Free Memory: ${(systemInfo.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);

    // Store system info for test files
    process.env.TEST_SYSTEM_INFO = JSON.stringify(systemInfo);

    console.log('✅ Global test setup completed');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Global test setup failed:', error.message);
    throw error;
  }
}

export default globalSetup;