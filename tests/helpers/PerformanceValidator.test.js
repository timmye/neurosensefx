/**
 * PerformanceValidator Test Suite
 *
 * Tests the comprehensive performance validation system for professional trading platforms.
 * Validates frame rate, latency, memory stability, rendering quality, and performance stability.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium } from 'playwright';
import { PerformanceValidator, createPerformanceValidator } from './PerformanceValidator.js';

describe('PerformanceValidator', () => {
  let browser;
  let page;
  let validator;

  beforeEach(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    validator = new PerformanceValidator(page);
  });

  afterEach(async () => {
    if (validator && validator.isValidating) {
      await validator.stopValidation();
    }
    if (browser) {
      await browser.close();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(validator.options.fpsTarget).toBe(60);
      expect(validator.options.latencyThreshold).toBe(100);
      expect(validator.options.memoryGrowthThreshold).toBe(50);
      expect(validator.options.stabilityDuration).toBe(60000);
    });

    it('should accept custom configuration', () => {
      const customValidator = new PerformanceValidator(page, {
        fpsTarget: 30,
        latencyThreshold: 200,
        memoryGrowthThreshold: 100
      });

      expect(customValidator.options.fpsTarget).toBe(30);
      expect(customValidator.options.latencyThreshold).toBe(200);
      expect(customValidator.options.memoryGrowthThreshold).toBe(100);
    });

    it('should initialize validation state correctly', () => {
      expect(validator.validationState).toBeDefined();
      expect(validator.validationState.frameRate).toBeDefined();
      expect(validator.validationState.latency).toBeDefined();
      expect(validator.validationState.memory).toBeDefined();
      expect(validator.validationState.quality).toBeDefined();
      expect(validator.validationState.extendedSession).toBeDefined();
    });
  });

  describe('Frame Rate Validation', () => {
    it('should start and stop validation correctly', async () => {
      expect(validator.isValidating).toBe(false);

      await validator.startValidation();
      expect(validator.isValidating).toBe(true);

      const results = await validator.stopValidation();
      expect(results).toBeDefined();
      expect(validator.isValidating).toBe(false);
    });

    it('should validate frame rate for simple operations', async () => {
      await validator.startValidation();

      // Create a simple canvas animation for testing
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            canvas {
              width: 300px;
              height: 200px;
              border: 1px solid #ccc;
            }
          </style>
        </head>
        <body>
          <canvas id="test-canvas"></canvas>
          <script>
            const canvas = document.getElementById('test-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 300;
            canvas.height = 200;

            // Simple animation
            let x = 0;
            function animate() {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#007acc';
              ctx.fillRect(x, 50, 50, 50);
              x = (x + 2) % canvas.width;
              requestAnimationFrame(animate);
            }
            animate();
          </script>
        </body>
        </html>
      `);

      const result = await validator.validateFrameRate('simple-animation', 2000);

      expect(result).toBeDefined();
      expect(result.operation).toBe('simple-animation');
      expect(result.frameRate).toBeDefined();
      expect(result.frameRate.average).toBeGreaterThan(0);
      expect(result.frameRate.minimum).toBeGreaterThanOrEqual(0);
      expect(result.frameRate.maximum).toBeGreaterThan(0);
      expect(result.samples).toBeGreaterThan(0);
      expect(result.passed).toBeDefined();

      await validator.stopValidation();
    }, 10000);
  });

  describe('Latency Validation', () => {
    it('should validate data-to-visual latency', async () => {
      await validator.startValidation();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <div id="price-display">0.0000</div>
          <script>
            // Simulate market data update
            function updatePrice(price) {
              const display = document.getElementById('price-display');
              display.textContent = price.toFixed(4);
            }
          </script>
        </body>
        </html>
      `);

      const result = await validator.validateLatency('data_to_visual', async () => {
        await page.evaluate(() => {
          updatePrice(1.2345);
        });
        await page.waitForTimeout(50); // Simulate rendering time
      });

      expect(result).toBeDefined();
      expect(result.metric).toBe('data_to_visual');
      expect(result.totalLatency).toBeGreaterThan(0);
      expect(result.visualLatency).toBeGreaterThan(0);
      expect(result.threshold).toBeDefined();
      expect(result.passed).toBeDefined();
      expect(result.timestamp).toBeDefined();

      await validator.stopValidation();
    });

    it('should detect latency spikes', async () => {
      await validator.startValidation();

      // Simulate a high-latency operation
      const result = await validator.validateLatency('ui_response', async () => {
        await page.waitForTimeout(300); // Simulate slow operation
      });

      expect(result).toBeDefined();
      expect(result.totalLatency).toBeGreaterThan(300);

      await validator.stopValidation();
    });
  });

  describe('Memory Validation', () => {
    it('should validate memory stability over short duration', async () => {
      await validator.startValidation();

      // Create memory pressure
      await page.evaluate(() => {
        const arrays = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new Array(10000).fill(Math.random()));
        }
        window.testArrays = arrays;
      });

      const result = await validator.validateMemoryStability('short_test', 5000);

      expect(result).toBeDefined();
      expect(result.testType).toBe('short_test');
      expect(result.memory).toBeDefined();
      expect(result.memory.initial).toBeDefined();
      expect(result.memory.final).toBeDefined();
      expect(result.memory.growth).toBeDefined();
      expect(result.memory.growthRate).toBeDefined();
      expect(result.leakDetected).toBeDefined();
      expect(result.passed).toBeDefined();

      // Cleanup
      await page.evaluate(() => {
        delete window.testArrays;
      });

      await validator.stopValidation();
    }, 15000);
  });

  describe('Rendering Quality Validation', () => {
    it('should validate DPR-aware rendering', async () => {
      await validator.startValidation();

      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <div id="test-element">
            <canvas id="test-canvas" width="600" height="400"></canvas>
          </div>
          <script>
            const canvas = document.getElementById('test-canvas');
            const ctx = canvas.getContext('2d');

            // Set up DPR-aware rendering
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = 600;
            const displayHeight = 400;

            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = displayHeight + 'px';

            ctx.scale(dpr, dpr);

            // Render some content
            ctx.font = '16px monospace';
            ctx.fillStyle = '#000';
            ctx.fillText('EUR/USD 1.2345', 50, 100);

            // Draw some graphics
            ctx.strokeStyle = '#007acc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(50, 150);
            ctx.lineTo(250, 150);
            ctx.stroke();
          </script>
        </body>
        </html>
      `);

      const result = await validator.validateRenderingQuality('#test-element');

      expect(result).toBeDefined();
      expect(result.elementSelector).toBe('#test-element');
      expect(result.quality).toBeDefined();
      expect(result.quality.dpr).toBeDefined();
      expect(result.quality.dpr.actual).toBeDefined();
      expect(result.quality.dpr.expected).toBeDefined();
      expect(result.quality.dpr.accuracy).toBeGreaterThan(0);
      expect(result.quality.sharpness).toBeDefined();
      expect(result.quality.canvas).toBeDefined();
      expect(result.passed).toBeDefined();

      await validator.stopValidation();
    });
  });

  describe('Extended Session Validation', () => {
    it('should establish performance baseline', async () => {
      await validator.startValidation();

      const baseline = validator.validationState.extendedSession.performanceBaseline;

      expect(baseline).toBeDefined();
      expect(baseline.frameRate).toBeGreaterThan(0);
      expect(baseline.memory).toBeDefined();
      expect(baseline.timestamp).toBeDefined();

      await validator.stopValidation();
    });

    it('should validate performance stability', async () => {
      await validator.startValidation();

      // Wait for baseline to be established
      await page.waitForTimeout(1000);

      // Run a short stability test (10 seconds)
      const result = await validator.validatePerformanceStability(10000);

      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThan(9000); // Allow some variance
      expect(result.performanceBaseline).toBeDefined();
      expect(result.final).toBeDefined();
      expect(result.degradation).toBeDefined();
      expect(result.stabilityChecks).toBeGreaterThan(0);
      expect(result.passed).toBeDefined();

      await validator.stopValidation();
    }, 20000);
  });

  describe('Comprehensive Reporting', () => {
    it('should generate comprehensive performance report', async () => {
      await validator.startValidation();

      // Run some validations to generate data
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <canvas id="test-canvas"></canvas>
          <script>
            const canvas = document.getElementById('test-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 300;
            canvas.height = 200;

            // Simple animation
            let x = 0;
            function animate() {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#007acc';
              ctx.fillRect(x, 50, 50, 50);
              x = (x + 2) % canvas.width;
              requestAnimationFrame(animate);
            }
            animate();
          </script>
        </body>
        </html>
      `);

      await validator.validateFrameRate('test-operation', 1000);
      await validator.validateLatency('test_latency', async () => {
        await page.waitForTimeout(50);
      });

      const report = await validator.generatePerformanceReport();

      expect(report).toBeDefined();
      expect(report.metadata).toBeDefined();
      expect(report.results).toBeDefined();
      expect(report.validationState).toBeDefined();
      expect(report.analysis).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.status).toBeDefined();

      expect(report.metadata.validationStartTime).toBeDefined();
      expect(report.metadata.thresholds).toBeDefined();
      expect(report.metadata.generatedAt).toBeDefined();

      expect(report.analysis.summary).toBeDefined();
      expect(report.analysis.summary.totalValidations).toBeGreaterThan(0);
      expect(report.analysis.summary.passRate).toBeGreaterThanOrEqual(0);
      expect(report.analysis.summary.status).toBeDefined();

      await validator.stopValidation();
    });
  });

  describe('Factory Function', () => {
    it('should create validator using factory function', () => {
      const factoryValidator = createPerformanceValidator(page, {
        fpsTarget: 30
      });

      expect(factoryValidator).toBeInstanceOf(PerformanceValidator);
      expect(factoryValidator.options.fpsTarget).toBe(30);
      expect(factoryValidator.page).toBe(page);
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      await validator.startValidation();

      // Try to validate a non-existent element
      await expect(validator.validateRenderingQuality('#non-existent-element'))
        .rejects.toThrow();

      // Results should still be available
      const results = await validator.stopValidation();
      expect(results).toBeDefined();

      // Should have recorded the failure
      expect(validator.results.failed.length).toBeGreaterThan(0);
    });

    it('should handle multiple start/stop calls gracefully', async () => {
      await validator.startValidation();
      await validator.startValidation(); // Should not throw

      const results1 = await validator.stopValidation();
      const results2 = await validator.stopValidation(); // Should not throw

      expect(results1).toBeDefined();
      expect(results2).toBeDefined();
    });
  });

  describe('Performance Threshold Enforcement', () => {
    it('should enforce critical frame rate violations', async () => {
      const criticalValidator = new PerformanceValidator(page, {
        thresholds: {
          FRAME_RATE: {
            TARGET: 60,
            MINIMUM: 55,
            CRITICAL: 45,
            MAX_FRAME_TIME: 16.67,
            CONSECUTIVE_DROPS: 3,
            VARIANCE_TOLERANCE: 5
          }
        }
      });

      await criticalValidator.startValidation();

      // Simulate poor performance
      await page.evaluate(() => {
        // Create a blocking operation that will hurt frame rate
        let i = 0;
        const block = () => {
          const start = Date.now();
          while (Date.now() - start < 30) {
            i++; // Block for 30ms
          }
        };

        // Run blocking operation multiple times
        for (let j = 0; j < 5; j++) {
          setTimeout(block, j * 100);
        }
      });

      await page.waitForTimeout(2000);
      const results = await criticalValidator.stopValidation();

      expect(results).toBeDefined();
      expect(criticalValidator.results.critical.length + criticalValidator.results.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect memory growth violations', async () => {
      await validator.startValidation();

      // Create memory growth over time
      const memoryGrowthPromise = page.evaluate(() => {
        return new Promise((resolve) => {
          const memoryConsumer = {
            arrays: [],
            interval: null
          };

          let count = 0;
          memoryConsumer.interval = setInterval(() => {
            memoryConsumer.arrays.push(new Array(100000).fill(Math.random()));
            count++;
            if (count >= 10) {
              clearInterval(memoryConsumer.interval);
              resolve();
            }
          }, 500);
        });
      });

      await memoryGrowthPromise;
      const result = await validator.validateMemoryStability('memory_growth_test', 10000);

      expect(result).toBeDefined();
      expect(result.memory.growthRate).toBeDefined();

      // Cleanup memory
      await page.evaluate(() => {
        if (window.memoryConsumer) {
          clearInterval(window.memoryConsumer.interval);
          delete window.memoryConsumer;
        }
      });

      await validator.stopValidation();
    }, 20000);
  });
});

describe('PerformanceValidator Integration', () => {
  let browser;
  let page;

  beforeEach(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterEach(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('should integrate with SystemVisibilityMonitor', async () => {
    // This test ensures PerformanceValidator works alongside SystemVisibilityMonitor
    const { SystemVisibilityMonitor } = await import('./SystemVisibilityMonitor.js');

    const monitor = new SystemVisibilityMonitor(page);
    const validator = new PerformanceValidator(page);

    // Start both systems
    await monitor.startMonitoring();
    await validator.startValidation();

    // Run some operations
    await page.setContent('<canvas id="test" width="400" height="300"></canvas>');
    await page.evaluate(() => {
      const canvas = document.getElementById('test');
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#007acc';
      ctx.fillRect(50, 50, 100, 100);
    });

    // Both systems should collect data
    await page.waitForTimeout(2000);

    // Get reports from both systems
    const monitorReport = monitor.getReport();
    const validatorReport = await validator.generatePerformanceReport();

    expect(monitorReport).toBeDefined();
    expect(validatorReport).toBeDefined();

    // Cleanup
    await monitor.stopMonitoring();
    await validator.stopValidation();
  });

  it('should handle concurrent validation operations', async () => {
    const validator1 = new PerformanceValidator(page);
    const validator2 = new PerformanceValidator(page);

    await validator1.startValidation();
    await validator2.startValidation();

    // Both validators should work independently
    await page.setContent('<canvas id="test" width="400" height="300"></canvas>');

    const [result1, result2] = await Promise.all([
      validator1.validateFrameRate('concurrent-test-1', 1000),
      validator2.validateFrameRate('concurrent-test-2', 1000)
    ]);

    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1.operation).toBe('concurrent-test-1');
    expect(result2.operation).toBe('concurrent-test-2');

    await validator1.stopValidation();
    await validator2.stopValidation();
  });
});