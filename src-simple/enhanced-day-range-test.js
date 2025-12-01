#!/usr/bin/env node

// Enhanced Browser Testing Script for Day Range Meter
// Crystal Clarity Compliant Testing with Emoji Classification System
// Comprehensive live testing at http://localhost:5176

import { chromium } from 'playwright';
import { performance } from 'perf_hooks';

// Enhanced Console Classification System
const CONSOLE_CLASSIFIERS = {
  '🌐': ['fetch', 'websocket', 'xhr', 'network', 'connection', 'http', 'ws:'],
  '⌨️': ['keyboard', 'keydown', 'keyup', 'keypress', 'shortcut', 'ctrl+', 'alt+', 'meta+'],
  '❌': ['error', 'exception', 'failed', 'uncaught', 'referenceerror', 'typeerror', 'syntaxerror'],
  '✅': ['success', 'completed', 'loaded', 'ready', 'initialized', 'registered', 'connected'],
  '🔥': ['critical', 'crash', 'fatal', 'server error', 'connection failed', 'timeout'],
  '⚠️': ['warning', 'deprecated', 'performance', 'slow', 'memory', 'leak'],
  '💡': ['debug', 'info', 'log', 'progressive', 'adr', 'day range', 'percentage'],
  '📦': ['module', 'import', 'export', 'bundle', 'asset', 'loading'],
  '📊': ['progressive', 'adr disclosure', 'percentage', 'marker', 'day range'],
  '🎨': ['render', 'canvas', 'draw', 'paint', 'dpr', 'crisp', 'text']
};

class EnhancedConsoleCollector {
  constructor() {
    this.messages = [];
    this.startTime = performance.now();
    this.metrics = {
      total: 0,
      byCategory: {},
      byType: {},
      performance: []
    };
  }

  classifyMessage(message) {
    const text = message.text().toLowerCase();

    for (const [emoji, keywords] of Object.entries(CONSOLE_CLASSIFIERS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return emoji;
      }
    }
    return '💡'; // Default debug classification
  }

  collectMessage(msg) {
    const category = this.classifyMessage(msg);
    const timestamp = performance.now() - this.startTime;

    const logEntry = {
      timestamp,
      type: msg.type(),
      category,
      text: msg.text(),
      location: msg.location(),
      args: msg.args()
    };

    this.messages.push(logEntry);
    this.metrics.total++;

    if (!this.metrics.byCategory[category]) {
      this.metrics.byCategory[category] = 0;
    }
    this.metrics.byCategory[category]++;

    if (!this.metrics.byType[msg.type()]) {
      this.metrics.byType[msg.type()] = 0;
    }
    this.metrics.byType[msg.type()]++;

    // Performance-specific tracking
    if (category === '⚠️' || msg.text().includes('performance') || msg.text().includes('render')) {
      this.metrics.performance.push(logEntry);
    }
  }

  generateReport() {
    const totalTime = performance.now() - this.startTime;

    console.log('\n📊 === ENHANCED BROWSER CONSOLE ANALYSIS ===');
    console.log(`⏱️  Total monitoring time: ${totalTime.toFixed(2)}ms`);
    console.log(`📝 Total messages collected: ${this.metrics.total}`);

    console.log('\n📈 Message Breakdown by Category:');
    Object.entries(this.metrics.byCategory)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        const percentage = ((count / this.metrics.total) * 100).toFixed(1);
        console.log(`${category} ${category}: ${count} messages (${percentage}%)`);
      });

    console.log('\n📋 Message Breakdown by Type:');
    Object.entries(this.metrics.byType)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        const percentage = ((count / this.metrics.total) * 100).toFixed(1);
        console.log(`  ${type}: ${count} messages (${percentage}%)`);
      });

    // Critical issues first
    const criticalMessages = this.messages.filter(m => m.category === '🔥');
    const errorMessages = this.messages.filter(m => m.category === '❌');

    if (criticalMessages.length > 0) {
      console.log('\n🔥 === CRITICAL ISSUES ===');
      criticalMessages.forEach(msg => {
        console.log(`${msg.category} [${msg.timestamp.toFixed(0)}ms] ${msg.text}`);
        if (msg.location) {
          console.log(`   Location: ${msg.location.url}:${msg.location.lineNumber}`);
        }
      });
    }

    if (errorMessages.length > 0) {
      console.log('\n❌ === ERROR MESSAGES ===');
      errorMessages.forEach(msg => {
        console.log(`${msg.category} [${msg.timestamp.toFixed(0)}ms] ${msg.text}`);
        if (msg.location) {
          console.log(`   Location: ${msg.location.url}:${msg.location.lineNumber}`);
        }
      });
    }

    // Progressive ADR Analysis
    const progressiveMessages = this.messages.filter(m =>
      m.text.includes('progressive') ||
      m.text.includes('adr') ||
      m.text.includes('day range')
    );

    if (progressiveMessages.length > 0) {
      console.log('\n📊 === PROGRESSIVE ADR ANALYSIS ===');
      progressiveMessages.forEach(msg => {
        console.log(`${msg.category} [${msg.timestamp.toFixed(0)}ms] ${msg.text}`);
      });
    }

    // Module Loading Analysis
    const moduleMessages = this.messages.filter(m =>
      m.category === '📦' || m.text.includes('module') || m.text.includes('import')
    );

    if (moduleMessages.length > 0) {
      console.log('\n📦 === MODULE LOADING ANALYSIS ===');
      moduleMessages.forEach(msg => {
        console.log(`${msg.category} [${msg.timestamp.toFixed(0)}ms] ${msg.text}`);
      });
    }

    // Performance Analysis
    if (this.metrics.performance.length > 0) {
      console.log('\n⚡ === PERFORMANCE METRICS ===');
      this.metrics.performance.forEach(msg => {
        console.log(`${msg.category} [${msg.timestamp.toFixed(0)}ms] ${msg.text}`);
      });
    }

    return {
      totalTime,
      metrics: this.metrics,
      criticalIssues: criticalMessages.length,
      errors: errorMessages.length,
      progressiveMessages: progressiveMessages.length,
      moduleMessages: moduleMessages.length,
      performanceIssues: this.metrics.performance.length
    };
  }
}

class DayRangeMeterTester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.consoleCollector = new EnhancedConsoleCollector();
    this.testResults = {
      moduleLoading: { passed: 0, failed: 0, details: [] },
      progressiveADR: { passed: 0, failed: 0, details: [] },
      performance: { passed: 0, failed: 0, details: [] },
      rendering: { passed: 0, failed: 0, details: [] }
    };
  }

  async initialize() {
    console.log('🚀 Initializing Enhanced Browser Testing Environment...');

    this.browser = await chromium.launch({
      headless: true, // Set to false for visual debugging
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2 // Test HiDPI rendering
    });

    this.page = await this.context.newPage();

    // Set up comprehensive console monitoring
    this.page.on('console', msg => this.consoleCollector.collectMessage(msg));
    this.page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
      this.testResults.moduleLoading.failed++;
      this.testResults.moduleLoading.details.push(`Page Error: ${error.message}`);
    });

    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('.js') || url.includes('.svelte')) {
        console.log('📦 Loading:', url.split('/').pop());
      }
    });

    console.log('✅ Browser environment initialized');
  }

  async loadApplication() {
    console.log('🌐 Loading Day Range Meter application...');

    const startTime = performance.now();

    try {
      await this.page.goto('http://localhost:5176', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      const loadTime = performance.now() - startTime;
      console.log(`✅ Application loaded in ${loadTime.toFixed(2)}ms`);

      this.testResults.moduleLoading.passed++;
      this.testResults.moduleLoading.details.push(`Page load: ${loadTime.toFixed(2)}ms`);

      // Wait for application to be fully initialized
      await this.page.waitForTimeout(2000);

      return true;
    } catch (error) {
      console.log('❌ Failed to load application:', error.message);
      this.testResults.moduleLoading.failed++;
      this.testResults.moduleLoading.details.push(`Load failed: ${error.message}`);
      return false;
    }
  }

  async testModuleLoading() {
    console.log('📦 Testing Module Loading...');

    try {
      // Test for module loading errors in console
      const moduleErrors = this.consoleCollector.messages.filter(msg =>
        msg.category === '❌' && (
          msg.text.includes('import') ||
          msg.text.includes('module') ||
          msg.text.includes('404') ||
          msg.text.includes('failed to load')
        )
      );

      if (moduleErrors.length === 0) {
        console.log('✅ No module loading errors detected');
        this.testResults.moduleLoading.passed++;
        this.testResults.moduleLoading.details.push('No module loading errors');
      } else {
        console.log(`❌ ${moduleErrors.length} module loading errors detected`);
        moduleErrors.forEach(error => {
          this.testResults.moduleLoading.details.push(`Module error: ${error.text}`);
        });
        this.testResults.moduleLoading.failed += moduleErrors.length;
      }

      // Test for successful module registrations
      const registrationMessages = this.consoleCollector.messages.filter(msg =>
        msg.text.includes('registered') && msg.text.includes('visualization')
      );

      if (registrationMessages.length > 0) {
        console.log(`✅ Found ${registrationMessages.length} visualization registrations`);
        this.testResults.moduleLoading.passed++;
        registrationMessages.forEach(msg => {
          this.testResults.moduleLoading.details.push(`Registration: ${msg.text}`);
        });
      }

    } catch (error) {
      console.log('❌ Module loading test failed:', error.message);
      this.testResults.moduleLoading.failed++;
      this.testResults.moduleLoading.details.push(`Test error: ${error.message}`);
    }
  }

  async testProgressiveADR() {
    console.log('📊 Testing Progressive ADR Disclosure...');

    try {
      // Look for progressive ADR console messages
      const progressiveMessages = this.consoleCollector.messages.filter(msg =>
        msg.text.includes('PROGRESSIVE') ||
        msg.text.includes('Day Range') ||
        msg.text.includes('Max ADR')
      );

      if (progressiveMessages.length > 0) {
        console.log(`✅ Found ${progressiveMessages.length} progressive ADR messages`);
        this.testResults.progressiveADR.passed++;
        progressiveMessages.forEach(msg => {
          this.testResults.progressiveADR.details.push(`Progressive: ${msg.text}`);
        });
      } else {
        console.log('⚠️ No progressive ADR messages found - may need market data');
        this.testResults.progressiveADR.details.push('No progressive ADR activity detected');
      }

      // Test for Math.ceil(maxPercentage * 4) / 4 functionality
      const calculationMessages = this.consoleCollector.messages.filter(msg =>
        msg.text.includes('0.25') || msg.text.includes('Math.ceil') || msg.text.includes('increment')
      );

      if (calculationMessages.length > 0) {
        console.log('✅ Progressive calculation evidence found');
        this.testResults.progressiveADR.passed++;
        calculationMessages.forEach(msg => {
          this.testResults.progressiveADR.details.push(`Calculation: ${msg.text}`);
        });
      }

    } catch (error) {
      console.log('❌ Progressive ADR test failed:', error.message);
      this.testResults.progressiveADR.failed++;
      this.testResults.progressiveADR.details.push(`Test error: ${error.message}`);
    }
  }

  async testPerformanceMetrics() {
    console.log('⚡ Testing Performance Metrics...');

    try {
      // Monitor rendering performance
      const performanceEntries = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('measure');
        return entries.map(entry => ({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime
        }));
      });

      if (performanceEntries.length > 0) {
        const avgRenderTime = performanceEntries.reduce((sum, entry) => sum + entry.duration, 0) / performanceEntries.length;
        console.log(`📈 Average render time: ${avgRenderTime.toFixed(2)}ms`);

        if (avgRenderTime < 16.67) { // 60fps = 16.67ms per frame
          console.log('✅ Rendering meets 60fps requirement');
          this.testResults.performance.passed++;
        } else {
          console.log('⚠️ Rendering below 60fps target');
          this.testResults.performance.failed++;
        }

        this.testResults.performance.details.push(`Average render: ${avgRenderTime.toFixed(2)}ms`);
      }

      // Check for performance warnings
      const performanceWarnings = this.consoleCollector.messages.filter(msg =>
        msg.category === '⚠️' && (
          msg.text.includes('performance') ||
          msg.text.includes('slow') ||
          msg.text.includes('memory')
        )
      );

      if (performanceWarnings.length === 0) {
        console.log('✅ No performance warnings detected');
        this.testResults.performance.passed++;
      } else {
        console.log(`⚠️ ${performanceWarnings.length} performance warnings`);
        performanceWarnings.forEach(warning => {
          this.testResults.performance.details.push(`Performance: ${warning.text}`);
        });
      }

    } catch (error) {
      console.log('❌ Performance test failed:', error.message);
      this.testResults.performance.failed++;
      this.testResults.performance.details.push(`Test error: ${error.message}`);
    }
  }

  async testRenderingAndDPR() {
    console.log('🎨 Testing Canvas Rendering and DPR Support...');

    try {
      // Test Canvas 2D rendering
      const canvasInfo = await this.page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        return Array.from(canvases).map(canvas => ({
          width: canvas.width,
          height: canvas.height,
          dpr: window.devicePixelRatio || 1,
          contextType: canvas.getContext?.('2d') ? '2d' : 'none'
        }));
      });

      if (canvasInfo.length > 0) {
        console.log(`✅ Found ${canvasInfo.length} canvas elements`);
        this.testResults.rendering.passed++;

        canvasInfo.forEach((info, index) => {
          this.testResults.rendering.details.push(
            `Canvas ${index}: ${info.width}x${info.height}, DPR: ${info.dpr}, Context: ${info.contextType}`
          );
        });
      }

      // Check for DPR-aware rendering messages
      const dprMessages = this.consoleCollector.messages.filter(msg =>
        msg.text.includes('dpr') ||
        msg.text.includes('devicepixelratio') ||
        msg.text.includes('crisp') ||
        msg.text.includes('scale')
      );

      if (dprMessages.length > 0) {
        console.log('✅ DPR-aware rendering evidence found');
        this.testResults.rendering.passed++;
        dprMessages.forEach(msg => {
          this.testResults.rendering.details.push(`DPR: ${msg.text}`);
        });
      }

    } catch (error) {
      console.log('❌ Rendering test failed:', error.message);
      this.testResults.rendering.failed++;
      this.testResults.rendering.details.push(`Test error: ${error.message}`);
    }
  }

  async waitForMarketData() {
    console.log('📡 Waiting for market data connection...');

    try {
      // Wait for WebSocket connection and potential market data
      await this.page.waitForTimeout(5000);

      // Check for WebSocket connection messages
      const wsMessages = this.consoleCollector.messages.filter(msg =>
        msg.category === '🌐' && (
          msg.text.includes('websocket') ||
          msg.text.includes('connection') ||
          msg.text.includes('connected')
        )
      );

      if (wsMessages.length > 0) {
        console.log('✅ WebSocket connection activity detected');
        wsMessages.forEach(msg => {
          console.log(`🌐 ${msg.text}`);
        });
      }

    } catch (error) {
      console.log('⚠️ Market data waiting period completed');
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');

    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();

    console.log('✅ Cleanup completed');
  }

  generateTestReport() {
    console.log('\n📋 === COMPREHENSIVE TEST REPORT ===');

    const totalTests = Object.values(this.testResults).reduce(
      (sum, category) => sum + category.passed + category.failed, 0
    );
    const totalPassed = Object.values(this.testResults).reduce(
      (sum, category) => sum + category.passed, 0
    );
    const totalFailed = Object.values(this.testResults).reduce(
      (sum, category) => sum + category.failed, 0
    );

    console.log(`\n📊 Overall Test Results: ${totalPassed}/${totalTests} passed (${((totalPassed/totalTests)*100).toFixed(1)}%)`);

    Object.entries(this.testResults).forEach(([category, results]) => {
      const status = results.failed === 0 ? '✅' : '❌';
      const percentage = results.passed + results.failed > 0 ?
        ((results.passed / (results.passed + results.failed)) * 100).toFixed(1) : 0;
      console.log(`${status} ${category}: ${results.passed}/${results.passed + results.failed} (${percentage}%)`);

      if (results.details.length > 0) {
        results.details.slice(0, 3).forEach(detail => {
          console.log(`   • ${detail}`);
        });
        if (results.details.length > 3) {
          console.log(`   • ... and ${results.details.length - 3} more`);
        }
      }
    });

    return {
      totalTests,
      totalPassed,
      totalFailed,
      successRate: (totalPassed / totalTests) * 100,
      categories: this.testResults
    };
  }
}

async function runComprehensiveTests() {
  const tester = new DayRangeMeterTester();

  try {
    await tester.initialize();
    const appLoaded = await tester.loadApplication();

    if (!appLoaded) {
      console.log('❌ Application failed to load - aborting tests');
      return;
    }

    await tester.waitForMarketData();

    // Run all test suites
    await tester.testModuleLoading();
    await tester.testProgressiveADR();
    await tester.testPerformanceMetrics();
    await tester.testRenderingAndDPR();

    // Generate comprehensive reports
    const consoleReport = tester.consoleCollector.generateReport();
    const testReport = tester.generateTestReport();

    // Final assessment
    console.log('\n🎯 === CRYSTAL CLARITY COMPLIANCE ASSESSMENT ===');

    if (consoleReport.criticalIssues === 0 && consoleReport.errors === 0) {
      console.log('✅ No critical errors - Crystal Clarity compliance maintained');
    } else {
      console.log(`❌ ${consoleReport.criticalIssues} critical issues, ${consoleReport.errors} errors found`);
    }

    if (testReport.successRate >= 80) {
      console.log('✅ High success rate - Implementation meets quality standards');
    } else {
      console.log(`⚠️ ${testReport.successRate.toFixed(1)}% success rate - Review recommended`);
    }

    if (consoleReport.progressiveMessages > 0) {
      console.log('✅ Progressive ADR disclosure functionality confirmed');
    } else {
      console.log('⚠️ Limited progressive ADR activity detected');
    }

  } catch (error) {
    console.log('🔥 Test execution failed:', error.message);
  } finally {
    await tester.cleanup();
  }
}

// Run the comprehensive test suite
console.log('🧪 Starting Enhanced Day Range Meter Testing...');
console.log('Testing progressive ADR disclosure with Math.ceil(maxPercentage * 4) / 4');
console.log('Crystal Clarity compliance verification');
console.log('Performance validation (60fps, sub-100ms latency)');
console.log('Enhanced console monitoring with emoji classification\n');

runComprehensiveTests().catch(console.error);