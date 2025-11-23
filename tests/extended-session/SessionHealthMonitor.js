/**
 * Session Health Monitor
 *
 * Comprehensive health monitoring system for extended trading sessions.
 * Monitors performance metrics, system stability, and professional trading readiness.
 */

export class SessionHealthMonitor {
  constructor() {
    this.sessionId = null;
    this.isInitialized = false;
    this.checkInterval = null;
    this.healthHistory = [];
    this.alertThresholds = {
      maxMemoryGrowthMB: 100,
      maxMemoryLeakRateMBPerHour: 10,
      minPerformanceScore: 80,
      maxResponseTime: 100,
      minFrameRate: 55,
      maxJankPercentage: 5
    };
    this.currentStatus = {
      overall: 'healthy',
      memory: 'healthy',
      performance: 'healthy',
      trading: 'healthy',
      score: 100
    };
    this.lastHealthCheck = null;
    this.consecutiveFailures = 0;
  }

  async initialize(options = {}) {
    this.sessionId = options.sessionId;
    this.healthHistory = [];

    // Merge custom thresholds
    if (options.thresholds) {
      this.alertThresholds = { ...this.alertThresholds, ...options.thresholds };
    }

    this.isInitialized = true;
    console.log('🏥 Session Health Monitor initialized');
    console.log('📊 Alert thresholds:', this.alertThresholds);
  }

  /**
   * Start periodic health monitoring
   */
  startPeriodicMonitoring(intervalMs = 60000) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.performScheduledHealthCheck();
    }, intervalMs);

    console.log(`🔄 Started periodic health monitoring (${intervalMs / 1000}s intervals)`);
  }

  /**
   * Stop periodic health monitoring
   */
  stopPeriodicMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Stopped periodic health monitoring');
    }
  }

  /**
   * Perform scheduled health check
   */
  async performScheduledHealthCheck() {
    const sessionData = this.gatherSessionData();
    return await this.performHealthCheck(sessionData);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(sessionData) {
    const check = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      duration: 0,
      overallScore: 100,
      categoryScores: {},
      alerts: [],
      issues: [],
      recommendations: []
    };

    const startTime = performance.now();

    try {
      // Memory health check
      const memoryHealth = await this.checkMemoryHealth(sessionData);
      check.categoryScores.memory = memoryHealth.score;
      check.alerts.push(...memoryHealth.alerts);
      check.issues.push(...memoryHealth.issues);

      // Performance health check
      const performanceHealth = await this.checkPerformanceHealth(sessionData);
      check.categoryScores.performance = performanceHealth.score;
      check.alerts.push(...performanceHealth.alerts);
      check.issues.push(...performanceHealth.issues);

      // Trading health check
      const tradingHealth = await this.checkTradingHealth(sessionData);
      check.categoryScores.trading = tradingHealth.score;
      check.alerts.push(...tradingHealth.alerts);
      check.issues.push(...tradingHealth.issues);

      // Calculate overall score
      check.overallScore = this.calculateOverallScore(check.categoryScores);
      check.status = this.determineOverallStatus(check.overallScore);

      // Generate recommendations
      check.recommendations = this.generateRecommendations(check);

      // Update current status
      this.currentStatus = {
        overall: check.status,
        memory: this.determineStatus(check.categoryScores.memory),
        performance: this.determineStatus(check.categoryScores.performance),
        trading: this.determineStatus(check.categoryScores.trading),
        score: check.overallScore
      };

      // Update consecutive failures counter
      if (check.status === 'critical' || check.status === 'unhealthy') {
        this.consecutiveFailures++;
      } else {
        this.consecutiveFailures = 0;
      }

      console.log(`🏥 Health check completed - Score: ${check.overallScore}/100 (${check.status})`);

    } catch (error) {
      console.error('Health check error:', error);
      check.error = error.message;
      check.overallScore = 0;
      check.status = 'error';
    }

    check.duration = performance.now() - startTime;
    this.lastHealthCheck = check;
    this.healthHistory.push(check);

    // Keep history manageable (last 100 checks)
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    return check;
  }

  /**
   * Check memory health
   */
  async checkMemoryHealth(sessionData) {
    const result = {
      score: 100,
      alerts: [],
      issues: []
    };

    try {
      if (!sessionData.memorySnapshots || sessionData.memorySnapshots.length < 2) {
        result.score = 90;
        result.issues.push({
          type: 'insufficient_data',
          category: 'memory',
          message: 'Insufficient memory data for comprehensive analysis'
        });
        return result;
      }

      const snapshots = sessionData.memorySnapshots;
      const recent = snapshots.slice(-10);
      const first = recent[0];
      const last = recent[recent.length - 1];

      // Memory growth analysis
      const memoryGrowth = last.usedJSHeapSize - first.usedJSHeapSize;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);
      const timeHours = (last.timestamp - first.timestamp) / (1000 * 60 * 60);
      const growthRate = timeHours > 0 ? memoryGrowthMB / timeHours : 0;

      // Memory utilization
      const memoryUtilization = last.usedJSHeapSize / last.jsHeapSizeLimit;

      // Score deductions
      if (memoryGrowthMB > this.alertThresholds.maxMemoryGrowthMB) {
        const deduction = Math.min(40, (memoryGrowthMB / this.alertThresholds.maxMemoryGrowthMB) * 40);
        result.score -= deduction;

        result.alerts.push({
          type: 'memory_growth',
          severity: memoryGrowthMB > this.alertThresholds.maxMemoryGrowthMB * 2 ? 'critical' : 'high',
          message: `Excessive memory growth: ${memoryGrowthMB.toFixed(1)}MB`,
          details: { memoryGrowthMB, growthRate: growthRate.toFixed(2) }
        });

        result.issues.push({
          type: 'memory_growth',
          category: 'memory',
          severity: 'high',
          description: `Memory growth exceeds threshold by ${(memoryGrowthMB / this.alertThresholds.maxMemoryGrowthMB).toFixed(1)}x`,
          impact: 'May indicate memory leaks or inefficient resource management'
        });
      }

      if (growthRate > this.alertThresholds.maxMemoryLeakRateMBPerHour) {
        const deduction = Math.min(30, (growthRate / this.alertThresholds.maxMemoryLeakRateMBPerHour) * 30);
        result.score -= deduction;

        result.alerts.push({
          type: 'memory_leak_rate',
          severity: 'high',
          message: `High memory leak rate: ${growthRate.toFixed(1)}MB/hr`,
          details: { growthRate }
        });
      }

      if (memoryUtilization > 0.85) {
        const deduction = Math.min(20, (memoryUtilization - 0.85) * 100);
        result.score -= deduction;

        result.alerts.push({
          type: 'memory_utilization',
          severity: memoryUtilization > 0.95 ? 'critical' : 'high',
          message: `High memory utilization: ${(memoryUtilization * 100).toFixed(1)}%`,
          details: { utilization: memoryUtilization }
        });
      }

      // Check for memory leaks
      if (sessionData.memoryLeaks && sessionData.memoryLeaks.length > 0) {
        const leakDeduction = Math.min(50, sessionData.memoryLeaks.length * 10);
        result.score -= leakDeduction;

        result.alerts.push({
          type: 'memory_leaks_detected',
          severity: 'critical',
          message: `${sessionData.memoryLeaks.length} memory leak(s) detected`,
          details: { leakCount: sessionData.memoryLeaks.length }
        });
      }

      result.memoryAnalysis = {
        currentMemory: last.usedJSHeapSizeMB,
        memoryGrowth: memoryGrowthMB.toFixed(2),
        growthRate: growthRate.toFixed(2),
        utilization: (memoryUtilization * 100).toFixed(1),
        snapshots: snapshots.length
      };

    } catch (error) {
      console.error('Memory health check error:', error);
      result.score = 0;
      result.issues.push({
        type: 'check_error',
        category: 'memory',
        message: `Memory health check failed: ${error.message}`
      });
    }

    return result;
  }

  /**
   * Check performance health
   */
  async checkPerformanceHealth(sessionData) {
    const result = {
      score: 100,
      alerts: [],
      issues: []
    };

    try {
      if (!sessionData.performanceMetrics || sessionData.performanceMetrics.length === 0) {
        result.score = 90;
        result.issues.push({
          type: 'insufficient_data',
          category: 'performance',
          message: 'No performance metrics available'
        });
        return result;
      }

      const metrics = sessionData.performanceMetrics.slice(-10);
      const frameRates = metrics.filter(m => m.frameRate).map(m => m.frameRate.fps);
      const responseTimes = metrics.filter(m => m.responseTime).map(m => m.responseTime);

      // Frame rate analysis
      if (frameRates.length > 0) {
        const avgFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
        const minFrameRate = Math.min(...frameRates);
        const frameRateScore = this.calculateFrameRateScore(avgFrameRate, minFrameRate);

        if (frameRateScore < 100) {
          result.score -= (100 - frameRateScore);
          result.alerts.push({
            type: 'low_frame_rate',
            severity: avgFrameRate < 30 ? 'critical' : 'high',
            message: `Low frame rate: ${avgFrameRate.toFixed(1)} FPS`,
            details: { average: avgFrameRate, minimum: minFrameRate }
          });
        }
      }

      // Response time analysis
      if (responseTimes.length > 0) {
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const maxResponseTime = Math.max(...responseTimes);

        if (avgResponseTime > this.alertThresholds.maxResponseTime) {
          const deduction = Math.min(30, (avgResponseTime / this.alertThresholds.maxResponseTime - 1) * 30);
          result.score -= deduction;

          result.alerts.push({
            type: 'slow_response',
            severity: avgResponseTime > this.alertThresholds.maxResponseTime * 2 ? 'critical' : 'high',
            message: `Slow response time: ${avgResponseTime.toFixed(1)}ms`,
            details: { average: avgResponseTime, maximum: maxResponseTime }
          });
        }
      }

      // Long tasks (jank) analysis
      const longTaskMetrics = metrics.filter(m => m.longTasks);
      if (longTaskMetrics.length > 0) {
        const totalLongTasks = longTaskMetrics.reduce((sum, m) => sum + m.longTasks.count, 0);
        const avgLongTaskDuration = longTaskMetrics.reduce((sum, m) => sum + m.longTasks.averageDuration, 0) / longTaskMetrics.length;

        if (totalLongTasks > 0) {
          const jankPercentage = (totalLongTasks / (metrics.length * 10)) * 100; // Assuming 10-second intervals

          if (jankPercentage > this.alertThresholds.maxJankPercentage) {
            const deduction = Math.min(25, (jankPercentage / this.alertThresholds.maxJankPercentage - 1) * 25);
            result.score -= deduction;

            result.alerts.push({
              type: 'jank_detected',
              severity: 'high',
              message: `Jank detected: ${jankPercentage.toFixed(1)}% of time`,
              details: { jankPercentage, totalLongTasks, avgDuration: avgLongTaskDuration }
            });
          }
        }
      }

      result.performanceAnalysis = {
        frameRateStats: this.calculateFrameRateStats(frameRates),
        responseTimeStats: this.calculateResponseTimeStats(responseTimes),
        longTaskAnalysis: this.analyzeLongTasks(longTaskMetrics)
      };

    } catch (error) {
      console.error('Performance health check error:', error);
      result.score = 0;
      result.issues.push({
        type: 'check_error',
        category: 'performance',
        message: `Performance health check failed: ${error.message}`
      });
    }

    return result;
  }

  /**
   * Check trading health
   */
  async checkTradingHealth(sessionData) {
    const result = {
      score: 100,
      alerts: [],
      issues: []
    };

    try {
      // Display health
      const displays = document.querySelectorAll('.enhanced-floating');
      const displayCount = displays.length;

      if (displayCount === 0) {
        result.score -= 50;
        result.alerts.push({
          type: 'no_displays',
          severity: 'high',
          message: 'No trading displays active',
          details: { displayCount }
        });
      }

      if (displayCount > 25) {
        result.score -= Math.min(30, (displayCount - 25) * 2);
        result.alerts.push({
          type: 'too_many_displays',
          severity: 'medium',
          message: `High display count: ${displayCount}`,
          details: { displayCount }
        });
      }

      // Canvas health
      const canvases = document.querySelectorAll('canvas');
      const unhealthyCanvases = [];

      canvases.forEach((canvas, index) => {
        if (canvas.width <= 0 || canvas.height <= 0) {
          unhealthyCanvases.push({ index, issue: 'invalid_dimensions' });
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          unhealthyCanvases.push({ index, issue: 'no_context' });
        }
      });

      if (unhealthyCanvases.length > 0) {
        const deduction = Math.min(40, unhealthyCanvases.length * 10);
        result.score -= deduction;

        result.alerts.push({
          type: 'canvas_issues',
          severity: 'high',
          message: `${unhealthyCanvases.length} canvas(es) unhealthy`,
          details: { unhealthyCanvases, totalCanvases: canvases.length }
        });
      }

      // Market data health
      if (window.marketDataBuffer && window.lastMarketDataUpdate) {
        const timeSinceLastUpdate = Date.now() - window.lastMarketDataUpdate;
        const updateFrequency = this.calculateUpdateFrequency();

        if (timeSinceLastUpdate > 5000) { // 5 seconds
          result.score -= 20;
          result.alerts.push({
            type: 'stale_market_data',
            severity: 'medium',
            message: `Stale market data: ${timeSinceLastUpdate}ms since last update`,
            details: { timeSinceLastUpdate, updateFrequency }
          });
        }

        if (updateFrequency && updateFrequency < 5) { // Less than 5 updates per second
          result.score -= 15;
          result.alerts.push({
            type: 'slow_market_updates',
            severity: 'medium',
            message: `Slow market updates: ${updateFrequency.toFixed(1)}/sec`,
            details: { updateFrequency }
          });
        }
      }

      // Professional trading requirements check
      const tradingReadiness = this.checkTradingReadiness();
      result.score *= tradingReadiness.score / 100;

      if (tradingReadiness.issues.length > 0) {
        result.issues.push(...tradingReadiness.issues);
      }

      result.tradingAnalysis = {
        displayCount,
        canvasCount: canvases.length,
        unhealthyCanvases: unhealthyCanvases.length,
        marketDataHealth: this.checkMarketDataHealth(),
        tradingReadiness
      };

    } catch (error) {
      console.error('Trading health check error:', error);
      result.score = 0;
      result.issues.push({
        type: 'check_error',
        category: 'trading',
        message: `Trading health check failed: ${error.message}`
      });
    }

    return result;
  }

  /**
   * Calculate frame rate score
   */
  calculateFrameRateScore(avg, min) {
    let score = 100;

    if (avg < 30) {
      score = 0;
    } else if (avg < 45) {
      score = 40;
    } else if (avg < 55) {
      score = 70;
    }

    // Penalty for low minimum frame rate
    if (min < 30) {
      score -= 20;
    } else if (min < 45) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate frame rate statistics
   */
  calculateFrameRateStats(frameRates) {
    if (frameRates.length === 0) return null;

    const avg = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
    const min = Math.min(...frameRates);
    const max = Math.max(...frameRates);
    const stdDev = Math.sqrt(frameRates.reduce((sum, fps) => sum + Math.pow(fps - avg, 2), 0) / frameRates.length);

    return {
      average: avg.toFixed(1),
      minimum: min,
      maximum: max,
      standardDeviation: stdDev.toFixed(2),
      measurements: frameRates.length
    };
  }

  /**
   * Calculate response time statistics
   */
  calculateResponseTimeStats(responseTimes) {
    if (responseTimes.length === 0) return null;

    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const min = Math.min(...responseTimes);
    const max = Math.max(...responseTimes);

    return {
      average: avg.toFixed(2),
      minimum: min.toFixed(2),
      maximum: max.toFixed(2),
      measurements: responseTimes.length
    };
  }

  /**
   * Analyze long tasks
   */
  analyzeLongTasks(longTaskMetrics) {
    if (longTaskMetrics.length === 0) return null;

    const totalTasks = longTaskMetrics.reduce((sum, m) => sum + m.longTasks.count, 0);
    const totalDuration = longTaskMetrics.reduce((sum, m) => sum + m.longTasks.totalDuration, 0);
    const avgDuration = totalDuration / totalTasks;

    return {
      totalTasks,
      totalDuration: totalDuration.toFixed(0),
      averageDuration: avgDuration.toFixed(1),
      tasksPerHour: (totalTasks / (longTaskMetrics.length * 10) * 3600).toFixed(1)
    };
  }

  /**
   * Check trading readiness
   */
  checkTradingReadiness() {
    const result = {
      score: 100,
      issues: []
    };

    // Check minimum requirements for professional trading
    const displays = document.querySelectorAll('.enhanced-floating').length;
    if (displays < 3) {
      result.score -= 30;
      result.issues.push({
        type: 'insufficient_displays',
        description: 'Professional trading requires at least 3 displays',
        impact: 'Limited market visibility'
      });
    }

    // Check for essential keyboard shortcuts
    if (!this.keyboardShortcutsWorking()) {
      result.score -= 20;
      result.issues.push({
        type: 'keyboard_shortcuts_broken',
        description: 'Essential keyboard shortcuts not working',
        impact: 'Reduced trading efficiency'
      });
    }

    // Check WebSocket connectivity (if applicable)
    if (!this.webSocketHealthy()) {
      result.score -= 25;
      result.issues.push({
        type: 'connectivity_issues',
        description: 'Real-time data connectivity issues',
        impact: 'Delayed market information'
      });
    }

    return result;
  }

  /**
   * Check if keyboard shortcuts are working
   */
  keyboardShortcutsWorking() {
    // This would need to be implemented based on actual keyboard shortcut system
    return true; // Placeholder
  }

  /**
   * Check WebSocket health
   */
  webSocketHealthy() {
    // This would need to be implemented based on actual WebSocket system
    return true; // Placeholder
  }

  /**
   * Check market data health
   */
  checkMarketDataHealth() {
    if (!window.marketDataBuffer || !window.lastMarketDataUpdate) {
      return {
        status: 'unavailable',
        lastUpdate: null,
        updateFrequency: null
      };
    }

    const timeSinceLastUpdate = Date.now() - window.lastMarketDataUpdate;
    const updateFrequency = this.calculateUpdateFrequency();

    return {
      status: timeSinceLastUpdate < 5000 ? 'healthy' : 'stale',
      lastUpdate: window.lastMarketDataUpdate,
      timeSinceLastUpdate,
      updateFrequency: updateFrequency ? updateFrequency.toFixed(1) : null,
      bufferSize: window.marketDataBuffer.length
    };
  }

  /**
   * Calculate update frequency
   */
  calculateUpdateFrequency() {
    if (!window.marketDataTimestamps || window.marketDataTimestamps.length < 2) {
      return null;
    }

    const timestamps = window.marketDataTimestamps.slice(-10);
    const intervals = [];

    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return 1000 / avgInterval; // Updates per second
  }

  /**
   * Calculate overall health score
   */
  calculateOverallScore(categoryScores) {
    const weights = {
      memory: 0.4,
      performance: 0.35,
      trading: 0.25
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [category, score] of Object.entries(categoryScores)) {
      if (score !== undefined) {
        totalScore += score * weights[category];
        totalWeight += weights[category];
      }
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  /**
   * Determine overall status from score
   */
  determineOverallStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'healthy';
    if (score >= 70) return 'acceptable';
    if (score >= 60) return 'degraded';
    if (score >= 40) return 'unhealthy';
    return 'critical';
  }

  /**
   * Determine status from score
   */
  determineStatus(score) {
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'degraded';
    if (score >= 40) return 'unhealthy';
    return 'critical';
  }

  /**
   * Generate health recommendations
   */
  generateRecommendations(healthCheck) {
    const recommendations = [];

    // Memory recommendations
    if (healthCheck.categoryScores.memory < 80) {
      recommendations.push({
        priority: 'high',
        category: 'memory',
        title: 'Memory Optimization Required',
        description: 'Memory performance is below optimal levels',
        actions: [
          'Investigate memory leaks',
          'Optimize object lifecycle management',
          'Implement garbage collection triggers'
        ]
      });
    }

    // Performance recommendations
    if (healthCheck.categoryScores.performance < 80) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Performance Optimization Required',
        description: 'System performance is degrading',
        actions: [
          'Optimize rendering pipeline',
          'Reduce long task duration',
          'Implement frame rate optimization'
        ]
      });
    }

    // Trading recommendations
    if (healthCheck.categoryScores.trading < 80) {
      recommendations.push({
        priority: 'critical',
        category: 'trading',
        title: 'Trading System Issues',
        description: 'Trading functionality is compromised',
        actions: [
          'Fix display rendering issues',
          'Ensure real-time data connectivity',
          'Verify keyboard shortcut functionality'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Gather current session data
   */
  gatherSessionData() {
    return {
      memorySnapshots: window.sessionData?.memorySnapshots || [],
      performanceMetrics: window.sessionData?.performanceMetrics || [],
      tradingOperations: window.sessionData?.tradingOperations || [],
      memoryLeaks: window.sessionData?.memoryLeaks || []
    };
  }

  /**
   * Get current health status
   */
  getCurrentHealthStatus() {
    return { ...this.currentStatus };
  }

  /**
   * Get health history
   */
  getHealthHistory(limit = 10) {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get health summary report
   */
  getHealthSummary() {
    if (this.healthHistory.length === 0) {
      return { status: 'no_data', message: 'No health checks performed' };
    }

    const recent = this.healthHistory.slice(-10);
    const latest = this.healthHistory[this.healthHistory.length - 1];
    const scores = recent.map(check => check.overallScore);

    return {
      currentStatus: this.currentStatus,
      latestScore: latest.overallScore,
      averageScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
      scoreTrend: this.calculateScoreTrend(scores),
      totalChecks: this.healthHistory.length,
      consecutiveFailures: this.consecutiveFailures,
      lastCheck: latest.timestamp,
      alertsCount: latest.alerts.length,
      criticalAlerts: latest.alerts.filter(a => a.severity === 'critical').length
    };
  }

  /**
   * Calculate score trend
   */
  calculateScoreTrend(scores) {
    if (scores.length < 3) return 'insufficient_data';

    const recent = scores.slice(-3);
    const first = recent[0];
    const last = recent[recent.length - 1];

    if (last > first + 5) return 'improving';
    if (last < first - 5) return 'declining';
    return 'stable';
  }
}

export default SessionHealthMonitor;