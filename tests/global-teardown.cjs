/**
 * Global Teardown for Unified Console Infrastructure
 *
 * Cleans up correlation manager, unified reporter, browser log capture,
 * and build log capture after all tests complete.
 */

const fs = require('fs');
const path = require('path');

async function globalTeardown() {
  console.log('🏁 Shutting down Unified Console Infrastructure...');

  try {
    // End global test run correlation
    if (global.testRunCorrelation && global.correlationManager) {
      global.correlationManager.endCorrelation(
        global.testRunCorrelation.id,
        'completed',
        {
          timestamp: new Date().toISOString(),
          shutdownReason: 'global_teardown'
        }
      );
    }

    // Stop all build processes
    if (global.buildLogCapture) {
      const stoppedBuilds = global.buildLogCapture.stopAllBuilds();
      if (stoppedBuilds.length > 0) {
        console.log(`🛑 Stopped ${stoppedBuilds.length} build processes`);
      }
    }

    // Export final correlation data for analysis
    if (global.correlationManager) {
      const exportData = global.correlationManager.exportCorrelationData();
      const exportPath = 'test-results/correlation-export.json';

      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      console.log(`📊 Correlation data exported to: ${exportPath}`);

      // Export system health metrics
      const healthMetrics = global.correlationManager.getHealthMetrics();
      const healthPath = 'test-results/health-metrics.json';
      fs.writeFileSync(healthPath, JSON.stringify(healthMetrics, null, 2));
      console.log(`💊 Health metrics exported to: ${healthPath}`);
    }

    // Export build session data
    if (global.buildLogCapture) {
      const buildSummary = global.buildLogCapture.getBuildSummary();
      const buildPath = 'test-results/build-summary.json';
      fs.writeFileSync(buildPath, JSON.stringify(buildSummary, null, 2));
      console.log(`🏗️ Build summary exported to: ${buildPath}`);
    }

    // Export browser log data
    if (global.browserLogCapture) {
      const browserExport = global.browserLogCapture.exportAllSessionsReport();
      const browserPath = 'test-results/browser-sessions.json';
      fs.writeFileSync(browserPath, JSON.stringify(browserExport, null, 2));
      console.log(`🌐 Browser sessions exported to: ${browserPath}`);
    }

    // Generate final unified log summary
    const summaryData = {
      shutdownTime: new Date().toISOString(),
      testRunCorrelationId: global.testRunCorrelation?.id,
      systemHealth: global.correlationManager?.getHealthMetrics(),
      buildSummary: global.buildLogCapture?.getBuildSummary(),
      browserSessionCount: global.browserLogCapture?.activeSessions?.size || 0
    };

    const summaryPath = 'test-results/final-summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
    console.log(`📋 Final summary exported to: ${summaryPath}`);

    console.log('✅ Unified Console Infrastructure shutdown complete');

    return {
      success: true,
      shutdownTime: new Date().toISOString(),
      exports: [
        'test-results/correlation-export.json',
        'test-results/health-metrics.json',
        'test-results/build-summary.json',
        'test-results/browser-sessions.json',
        'test-results/final-summary.json'
      ]
    };

  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    return {
      success: false,
      error: error.message,
      shutdownTime: new Date().toISOString()
    };
  }
}

module.exports = globalTeardown;