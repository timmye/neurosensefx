/**
 * Global Test Teardown
 *
 * Cleans up resources and generates final reports after comprehensive testing.
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function globalTeardown(config) {
  console.log('🧹 Global Test Teardown - Cleaning Up Real-World Testing Environment');
  console.log('='.repeat(70));

  try {
    // Collect final system metrics
    const finalSystemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
      uptime: require('os').uptime(),
      timestamp: new Date().toISOString()
    };

    console.log('📊 Final System Metrics:');
    console.log(`  Free Memory: ${(finalSystemInfo.freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`  System Uptime: ${(finalSystemInfo.uptime / 3600).toFixed(2)} hours`);

    // Generate cleanup summary
    const cleanupSummary = {
      testCompletedAt: new Date().toISOString(),
      systemInfo: finalSystemInfo,
      testResultsLocation: 'test-results/',
      artifacts: {
        htmlReport: 'test-results/html-report/index.html',
        jsonResults: 'test-results/results.json',
        junitResults: 'test-results/results.xml',
        videos: 'test-results/videos/',
        screenshots: 'test-results/screenshots/',
        traces: 'test-results/traces/'
      }
    };

    // Save cleanup summary
    writeFileSync(
      join('test-results', 'cleanup-summary.json'),
      JSON.stringify(cleanupSummary, null, 2)
    );

    console.log('💾 Cleanup summary saved to test-results/cleanup-summary.json');

    // Cleanup any orphaned processes (if running in CI)
    if (process.env.CI) {
      try {
        console.log('🔧 Cleaning up orphaned processes...');
        execSync('pkill -f "playwright" || true', { encoding: 'utf8' });
        execSync('pkill -f "chromium" || true', { encoding: 'utf8' });
        console.log('✅ Orphaned processes cleaned up');
      } catch (error) {
        console.log('⚠️ No orphaned processes to clean up');
      }
    }

    console.log('✅ Global test teardown completed');
    console.log('='.repeat(70));
    console.log('📊 Test results and artifacts available in test-results/');
    console.log('📈 HTML report: test-results/html-report/index.html');

  } catch (error) {
    console.error('❌ Global test teardown failed:', error.message);
    // Don't throw error to avoid masking test results
  }
}

export default globalTeardown;