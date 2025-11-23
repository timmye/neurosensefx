/**
 * Extended Session Integration
 *
 * Integration layer for the complete extended session testing framework.
 * Provides a unified interface and orchestrates all components.
 */

import { RealExtendedSessionTester } from './RealExtendedSessionTester.js';
import { SessionOptimizer } from './SessionOptimizer.js';

export class ExtendedSessionIntegration {
  constructor() {
    this.tester = null;
    this.optimizer = null;
    this.isInitialized = false;
    this.integrationOptions = {
      enableAutomaticOptimization: true,
      optimizationInterval: 60000, // 1 minute
      enableDetailedLogging: true,
      enableProgressTracking: true,
      enableAlertNotifications: true
    };
    this.sessionMetadata = {
      startTime: null,
      endTime: null,
      duration: null,
      status: 'idle'
    };
    this.progressCallbacks = new Set();
    this.alertCallbacks = new Set();
  }

  /**
   * Initialize the complete extended session testing system
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      console.warn('Extended session integration already initialized');
      return;
    }

    // Merge integration options
    this.integrationOptions = { ...this.integrationOptions, ...options };

    console.log('🔧 Initializing Extended Session Testing System...');
    console.log('⚙️ Integration options:', this.integrationOptions);

    // Initialize main tester
    this.tester = new RealExtendedSessionTester({
      sessionDuration: options.sessionDuration || 8 * 60 * 60 * 1000, // 8 hours
      memorySnapshotInterval: options.memorySnapshotInterval || 30000,
      healthCheckInterval: options.healthCheckInterval || 60000,
      reportingInterval: options.reportingInterval || 15 * 60 * 1000,
      enableRealTimeReporting: this.integrationOptions.enableDetailedLogging,
      enableMemoryLeakDetection: true,
      enableProfessionalTradingSimulation: true,
      enableAutomatedAlerts: this.integrationOptions.enableAlertNotifications,
      ...options.testerOptions
    });

    // Initialize optimizer
    this.optimizer = new SessionOptimizer();

    // Set up integration hooks
    this.setupIntegrationHooks();

    this.isInitialized = true;
    console.log('✅ Extended Session Testing System initialized successfully');

    return {
      tester: this.tester,
      optimizer: this.optimizer,
      options: this.integrationOptions
    };
  }

  /**
   * Start a complete extended session test
   */
  async startExtendedSessionTest(testConfig = {}) {
    if (!this.isInitialized) {
      throw new Error('Extended session integration not initialized');
    }

    console.log('🚀 Starting Extended Session Test...');
    this.sessionMetadata.status = 'starting';
    this.sessionMetadata.startTime = Date.now();

    try {
      // Initialize components
      await this.tester.initialize(testConfig);
      await this.optimizer.initialize({
        sessionId: 'optimizer_' + Date.now(),
        ...testConfig.optimizerOptions
      });

      // Start automatic optimization if enabled
      if (this.integrationOptions.enableAutomaticOptimization) {
        this.optimizer.startAutomaticOptimization(this.integrationOptions.optimizationInterval);
        console.log('⚡ Automatic optimization started');
      }

      // Start the main session test
      const sessionInfo = await this.tester.startSession(testConfig);

      this.sessionMetadata.status = 'running';
      this.sessionMetadata.duration = sessionInfo.duration;

      // Set up progress tracking if enabled
      if (this.integrationOptions.enableProgressTracking) {
        this.startProgressTracking();
      }

      console.log('✅ Extended Session Test started successfully');
      console.log('📊 Session info:', sessionInfo);

      // Set up session monitoring
      this.setupSessionMonitoring();

      return {
        success: true,
        sessionInfo,
        integrationStatus: this.getSessionStatus()
      };

    } catch (error) {
      this.sessionMetadata.status = 'error';
      console.error('❌ Failed to start Extended Session Test:', error);
      throw error;
    }
  }

  /**
   * Stop the extended session test
   */
  async stopExtendedSessionTest() {
    if (!this.isInitialized || this.sessionMetadata.status !== 'running') {
      console.warn('No active session to stop');
      return null;
    }

    console.log('🛑 Stopping Extended Session Test...');
    this.sessionMetadata.status = 'stopping';

    try {
      // Stop automatic optimization
      if (this.integrationOptions.enableAutomaticOptimization) {
        this.optimizer.stopAutomaticOptimization();
      }

      // Stop the main session test
      const finalReport = await this.tester.stopSession();

      this.sessionMetadata.endTime = Date.now();
      this.sessionMetadata.status = 'completed';

      // Generate integration report
      const integrationReport = await this.generateIntegrationReport(finalReport);

      console.log('✅ Extended Session Test completed successfully');

      return {
        success: true,
        finalReport,
        integrationReport,
        sessionMetadata: this.sessionMetadata
      };

    } catch (error) {
      this.sessionMetadata.status = 'error';
      console.error('❌ Failed to stop Extended Session Test:', error);
      throw error;
    }
  }

  /**
   * Get current session status
   */
  getSessionStatus() {
    if (!this.isInitialized) {
      return {
        status: 'not_initialized',
        message: 'Extended session integration not initialized'
      };
    }

    const testerStatus = this.tester ? this.tester.getSessionStatus() : null;
    const optimizerStats = this.optimizer ? this.optimizer.getOptimizationStats() : null;

    return {
      integration: {
        initialized: this.isInitialized,
        automaticOptimization: this.integrationOptions.enableAutomaticOptimization,
        detailedLogging: this.integrationOptions.enableDetailedLogging,
        progressTracking: this.integrationOptions.enableProgressTracking
      },
      session: this.sessionMetadata,
      tester: testerStatus,
      optimizer: optimizerStats,
      timestamp: Date.now()
    };
  }

  /**
   * Subscribe to progress updates
   */
  subscribeToProgress(callback) {
    this.progressCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(callback) {
    this.alertCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  /**
   * Trigger manual optimization
   */
  async triggerManualOptimization() {
    if (!this.optimizer) {
      throw new Error('Optimizer not initialized');
    }

    console.log('⚡ Triggering manual optimization...');
    const result = await this.optimizer.performAutomaticOptimization();

    console.log('📊 Manual optimization result:', {
      strategiesExecuted: result.strategiesExecuted.length,
      memoryReclaimed: (result.totalMemoryReclaimed / (1024 * 1024)).toFixed(2) + ' MB',
      performanceGain: result.totalPerformanceGain.toFixed(2) + '%'
    });

    return result;
  }

  /**
   * Force garbage collection
   */
  async forceGarbageCollection() {
    if (!this.tester) {
      throw new Error('Tester not initialized');
    }

    console.log('🗑️ Forcing garbage collection...');
    await this.tester.forceGarbageCollection();
  }

  /**
   * Generate intermediate progress report
   */
  async generateProgressReport() {
    if (!this.isInitialized || !this.tester) {
      return { error: 'System not initialized' };
    }

    const sessionStatus = this.tester.getSessionStatus();
    const optimizerStats = this.optimizer ? this.optimizer.getOptimizationStats() : null;

    const report = {
      timestamp: Date.now(),
      sessionId: sessionStatus.sessionId,
      progress: {
        elapsed: sessionStatus.elapsed,
        remaining: sessionStatus.remaining,
        percentage: sessionStatus.progress,
        estimatedCompletion: sessionStatus.startTime + sessionStatus.remaining
      },
      statistics: {
        memorySnapshots: sessionStatus.memorySnapshots,
        alerts: sessionStatus.alerts,
        tradingOperations: sessionStatus.tradingOperations,
        optimizationCycles: optimizerStats ? optimizerStats.optimizationCycles : 0,
        totalMemoryReclaimed: optimizerStats ? optimizerStats.totalMemoryReclaimed : 0
      },
      health: {
        status: this.sessionMetadata.status,
        automaticOptimization: this.integrationOptions.enableAutomaticOptimization
      }
    };

    // Notify progress callbacks
    this.notifyProgressCallbacks(report);

    return report;
  }

  /**
   * Set up integration hooks
   */
  setupIntegrationHooks() {
    // Override tester alert handling to integrate with our callback system
    if (this.tester) {
      const originalTriggerAlert = this.tester.triggerAlert.bind(this.tester);
      this.tester.triggerAlert = (alert) => {
        // Call original method
        originalTriggerAlert(alert);

        // Notify our alert callbacks
        this.notifyAlertCallbacks(alert);
      };
    }
  }

  /**
   * Set up session monitoring
   */
  setupSessionMonitoring() {
    if (!this.integrationOptions.enableDetailedLogging) return;

    // Log periodic status updates
    const monitoringInterval = setInterval(() => {
      if (this.sessionMetadata.status !== 'running') {
        clearInterval(monitoringInterval);
        return;
      }

      const status = this.getSessionStatus();
      console.log('📊 Session Status Update:', {
        status: status.session.status,
        elapsed: status.tester ? (status.tester.elapsed / (1000 * 60)).toFixed(1) + ' min' : 'N/A',
        progress: status.tester ? status.tester.progress : 'N/A',
        alerts: status.tester ? status.tester.alerts : 0,
        optimizations: status.optimizer ? status.optimizer.optimizationCycles : 0
      });

    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Start progress tracking
   */
  startProgressTracking() {
    const progressInterval = setInterval(() => {
      if (this.sessionMetadata.status !== 'running') {
        clearInterval(progressInterval);
        return;
      }

      this.generateProgressReport();
    }, 60000); // Every minute

    // Generate initial progress report
    this.generateProgressReport();
  }

  /**
   * Notify progress callbacks
   */
  notifyProgressCallbacks(report) {
    for (const callback of this.progressCallbacks) {
      try {
        callback(report);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    }
  }

  /**
   * Notify alert callbacks
   */
  notifyAlertCallbacks(alert) {
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    }
  }

  /**
   * Generate integration report
   */
  async generateIntegrationReport(finalReport) {
    const optimizerStats = this.optimizer ? this.optimizer.getOptimizationStats() : null;
    const integrationRecommendations = this.optimizer ? this.optimizer.generateRecommendations() : [];

    return {
      integration: {
        sessionId: this.sessionMetadata.startTime,
        startTime: this.sessionMetadata.startTime,
        endTime: this.sessionMetadata.endTime,
        totalDuration: this.sessionMetadata.endTime - this.sessionMetadata.startTime,
        durationHours: ((this.sessionMetadata.endTime - this.sessionMetadata.startTime) / (1000 * 60 * 60)).toFixed(2),
        status: this.sessionMetadata.status,
        options: this.integrationOptions
      },
      optimization: optimizerStats ? {
        totalOptimizationCycles: optimizerStats.optimizationCycles,
        totalMemoryReclaimed: (optimizerStats.totalMemoryReclaimed / (1024 * 1024)).toFixed(2) + ' MB',
        totalPerformanceGain: optimizerStats.totalPerformanceGain.toFixed(2) + '%',
        garbageCollectionStats: optimizerStats.garbageCollectionStats,
        mostUsedStrategies: optimizerStats.mostUsedStrategies,
        recommendations: integrationRecommendations
      } : null,
      finalTestReport: finalReport,
      integrationGrade: this.calculateIntegrationGrade(finalReport, optimizerStats)
    };
  }

  /**
   * Calculate overall integration grade
   */
  calculateIntegrationGrade(finalReport, optimizerStats) {
    let score = 0;
    const weights = {
      testPerformance: 0.6,
      optimizationEffectiveness: 0.4
    };

    // Test performance score (from final report)
    const testScore = finalReport.overallGrade ? parseFloat(finalReport.overallGrade.score) : 0;
    score += testScore * weights.testPerformance;

    // Optimization effectiveness score
    if (optimizerStats) {
      const optimizationScore = this.calculateOptimizationScore(optimizerStats);
      score += optimizationScore * weights.optimizationEffectiveness;
    }

    // Convert to grade
    let grade = 'A';
    if (score < 60) grade = 'F';
    else if (score < 70) grade = 'D';
    else if (score < 80) grade = 'C';
    else if (score < 90) grade = 'B';

    return {
      score: score.toFixed(1),
      grade,
      message: this.getGradeMessage(grade),
      breakdown: {
        testPerformance: (testScore * weights.testPerformance).toFixed(1),
        optimizationEffectiveness: optimizerStats ?
          (this.calculateOptimizationScore(optimizerStats) * weights.optimizationEffectiveness).toFixed(1) : 'N/A'
      }
    };
  }

  /**
   * Calculate optimization effectiveness score
   */
  calculateOptimizationScore(optimizerStats) {
    let score = 50; // Base score

    // Memory reclamation effectiveness
    if (optimizerStats.totalMemoryReclaimed > 100 * 1024 * 1024) { // More than 100MB
      score += 20;
    } else if (optimizerStats.totalMemoryReclaimed > 50 * 1024 * 1024) { // More than 50MB
      score += 10;
    }

    // Performance gains
    if (optimizerStats.totalPerformanceGain > 20) {
      score += 20;
    } else if (optimizerStats.totalPerformanceGain > 10) {
      score += 10;
    }

    // Garbage collection effectiveness
    if (optimizerStats.garbageCollectionStats.effectiveGCs > 0) {
      const gcEffectiveness = optimizerStats.garbageCollectionStats.effectiveGCs /
                               optimizerStats.garbageCollectionStats.forcedGCs;
      score += Math.min(10, gcEffectiveness * 10);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get grade message
   */
  getGradeMessage(grade) {
    const messages = {
      'A': 'Excellent integration - optimal system performance and optimization',
      'B': 'Good integration - solid performance with room for improvement',
      'C': 'Acceptable integration - meets basic requirements',
      'D': 'Poor integration - significant issues detected',
      'F': 'Fail - critical problems require immediate attention'
    };
    return messages[grade] || 'Unknown grade';
  }

  /**
   * Cleanup all integration resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up Extended Session Integration...');

    // Stop any running processes
    if (this.sessionMetadata.status === 'running') {
      await this.stopExtendedSessionTest();
    }

    // Cleanup components
    if (this.optimizer) {
      this.optimizer.cleanup();
    }

    // Clear callbacks
    this.progressCallbacks.clear();
    this.alertCallbacks.clear();

    // Reset state
    this.sessionMetadata = {
      startTime: null,
      endTime: null,
      duration: null,
      status: 'idle'
    };

    this.isInitialized = false;

    console.log('✅ Extended Session Integration cleaned up');
  }

  /**
   * Export session data for external analysis
   */
  async exportSessionData(format = 'json') {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }

    const exportData = {
      timestamp: Date.now(),
      sessionId: this.sessionMetadata.startTime,
      integrationOptions: this.integrationOptions,
      sessionMetadata: this.sessionMetadata,
      sessionStatus: this.getSessionStatus(),
      progressHistory: this.getProgressHistory(),
      alertHistory: this.getAlertHistory()
    };

    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
      case 'csv':
        return this.convertToCSV(exportData);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get progress history (simplified)
   */
  getProgressHistory() {
    // This would need to be implemented to track actual progress history
    return [];
  }

  /**
   * Get alert history (simplified)
   */
  getAlertHistory() {
    // This would need to be implemented to track actual alert history
    return [];
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    // Simplified CSV conversion
    const rows = [];
    rows.push('Timestamp,Session Status,Elapsed,Progress,Alerts');

    if (data.sessionStatus && data.sessionStatus.tester) {
      const { status, elapsed, progress, alerts } = data.sessionStatus.tester;
      rows.push(`${new Date(data.timestamp).toISOString()},${status},${elapsed || 0},${progress || 0},${alerts || 0}`);
    }

    return rows.join('\n');
  }
}

// Export convenience functions for quick usage
export async function createExtendedSessionTester(options = {}) {
  const integration = new ExtendedSessionIntegration();
  await integration.initialize(options);
  return integration;
}

export async function runExtendedSessionTest(durationMs = 8 * 60 * 60 * 1000, options = {}) {
  const integration = new ExtendedSessionIntegration();
  await integration.initialize({ ...options, sessionDuration: durationMs });

  try {
    const startResult = await integration.startExtendedSessionTest(options);

    // Wait for session to complete (in real usage, this would be event-driven)
    if (durationMs > 0) {
      await new Promise(resolve => setTimeout(resolve, durationMs));
    }

    const stopResult = await integration.stopExtendedSessionTest();

    return {
      start: startResult,
      stop: stopResult,
      success: true
    };

  } catch (error) {
    await integration.cleanup();
    throw error;
  }
}

export default ExtendedSessionIntegration;