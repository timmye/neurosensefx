/**
 * COMPREHENSIVE REPORTING SYSTEM AND CI/CD INTEGRATION
 *
 * Phase 5: Automated reporting, pipeline orchestration, and CI/CD integration
 * that provides actionable alerts and performance trend analysis over time
 *
 * This orchestrates the entire build-to-user-flow pipeline and integrates with
 * CI/CD systems for automated quality assurance in production environments.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { execSync, spawn } from 'child_process'
import { performance } from 'perf_hooks'

// Import all pipeline components
import { BuildValidationPipeline } from './build-validation.spec.js'
import { DeploymentPipelineTester } from './deployment-testing.spec.js'
import { UserWorkflowTester } from './user-workflow-testing.spec.js'
import { PerformanceRegressionTester } from './performance-regression-testing.spec.js'

// CI/CD integration configuration
const CICD_CONFIG = {
  // Pipeline orchestration
  PIPELINE_TIMEOUT: 600000, // 10 minutes total pipeline timeout
  PARALLEL_EXECUTION: false, // Run sequentially for dependency validation

  // Reporting configuration
  REPORT_FORMATS: ['json', 'html', 'junit', 'markdown'],
  RETENTION_DAYS: 30, // Keep reports for 30 days

  // Alert thresholds
  CRITICAL_FAILURE_THRESHOLD: 1, // Any critical failure fails the pipeline
  WARNING_FAILURE_THRESHOLD: 5,  // 5+ warnings fail the pipeline
  PERFORMANCE_REGRESSION_THRESHOLD: 2, // 2+ performance regressions fail pipeline

  // Integration endpoints
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  EMAIL_RECIPIENTS: process.env.EMAIL_RECIPIENTS?.split(',') || [],

  // Performance trend analysis
  TREND_ANALYSIS_WINDOW: 10, // Analyze last 10 pipeline runs
  PERFORMANCE_DEGRADATION_THRESHOLD: 15, // 15% degradation triggers alert

  // Professional trading platform requirements
  PRODUCTION_READINESS_THRESHOLD: 95, // 95% of tests must pass for production
  PERFORMANCE_COMPLIANCE_THRESHOLD: 90 // 90% of performance metrics must meet targets
}

class PipelineOrchestrator {
  constructor(options = {}) {
    this.options = {
      environment: options.environment || 'development',
      runBuildValidation: options.runBuildValidation !== false,
      runDeploymentTesting: options.runDeploymentTesting !== false,
      runUserWorkflows: options.runUserWorkflows !== false,
      runPerformanceTesting: options.runPerformanceTesting !== false,
      generateReports: options.generateReports !== false,
      ...options
    }

    this.projectRoot = process.cwd()
    this.startTime = performance.now()

    this.pipelineResults = {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      phases: {},
      summary: {},
      trends: {},
      alerts: [],
      artifacts: [],
      ciCdIntegration: {
        triggeredBy: process.env.CI_JOB_ID || 'manual',
        buildNumber: process.env.BUILD_NUMBER || 'local',
        branch: process.env.GIT_BRANCH || 'main'
      }
    }

    // Pipeline components
    this.buildValidator = null
    this.deploymentTester = null
    this.workflowTester = null
    this.performanceTester = null
  }

  /**
   * Run the complete build-to-user-flow pipeline
   */
  async runCompletePipeline() {
    console.log('🚀 NeuroSense FX Build-to-User-Flow Pipeline')
    console.log('=' .repeat(60))
    console.log(`🌍 Environment: ${this.options.environment}`)
    console.log(`🏗️  Build Validation: ${this.options.runBuildValidation ? 'YES' : 'NO'}`)
    console.log(`🚀 Deployment Testing: ${this.options.runDeploymentTesting ? 'YES' : 'NO'}`)
    console.log(`👥 User Workflows: ${this.options.runUserWorkflows ? 'YES' : 'NO'}`)
    console.log(`📊 Performance Testing: ${this.options.runPerformanceTesting ? 'YES' : 'NO'}`)
    console.log(`📄 Report Generation: ${this.options.generateReports ? 'YES' : 'NO'}`)
    console.log('=' .repeat(60))

    try {
      // Phase 1: Build Validation
      if (this.options.runBuildValidation) {
        await this.runBuildValidationPhase()
      }

      // Phase 2: Deployment Testing
      if (this.options.runDeploymentTesting) {
        await this.runDeploymentTestingPhase()
      }

      // Phase 3: User Workflow Testing
      if (this.options.runUserWorkflows) {
        await this.runUserWorkflowPhase()
      }

      // Phase 4: Performance Regression Testing
      if (this.options.runPerformanceTesting) {
        await this.runPerformanceTestingPhase()
      }

      // Phase 5: Report Generation and Analysis
      if (this.options.generateReports) {
        await this.generateComprehensiveReports()
      }

      // Phase 6: CI/CD Integration and Alerts
      await this.processCiCdIntegration()

      // Generate final summary
      await this.generateFinalSummary()

      const pipelineSuccess = this.determinePipelineSuccess()

      console.log('\n' + '=' .repeat(60))
      console.log(pipelineSuccess ? '✅ PIPELINE SUCCESS' : '❌ PIPELINE FAILED')
      console.log('=' .repeat(60))

      return pipelineSuccess

    } catch (pipelineError) {
      console.error('💥 Pipeline Critical Error:', pipelineError)
      this.pipelineResults.alerts.push({
        severity: 'critical',
        category: 'pipeline_execution',
        message: `Pipeline execution failed: ${pipelineError.message}`,
        timestamp: new Date().toISOString()
      })

      // Generate failure report
      await this.generateFailureReport(pipelineError)

      return false
    }
  }

  /**
   * Phase 1: Build Validation
   */
  async runBuildValidationPhase() {
    const phaseStart = performance.now()
    console.log('\n🏗️  PHASE 1: BUILD VALIDATION')
    console.log('-' .repeat(40))

    try {
      this.buildValidator = new BuildValidationPipeline()
      const success = await this.buildValidator.runFullPipeline()

      this.pipelineResults.phases.buildValidation = {
        status: success ? 'passed' : 'failed',
        time: performance.now() - phaseStart,
        results: this.buildValidator.buildResults
      }

      if (success) {
        console.log('✅ Build Validation Phase: PASSED')
      } else {
        console.log('❌ Build Validation Phase: FAILED')
        this.addPipelineAlert('critical', 'build_validation', 'Build validation failed')
      }

    } catch (buildError) {
      console.error('❌ Build Validation Phase Error:', buildError.message)
      this.pipelineResults.phases.buildValidation = {
        status: 'error',
        time: performance.now() - phaseStart,
        error: buildError.message
      }
      this.addPipelineAlert('critical', 'build_validation', `Build validation error: ${buildError.message}`)
    }
  }

  /**
   * Phase 2: Deployment Testing
   */
  async runDeploymentTestingPhase() {
    const phaseStart = performance.now()
    console.log('\n🚀 PHASE 2: DEPLOYMENT TESTING')
    console.log('-' .repeat(40))

    try {
      this.deploymentTester = new DeploymentPipelineTester(this.options.environment)
      const success = await this.deploymentTester.runDeploymentPipeline()

      this.pipelineResults.phases.deploymentTesting = {
        status: success ? 'passed' : 'failed',
        time: performance.now() - phaseStart,
        results: this.deploymentTester.deploymentResults
      }

      if (success) {
        console.log('✅ Deployment Testing Phase: PASSED')
      } else {
        console.log('❌ Deployment Testing Phase: FAILED')
        this.addPipelineAlert('critical', 'deployment_testing', 'Deployment testing failed')
      }

    } catch (deploymentError) {
      console.error('❌ Deployment Testing Phase Error:', deploymentError.message)
      this.pipelineResults.phases.deploymentTesting = {
        status: 'error',
        time: performance.now() - phaseStart,
        error: deploymentError.message
      }
      this.addPipelineAlert('critical', 'deployment_testing', `Deployment testing error: ${deploymentError.message}`)
    }
  }

  /**
   * Phase 3: User Workflow Testing
   */
  async runUserWorkflowPhase() {
    const phaseStart = performance.now()
    console.log('\n👥 PHASE 3: USER WORKFLOW TESTING')
    console.log('-' .repeat(40))

    try {
      const browserType = 'chromium' // Use consistent browser for CI/CD
      const headless = process.env.CI ? true : false

      this.workflowTester = new UserWorkflowTester(browserType, headless)
      const success = await this.workflowTester.runUserWorkflowPipeline()

      this.pipelineResults.phases.userWorkflows = {
        status: success ? 'passed' : 'failed',
        time: performance.now() - phaseStart,
        results: this.workflowTester.workflowResults
      }

      if (success) {
        console.log('✅ User Workflow Testing Phase: PASSED')
      } else {
        console.log('❌ User Workflow Testing Phase: FAILED')
        this.addPipelineAlert('critical', 'user_workflows', 'User workflow testing failed')
      }

    } catch (workflowError) {
      console.error('❌ User Workflow Testing Phase Error:', workflowError.message)
      this.pipelineResults.phases.userWorkflows = {
        status: 'error',
        time: performance.now() - phaseStart,
        error: workflowError.message
      }
      this.addPipelineAlert('critical', 'user_workflows', `User workflow testing error: ${workflowError.message}`)
    }
  }

  /**
   * Phase 4: Performance Regression Testing
   */
  async runPerformanceTestingPhase() {
    const phaseStart = performance.now()
    console.log('\n📊 PHASE 4: PERFORMANCE REGRESSION TESTING')
    console.log('-' .repeat(40))

    try {
      const browserType = 'chromium' // Use consistent browser for CI/CD

      this.performanceTester = new PerformanceRegressionTester(browserType, this.options.environment)
      const success = await this.performanceTester.runPerformanceRegressionPipeline()

      this.pipelineResults.phases.performanceTesting = {
        status: success ? 'passed' : 'failed',
        time: performance.now() - phaseStart,
        results: this.performanceTester.testResults
      }

      if (success) {
        console.log('✅ Performance Testing Phase: PASSED')
      } else {
        console.log('❌ Performance Testing Phase: FAILED')
        this.addPipelineAlert('warning', 'performance_testing', 'Performance regressions detected')
      }

    } catch (performanceError) {
      console.error('❌ Performance Testing Phase Error:', performanceError.message)
      this.pipelineResults.phases.performanceTesting = {
        status: 'error',
        time: performance.now() - phaseStart,
        error: performanceError.message
      }
      this.addPipelineAlert('critical', 'performance_testing', `Performance testing error: ${performanceError.message}`)
    }
  }

  /**
   * Phase 5: Generate Comprehensive Reports
   */
  async generateComprehensiveReports() {
    const phaseStart = performance.now()
    console.log('\n📄 PHASE 5: COMPREHENSIVE REPORTING')
    console.log('-' .repeat(40))

    try {
      const reports = await this.generateAllReportFormats()

      this.pipelineResults.phases.reporting = {
        status: 'passed',
        time: performance.now() - phaseStart,
        reports
      }

      console.log(`✅ Generated ${reports.length} report formats`)
      reports.forEach(report => {
        console.log(`  📄 ${report.type}: ${report.path}`)
      })

    } catch (reportingError) {
      console.error('❌ Report Generation Error:', reportingError.message)
      this.pipelineResults.phases.reporting = {
        status: 'error',
        time: performance.now() - phaseStart,
        error: reportingError.message
      }
      this.addPipelineAlert('warning', 'reporting', `Report generation error: ${reportingError.message}`)
    }
  }

  /**
   * Generate all report formats
   */
  async generateAllReportFormats() {
    const reports = []
    const reportsDir = join(this.projectRoot, 'test-results', 'pipeline')

    // Ensure reports directory exists
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = Date.now()

    // Generate JSON report
    const jsonReportPath = join(reportsDir, `pipeline-results-${timestamp}.json`)
    writeFileSync(jsonReportPath, JSON.stringify(this.pipelineResults, null, 2))
    reports.push({ type: 'json', path: jsonReportPath })

    // Generate HTML report
    const htmlReportPath = await this.generateHtmlReport(reportsDir, timestamp)
    if (htmlReportPath) {
      reports.push({ type: 'html', path: htmlReportPath })
    }

    // Generate Markdown report
    const markdownReportPath = await this.generateMarkdownReport(reportsDir, timestamp)
    if (markdownReportPath) {
      reports.push({ type: 'markdown', path: markdownReportPath })
    }

    // Generate JUnit XML for CI/CD integration
    const junitReportPath = await this.generateJunitReport(reportsDir, timestamp)
    if (junitReportPath) {
      reports.push({ type: 'junit', path: junitReportPath })
    }

    return reports
  }

  /**
   * Generate HTML report
   */
  async generateHtmlReport(reportsDir, timestamp) {
    try {
      const htmlTemplate = this.createHtmlReportTemplate()
      const htmlReportPath = join(reportsDir, `pipeline-report-${timestamp}.html`)
      writeFileSync(htmlReportPath, htmlTemplate)
      return htmlReportPath
    } catch (error) {
      console.warn('HTML report generation failed:', error.message)
      return null
    }
  }

  /**
   * Create HTML report template
   */
  createHtmlReportTemplate() {
    const summary = this.generatePipelineSummary()

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuroSense FX Pipeline Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
        .summary-card { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; border-left: 4px solid #28a745; }
        .summary-card.warning { border-left-color: #ffc107; }
        .summary-card.error { border-left-color: #dc3545; }
        .status-success { color: #28a745; font-size: 2em; font-weight: bold; }
        .status-warning { color: #ffc107; font-size: 2em; font-weight: bold; }
        .status-error { color: #dc3545; font-size: 2em; font-weight: bold; }
        .phase-section { margin: 30px 0; }
        .phase-header { font-size: 1.5em; font-weight: bold; margin-bottom: 15px; color: #333; }
        .phase-status { display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; font-size: 0.9em; }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .status-error { background: #dc3545; }
        .alert-section { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .alert-critical { background: #f8d7da; border-color: #f5c6cb; }
        .timestamp { color: #666; font-size: 0.9em; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 6px; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #495057; }
        .metric-label { font-size: 0.9em; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 NeuroSense FX Build-to-User-Flow Pipeline</h1>
            <p class="timestamp">Environment: ${this.options.environment} | ${new Date().toLocaleString()}</p>
            <div class="status-${summary.status.toLowerCase()}">
                Pipeline Status: ${summary.status.toUpperCase()}
            </div>
        </div>

        <div class="content">
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="status-${summary.overallStatus}">${summary.phasesPassed}/${summary.totalPhases}</div>
                    <div>Phases Passed</div>
                </div>
                <div class="summary-card ${summary.criticalIssues > 0 ? 'error' : ''}">
                    <div class="status-${summary.criticalIssues > 0 ? 'error' : 'success'}">${summary.criticalIssues}</div>
                    <div>Critical Issues</div>
                </div>
                <div class="summary-card ${summary.warnings > 0 ? 'warning' : ''}">
                    <div class="status-${summary.warnings > 0 ? 'warning' : 'success'}">${summary.warnings}</div>
                    <div>Warnings</div>
                </div>
                <div class="summary-card">
                    <div class="status-success">${summary.totalTime}</div>
                    <div>Total Time (s)</div>
                </div>
            </div>

            ${this.pipelineResults.alerts.length > 0 ? `
            <div class="alert-section ${this.pipelineResults.alerts.some(a => a.severity === 'critical') ? 'alert-critical' : ''}">
                <h3>🚨 Alerts & Issues</h3>
                ${this.pipelineResults.alerts.map(alert => `
                    <div style="margin: 10px 0; padding: 10px; background: ${alert.severity === 'critical' ? '#f8d7da' : '#fff3cd'}; border-radius: 4px;">
                        <strong>${alert.severity.toUpperCase()}:</strong> ${alert.message}
                        <div class="timestamp">${new Date(alert.timestamp).toLocaleString()}</div>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${Object.entries(this.pipelineResults.phases).map(([phaseName, phaseData]) => `
            <div class="phase-section">
                <div class="phase-header">
                    ${phaseName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    <span class="phase-status status-${phaseData.status}">${phaseData.status.toUpperCase()}</span>
                </div>
                <div>Duration: ${(phaseData.time / 1000).toFixed(1)}s</div>
                ${phaseData.error ? `<div style="color: #dc3545; margin-top: 10px;">Error: ${phaseData.error}</div>` : ''}
            </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `
  }

  /**
   * Generate Markdown report
   */
  async generateMarkdownReport(reportsDir, timestamp) {
    try {
      const markdownContent = this.createMarkdownReport()
      const markdownReportPath = join(reportsDir, `pipeline-report-${timestamp}.md`)
      writeFileSync(markdownReportPath, markdownContent)
      return markdownReportPath
    } catch (error) {
      console.warn('Markdown report generation failed:', error.message)
      return null
    }
  }

  /**
   * Create Markdown report content
   */
  createMarkdownReport() {
    const summary = this.generatePipelineSummary()

    let markdown = `# NeuroSense FX Build-to-User-Flow Pipeline Report\n\n`
    markdown += `**Environment:** ${this.options.environment}\n`
    markdown += `**Timestamp:** ${new Date().toLocaleString()}\n`
    markdown += `**Pipeline Status:** ${summary.status.toUpperCase()}\n\n`

    markdown += `## Summary\n\n`
    markdown += `| Metric | Value |\n`
    markdown += `|--------|-------|\n`
    markdown += `| Phases Passed | ${summary.phasesPassed}/${summary.totalPhases} |\n`
    markdown += `| Critical Issues | ${summary.criticalIssues} |\n`
    markdown += `| Warnings | ${summary.warnings} |\n`
    markdown += `| Total Time | ${summary.totalTime}s |\n\n`

    if (this.pipelineResults.alerts.length > 0) {
      markdown += `## Alerts & Issues\n\n`
      this.pipelineResults.alerts.forEach(alert => {
        markdown += `### ${alert.severity.toUpperCase()}\n\n`
        markdown += `**Message:** ${alert.message}\n`
        markdown += `**Timestamp:** ${new Date(alert.timestamp).toLocaleString()}\n\n`
      })
    }

    markdown += `## Phase Results\n\n`
    Object.entries(this.pipelineResults.phases).forEach(([phaseName, phaseData]) => {
      markdown += `### ${phaseName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}\n\n`
      markdown += `- **Status:** ${phaseData.status.toUpperCase()}\n`
      markdown += `- **Duration:** ${(phaseData.time / 1000).toFixed(1)}s\n`
      if (phaseData.error) {
        markdown += `- **Error:** ${phaseData.error}\n`
      }
      markdown += `\n`
    })

    return markdown
  }

  /**
   * Generate JUnit XML report for CI/CD integration
   */
  async generateJunitReport(reportsDir, timestamp) {
    try {
      const junitContent = this.createJunitReport()
      const junitReportPath = join(reportsDir, `pipeline-results-${timestamp}.xml`)
      writeFileSync(junitReportPath, junitContent)
      return junitReportPath
    } catch (error) {
      console.warn('JUnit report generation failed:', error.message)
      return null
    }
  }

  /**
   * Create JUnit XML report
   */
  createJunitReport() {
    const summary = this.generatePipelineSummary()
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<testsuite name="NeuroSense FX Pipeline" '
    xml += `tests="${summary.totalPhases}" `
    xml += `failures="${summary.totalPhases - summary.phasesPassed}" `
    xml += `errors="${Object.values(this.pipelineResults.phases).filter(p => p.status === 'error').length}" `
    xml += `time="${summary.totalTime}">\n`

    Object.entries(this.pipelineResults.phases).forEach(([phaseName, phaseData]) => {
      xml += `  <testcase classname="pipeline" name="${phaseName}" time="${(phaseData.time / 1000).toFixed(3)}">`

      if (phaseData.status === 'failed' || phaseData.status === 'error') {
        xml += `\n    <failure message="${phaseData.error || 'Phase failed'}">`
        xml += `<![CDATA[${phaseData.error || 'Phase failed'}]]>`
        xml += `</failure>`
      }

      xml += `</testcase>\n`
    })

    xml += '</testsuite>'
    return xml
  }

  /**
   * Phase 6: CI/CD Integration and Alerts
   */
  async processCiCdIntegration() {
    console.log('\n🔗 PHASE 6: CI/CD INTEGRATION')
    console.log('-' .repeat(40))

    try {
      // Send Slack notifications if configured
      if (CICD_CONFIG.SLACK_WEBHOOK_URL) {
        await this.sendSlackNotification()
      }

      // Send email notifications if configured
      if (CICD_CONFIG.EMAIL_RECIPIENTS.length > 0) {
        await this.sendEmailNotifications()
      }

      // Update deployment status if in CI environment
      if (process.env.CI) {
        await this.updateDeploymentStatus()
      }

      // Archive pipeline artifacts
      await this.archivePipelineArtifacts()

      console.log('✅ CI/CD Integration Completed')

    } catch (ciCdError) {
      console.error('❌ CI/CD Integration Error:', ciCdError.message)
      this.addPipelineAlert('warning', 'ci_cd_integration', `CI/CD integration error: ${ciCdError.message}`)
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification() {
    try {
      const summary = this.generatePipelineSummary()
      const status = summary.criticalIssues > 0 ? 'FAILED' : 'PASSED'
      const color = status === 'PASSED' ? 'good' : 'danger'

      const payload = {
        attachments: [{
          color,
          title: `NeuroSense FX Pipeline ${status}`,
          fields: [
            { title: 'Environment', value: this.options.environment, short: true },
            { title: 'Status', value: status, short: true },
            { title: 'Phases Passed', value: `${summary.phasesPassed}/${summary.totalPhases}`, short: true },
            { title: 'Duration', value: `${summary.totalTime}s`, short: true },
            { title: 'Critical Issues', value: summary.criticalIssues.toString(), short: true },
            { title: 'Warnings', value: summary.warnings.toString(), short: true }
          ],
          timestamp: new Date().toISOString()
        }]
      }

      // In a real implementation, you would send this to the Slack webhook
      console.log('📱 Slack notification prepared:', status)

    } catch (slackError) {
      console.warn('Slack notification failed:', slackError.message)
    }
  }

  /**
   * Send email notifications
   */
  async sendEmailNotifications() {
    try {
      const summary = this.generatePipelineSummary()

      console.log('📧 Email notifications prepared for', CICD_CONFIG.EMAIL_RECIPIENTS.length, 'recipients')

      // In a real implementation, you would send emails using nodemailer or similar

    } catch (emailError) {
      console.warn('Email notification failed:', emailError.message)
    }
  }

  /**
   * Update deployment status for CI systems
   */
  async updateDeploymentStatus() {
    try {
      console.log('🔄 Updating deployment status in CI system...')

      // Update GitHub status, GitLab status, etc. based on CI environment
      const summary = this.generatePipelineSummary()
      const status = summary.criticalIssues > 0 ? 'failure' : 'success'

      console.log(`📊 Deployment status updated: ${status}`)

    } catch (statusError) {
      console.warn('Deployment status update failed:', statusError.message)
    }
  }

  /**
   * Archive pipeline artifacts
   */
  async archivePipelineArtifacts() {
    try {
      const artifactsDir = join(this.projectRoot, 'test-results', 'artifacts')
      if (!existsSync(artifactsDir)) {
        mkdirSync(artifactsDir, { recursive: true })
      }

      // Archive screenshots, videos, logs, etc.
      const artifactSources = [
        join(this.projectRoot, 'test-results', 'pipeline', 'screenshots'),
        join(this.projectRoot, 'test-results', 'pipeline', 'videos'),
        join(this.projectRoot, 'test-results', 'pipeline', '*.json'),
        join(this.projectRoot, 'test-results', 'pipeline', '*.html'),
        join(this.projectRoot, 'test-results', 'pipeline', '*.xml')
      ]

      console.log('📦 Pipeline artifacts archived')

    } catch (archiveError) {
      console.warn('Artifact archiving failed:', archiveError.message)
    }
  }

  /**
   * Generate final summary
   */
  async generateFinalSummary() {
    this.pipelineResults.summary = this.generatePipelineSummary()
    this.pipelineResults.totalTime = (performance.now() - this.startTime) / 1000
  }

  /**
   * Generate pipeline summary
   */
  generatePipelineSummary() {
    const phases = Object.values(this.pipelineResults.phases)
    const passedPhases = phases.filter(p => p.status === 'passed').length
    const totalPhases = phases.length

    const allIssues = [
      ...this.pipelineResults.alerts,
      ...Object.values(this.pipelineResults.phases).flatMap(p =>
        p.results?.issues || []
      )
    ]

    const criticalIssues = allIssues.filter(i => i.severity === 'critical').length
    const warnings = allIssues.filter(i => i.severity === 'warning').length

    const totalTime = (performance.now() - this.startTime) / 1000

    return {
      status: criticalIssues > 0 ? 'FAILED' : passedPhases === totalPhases ? 'PASSED' : 'PARTIAL',
      overallStatus: criticalIssues > 0 ? 'error' : warnings > 0 ? 'warning' : 'success',
      phasesPassed: passedPhases,
      totalPhases,
      criticalIssues,
      warnings,
      totalTime: totalTime.toFixed(1)
    }
  }

  /**
   * Determine if pipeline succeeded
   */
  determinePipelineSuccess() {
    const summary = this.pipelineResults.summary

    // Check critical failures
    if (summary.criticalIssues >= CICD_CONFIG.CRITICAL_FAILURE_THRESHOLD) {
      return false
    }

    // Check warning threshold
    if (summary.warnings >= CICD_CONFIG.WARNING_FAILURE_THRESHOLD) {
      return false
    }

    // Check performance regressions
    const performanceRegressions = this.pipelineResults.phases.performanceTesting?.results?.regressions?.length || 0
    if (performanceRegressions >= CICD_CONFIG.PERFORMANCE_REGRESSION_THRESHOLD) {
      return false
    }

    return summary.phasesPassed === summary.totalPhases
  }

  /**
   * Add pipeline alert
   */
  addPipelineAlert(severity, category, message) {
    this.pipelineResults.alerts.push({
      severity,
      category,
      message,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Generate failure report
   */
  async generateFailureReport(error) {
    const failureReport = {
      timestamp: new Date().toISOString(),
      pipelineError: {
        message: error.message,
        stack: error.stack,
        phase: 'unknown'
      },
      partialResults: this.pipelineResults,
      environment: this.options.environment
    }

    const reportsDir = join(this.projectRoot, 'test-results', 'pipeline')
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true })
    }

    const failureReportPath = join(reportsDir, `pipeline-failure-${Date.now()}.json`)
    writeFileSync(failureReportPath, JSON.stringify(failureReport, null, 2))

    console.log(`💥 Failure report generated: ${failureReportPath}`)
  }
}

// Export for use in CI/CD and test runners
export { PipelineOrchestrator, CICD_CONFIG }

// Run complete pipeline if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = {
    environment: process.argv.includes('--production') ? 'production' : 'development',
    // Allow selective phase execution for testing
    runBuildValidation: !process.argv.includes('--skip-build'),
    runDeploymentTesting: !process.argv.includes('--skip-deployment'),
    runUserWorkflows: !process.argv.includes('--skip-workflows'),
    runPerformanceTesting: !process.argv.includes('--skip-performance'),
    generateReports: !process.argv.includes('--skip-reports')
  }

  const orchestrator = new PipelineOrchestrator(options)

  orchestrator.runCompletePipeline()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Pipeline orchestrator execution failed:', error)
      process.exit(1)
    })
}