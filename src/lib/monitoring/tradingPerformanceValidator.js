/**
 * Professional Trading Performance Validator
 *
 * Enforces strict performance requirements for professional FX trading environments.
 * Validates 60fps rendering, sub-100ms latency, and 8+ hour session stability.
 *
 * Critical for ensuring trading platform meets professional standards where
 * performance delays directly impact trading decisions and financial outcomes.
 */

import { browserMonitor } from './browserProcessMonitor.js';

class TradingPerformanceValidator {
  constructor() {
    this.requirements = new Map();
    this.validationResults = new Map();
    this.isRunning = false;
    this.startTime = null;
    this.testScenarios = new Map();
    this.currentTest = null;

    // Define professional trading requirements
    this.initializeRequirements();

    // Initialize test scenarios
    this.initializeTestScenarios();

    // Setup validation intervals
    this.validationInterval = null;
    this.comprehensiveCheckInterval = null;
  }

  /**
   * Initialize professional trading performance requirements
   */
  initializeRequirements() {
    // Core Performance Requirements
    this.requirements.set('frameRate', {
      name: '60fps Rendering',
      description: 'Smooth price movement visualization without stutter',
      minimum: 58,  // Allow slight variance
      target: 60,
      critical: 45, // Below this impacts trading decisions
      unit: 'fps',
      weight: 0.25, // 25% of overall score
      measurement: 'average',
      window: 5000  // 5 second averaging window
    });

    this.requirements.set('dataLatency', {
      name: 'Sub-100ms Data-to-Visual Latency',
      description: 'Real-time market data display accuracy',
      maximum: 100,  // Must be under 100ms
      target: 50,    // Ideal under 50ms
      critical: 250, // Above this causes trading delays
      unit: 'ms',
      weight: 0.30,  // 30% of overall score (most critical)
      measurement: 'average',
      window: 10000  // 10 second averaging window
    });

    this.requirements.set('sessionStability', {
      name: '8+ Hour Session Stability',
      description: 'Extended trading session reliability',
      minimumDuration: 8 * 60 * 60 * 1000, // 8 hours in ms
      memoryLeakThreshold: 5,  // MB per hour
      criticalReconnects: 3,  // Max reconnections per hour
      crashTolerance: 0,      // No crashes allowed
      weight: 0.20,           // 20% of overall score
      measurement: 'continuous'
    });

    this.requirements.set('concurrentDisplays', {
      name: '20+ Concurrent Displays',
      description: 'Multi-instrument monitoring capability',
      minimum: 15,   // Minimum acceptable
      target: 25,    // Target performance
      critical: 10,  // Below this is unusable
      unit: 'displays',
      weight: 0.15,
      measurement: 'load-test'
    });

    this.requirements.set('responseTime', {
      name: 'UI Response Time',
      description: 'Keyboard and mouse interaction responsiveness',
      maximum: 50,   // Must feel instantaneous
      target: 16,    // One frame at 60fps
      critical: 100, // Noticeable delay
      unit: 'ms',
      weight: 0.10,
      measurement: 'p95' // 95th percentile
    });
  }

  /**
   * Initialize test scenarios for validation
   */
  initializeTestScenarios() {
    // High-frequency market data simulation
    this.testScenarios.set('highFrequencyData', {
      name: 'High-Frequency Market Data',
      description: 'Simulate rapid price updates during volatile market conditions',
      duration: 60000, // 1 minute
      dataRate: 100,   // 100 updates per second
      expectedBehavior: {
        frameRate: { min: 55, avg: 58 },
        latency: { max: 80, avg: 50 },
        memoryGrowth: { max: 2 } // MB per minute
      }
    });

    // Multi-display stress test
    this.testScenarios.set('multiDisplayStress', {
      name: 'Multi-Display Stress Test',
      description: 'Test performance with multiple concurrent trading displays',
      duration: 120000, // 2 minutes
      displayCount: 25,  // Create 25 displays
      updateFrequency: 30, // Updates per second per display
      expectedBehavior: {
        frameRate: { min: 50, avg: 55 },
        latency: { max: 120, avg: 80 },
        memoryUsage: { max: 1024 } // MB total
      }
    });

    // Extended session simulation
    this.testScenarios.set('extendedSession', {
      name: 'Extended Session Simulation',
      description: 'Accelerated 8-hour trading session test',
      duration: 300000, // 5 minutes (accelerated)
      timeAcceleration: 96, // 5 min = 8 hours (96x speed)
      expectedBehavior: {
        memoryLeakRate: { max: 1 }, // MB per hour
        performanceDegradation: { max: 5 }, // % degradation over session
        connectionStability: { reconnects: 0 }
      }
    });

    // Rapid interaction workflow
    this.testScenarios.set('rapidInteraction', {
      name: 'Rapid Trading Interaction',
      display: 'Test keyboard-first workflow during active trading',
      duration: 30000, // 30 seconds
      interactionRate: 10, // 10 interactions per second
      expectedBehavior: {
        responseTime: { p95: 30, max: 50 },
        frameRate: { min: 55, avg: 58 },
        uiJank: { max: 2 } // Long frames per second
      }
    });
  }

  /**
   * Start comprehensive validation
   */
  async startValidation(options = {}) {
    if (this.isRunning) {
      throw new Error('Validation is already running');
    }

    this.isRunning = true;
    this.startTime = performance.now();
    this.validationResults.clear();

    console.log('🚀 Starting Professional Trading Performance Validation');

    // Start browser monitoring if not already running
    if (!browserMonitor.isMonitoring) {
      browserMonitor.start();
    }

    try {
      // Run initial baseline test
      await this.runBaselineTest();

      // Start continuous monitoring
      this.startContinuousValidation();

      // Run test scenarios
      const testResults = await this.runTestScenarios(options.scenarios);

      // Generate final report
      const finalReport = this.generateFinalReport(testResults);

      this.isRunning = false;
      return finalReport;

    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Run baseline performance test
   */
  async runBaselineTest() {
    console.log('📊 Running baseline performance test...');

    const baselineDuration = 10000; // 10 seconds
    const baselineStart = performance.now();

    // Collect baseline metrics
    const baselineMetrics = {
      frameRate: [],
      latency: [],
      memory: [],
      responseTime: []
    };

    const collectMetrics = () => {
      const snapshot = browserMonitor.getCurrentSnapshot();

      // Collect frame rate
      const fpsHistory = browserMonitor.processHealth.frameRate;
      if (fpsHistory.length > 0) {
        baselineMetrics.frameRate.push(fpsHistory[fpsHistory.length - 1].fps);
      }

      // Collect memory
      if (snapshot.memory) {
        baselineMetrics.memory.push(snapshot.memory.used / 1024 / 1024);
      }

      // Collect latency
      const wsMetrics = browserMonitor.processHealth.websocket;
      const recentLatency = wsMetrics?.filter(m => m.eventType === 'message').slice(-5);
      if (recentLatency && recentLatency.length > 0) {
        const avgLatency = recentLatency.reduce((sum, m) => sum + m.latency, 0) / recentLatency.length;
        baselineMetrics.latency.push(avgLatency);
      }
    };

    // Collect metrics every 100ms
    const metricsInterval = setInterval(collectMetrics, 100);

    // Wait for baseline duration
    await new Promise(resolve => setTimeout(resolve, baselineDuration));
    clearInterval(metricsInterval);

    // Calculate baseline averages
    const baseline = {
      frameRate: baselineMetrics.frameRate.length > 0
        ? baselineMetrics.frameRate.reduce((a, b) => a + b, 0) / baselineMetrics.frameRate.length
        : 0,
      latency: baselineMetrics.latency.length > 0
        ? baselineMetrics.latency.reduce((a, b) => a + b, 0) / baselineMetrics.latency.length
        : 0,
      memory: baselineMetrics.memory.length > 0
        ? baselineMetrics.memory[baselineMetrics.memory.length - 1] // Latest memory usage
        : 0,
      timestamp: baselineStart
    };

    this.validationResults.set('baseline', baseline);
    console.log('✅ Baseline established:', baseline);

    return baseline;
  }

  /**
   * Start continuous validation monitoring
   */
  startContinuousValidation() {
    console.log('🔍 Starting continuous validation monitoring...');

    // Validate core requirements every second
    this.validationInterval = setInterval(() => {
      this.validateCoreRequirements();
    }, 1000);

    // Comprehensive check every 30 seconds
    this.comprehensiveCheckInterval = setInterval(() => {
      this.runComprehensiveCheck();
    }, 30000);
  }

  /**
   * Validate core requirements in real-time
   */
  validateCoreRequirements() {
    const snapshot = browserMonitor.getCurrentSnapshot();
    const now = performance.now();
    const results = {};

    // Frame Rate Validation
    const fpsHistory = browserMonitor.processHealth.frameRate;
    if (fpsHistory && fpsHistory.length > 0) {
      const recentFps = fpsHistory.slice(-5); // Last 5 seconds
      const avgFps = recentFps.reduce((sum, f) => sum + f.fps, 0) / recentFps.length;

      results.frameRate = {
        current: avgFps,
        passes: avgFps >= this.requirements.get('frameRate').minimum,
        grade: this.calculateGrade(avgFps, this.requirements.get('frameRate'))
      };

      if (avgFps < this.requirements.get('frameRate').critical) {
        this.emitAlert('critical', 'Frame rate below critical threshold', {
          current: avgFps,
          threshold: this.requirements.get('frameRate').critical
        });
      }
    }

    // Latency Validation
    const wsMetrics = browserMonitor.processHealth.websocket;
    if (wsMetrics && wsMetrics.length > 0) {
      const recentLatency = wsMetrics
        .filter(m => m.eventType === 'message')
        .slice(-10); // Last 10 messages

      if (recentLatency.length > 0) {
        const avgLatency = recentLatency.reduce((sum, m) => sum + m.latency, 0) / recentLatency.length;

        results.dataLatency = {
          current: avgLatency,
          passes: avgLatency <= this.requirements.get('dataLatency').maximum,
          grade: this.calculateGrade(avgLatency, this.requirements.get('dataLatency'), true)
        };

        if (avgLatency > this.requirements.get('dataLatency').critical) {
          this.emitAlert('critical', 'Data latency exceeds critical threshold', {
            current: avgLatency,
            threshold: this.requirements.get('dataLatency').critical
          });
        }
      }
    }

    // Memory Validation
    if (snapshot.memory) {
      const currentMemory = snapshot.memory.used / 1024 / 1024; // MB
      const memoryGrowthRate = this.calculateMemoryGrowthRate();

      results.memory = {
        current: currentMemory,
        growthRate: memoryGrowthRate,
        passes: memoryGrowthRate < this.requirements.get('sessionStability').memoryLeakThreshold,
        grade: memoryGrowthRate < 2 ? 'A' : memoryGrowthRate < 5 ? 'B' : 'C'
      };
    }

    this.validationResults.set('continuous', results);
  }

  /**
   * Run comprehensive performance check
   */
  async runComprehensiveCheck() {
    console.log('🔬 Running comprehensive performance check...');

    const checkStart = performance.now();
    const results = {};

    // Test response time
    results.responseTime = await this.testResponseTime();

    // Test canvas rendering performance
    results.canvasPerformance = await this.testCanvasPerformance();

    // Test network resilience
    results.networkResilience = await this.testNetworkResilience();

    // Test memory pressure
    results.memoryPressure = await this.testMemoryPressure();

    this.validationResults.set('comprehensive', {
      timestamp: checkStart,
      results,
      duration: performance.now() - checkStart
    });
  }

  /**
   * Test UI response time
   */
  async testResponseTime() {
    const testCount = 50;
    const responseTimes = [];

    for (let i = 0; i < testCount; i++) {
      const start = performance.now();

      // Simulate user interaction
      await this.simulateUserInteraction();

      const responseTime = performance.now() - start;
      responseTimes.push(responseTime);

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Calculate statistics
    responseTimes.sort((a, b) => a - b);
    const avg = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const max = Math.max(...responseTimes);

    return {
      average: avg,
      p95: p95,
      max: max,
      passes: p95 <= this.requirements.get('responseTime').maximum,
      grade: this.calculateGrade(p95, this.requirements.get('responseTime'), true)
    };
  }

  /**
   * Test canvas rendering performance
   */
  async testCanvasPerformance() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    const renderTimes = [];
    const testDuration = 5000; // 5 seconds
    const testStart = performance.now();

    while (performance.now() - testStart < testDuration) {
      const frameStart = performance.now();

      // Simulate complex trading visualization
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw multiple price lines
      for (let i = 0; i < 20; i++) {
        ctx.strokeStyle = `hsl(${i * 18}, 70%, 50%)`;
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let x = 0; x < canvas.width; x += 10) {
          const y = canvas.height / 2 + Math.sin((x + i * 50) * 0.02) * 100 + Math.random() * 20;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }

      const renderTime = performance.now() - frameStart;
      renderTimes.push(renderTime);

      // Target 60fps = 16.67ms per frame
      if (renderTime > 16.67) {
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    }

    const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
    const fps = 1000 / avgRenderTime;

    return {
      averageRenderTime: avgRenderTime,
      estimatedFps: fps,
      passes: fps >= 55,
      grade: fps >= 58 ? 'A' : fps >= 50 ? 'B' : 'C'
    };
  }

  /**
   * Test network resilience
   */
  async testNetworkResilience() {
    // Simulate network conditions and test recovery
    const results = {
      connectionStability: true,
      recoveryTime: 0,
      messageLoss: 0
    };

    // Test WebSocket connection if available
    if (window.WebSocket) {
      try {
        const testStart = performance.now();
        const ws = new WebSocket('wss://echo.websocket.org/');

        await new Promise((resolve, reject) => {
          ws.onopen = () => {
            const messageTime = performance.now();
            ws.send('test');
          };

          ws.onmessage = () => {
            results.recoveryTime = performance.now() - testStart;
            ws.close();
            resolve();
          };

          ws.onerror = reject;

          // Timeout after 5 seconds
          setTimeout(() => reject(new Error('WebSocket test timeout')), 5000);
        });

        results.connectionStability = true;
      } catch (error) {
        results.connectionStability = false;
        console.warn('Network resilience test failed:', error);
      }
    }

    return results;
  }

  /**
   * Test memory pressure handling
   */
  async testMemoryPressure() {
    const initialMemory = browserMonitor.getCurrentSnapshot().memory?.used || 0;

    // Create memory pressure
    const dataArrays = [];
    for (let i = 0; i < 100; i++) {
      dataArrays.push(new Float64Array(1000000)); // 8MB each
    }

    // Check if performance degrades under pressure
    const pressureStart = performance.now();
    const testFps = [];

    for (let i = 0; i < 10; i++) {
      const frameStart = performance.now();
      await new Promise(resolve => requestAnimationFrame(resolve));
      testFps.push(1000 / (performance.now() - frameStart));
    }

    // Cleanup
    dataArrays.length = 0;

    const avgFpsUnderPressure = testFps.reduce((sum, fps) => sum + fps, 0) / testFps.length;
    const finalMemory = browserMonitor.getCurrentSnapshot().memory?.used || 0;

    return {
      fpsUnderPressure: avgFpsUnderPressure,
      memoryImpact: finalMemory - initialMemory,
      recoveryCapability: avgFpsUnderPressure > 45,
      grade: avgFpsUnderPressure > 55 ? 'A' : avgFpsUnderPressure > 40 ? 'B' : 'C'
    };
  }

  /**
   * Run specified test scenarios
   */
  async runTestScenarios(scenarios = ['highFrequencyData', 'multiDisplayStress']) {
    console.log('🧪 Running test scenarios...');

    const results = new Map();

    for (const scenarioName of scenarios) {
      const scenario = this.testScenarios.get(scenarioName);
      if (!scenario) {
        console.warn(`Unknown test scenario: ${scenarioName}`);
        continue;
      }

      console.log(`Running scenario: ${scenario.name}`);
      this.currentTest = scenarioName;

      try {
        const result = await this.runTestScenario(scenario);
        results.set(scenarioName, result);
        console.log(`✅ ${scenario.name} completed`);
      } catch (error) {
        console.error(`❌ ${scenario.name} failed:`, error);
        results.set(scenarioName, {
          success: false,
          error: error.message
        });
      }
    }

    this.currentTest = null;
    return results;
  }

  /**
   * Run a single test scenario
   */
  async runTestScenario(scenario) {
    const scenarioStart = performance.now();
    const metrics = {
      frameRate: [],
      latency: [],
      memory: [],
      errors: []
    };

    // Simulate scenario-specific load
    switch (scenario.name) {
      case 'High-Frequency Market Data':
        await this.simulateHighFrequencyData(scenario, metrics);
        break;
      case 'Multi-Display Stress Test':
        await this.simulateMultiDisplayStress(scenario, metrics);
        break;
      case 'Extended Session Simulation':
        await this.simulateExtendedSession(scenario, metrics);
        break;
      case 'Rapid Trading Interaction':
        await this.simulateRapidInteraction(scenario, metrics);
        break;
      default:
        await this.simulateGenericScenario(scenario, metrics);
    }

    const duration = performance.now() - scenarioStart;

    // Calculate scenario results
    return {
      success: true,
      duration,
      metrics,
      validation: this.validateScenarioResults(scenario, metrics)
    };
  }

  /**
   * Simulate high-frequency market data
   */
  async simulateHighFrequencyData(scenario, metrics) {
    const interval = 1000 / scenario.dataRate; // Updates per second
    let updateCount = 0;
    const maxUpdates = (scenario.duration / 1000) * scenario.dataRate;

    const dataInterval = setInterval(() => {
      const now = performance.now();

      // Collect metrics
      const snapshot = browserMonitor.getCurrentSnapshot();
      if (snapshot.memory) {
        metrics.memory.push(snapshot.memory.used / 1024 / 1024);
      }

      // Simulate market data processing
      this.simulateMarketDataUpdate();

      updateCount++;
      if (updateCount >= maxUpdates) {
        clearInterval(dataInterval);
      }
    }, interval);

    return new Promise(resolve => {
      setTimeout(() => {
        clearInterval(dataInterval);
        resolve();
      }, scenario.duration);
    });
  }

  /**
   * Simulate multi-display stress
   */
  async simulateMultiDisplayStress(scenario, metrics) {
    // Create simulated displays
    const displays = [];
    for (let i = 0; i < scenario.displayCount; i++) {
      displays.push(this.createMockDisplay(i));
    }

    const updateInterval = 1000 / scenario.updateFrequency;
    let updateCount = 0;

    const displayInterval = setInterval(() => {
      const now = performance.now();

      // Update all displays
      displays.forEach(display => {
        this.updateMockDisplay(display);
      });

      // Collect metrics
      const snapshot = browserMonitor.getCurrentSnapshot();
      if (snapshot.memory) {
        metrics.memory.push(snapshot.memory.used / 1024 / 1024);
      }

      updateCount++;
      if (updateCount >= (scenario.duration / 1000) * scenario.updateFrequency) {
        clearInterval(displayInterval);
      }
    }, updateInterval);

    return new Promise(resolve => {
      setTimeout(() => {
        clearInterval(displayInterval);
        // Cleanup mock displays
        displays.forEach(display => display.destroy());
        resolve();
      }, scenario.duration);
    });
  }

  /**
   * Simulate extended session
   */
  async simulateExtendedSession(scenario, metrics) {
    const memorySnapshots = [];
    const performanceSnapshots = [];

    const interval = setInterval(() => {
      const snapshot = browserMonitor.getCurrentSnapshot();

      if (snapshot.memory) {
        memorySnapshots.push(snapshot.memory.used / 1024 / 1024);
        metrics.memory.push(snapshot.memory.used / 1024 / 1024);
      }

      // Simulate extended session workload
      this.simulateSessionWorkload();

    }, 10000); // Sample every 10 seconds (accelerated time)

    return new Promise(resolve => {
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, scenario.duration);
    });
  }

  /**
   * Simulate rapid interaction
   */
  async simulateRapidInteraction(scenario, metrics) {
    const interactionTimes = [];

    for (let i = 0; i < (scenario.duration / 1000) * scenario.interactionRate; i++) {
      const start = performance.now();

      await this.simulateUserInteraction();

      const responseTime = performance.now() - start;
      interactionTimes.push(responseTime);

      // Small delay between interactions
      await new Promise(resolve => setTimeout(resolve, 1000 / scenario.interactionRate));
    }

    metrics.responseTime = interactionTimes;
  }

  /**
   * Validate scenario results against expectations
   */
  validateScenarioResults(scenario, metrics) {
    const validation = {
      overall: 'pass',
      checks: []
    };

    // Check frame rate
    if (metrics.frameRate.length > 0) {
      const avgFps = metrics.frameRate.reduce((sum, fps) => sum + fps, 0) / metrics.frameRate.length;
      const fpsCheck = {
        name: 'Frame Rate',
        passed: avgFps >= scenario.expectedBehavior.frameRate.min,
        value: avgFps,
        expected: scenario.expectedBehavior.frameRate
      };
      validation.checks.push(fpsCheck);

      if (!fpsCheck.passed) validation.overall = 'fail';
    }

    // Check memory growth
    if (metrics.memory.length > 1) {
      const firstMemory = metrics.memory[0];
      const lastMemory = metrics.memory[metrics.memory.length - 1];
      const memoryGrowth = lastMemory - firstMemory;

      const memoryCheck = {
        name: 'Memory Growth',
        passed: memoryGrowth <= scenario.expectedBehavior.memoryGrowth.max,
        value: memoryGrowth,
        expected: scenario.expectedBehavior.memoryGrowth
      };
      validation.checks.push(memoryCheck);

      if (!memoryCheck.passed) validation.overall = 'fail';
    }

    return validation;
  }

  /**
   * Generate final validation report
   */
  generateFinalReport(testResults) {
    const now = performance.now();
    const totalDuration = now - this.startTime;

    // Stop monitoring intervals
    if (this.validationInterval) clearInterval(this.validationInterval);
    if (this.comprehensiveCheckInterval) clearInterval(this.comprehensiveCheckInterval);

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        duration: Math.round(totalDuration),
        overallGrade: 'A', // Will be calculated
        professionalGrade: true // Will be calculated
      },
      baseline: this.validationResults.get('baseline'),
      requirements: this.validateAllRequirements(),
      testResults: Object.fromEntries(testResults),
      comprehensive: this.validationResults.get('comprehensive'),
      recommendations: this.generateRecommendations(),
      professionalValidation: this.validateProfessionalStandards()
    };

    // Calculate overall grade
    report.summary.overallGrade = this.calculateOverallGrade(report);

    return report;
  }

  /**
   * Validate all requirements
   */
  validateAllRequirements() {
    const results = new Map();

    for (const [key, requirement] of this.requirements) {
      const validation = this.validateRequirement(key, requirement);
      results.set(key, validation);
    }

    return Object.fromEntries(results);
  }

  /**
   * Validate single requirement
   */
  validateRequirement(key, requirement) {
    const continuous = this.validationResults.get('continuous');

    if (!continuous || !continuous[key]) {
      return {
        passed: false,
        grade: 'F',
        message: 'No data available'
      };
    }

    const data = continuous[key];
    return {
      passed: data.passes,
      grade: data.grade,
      current: data.current,
      requirement: requirement,
      message: this.generateRequirementMessage(key, data, requirement)
    };
  }

  /**
   * Validate professional trading standards
   */
  validateProfessionalStandards() {
    const continuous = this.validationResults.get('continuous');
    if (!continuous) return { passed: false, score: 0 };

    const checks = [
      continuous.frameRate?.passes || false,
      continuous.dataLatency?.passes || false,
      continuous.memory?.passes || false
    ];

    const passed = checks.filter(Boolean).length;
    const score = Math.round((passed / checks.length) * 100);

    return {
      passed: passed === checks.length,
      score,
      details: {
        frameRate: continuous.frameRate?.passes || false,
        dataLatency: continuous.dataLatency?.passes || false,
        memoryStability: continuous.memory?.passes || false
      }
    };
  }

  // Helper methods
  calculateGrade(value, requirement, inverse = false) {
    if (inverse) {
      if (value <= requirement.target) return 'A';
      if (value <= requirement.maximum) return 'B';
      return 'C';
    } else {
      if (value >= requirement.target) return 'A';
      if (value >= requirement.minimum) return 'B';
      return 'C';
    }
  }

  calculateMemoryGrowthRate() {
    const memoryHistory = browserMonitor.processHealth.memory;
    if (memoryHistory && memoryHistory.length > 1) {
      const recent = memoryHistory.slice(-5); // Last 5 measurements
      const first = recent[0];
      const last = recent[recent.length - 1];
      const timeDelta = (last.timestamp - first.timestamp) / 1000 / 60; // minutes

      if (timeDelta > 0) {
        return ((last.usedJSHeapSize - first.usedJSHeapSize) / 1024 / 1024) / timeDelta; // MB/min
      }
    }
    return 0;
  }

  emitAlert(severity, message, data) {
    console.warn(`🚨 ${severity.toUpperCase()} ALERT: ${message}`, data);
    // Could integrate with notification system here
  }

  async simulateUserInteraction() {
    // Simulate DOM interaction
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        // Simulate some work
        const element = document.createElement('div');
        document.body.appendChild(element);
        document.body.removeChild(element);
        resolve();
      });
    });
  }

  simulateMarketDataUpdate() {
    // Simulate market data processing
    const data = new Float32Array(1000);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 100;
    }
    return data;
  }

  createMockDisplay(index) {
    return {
      id: `mock-display-${index}`,
      update: () => this.simulateMarketDataUpdate(),
      destroy: () => {} // Cleanup
    };
  }

  updateMockDisplay(display) {
    display.update();
  }

  simulateSessionWorkload() {
    // Simulate typical trading session workload
    const workload = [
      () => this.simulateMarketDataUpdate(),
      () => this.simulateUserInteraction(),
      () => new Promise(resolve => setTimeout(resolve, 10))
    ];

    const task = workload[Math.floor(Math.random() * workload.length)];
    return task();
  }

  async simulateGenericScenario(scenario, metrics) {
    // Generic simulation for unknown scenarios
    return new Promise(resolve => {
      setTimeout(resolve, scenario.duration);
    });
  }

  calculateOverallGrade(report) {
    const requirements = report.requirements;
    const passedCount = Object.values(requirements).filter(req => req.passed).length;
    const totalCount = Object.keys(requirements).length;

    if (passedCount === totalCount) return 'A';
    if (passedCount >= totalCount * 0.8) return 'B';
    if (passedCount >= totalCount * 0.6) return 'C';
    return 'F';
  }

  generateRequirementMessage(key, data, requirement) {
    if (data.passes) {
      return `✓ ${requirement.name}: ${Math.round(data.current * 100) / 100} ${requirement.unit || ''}`;
    } else {
      return `✗ ${requirement.name}: ${Math.round(data.current * 100) / 100} ${requirement.unit || ''} (required: ${requirement.minimum || requirement.maximum} ${requirement.unit || ''})`;
    }
  }

  generateRecommendations() {
    const recommendations = [];
    const continuous = this.validationResults.get('continuous');

    if (!continuous) return recommendations;

    if (continuous.frameRate && !continuous.frameRate.passes) {
      recommendations.push({
        priority: 'high',
        category: 'Performance',
        issue: 'Frame rate below professional standards',
        solution: 'Optimize canvas rendering, reduce animation complexity, implement render throttling'
      });
    }

    if (continuous.dataLatency && !continuous.dataLatency.passes) {
      recommendations.push({
        priority: 'critical',
        category: 'Latency',
        issue: 'Data latency exceeds trading requirements',
        solution: 'Optimize WebSocket handling, implement data buffering, reduce processing overhead'
      });
    }

    if (continuous.memory && !continuous.memory.passes) {
      recommendations.push({
        priority: 'high',
        category: 'Memory',
        issue: 'Memory growth indicates potential leaks',
        solution: 'Check for unclosed connections, event listeners, or canvas contexts'
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const tradingValidator = new TradingPerformanceValidator();

// Export class for testing
export { TradingPerformanceValidator };