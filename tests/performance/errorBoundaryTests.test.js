/**
 * Error Boundary Tests for Phase 2 Performance Systems
 *
 * Tests the comprehensive error handling and fallback mechanisms to ensure
 * system stability even when optimizations fail.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import error boundary utilities
import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  memorySafeErrorHandler,
  getContextualFallback,
  SAFE_DEFAULTS,
  CircuitBreaker
} from '../../src/utils/errorBoundaryUtils.js';

// Import Phase 2 systems for testing
import { FrameRateMonitor, LatencyMonitor, createPerformanceMonitors } from '../../src/utils/performanceMonitoring.js';
import { ResourceCleanupManager } from '../../src/utils/memoryManagementUtils.js';
import { MemoryProfiler } from '../../src/utils/memoryProfiler.js';

describe('Error Boundary Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('withErrorBoundary', () => {
    it('should execute successful functions normally', () => {
      const successFn = vi.fn(() => 'success');
      const wrappedFn = withErrorBoundary(successFn, 'fallback', 'test');

      const result = wrappedFn('arg1', 'arg2');

      expect(successFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('success');
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should return fallback value when function throws', () => {
      const errorFn = vi.fn(() => {
        throw new Error('Test error');
      });
      const fallback = 'fallback_value';
      const wrappedFn = withErrorBoundary(errorFn, fallback, 'test');

      const result = wrappedFn();

      expect(errorFn).toHaveBeenCalled();
      expect(result).toBe(fallback);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR_BOUNDARY] test:'),
        expect.any(Error),
        expect.objectContaining({ args: [] })
      );
    });

    it('should call fallback function when provided', () => {
      const errorFn = vi.fn(() => {
        throw new Error('Test error');
      });
      const fallbackFn = vi.fn(() => 'dynamic_fallback');
      const wrappedFn = withErrorBoundary(errorFn, fallbackFn, 'test');

      const result = wrappedFn('test_arg');

      expect(errorFn).toHaveBeenCalledWith('test_arg');
      expect(fallbackFn).toHaveBeenCalledWith('test_arg');
      expect(result).toBe('dynamic_fallback');
    });

    it('should handle async function errors', async () => {
      const asyncErrorFn = vi.fn(async () => {
        throw new Error('Async error');
      });
      const wrappedFn = withErrorBoundary(asyncErrorFn, 'fallback', 'test');

      const result = await wrappedFn();

      expect(asyncErrorFn).toHaveBeenCalled();
      expect(result).toBe('fallback');
    });
  });

  describe('CircuitBreaker', () => {
    it('should allow operations when closed', async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 2, recoveryTime: 1000 });
      const successFn = vi.fn(async () => 'success');

      const result = await circuitBreaker.execute(successFn, null, 'test');

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
    });

    it('should open after failure threshold is reached', async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 2, recoveryTime: 1000 });
      const failFn = vi.fn(async () => {
        throw new Error('Failure');
      });

      // First failure
      await circuitBreaker.execute(failFn, 'fallback1', 'test');
      expect(circuitBreaker.state).toBe('CLOSED');

      // Second failure - should open circuit
      await circuitBreaker.execute(failFn, 'fallback2', 'test');
      expect(circuitBreaker.state).toBe('OPEN');

      // Subsequent calls should return fallback immediately
      const result = await circuitBreaker.execute(vi.fn(), 'fallback3', 'test');
      expect(result).toBe('fallback3');
    });

    it('should transition to half-open after recovery time', async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 1, recoveryTime: 1000 });

      // Trigger failure to open circuit
      await circuitBreaker.execute(async () => {
        throw new Error('Failure');
      }, 'fallback', 'test');

      expect(circuitBreaker.state).toBe('OPEN');

      // Advance time past recovery period
      vi.advanceTimersByTime(1001);

      // Next call should put circuit in half-open state
      const successFn = vi.fn(async () => 'success');
      const result = await circuitBreaker.execute(successFn, 'fallback', 'test');

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(result).toBe('success');
    });
  });

  describe('Performance Monitor Error Boundaries', () => {
    it('should handle FrameRateMonitor constructor errors gracefully', () => {
      // Mock performance.now to throw error
      const originalNow = performance.now;
      performance.now = vi.fn(() => {
        throw new Error('Performance API error');
      });

      const monitor = new FrameRateMonitor();

      expect(monitor.enabled).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[FRAME_RATE_MONITOR] Initialization failed')
      );

      // Restore original performance.now
      performance.now = originalNow;
    });

    it('should handle recordFrame errors and continue working', () => {
      const monitor = new FrameRateMonitor({ windowSize: 3 });

      // Mock recordFrame to throw error
      const originalRecordFrame = monitor.recordFrame;
      let callCount = 0;
      monitor.recordFrame = vi.fn(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Recording error');
        }
        return originalRecordFrame.call(monitor);
      });

      // Should not crash and return fallback values
      const result1 = monitor.recordFrame();
      const result2 = monitor.recordFrame();
      const result3 = monitor.recordFrame();

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeTruthy(); // Should work on third call
    });

    it('should createPerformanceMonitors with fallbacks', () => {
      // Mock to cause errors
      const originalFrameRateMonitor = global.FrameRateMonitor;
      global.FrameRateMonitor = vi.fn(() => {
        throw new Error('Monitor creation failed');
      });

      const monitors = createPerformanceMonitors();

      expect(monitors).toHaveProperty('frameRateMonitor');
      expect(monitors).toHaveProperty('latencyMonitor');
      expect(monitors.frameRateMonitor.enabled).toBe(false);
      expect(monitors.latencyMonitor).toHaveProperty('recordDataReceipt');

      // Restore
      global.FrameRateMonitor = originalFrameRateMonitor;
    });
  });

  describe('Memory Management Error Boundaries', () => {
    it('should handle ResourceCleanupManager constructor errors', () => {
      const manager = new ResourceCleanupManager('test-component', 'test');

      expect(manager.componentId).toBe('test-component');
      expect(manager.componentType).toBe('test');
      expect(manager.resources).toBeInstanceOf(Map);
    });

    it('should handle resource registration errors', () => {
      const manager = new ResourceCleanupManager('test');

      // Register with invalid cleanup function
      const resourceId = manager.registerResource(
        'test',
        { data: 'test' },
        null, // Invalid cleanup function
        { id: 'test-resource' }
      );

      expect(resourceId).toBeNull();
    });

    it('should handle cleanup errors gracefully', () => {
      const manager = new ResourceCleanupManager('test');

      // Register resource with failing cleanup
      manager.registerResource(
        'test',
        { data: 'test' },
        () => {
          throw new Error('Cleanup failed');
        }
      );

      const result = manager.cleanup();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Memory Profiler Error Boundaries', () => {
    it('should handle MemoryProfiler constructor errors', () => {
      // Create with invalid options
      const profiler = new MemoryProfiler({
        samplingInterval: -1, // Invalid
        warningUsage: 2.0,     // Invalid (>1)
        leakThreshold: -5     // Invalid
      });

      expect(profiler.samplingInterval).toBe(1000); // Should be clamped to minimum
      expect(profiler.thresholds.warningUsage).toBe(1.0); // Should be clamped
      expect(profiler.thresholds.leakThreshold).toBe(0.1); // Should be clamped
    });

    it('should handle profiling start errors', () => {
      const profiler = new MemoryProfiler();

      // Mock isMemoryAPIAvailable to return false
      profiler.isMemoryAPIAvailable = () => false;

      const result = profiler.startProfiling();

      expect(result).toBe(false);
    });

    it('should handle memory sampling errors', () => {
      const profiler = new MemoryProfiler();

      // Mock performance.memory to throw error
      const originalMemory = performance.memory;
      performance.memory = null; // Force error

      const sample = profiler.sampleMemory();

      expect(sample).toEqual(SAFE_DEFAULTS.object);

      // Restore
      performance.memory = originalMemory;
    });
  });

  describe('Context-aware Fallbacks', () => {
    it('should provide appropriate fallback values for different contexts', () => {
      expect(getContextualFallback('FrameRateMonitor')).toBe(SAFE_DEFAULTS.number);
      expect(getContextualFallback('LatencyMonitor')).toBe(SAFE_DEFAULTS.number);
      expect(getContextualFallback('StoreOptimizer')).toBe(SAFE_DEFAULTS.object);
      expect(getContextualFallback('RenderingPipeline')).toBe(SAFE_DEFAULTS.boolean);
      expect(getContextualFallback('Cache', 'get')).toBeNull();
      expect(getContextualFallback('Cache', 'set')).toBe(SAFE_DEFAULTS.boolean);
      expect(getContextualFallback('Unknown')).toBe(SAFE_DEFAULTS.object);
    });
  });

  describe('Memory-safe Error Handler', () => {
    it('should prevent error cascades', () => {
      const handler = memorySafeErrorHandler;

      // Generate many errors to test cascade prevention
      for (let i = 0; i < 150; i++) {
        handler('test', new Error(`Error ${i}`));
      }

      // Should stop logging after maxErrors
      expect(console.error).toHaveBeenCalledTimes(100); // Max errors
    });

    it('should rate limit repeated errors', () => {
      const handler = memorySafeErrorHandler;

      // Generate same error multiple times rapidly
      for (let i = 0; i < 10; i++) {
        handler('test_context', new Error('Same error'));
      }

      // Should only log first one due to rate limiting
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Integration Tests - Real-world Error Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should handle cascade of optimization failures', () => {
    // Simulate complete optimization system failure
    const monitors = createPerformanceMonitors({
      frameRate: { invalidOption: 'this should not break' },
      latency: { criticalThreshold: 'invalid' }
    });

    const manager = new ResourceCleanupManager('test-component');
    const profiler = new MemoryProfiler({ invalidOptions: true });

    // All systems should still function in fallback mode
    expect(monitors.frameRateMonitor).toBeDefined();
    expect(manager.componentId).toBe('test-component');
    expect(profiler.enabled).toBeDefined();
  });

  it('should maintain system stability under error conditions', () => {
    // Create multiple systems with invalid configurations
    const systems = [];

    for (let i = 0; i < 10; i++) {
      try {
        systems.push(new FrameRateMonitor({
          windowSize: -1, // Invalid
          targetFPS: 'invalid', // Invalid
          maxFrameTime: null // Invalid
        }));
      } catch (error) {
        // Should not reach here due to error boundaries
        expect.fail('Constructor should not throw due to error boundaries');
      }
    }

    // All systems should be in safe fallback state
    systems.forEach(system => {
      expect(system.enabled).toBe(false);
      expect(system.frameHistory).toEqual([]);
    });
  });

  it('should recover from transient errors', async () => {
    const circuitBreaker = new CircuitBreaker({ failureThreshold: 2, recoveryTime: 100 });

    let shouldFail = true;
    const flakyFn = vi.fn(async () => {
      if (shouldFail) {
        throw new Error('Transient failure');
      }
      return 'success';
    });

    // First failure
    await circuitBreaker.execute(flakyFn, 'fallback', 'test');

    // Second failure - opens circuit
    await circuitBreaker.execute(flakyFn, 'fallback', 'test');
    expect(circuitBreaker.state).toBe('OPEN');

    // Wait for recovery time
    vi.advanceTimersByTime(101);

    // Fix the function
    shouldFail = false;

    // Should recover and work
    const result = await circuitBreaker.execute(flakyFn, 'fallback', 'test');

    expect(result).toBe('success');
    expect(circuitBreaker.state).toBe('CLOSED');
  });
});