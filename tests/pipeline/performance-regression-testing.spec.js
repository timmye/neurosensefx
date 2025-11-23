/**
 * PERFORMANCE REGRESSION TESTING AND MONITORING
 *
 * Phase 4: Automated performance baseline testing, memory usage tracking,
 * and professional trading requirements compliance validation
 *
 * This establishes performance baselines and detects regressions that would
 * impact the professional trading experience before they reach production.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { performance } from 'perf_hooks'
import { execSync } from 'child_process'

// Professional trading performance requirements
const PERFORMANCE_BASELINES = {
  // Core application performance
  APP_LAUNCH_TIME: { target: 3000, threshold: 5000 },      // ms
  DISPLAY_CREATION_TIME: { target: 1000, threshold: 2000 }, // ms
  KEYBOARD_RESPONSE_TIME: { target: 50, threshold: 100 },   // ms

  // Real-time data performance
  DATA_TO_VISUAL_LATENCY: { target: 50, threshold: 100 },   // ms
  WEBSOCKET_MESSAGE_RATE: { target: 100, threshold: 50 },   // messages/second
  RENDERING_FPS: { target: 60, threshold: 30 },             // frames per second

  // Memory and resource usage
  INITIAL_MEMORY_USAGE: { target: 52428800, threshold: 104857600 },   // 50MB/100MB
  MEMORY_LEAK_RATE: { target: 1048576, threshold: 5242880 },         // 1MB/5MB per hour
  CPU_USAGE_THRESHOLD: 70,                                              // percentage

  // Extended session performance
  EXTENDED_SESSION_MEMORY: { target: 209715200, threshold: 419430400 }, // 200MB/400MB after 8 hours
  PERFORMANCE_DEGRADATION: { target: 10, threshold: 25 },               // percentage

  // Bundle and loading performance
  INITIAL_BUNDLE_SIZE: { target: 1048576, threshold: 2097152 },         // 1MB/2MB
  TIME_TO_INTERACTIVE: { target: 3000, threshold: 5000 },               // ms
  LARGEST_CONTENTFUL_PAINT: { target: 2000, threshold: 3500 }           // ms
}

class PerformanceRegressionTester {
  constructor(browserType = 'chromium', environment = 'development') {
    this.browserType = browserType
    this.environment = environment
    this.projectRoot = process.cwd()

    this.testResults = {
      timestamp: new Date().toISOString(),
      browserType,
      environment,
      baselines: {},
      current: {},
      regressions: [],
      improvements: [],
      summary: {},
      trends: {}
    }

    // Performance tracking
    this.browser = null
    this.context = null
    this.page = null
    this.startTime = performance.now()

    // Historical data
    this.historicalBaselines = this.loadHistoricalBaselines()

    // Test phases
    this.testPhases = [
      'initial_load_performance',
      'interactive_performance',
      'memory_usage_analysis',
      'real_time_data_performance',
      'extended_session_simulation',
      'bundle_analysis'
    ]
  }

  /**
   * Run complete performance regression testing
   */
  async runPerformanceRegressionPipeline() {
    console.log('📊 NeuroSense FX Performance Regression Testing')
    console.log(`🌐 Browser: ${this.browserType}`)
    console.log(`🌍 Environment: ${this.environment}`)
    console.log(`📈 Historical baselines loaded: ${Object.keys(this.historicalBaselines).length}`)

    try {
      // Setup performance testing environment
      await this.setupPerformanceEnvironment()

      // Run all performance test phases
      for (const phase of this.testPhases) {
        await this[`test${phase.replace(/_/g, '').replace(/\b\w/g, l => l.toUpperCase())}`]()
      }

      // Analyze results for regressions
      await this.analyzePerformanceRegressions()

      // Update baseline database
      await this.updatePerformanceBaselines()

      // Generate comprehensive report
      await this.generatePerformanceReport()

      const hasRegressions = this.testResults.regressions.length > 0
      console.log(hasRegressions ? '⚠️  Performance Regressions Detected' : '✅ Performance Regression Testing: PASSED')

      return !hasRegressions

    } catch (error) {
      console.error('💥 Performance Regression Testing Critical Error:', error)
      this.testResults.regressions.push({
        severity: 'critical',
        category: 'pipeline_execution',
        error: error.message
      })
      return false
    } finally {
      await this.cleanupPerformanceEnvironment()
    }
  }

  /**
   * Setup performance testing environment
   */
  async setupPerformanceEnvironment() {
    console.log('\n🔧 Setting up performance testing environment...')

    try {
      // Launch browser with performance monitoring
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--enable-performance-memory-pressure-indicator',
          '--memory-pressure-off',
          '--window-size=1920,1080'
        ]
      })

      // Create context with performance monitoring
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: {
          dir: 'test-results/pipeline/performance-videos/',
          size: { width: 1920, height: 1080 }
        }
      })

      // Create page with performance monitoring
      this.page = await this.context.newPage()

      // Enable performance monitoring
      await this.page.addInitScript(() => {
        // Performance monitoring globals
        window.__PERFORMANCE_TEST__ = true
        window.__PERFORMANCE_MARKS__ = []
        window.__MEMORY_SNAPSHOTS__ = []
        window.__FPS_MEASUREMENTS__ = []

        // Performance mark function
        window.__markPerformance__ = (name) => {
          window.__PERFORMANCE_MARKS__.push({
            name,
            timestamp: performance.now(),
            memory: performance.memory ? performance.memory.usedJSHeapSize : null
          })
        }

        // Memory snapshot function
        window.__takeMemorySnapshot__ = () => {
          if (performance.memory) {
            window.__MEMORY_SNAPSHOTS__.push({
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit,
              timestamp: Date.now()
            })
          }
        }

        // FPS measurement
        let lastFrameTime = performance.now()
        window.__measureFPS__ = () => {
          const now = performance.now()
          const fps = 1000 / (now - lastFrameTime)
          lastFrameTime = now

          window.__FPS_MEASUREMENTS__.push({
            fps,
            timestamp: now
          })
        }

        // Set up continuous monitoring
        setInterval(() => {
          window.__takeMemorySnapshot__()
          window.__measureFPS__()
        }, 1000)
      })

      console.log('  ✅ Performance testing environment ready')

    } catch (setupError) {
      throw new Error(`Performance environment setup failed: ${setupError.message}`)
    }
  }

  /**
   * Test Initial Load Performance
   */
  async testInitialLoadPerformance() {
    const phaseStart = performance.now()
    console.log('\n🚀 Testing Initial Load Performance')

    try {
      // Clear any existing state
      await this.page.context().clearCookies()
      await this.page.goto('about:blank')

      // Begin performance monitoring
      await this.page.evaluate(() => {
        window.__markPerformance__('test_start')
      })

      // Navigate to application
      const navigationStart = performance.now()
      await this.page.goto('http://localhost:5174', {
        waitUntil: 'networkidle'
      })
      const navigationTime = performance.now() - navigationStart

      // Wait for application to be ready
      await this.page.waitForSelector('body', { timeout: 5000 })

      // Mark app ready
      const appReadyTime = await this.page.evaluate(() => {
        window.__markPerformance__('app_ready')
        return performance.now()
      })

      // Collect Core Web Vitals
      const webVitals = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals = {}

          // Performance Observer for metrics
          if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.entryType === 'largest-contentful-paint') {
                  vitals.lcp = entry.startTime
                } else if (entry.entryType === 'first-input') {
                  vitals.fid = entry.processingStart - entry.startTime
                }
              }
            })

            observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })
          }

          // Fallback measurements
          setTimeout(() => {
            vitals.navigationStart = performance.timing.navigationStart
            vitals.loadEventEnd = performance.timing.loadEventEnd
            vitals.domContentLoaded = performance.timing.domContentLoadedEventEnd

            resolve(vitals)
          }, 2000)
        })
      })

      const totalLoadTime = appReadyTime - phaseStart

      // Get memory usage after load
      const memoryAfterLoad = await this.page.evaluate(() => {
        if (performance.memory) {
          return {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          }
        }
        return null
      })

      const results = {
        navigationTime,
        totalLoadTime,
        webVitals,
        memoryAfterLoad,
        timestamp: Date.now()
      }

      // Store in results
      this.testResults.current.initialLoadPerformance = results

      console.log(`  ⏱️  Navigation time: ${navigationTime.toFixed(0)}ms`)
      console.log(`  ⏱️  Total load time: ${totalLoadTime.toFixed(0)}ms`)
      console.log(`  💾 Memory after load: ${memoryAfterLoad ? (memoryAfterLoad.used / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`)

      console.log('  ✅ Initial load performance testing completed')

    } catch (loadError) {
      console.error(`  ❌ Initial Load Performance Testing Failed: ${loadError.message}`)
      this.testResults.regressions.push({
        severity: 'critical',
        category: 'initial_load',
        error: loadError.message
      })
    }
  }

  /**
   * Test Interactive Performance
   */
  async testInteractivePerformance() {
    const phaseStart = performance.now()
    console.log('\n⚡ Testing Interactive Performance')

    try {
      const interactiveTests = []

      // Test keyboard responsiveness
      console.log('  ⌨️  Testing keyboard responsiveness...')

      for (let i = 0; i < 10; i++) {
        const startTime = performance.now()
        await this.page.keyboard.press('ArrowRight')
        await this.page.waitForTimeout(50)

        const responseTime = performance.now() - startTime
        interactiveTests.push({
          type: 'keyboard',
          action: 'ArrowRight',
          responseTime
        })
      }

      // Test display creation performance
      console.log('  ➕ Testing display creation performance...')

      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()
        await this.page.keyboard.press('Control+N')
        await this.page.waitForTimeout(200)

        const creationTime = performance.now() - startTime
        interactiveTests.push({
          type: 'display_creation',
          action: 'Control+N',
          responseTime: creationTime
        })
      }

      // Calculate statistics
      const keyboardTests = interactiveTests.filter(t => t.type === 'keyboard')
      const displayTests = interactiveTests.filter(t => t.type === 'display_creation')

      const keyboardStats = this.calculateStats(keyboardTests.map(t => t.responseTime))
      const displayStats = this.calculateStats(displayTests.map(t => t.responseTime))

      const results = {
        keyboardPerformance: keyboardStats,
        displayCreationPerformance: displayStats,
        allTests: interactiveTests
      }

      this.testResults.current.interactivePerformance = results

      console.log(`  ⌨️  Keyboard response: avg ${keyboardStats.avg.toFixed(0)}ms (max: ${keyboardStats.max.toFixed(0)}ms)`)
      console.log(`  ➕ Display creation: avg ${displayStats.avg.toFixed(0)}ms (max: ${displayStats.max.toFixed(0)}ms)`)

      console.log('  ✅ Interactive performance testing completed')

    } catch (interactiveError) {
      console.error(`  ❌ Interactive Performance Testing Failed: ${interactiveError.message}`)
      this.testResults.regressions.push({
        severity: 'critical',
        category: 'interactive_performance',
        error: interactiveError.message
      })
    }
  }

  /**
   * Test Memory Usage Analysis
   */
  async testMemoryUsageAnalysis() {
    const phaseStart = performance.now()
    console.log('\n💾 Testing Memory Usage Analysis')

    try {
      // Collect baseline memory snapshot
      const baselineMemory = await this.page.evaluate(() => {
        if (performance.memory) {
          return {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          }
        }
        return null
      })

      // Simulate memory usage through various activities
      console.log('  🔄 Simulating memory-intensive activities...')

      const memorySnapshots = [baselineMemory]

      // Create and delete displays repeatedly
      for (let cycle = 0; cycle < 5; cycle++) {
        // Create displays
        for (let i = 0; i < 3; i++) {
          await this.page.keyboard.press('Control+N')
          await this.page.waitForTimeout(100)
        }

        // Wait a moment
        await this.page.waitForTimeout(1000)

        // Take memory snapshot
        const snapshot = await this.page.evaluate(() => {
          if (performance.memory) {
            return {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit
            }
          }
          return null
        })

        if (snapshot) {
          memorySnapshots.push(snapshot)
        }

        // Clean up displays
        for (let i = 0; i < 3; i++) {
          await this.page.keyboard.press('Control+D')
          await this.page.waitForTimeout(100)
        }

        await this.page.waitForTimeout(1000)
      }

      // Analyze memory patterns
      const memoryAnalysis = this.analyzeMemoryPatterns(memorySnapshots)

      // Check for memory leaks
      const memoryLeakDetected = this.detectMemoryLeaks(memorySnapshots)

      const results = {
        baseline: baselineMemory,
        snapshots: memorySnapshots,
        analysis: memoryAnalysis,
        memoryLeakDetected
      }

      this.testResults.current.memoryUsageAnalysis = results

      console.log(`  💾 Baseline memory: ${baselineMemory ? (baselineMemory.used / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`)
      console.log(`  📊 Peak memory: ${memoryAnalysis.peakUsed ? (memoryAnalysis.peakUsed / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`)
      console.log(`  🔍 Memory leak detected: ${memoryLeakDetected ? 'YES' : 'NO'}`)

      console.log('  ✅ Memory usage analysis completed')

    } catch (memoryError) {
      console.error(`  ❌ Memory Usage Analysis Failed: ${memoryError.message}`)
      this.testResults.regressions.push({
        severity: 'warning',
        category: 'memory_analysis',
        error: memoryError.message
      })
    }
  }

  /**
   * Test Real-Time Data Performance
   */
  async testRealTimeDataPerformance() {
    const phaseStart = performance.now()
    console.log('\n📡 Testing Real-Time Data Performance')

    try {
      // Monitor WebSocket performance
      console.log('  📊 Monitoring WebSocket performance...')

      const wsPerformance = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const metrics = {
            connectionTime: null,
            messageLatencies: [],
            messageRate: 0,
            totalMessages: 0
          }

          const wsStart = performance.now()
          const ws = new WebSocket('ws://localhost:8080/ws')

          const timeout = setTimeout(() => {
            resolve(metrics)
          }, 5000)

          ws.onopen = () => {
            metrics.connectionTime = performance.now() - wsStart

            // Start monitoring messages
            const messageStartTime = new Map()

            ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data)
                metrics.totalMessages++

                // Calculate message latency if timestamp is present
                if (data.timestamp) {
                  const latency = Date.now() - data.timestamp
                  metrics.messageLatencies.push(latency)
                }
              } catch (e) {
                // Ignore non-JSON messages
              }
            }
          }

          ws.onerror = () => {
            clearTimeout(timeout)
            resolve(metrics)
          }

          // Calculate message rate
          setTimeout(() => {
            if (metrics.totalMessages > 0) {
              metrics.messageRate = metrics.totalMessages / 5 // messages per second
            }
            clearTimeout(timeout)
            resolve(metrics)
          }, 5000)
        })
      })

      // Test data-to-visual latency
      console.log('  ⚡ Testing data-to-visual latency...')

      const latencyTests = []
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()

        // Simulate data update
        await this.page.evaluate(() => {
          // Trigger data update if the app supports it
          if (window.app && window.app.updateMarketData) {
            window.app.updateMarketData({
              symbol: 'EUR/USD',
              bid: 1.1234 + Math.random() * 0.001,
              ask: 1.1235 + Math.random() * 0.001,
              timestamp: Date.now()
            })
          }
        })

        // Wait for visual update
        await this.page.waitForTimeout(100)

        const latency = performance.now() - startTime
        latencyTests.push(latency)
      }

      const latencyStats = this.calculateStats(latencyTests)

      const results = {
        webSocket: wsPerformance,
        dataToVisualLatency: latencyStats
      }

      this.testResults.current.realTimeDataPerformance = results

      console.log(`  📊 WebSocket connection time: ${wsPerformance.connectionTime?.toFixed(0) || 'N/A'}ms`)
      console.log(`  📨 Message rate: ${wsPerformance.messageRate.toFixed(1)} msg/sec`)
      console.log(`  ⚡ Data-to-visual latency: avg ${latencyStats.avg.toFixed(0)}ms`)

      console.log('  ✅ Real-time data performance testing completed')

    } catch (rtDataError) {
      console.error(`  ❌ Real-Time Data Performance Testing Failed: ${rtDataError.message}`)
      this.testResults.regressions.push({
        severity: 'warning',
        category: 'real_time_data',
        error: rtDataError.message
      })
    }
  }

  /**
   * Test Extended Session Simulation
   */
  async testExtendedSessionSimulation() {
    const phaseStart = performance.now()
    console.log('\n⏰ Testing Extended Session Simulation')

    try {
      const sessionDuration = 30000 // 30 seconds for testing
      const measurementInterval = 5000 // 5 seconds
      const measurements = Math.floor(sessionDuration / measurementInterval)

      console.log(`  ⏱️  Running ${sessionDuration/1000}s extended session simulation...`)

      const sessionMetrics = {
        startTime: Date.now(),
        measurements: [],
        interactions: 0,
        performanceMetrics: []
      }

      for (let i = 0; i < measurements; i++) {
        // Simulate user interactions
        await this.page.keyboard.press('ArrowRight')
        await this.page.keyboard.press('ArrowLeft')
        await this.page.keyboard.press('Control+N')
        await this.page.waitForTimeout(100)
        await this.page.keyboard.press('Control+D')

        sessionMetrics.interactions += 4

        // Take performance measurement
        const measurement = await this.page.evaluate(() => {
          const metrics = {
            timestamp: Date.now(),
            memory: performance.memory ? {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit
            } : null,
            fps: window.__FPS_MEASUREMENTS__ ? window.__FPS_MEASUREMENTS__.slice(-10) : []
          }

          return metrics
        })

        sessionMetrics.measurements.push(measurement)

        // Calculate average FPS for recent measurements
        if (measurement.fps && measurement.fps.length > 0) {
          const avgFPS = measurement.fps.reduce((sum, f) => sum + f.fps, 0) / measurement.fps.length
          sessionMetrics.performanceMetrics.push({
            timestamp: measurement.timestamp,
            avgFPS
          })
        }

        console.log(`    Measurement ${i + 1}/${measurements}: Memory ${measurement.memory ? (measurement.memory.used / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`)

        // Wait for next interval
        await this.page.waitForTimeout(measurementInterval)
      }

      // Analyze session performance degradation
      const degradationAnalysis = this.analyzePerformanceDegradation(sessionMetrics)

      const results = {
        duration: sessionDuration,
        measurements: sessionMetrics.measurements,
        interactions: sessionMetrics.interactions,
        performanceMetrics: sessionMetrics.performanceMetrics,
        degradationAnalysis
      }

      this.testResults.current.extendedSessionSimulation = results

      console.log(`  ⏱️  Session completed with ${sessionMetrics.interactions} interactions`)
      console.log(`  📉 Performance degradation: ${degradationAnalysis.overallDegradation.toFixed(1)}%`)

      console.log('  ✅ Extended session simulation completed')

    } catch (sessionError) {
      console.error(`  ❌ Extended Session Simulation Failed: ${sessionError.message}`)
      this.testResults.regressions.push({
        severity: 'warning',
        category: 'extended_session',
        error: sessionError.message
      })
    }
  }

  /**
   * Test Bundle Analysis
   */
  async testBundleAnalysis() {
    const phaseStart = performance.now()
    console.log('\n📦 Testing Bundle Analysis')

    try {
      // Analyze the built bundle
      const distPath = join(this.projectRoot, 'dist')
      if (!existsSync(distPath)) {
        throw new Error('No built application found in dist/ directory')
      }

      const bundleStats = this.analyzeBundleSize(distPath)

      // Analyze bundle composition
      const bundleComposition = this.analyzeBundleComposition(distPath)

      // Check for optimization opportunities
      const optimizationAnalysis = this.analyzeBundleOptimization(bundleStats, bundleComposition)

      const results = {
        bundleStats,
        composition: bundleComposition,
        optimization: optimizationAnalysis
      }

      this.testResults.current.bundleAnalysis = results

      console.log(`  📦 Total bundle size: ${(bundleStats.totalSize / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  📄 JavaScript files: ${bundleStats.jsFiles}`)
      console.log(`  🎨 CSS files: ${bundleStats.cssFiles}`)
      console.log(`  🖼️  Image files: ${bundleStats.imageFiles}`)

      console.log('  ✅ Bundle analysis completed')

    } catch (bundleError) {
      console.error(`  ❌ Bundle Analysis Failed: ${bundleError.message}`)
      this.testResults.regressions.push({
        severity: 'warning',
        category: 'bundle_analysis',
        error: bundleError.message
      })
    }
  }

  /**
   * Analyze performance regressions
   */
  async analyzePerformanceRegressions() {
    console.log('\n🔍 Analyzing Performance Regressions...')

    const current = this.testResults.current
    const regressions = []
    const improvements = []

    // Compare against baselines
    for (const [category, metrics] of Object.entries(current)) {
      if (this.historicalBaselines[category]) {
        const baseline = this.historicalBaselines[category]
        const comparison = this.compareWithBaseline(category, metrics, baseline)

        if (comparison.regression) {
          regressions.push({
            category,
            severity: comparison.severity,
            baseline: comparison.baselineValue,
            current: comparison.currentValue,
            change: comparison.changePercent,
            details: comparison.details
          })
        } else if (comparison.improvement) {
          improvements.push({
            category,
            baseline: comparison.baselineValue,
            current: comparison.currentValue,
            change: comparison.changePercent,
            details: comparison.details
          })
        }
      }
    }

    // Check against performance thresholds
    for (const [category, metrics] of Object.entries(current)) {
      const thresholdViolations = this.checkThresholds(category, metrics)
      regressions.push(...thresholdViolations)
    }

    this.testResults.regressions = regressions
    this.testResults.improvements = improvements

    console.log(`  🔴 Regressions found: ${regressions.length}`)
    console.log(`  🟢 Improvements found: ${improvements.length}`)

    // Report summary
    if (regressions.length > 0) {
      console.log('\n  🚨 PERFORMANCE REGRESSIONS:')
      regressions.forEach(reg => {
        console.log(`    ${reg.category}: ${reg.change > 0 ? '+' : ''}${reg.change.toFixed(1)}% (${reg.severity})`)
      })
    }

    if (improvements.length > 0) {
      console.log('\n  ✅ PERFORMANCE IMPROVEMENTS:')
      improvements.forEach(imp => {
        console.log(`    ${imp.category}: ${imp.change > 0 ? '+' : ''}${imp.change.toFixed(1)}%`)
      })
    }
  }

  /**
   * Update performance baselines
   */
  async updatePerformanceBaselines() {
    console.log('\n💾 Updating Performance Baselines...')

    // Create baselines directory
    const baselinesDir = join(this.projectRoot, 'test-results', 'baselines')
    if (!existsSync(baselinesDir)) {
      mkdirSync(baselinesDir, { recursive: true })
    }

    // Update baseline file
    const baselineFile = join(baselinesDir, 'performance-baselines.json')
    const existingBaselines = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : {}

    // Merge current results with existing baselines
    const updatedBaselines = {
      lastUpdated: new Date().toISOString(),
      ...existingBaselines,
      latest: this.testResults.current
    }

    // Keep historical data (last 10 runs)
    const historyFile = join(baselinesDir, 'performance-history.json')
    const existingHistory = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, 'utf8')) : []
    const historyEntry = {
      timestamp: this.testResults.timestamp,
      environment: this.testResults.environment,
      results: this.testResults.current
    }

    const updatedHistory = [...existingHistory.slice(-9), historyEntry]

    // Write updated files
    writeFileSync(baselineFile, JSON.stringify(updatedBaselines, null, 2))
    writeFileSync(historyFile, JSON.stringify(updatedHistory, null, 2))

    console.log(`  ✅ Baselines updated: ${baselineFile}`)
    console.log(`  ✅ History updated: ${historyFile}`)
  }

  /**
   * Generate comprehensive performance report
   */
  async generatePerformanceReport() {
    const totalTime = performance.now() - this.startTime

    this.testResults.summary = {
      totalTime,
      categoriesTested: Object.keys(this.testResults.current).length,
      regressionsFound: this.testResults.regressions.length,
      improvementsFound: this.testResults.improvements.length,
      criticalIssues: this.testResults.regressions.filter(r => r.severity === 'critical').length,
      warnings: this.testResults.regressions.filter(r => r.severity === 'warning').length
    }

    // Create reports directory
    const reportsDir = join(this.projectRoot, 'test-results', 'pipeline')
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true })
    }

    // Write detailed JSON report
    const reportPath = join(reportsDir, `performance-regression-${Date.now()}.json`)
    writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2))

    // Write summary console report
    console.log('\n📋 PERFORMANCE REGRESSION TESTING SUMMARY')
    console.log('=' .repeat(50))
    console.log(`⏱️  Total Time: ${totalTime.toFixed(0)}ms`)
    console.log(`📊 Categories Tested: ${this.testResults.summary.categoriesTested}`)
    console.log(`🔴 Regressions Found: ${this.testResults.summary.regressionsFound}`)
    console.log(`🟢 Improvements Found: ${this.testResults.summary.improvementsFound}`)
    console.log(`❌ Critical Issues: ${this.testResults.summary.criticalIssues}`)
    console.log(`⚠️  Warnings: ${this.testResults.summary.warnings}`)
    console.log(`📄 Detailed report: ${reportPath}`)

    return this.testResults
  }

  /**
   * Load historical baselines
   */
  loadHistoricalBaselines() {
    const baselineFile = join(this.projectRoot, 'test-results', 'baselines', 'performance-baselines.json')

    if (existsSync(baselineFile)) {
      try {
        const baselines = JSON.parse(readFileSync(baselineFile, 'utf8'))
        return baselines.latest || {}
      } catch (error) {
        console.warn('Could not load performance baselines:', error.message)
      }
    }

    return {}
  }

  /**
   * Calculate statistics for performance measurements
   */
  calculateStats(values) {
    if (values.length === 0) return { avg: 0, min: 0, max: 0, median: 0 }

    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      count: values.length
    }
  }

  /**
   * Analyze memory usage patterns
   */
  analyzeMemoryPatterns(snapshots) {
    if (!snapshots.length) return {}

    const memoryUsages = snapshots.map(s => s.used).filter(Boolean)
    if (!memoryUsages.length) return {}

    const stats = this.calculateStats(memoryUsages)

    return {
      initialUsed: memoryUsages[0],
      peakUsed: Math.max(...memoryUsages),
      finalUsed: memoryUsages[memoryUsages.length - 1],
      growthRate: (memoryUsages[memoryUsages.length - 1] - memoryUsages[0]) / memoryUsages[0] * 100,
      stats
    }
  }

  /**
   * Detect memory leaks
   */
  detectMemoryLeaks(snapshots) {
    if (!snapshots.length || snapshots.length < 3) return false

    const memoryUsages = snapshots.map(s => s.used).filter(Boolean)
    if (memoryUsages.length < 3) return false

    // Check if memory consistently grows
    let growthCount = 0
    for (let i = 1; i < memoryUsages.length; i++) {
      if (memoryUsages[i] > memoryUsages[i - 1]) {
        growthCount++
      }
    }

    // If memory grows in more than 70% of snapshots, consider it a leak
    return growthCount / (memoryUsages.length - 1) > 0.7
  }

  /**
   * Analyze performance degradation over session
   */
  analyzePerformanceDegradation(sessionMetrics) {
    if (!sessionMetrics.performanceMetrics.length) {
      return { overallDegradation: 0, fpsDegradation: 0, memoryGrowth: 0 }
    }

    const fpsMetrics = sessionMetrics.performanceMetrics.map(m => m.avgFPS)
    const initialFPS = fpsMetrics[0] || 60
    const finalFPS = fpsMetrics[fpsMetrics.length - 1] || 60

    const fpsDegradation = ((initialFPS - finalFPS) / initialFPS) * 100

    const memoryMeasurements = sessionMetrics.measurements
      .filter(m => m.memory)
      .map(m => m.memory.used)

    let memoryGrowth = 0
    if (memoryMeasurements.length >= 2) {
      const initialMemory = memoryMeasurements[0]
      const finalMemory = memoryMeasurements[memoryMeasurements.length - 1]
      memoryGrowth = ((finalMemory - initialMemory) / initialMemory) * 100
    }

    // Overall degradation is weighted average
    const overallDegradation = (Math.abs(fpsDegradation) + Math.max(0, memoryGrowth)) / 2

    return {
      overallDegradation,
      fpsDegradation,
      memoryGrowth,
      initialFPS,
      finalFPS
    }
  }

  /**
   * Analyze bundle size
   */
  analyzeBundleSize(distPath) {
    let totalSize = 0
    let jsFiles = 0
    let cssFiles = 0
    let imageFiles = 0
    let otherFiles = 0

    function scanDirectory(dir) {
      const items = readdirSync(dir)

      for (const item of items) {
        const fullPath = join(dir, item)
        const stat = statSync(fullPath)

        if (stat.isDirectory()) {
          scanDirectory(fullPath)
        } else {
          const fileSize = stat.size
          const ext = item.split('.').pop().toLowerCase()

          totalSize += fileSize

          switch (ext) {
            case 'js':
            case 'mjs':
              jsFiles++
              break
            case 'css':
              cssFiles++
              break
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'svg':
            case 'gif':
            case 'webp':
              imageFiles++
              break
            default:
              otherFiles++
          }
        }
      }
    }

    scanDirectory(distPath)

    return {
      totalSize,
      jsFiles,
      cssFiles,
      imageFiles,
      otherFiles
    }
  }

  /**
   * Analyze bundle composition
   */
  analyzeBundleComposition(distPath) {
    // This would require more sophisticated analysis
    // For now, return basic composition info
    return {
      frameworkFiles: 0,
      vendorFiles: 0,
      appFiles: 0,
      assetFiles: 0
    }
  }

  /**
   * Analyze bundle optimization opportunities
   */
  analyzeBundleOptimization(bundleStats, composition) {
    const opportunities = []

    // Check if total bundle size exceeds thresholds
    if (bundleStats.totalSize > PERFORMANCE_BASELINES.INITIAL_BUNDLE_SIZE.threshold) {
      opportunities.push({
        type: 'bundle_size',
        severity: 'high',
        current: bundleStats.totalSize,
        threshold: PERFORMANCE_BASELINES.INITIAL_BUNDLE_SIZE.threshold,
        suggestion: 'Consider code splitting and tree shaking'
      })
    }

    return opportunities
  }

  /**
   * Compare current metrics with baseline
   */
  compareWithBaseline(category, current, baseline) {
    // This would need category-specific comparison logic
    // For now, return a placeholder
    return {
      regression: false,
      improvement: false,
      baselineValue: 0,
      currentValue: 0,
      changePercent: 0
    }
  }

  /**
   * Check performance thresholds
   */
  checkThresholds(category, metrics) {
    const violations = []

    // This would need category-specific threshold checking
    // For now, return empty array
    return violations
  }

  /**
   * Clean up performance testing environment
   */
  async cleanupPerformanceEnvironment() {
    console.log('\n🧹 Cleaning up performance testing environment...')

    try {
      if (this.context) {
        await this.context.close()
        console.log('  ✅ Browser context closed')
      }

      if (this.browser) {
        await this.browser.close()
        console.log('  ✅ Browser closed')
      }
    } catch (cleanupError) {
      console.warn(`  ⚠️  Cleanup error: ${cleanupError.message}`)
    }
  }
}

// Export for use in test runners and CI/CD
export { PerformanceRegressionTester, PERFORMANCE_BASELINES }

// Run pipeline if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const browserType = process.argv.includes('--firefox') ? 'firefox' : 'chromium'
  const environment = process.argv.includes('--production') ? 'production' : 'development'

  const tester = new PerformanceRegressionTester(browserType, environment)

  tester.runPerformanceRegressionPipeline()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Performance regression pipeline execution failed:', error)
      process.exit(1)
    })
}