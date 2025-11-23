/**
 * Session Reporter
 *
 * Comprehensive reporting system for extended session testing.
 * Generates detailed reports, real-time updates, and actionable insights.
 */

export class SessionReporter {
  constructor() {
    this.sessionId = null;
    this.isInitialized = false;
    this.enableRealTimeReporting = true;
    this.reportingInterval = null;
    this.reportHistory = [];
    this.realTimeSubscribers = new Set();
    this.reportFormatters = new Map();
    this.exportFormats = ['json', 'html', 'csv'];
  }

  async initialize(options = {}) {
    this.sessionId = options.sessionId;
    this.enableRealTimeReporting = options.enableRealTimeReporting !== false;
    this.reportingInterval = options.reportingInterval || 15 * 60 * 1000; // 15 minutes default

    // Initialize report formatters
    this.initializeReportFormatters();

    // Start real-time reporting if enabled
    if (this.enableRealTimeReporting) {
      this.startRealTimeReporting();
    }

    this.isInitialized = true;
    console.log('📋 Session Reporter initialized');
    console.log(`📊 Real-time reporting: ${this.enableRealTimeReporting ? 'enabled' : 'disabled'}`);
  }

  /**
   * Initialize different report formatters
   */
  initializeReportFormatters() {
    this.reportFormatters.set('json', this.formatJSONReport.bind(this));
    this.reportFormatters.set('html', this.formatHTMLReport.bind(this));
    this.reportFormatters.set('csv', this.formatCSVReport.bind(this));
    this.reportFormatters.set('summary', this.formatSummaryReport.bind(this));
  }

  /**
   * Start real-time reporting
   */
  startRealTimeReporting() {
    if (this.reportingInterval) {
      this.reportingInterval = setInterval(() => {
        this.generateRealTimeReport();
      }, this.reportingInterval);
      console.log(`🔄 Started real-time reporting (${this.reportingInterval / 1000}s intervals)`);
    }
  }

  /**
   * Stop real-time reporting
   */
  stopRealTimeReporting() {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
      console.log('⏹️ Stopped real-time reporting');
    }
  }

  /**
   * Generate real-time progress report
   */
  async generateRealTimeReport() {
    const report = {
      type: 'real_time',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      progress: this.calculateProgress(),
      status: this.getCurrentStatus(),
      metrics: this.getCurrentMetrics(),
      alerts: this.getRecentAlerts(),
      recommendations: this.getCurrentRecommendations()
    };

    // Store report
    this.reportHistory.push(report);
    if (this.reportHistory.length > 100) {
      this.reportHistory.shift();
    }

    // Notify subscribers
    this.notifyRealTimeSubscribers(report);

    // Log to console
    console.log('📊 Real-time Report:', {
      progress: `${report.progress}%`,
      status: report.status.overall,
      score: report.status.score,
      alerts: report.alerts.length
    });

    return report;
  }

  /**
   * Save comprehensive final report
   */
  async saveFinalReport(finalReport) {
    const report = {
      type: 'final',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      ...finalReport,
      generatedAt: new Date().toISOString(),
      reportVersion: '1.0'
    };

    // Add reporting metadata
    report.metadata = {
      totalReportingDuration: this.calculateReportingDuration(),
      realTimeReportsGenerated: this.reportHistory.filter(r => r.type === 'real_time').length,
      alertCount: finalReport.alertSummary.totalAlerts,
      dataPoints: {
        memorySnapshots: finalReport.summary.totalMemorySnapshots,
        healthChecks: finalReport.summary.totalHealthChecks,
        tradingOperations: finalReport.summary.totalTradingOperations
      }
    };

    // Save in all requested formats
    for (const format of this.exportFormats) {
      await this.exportReport(report, format);
    }

    // Store in history
    this.reportHistory.push(report);

    console.log('💾 Final report saved in all formats');
    return report;
  }

  /**
   * Export report in specified format
   */
  async exportReport(report, format) {
    const formatter = this.reportFormatters.get(format);
    if (!formatter) {
      throw new Error(`Unsupported report format: ${format}`);
    }

    const formattedReport = await formatter(report);
    const filename = this.generateFilename(report, format);

    // Save to file system or send to external service
    await this.saveReportToFile(formattedReport, filename);

    console.log(`📄 Report exported as ${format.toUpperCase()}: ${filename}`);
    return { filename, format, size: formattedReport.length };
  }

  /**
   * Generate filename for report
   */
  generateFilename(report, format) {
    const timestamp = new Date(report.timestamp).toISOString().replace(/[:.]/g, '-');
    return `extended-session-report-${this.sessionId}-${timestamp}.${format}`;
  }

  /**
   * Save report to file
   */
  async saveReportToFile(content, filename) {
    // In browser environment, trigger download
    if (typeof window !== 'undefined') {
      const blob = new Blob([content], { type: this.getContentType(filename) });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // In Node.js environment, save to file system
      const fs = await import('fs');
      await fs.promises.writeFile(filename, content);
    }
  }

  /**
   * Get content type for file
   */
  getContentType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const types = {
      'json': 'application/json',
      'html': 'text/html',
      'csv': 'text/csv',
      'txt': 'text/plain'
    };
    return types[extension] || 'text/plain';
  }

  /**
   * Format report as JSON
   */
  async formatJSONReport(report) {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Format report as HTML
   */
  async formatHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Extended Session Test Report - ${this.sessionId}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .grade { font-size: 72px; font-weight: bold; text-align: center; margin: 20px 0; }
        .grade.A { color: #10b981; }
        .grade.B { color: #3b82f6; }
        .grade.C { color: #f59e0b; }
        .grade.D { color: #f97316; }
        .grade.F { color: #ef4444; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric-card { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #1f2937; }
        .metric-label { color: #6b7280; font-size: 14px; margin-top: 5px; }
        .section { margin: 40px 0; }
        .section h2 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .alert.warning { background: #fffbeb; border-left-color: #f59e0b; }
        .alert.info { background: #eff6ff; border-left-color: #3b82f6; }
        .recommendations { background: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; border-radius: 4px; }
        .chart-placeholder { background: #e5e7eb; height: 200px; display: flex; align-items: center; justify-content: center; color: #6b7280; border-radius: 4px; margin: 20px 0; }
        .timestamp { color: #6b7280; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f8fafc; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Extended Session Test Report</h1>
            <p>Session ID: ${this.sessionId}</p>
            <p class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</p>
        </div>

        <div class="content">
            ${this.generateHTMLGradeSection(report)}
            ${this.generateHTMLSessionInfo(report)}
            ${this.generateHTMLMetricsGrid(report)}
            ${this.generateHTMLMemoryAnalysis(report)}
            ${this.generateHTMLPerformanceAnalysis(report)}
            ${this.generateHTMLAlertsSection(report)}
            ${this.generateHTMLRecommendations(report)}
            ${this.generateHTMLCharts(report)}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Generate HTML grade section
   */
  generateHTMLGradeSection(report) {
    if (!report.overallGrade) return '';

    return `
    <div class="grade-section">
        <div class="grade ${report.overallGrade.grade}">${report.overallGrade.grade}</div>
        <p style="text-align: center; font-size: 18px; color: #6b7280;">${report.overallGrade.message}</p>
        <p style="text-align: center; font-size: 14px;">Score: ${report.overallGrade.score}/100</p>
    </div>`;
  }

  /**
   * Generate HTML session info
   */
  generateHTMLSessionInfo(report) {
    const info = report.sessionInfo || {};

    return `
    <div class="section">
        <h2>Session Information</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div><strong>Duration:</strong> ${info.durationHours || 'N/A'} hours</div>
            <div><strong>Start Time:</strong> ${info.startTime ? new Date(info.startTime).toLocaleString() : 'N/A'}</div>
            <div><strong>End Time:</strong> ${info.endTime ? new Date(info.endTime).toLocaleString() : 'N/A'}</div>
        </div>
    </div>`;
  }

  /**
   * Generate HTML metrics grid
   */
  generateHTMLMetricsGrid(report) {
    const summary = report.summary || {};

    return `
    <div class="section">
        <h2>Session Summary</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${summary.totalMemorySnapshots || 0}</div>
                <div class="metric-label">Memory Snapshots</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.totalHealthChecks || 0}</div>
                <div class="metric-label">Health Checks</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.totalAlerts || 0}</div>
                <div class="metric-label">Total Alerts</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${summary.totalTradingOperations || 0}</div>
                <div class="metric-label">Trading Operations</div>
            </div>
        </div>
    </div>`;
  }

  /**
   * Generate HTML memory analysis
   */
  generateHTMLMemoryAnalysis(report) {
    const memory = report.memoryAnalysis || {};

    return `
    <div class="section">
        <h2>Memory Analysis</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${memory.memoryGrowthMB || 'N/A'} MB</div>
                <div class="metric-label">Memory Growth</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${memory.memoryGrowthRate || 'N/A'} MB/hr</div>
                <div class="metric-label">Growth Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${memory.memoryStable ? '✅ Yes' : '❌ No'}</div>
                <div class="metric-label">Memory Stable</div>
            </div>
        </div>
    </div>`;
  }

  /**
   * Generate HTML performance analysis
   */
  generateHTMLPerformanceAnalysis(report) {
    const performance = report.performanceAnalysis || {};

    return `
    <div class="section">
        <h2>Performance Analysis</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${performance.averageFrameRate || 'N/A'} FPS</div>
                <div class="metric-label">Average Frame Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${performance.averageResponseTime || 'N/A'} ms</div>
                <div class="metric-label">Average Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${performance.minFrameRate || 'N/A'} FPS</div>
                <div class="metric-label">Minimum Frame Rate</div>
            </div>
        </div>
    </div>`;
  }

  /**
   * Generate HTML alerts section
   */
  generateHTMLAlertsSection(report) {
    const alerts = report.alertSummary || {};

    if (!alerts.totalAlerts || alerts.totalAlerts === 0) {
      return `
      <div class="section">
        <h2>Alerts</h2>
        <div class="alert info">
          <strong>No alerts generated</strong> - System performed well throughout the session.
        </div>
      </div>`;
    }

    return `
    <div class="section">
        <h2>Alerts Summary</h2>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${alerts.totalAlerts}</div>
                <div class="metric-label">Total Alerts</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${alerts.alertsPerHour || 'N/A'}</div>
                <div class="metric-label">Alerts Per Hour</div>
            </div>
        </div>

        ${alerts.severityBreakdown ? `
        <h3>Severity Breakdown</h3>
        <table>
            <thead>
                <tr><th>Severity</th><th>Count</th></tr>
            </thead>
            <tbody>
                ${Object.entries(alerts.severityBreakdown).map(([severity, count]) =>
                  `<tr><td>${severity}</td><td>${count}</td></tr>`
                ).join('')}
            </tbody>
        </table>` : ''}
    </div>`;
  }

  /**
   * Generate HTML recommendations
   */
  generateHTMLRecommendations(report) {
    const recommendations = report.recommendations || [];

    if (recommendations.length === 0) {
      return `
      <div class="section">
        <h2>Recommendations</h2>
        <div class="recommendations">
          <strong>Excellent performance!</strong> No specific recommendations needed.
        </div>
      </div>`;
    }

    return `
    <div class="section">
        <h2>Recommendations</h2>
        ${recommendations.map(rec => `
          <div class="recommendations" style="margin: 15px 0;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937;">
              ${rec.title || rec.category}
              <span style="background: ${
                rec.priority === 'critical' ? '#ef4444' :
                rec.priority === 'high' ? '#f59e0b' :
                rec.priority === 'medium' ? '#3b82f6' : '#10b981'
              } color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px;">
                ${rec.priority}
              </span>
            </h4>
            <p style="margin: 0; color: #4b5563;">${rec.description}</p>
          </div>
        `).join('')}
    </div>`;
  }

  /**
   * Generate HTML charts placeholder
   */
  generateHTMLCharts(report) {
    return `
    <div class="section">
        <h2>Performance Charts</h2>
        <div class="chart-placeholder">
            Memory Usage Over Time (Chart data available in JSON export)
        </div>
        <div class="chart-placeholder">
            Frame Rate Performance (Chart data available in JSON export)
        </div>
    </div>`;
  }

  /**
   * Format report as CSV
   */
  async formatCSVReport(report) {
    const csvRows = [];

    // Header
    csvRows.push('Metric,Value,Unit,Timestamp');

    // Session info
    if (report.sessionInfo) {
      csvRows.push(`Session Duration,${report.sessionInfo.durationHours},hours,${report.timestamp}`);
      csvRows.push(`Session ID,${this.sessionId},,${report.timestamp}`);
    }

    // Memory analysis
    if (report.memoryAnalysis) {
      csvRows.push(`Memory Growth,${report.memoryAnalysis.memoryGrowthMB},MB,${report.timestamp}`);
      csvRows.push(`Memory Growth Rate,${report.memoryAnalysis.memoryGrowthRate},MB/hr,${report.timestamp}`);
    }

    // Performance analysis
    if (report.performanceAnalysis) {
      csvRows.push(`Average Frame Rate,${report.performanceAnalysis.averageFrameRate},FPS,${report.timestamp}`);
      csvRows.push(`Average Response Time,${report.performanceAnalysis.averageResponseTime},ms,${report.timestamp}`);
    }

    return csvRows.join('\n');
  }

  /**
   * Format summary report
   */
  async formatSummaryReport(report) {
    return `
EXTENDED SESSION TEST SUMMARY
==============================

Session ID: ${this.sessionId}
Generated: ${new Date(report.timestamp).toLocaleString()}

OVERALL GRADE: ${report.overallGrade?.grade || 'N/A'}
Score: ${report.overallGrade?.score || 'N/A'}/100
${report.overallGrade?.message || ''}

SESSION INFORMATION
------------------
Duration: ${report.sessionInfo?.durationHours || 'N/A'} hours
Start: ${report.sessionInfo?.startTime ? new Date(report.sessionInfo.startTime).toLocaleString() : 'N/A'}
End: ${report.sessionInfo?.endTime ? new Date(report.sessionInfo.endTime).toLocaleString() : 'N/A'}

SUMMARY STATISTICS
------------------
Memory Snapshots: ${report.summary?.totalMemorySnapshots || 0}
Health Checks: ${report.summary?.totalHealthChecks || 0}
Total Alerts: ${report.summary?.totalAlerts || 0}
Trading Operations: ${report.summary?.totalTradingOperations || 0}

MEMORY ANALYSIS
---------------
Memory Growth: ${report.memoryAnalysis?.memoryGrowthMB || 'N/A'} MB
Growth Rate: ${report.memoryAnalysis?.memoryGrowthRate || 'N/A'} MB/hr
Memory Stable: ${report.memoryAnalysis?.memoryStable ? 'Yes' : 'No'}

PERFORMANCE ANALYSIS
--------------------
Average Frame Rate: ${report.performanceAnalysis?.averageFrameRate || 'N/A'} FPS
Average Response Time: ${report.performanceAnalysis?.averageResponseTime || 'N/A'} ms
Minimum Frame Rate: ${report.performanceAnalysis?.minFrameRate || 'N/A'} FPS

RECOMMENDATIONS
---------------
${report.recommendations?.map(rec =>
  `- [${rec.priority?.toUpperCase()}] ${rec.title}: ${rec.description}`
).join('\n') || 'No specific recommendations'}
`;
  }

  /**
   * Subscribe to real-time updates
   */
  subscribeToRealTimeUpdates(callback) {
    this.realTimeSubscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.realTimeSubscribers.delete(callback);
    };
  }

  /**
   * Notify real-time subscribers
   */
  notifyRealTimeSubscribers(report) {
    for (const callback of this.realTimeSubscribers) {
      try {
        callback(report);
      } catch (error) {
        console.error('Error notifying real-time subscriber:', error);
      }
    }
  }

  /**
   * Calculate session progress
   */
  calculateProgress() {
    // This would need to be implemented based on actual session duration
    return 0; // Placeholder
  }

  /**
   * Get current status
   */
  getCurrentStatus() {
    // This would need to be implemented based on actual session monitoring
    return {
      overall: 'unknown',
      score: 0
    }; // Placeholder
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    // This would need to be implemented based on actual session monitoring
    return {}; // Placeholder
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts() {
    // This would need to be implemented based on actual session monitoring
    return []; // Placeholder
  }

  /**
   * Get current recommendations
   */
  getCurrentRecommendations() {
    // This would need to be implemented based on actual session monitoring
    return []; // Placeholder
  }

  /**
   * Calculate reporting duration
   */
  calculateReportingDuration() {
    if (this.reportHistory.length === 0) return 0;

    const first = this.reportHistory[0].timestamp;
    const last = this.reportHistory[this.reportHistory.length - 1].timestamp;

    return last - first;
  }

  /**
   * Get report history
   */
  getReportHistory(limit = 10) {
    return this.reportHistory.slice(-limit);
  }

  /**
   * Cleanup reporter resources
   */
  cleanup() {
    this.stopRealTimeReporting();
    this.realTimeSubscribers.clear();
    this.reportHistory = [];
    console.log('🧹 Session Reporter cleaned up');
  }
}

export default SessionReporter;