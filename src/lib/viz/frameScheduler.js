/**
 * Frame Budgeting and RequestAnimationFrame Scheduler
 *
 * Phase 2: Rendering Optimization Pipeline
 * Implements frame budgeting and intelligent scheduling to achieve consistent
 * 60fps performance with sub-100ms data-to-visual latency.
 *
 * ARCHITECTURE:
 * - Frame budget management with priority-based scheduling
 * - RequestAnimationFrame optimization with frame time monitoring
 * - Render queue management with prioritization
 * - Performance metrics for 60fps verification
 *
 * PERFORMANCE TARGETS:
 * - Consistent 16.67ms frame budget (60fps)
 * - Sub-100ms data-to-visual latency for high-priority updates
 * - Frame time stability during active trading
 * - Support for 20+ concurrent displays without frame drops
 */

/**
 * Render task with priority and timing information
 */
class RenderTask {
  constructor(id, renderFunction, options = {}) {
    this.id = id;
    this.renderFunction = renderFunction;
    this.priority = options.priority || 'normal'; // 'critical', 'high', 'normal', 'low'
    this.maxFrameTime = options.maxFrameTime || 16.67; // milliseconds
    this.timeout = options.timeout || 100; // milliseconds before task is considered stale
    this.created = performance.now();
    this.scheduled = false;
    this.executions = 0;
    this.totalExecutionTime = 0;
    this.averageExecutionTime = 0;
    this.lastExecutionTime = 0;
  }

  /**
   * Check if task is stale and should be skipped
   */
  isStale() {
    return (performance.now() - this.created) > this.timeout;
  }

  /**
   * Record execution timing for performance tracking
   */
  recordExecution(executionTime) {
    this.executions++;
    this.totalExecutionTime += executionTime;
    this.lastExecutionTime = executionTime;
    this.averageExecutionTime = this.totalExecutionTime / this.executions;
  }

  /**
   * Get task performance statistics
   */
  getStats() {
    return {
      id: this.id,
      priority: this.priority,
      executions: this.executions,
      totalExecutionTime: this.totalExecutionTime,
      averageExecutionTime: this.averageExecutionTime,
      lastExecutionTime: this.lastExecutionTime,
      created: this.created,
      age: performance.now() - this.created,
      isStale: this.isStale()
    };
  }
}

/**
 * Frame Budget Manager
 *
 * Manages frame budget allocation and task scheduling within 16.67ms constraints
 */
export class FrameBudgetManager {
  constructor(options = {}) {
    this.targetFrameTime = options.targetFrameTime || 16.67; // 60fps
    this.criticalThreshold = options.criticalThreshold || 8.0; // Critical tasks get half budget
    this.highThreshold = options.highThreshold || 12.0; // High priority tasks
    this.warningThreshold = options.warningThreshold || 14.0; // Warning threshold
    this.debugLogging = options.debugLogging || false;

    // Frame tracking
    this.frameCount = 0;
    this.frameStartTime = 0;
    this.lastFrameTime = 0;
    this.frameTimeHistory = [];
    this.maxFrameHistory = 60; // Keep last 60 frames for statistics

    // Task queue management
    this.taskQueue = [];
    this.executingTasks = new Set();

    // Performance tracking
    this.stats = {
      totalFrames: 0,
      droppedFrames: 0,
      averageFrameTime: 0,
      tasksExecuted: 0,
      tasksSkipped: 0,
      budgetExceededFrames: 0,
      criticalTasksMissedDeadline: 0
    };

    // Performance thresholds
    this.performanceThresholds = {
      excellent: 16.67, // Perfect 60fps
      good: 20.0,       // 50fps, acceptable for trading
      acceptable: 33.33, // 30fps, minimum for real-time
      poor: 50.0        // 20fps, needs optimization
    };
  }

  /**
   * Start frame timing
   */
  startFrame() {
    this.frameStartTime = performance.now();
    this.frameCount++;
    this.stats.totalFrames++;

    // Clear executing tasks set
    this.executingTasks.clear();

    if (this.debugLogging && this.frameCount % 60 === 0) {
      this._logFrameStats();
    }
  }

  /**
   * End frame timing and update statistics
   */
  endFrame() {
    const frameTime = performance.now() - this.frameStartTime;
    this.lastFrameTime = frameTime;

    // Update frame time history
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.maxFrameHistory) {
      this.frameTimeHistory.shift();
    }

    // Update statistics
    this._updateFrameStatistics(frameTime);

    // Check for dropped frames
    if (frameTime > this.targetFrameTime * 1.5) {
      this.stats.droppedFrames++;
      if (this.debugLogging) {
        console.warn(`[FrameBudget] Frame ${this.frameCount} exceeded budget: ${frameTime.toFixed(2)}ms`);
      }
    }

    return frameTime;
  }

  /**
   * Check if there's remaining budget in current frame
   */
  hasBudget(estimatedTime = 0) {
    if (this.frameStartTime === 0) return true; // Frame hasn't started

    const elapsed = performance.now() - this.frameStartTime;
    const remaining = this.targetFrameTime - elapsed - estimatedTime;

    return remaining > 2.0; // Leave 2ms buffer
  }

  /**
   * Get remaining time in current frame budget
   */
  getRemainingBudget() {
    if (this.frameStartTime === 0) return this.targetFrameTime;

    const elapsed = performance.now() - this.frameStartTime;
    return Math.max(0, this.targetFrameTime - elapsed);
  }

  /**
   * Schedule render task with priority-based budget allocation
   */
  scheduleTask(task) {
    if (!(task instanceof RenderTask)) {
      console.error('[FrameBudget] Task must be RenderTask instance');
      return false;
    }

    // Skip stale tasks
    if (task.isStale()) {
      this.stats.tasksSkipped++;
      if (this.debugLogging) {
        console.log(`[FrameBudget] Skipping stale task: ${task.id}`);
      }
      return false;
    }

    // Check if task can fit in current frame budget
    const canExecute = this._canExecuteTask(task);

    if (!canExecute) {
      // Add to queue for next frame
      this.taskQueue.push(task);
      task.scheduled = true;
      return false;
    }

    // Execute task immediately
    return this._executeTask(task);
  }

  /**
   * Process task queue for next frame
   */
  processQueue() {
    if (this.taskQueue.length === 0) return 0;

    // Sort queue by priority (critical first)
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    let executedCount = 0;
    const tasksToExecute = [];

    // Collect tasks that can be executed within budget
    while (this.taskQueue.length > 0 && this.hasBudget()) {
      const task = this.taskQueue.shift();
      if (!task.isStale() && this._canExecuteTask(task)) {
        tasksToExecute.push(task);
      }
    }

    // Execute selected tasks
    for (const task of tasksToExecute) {
      if (this._executeTask(task)) {
        executedCount++;
      }
    }

    return executedCount;
  }

  /**
   * Clear all tasks from queue
   */
  clearQueue() {
    const clearedCount = this.taskQueue.length;
    this.taskQueue = [];
    this.stats.tasksSkipped += clearedCount;

    if (this.debugLogging) {
      console.log(`[FrameBudget] Cleared ${clearedCount} tasks from queue`);
    }

    return clearedCount;
  }

  /**
   * Get current frame budget statistics
   */
  getFrameStats() {
    const recentFrames = this.frameTimeHistory.slice(-10);
    const recentAverage = recentFrames.length > 0
      ? recentFrames.reduce((a, b) => a + b, 0) / recentFrames.length
      : 0;

    return {
      frameCount: this.frameCount,
      currentFrameTime: this.lastFrameTime,
      recentAverageFrameTime: recentAverage,
      targetFrameTime: this.targetFrameTime,
      remainingBudget: this.getRemainingBudget(),
      queuedTasks: this.taskQueue.length,
      executingTasks: this.executingTasks.size,
      fps: this.lastFrameTime > 0 ? 1000 / this.lastFrameTime : 0,
      recentFps: recentAverage > 0 ? 1000 / recentAverage : 0
    };
  }

  /**
   * Get overall performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.stats,
      currentFps: this.lastFrameTime > 0 ? 1000 / this.lastFrameTime : 0,
      averageFps: this.stats.averageFrameTime > 0 ? 1000 / this.stats.averageFrameTime : 0,
      dropRate: this.stats.totalFrames > 0 ? (this.stats.droppedFrames / this.stats.totalFrames) * 100 : 0,
      performanceGrade: this._getPerformanceGrade(),
      frameTimeHistory: [...this.frameTimeHistory],
      queuedTasks: this.taskQueue.length
    };
  }

  /**
   * Check if a task can be executed within current frame budget
   */
  _canExecuteTask(task) {
    if (this.frameStartTime === 0) return true;

    const remainingBudget = this.getRemainingBudget();
    const taskThreshold = this._getTaskThreshold(task.priority);

    return remainingBudget >= Math.min(task.maxFrameTime, taskThreshold);
  }

  /**
   * Get time threshold for task priority
   */
  _getTaskThreshold(priority) {
    switch (priority) {
      case 'critical': return this.criticalThreshold;
      case 'high': return this.highThreshold;
      case 'normal': return this.targetFrameTime;
      case 'low': return this.targetFrameTime * 2; // Low priority can span frames
      default: return this.targetFrameTime;
    }
  }

  /**
   * Execute a render task with timing and error handling
   */
  _executeTask(task) {
    if (this.executingTasks.has(task.id)) {
      return false; // Already executing
    }

    this.executingTasks.add(task.id);
    const startTime = performance.now();

    try {
      // Execute the render function
      task.renderFunction();

      const executionTime = performance.now() - startTime;
      task.recordExecution(executionTime);

      this.stats.tasksExecuted++;

      if (this.debugLogging) {
        console.log(`[FrameBudget] Executed task ${task.id}: ${executionTime.toFixed(2)}ms (priority: ${task.priority})`);
      }

      return true;
    } catch (error) {
      console.error(`[FrameBudget] Task execution failed: ${task.id}`, error);
      return false;
    } finally {
      this.executingTasks.delete(task.id);
    }
  }

  /**
   * Update frame statistics
   */
  _updateFrameStatistics(frameTime) {
    // Update average frame time
    if (this.stats.averageFrameTime === 0) {
      this.stats.averageFrameTime = frameTime;
    } else {
      // Exponential moving average with alpha = 0.1
      this.stats.averageFrameTime = (this.stats.averageFrameTime * 0.9) + (frameTime * 0.1);
    }

    // Track budget exceeded frames
    if (frameTime > this.targetFrameTime) {
      this.stats.budgetExceededFrames++;
    }
  }

  /**
   * Get performance grade based on frame statistics
   */
  _getPerformanceGrade() {
    const fps = this.lastFrameTime > 0 ? 1000 / this.lastFrameTime : 0;
    const dropRate = this.stats.totalFrames > 0 ? (this.stats.droppedFrames / this.stats.totalFrames) * 100 : 0;

    if (fps >= 58 && dropRate < 2) return 'excellent';
    if (fps >= 50 && dropRate < 5) return 'good';
    if (fps >= 30 && dropRate < 10) return 'acceptable';
    if (fps >= 20 && dropRate < 20) return 'poor';
    return 'unacceptable';
  }

  /**
   * Log frame statistics for debugging
   */
  _logFrameStats() {
    const stats = this.getPerformanceStats();
    console.log(`[FrameBudget] Frame ${this.frameCount} statistics:`, {
      fps: stats.currentFps.toFixed(1),
      averageFps: stats.averageFps.toFixed(1),
      dropRate: `${stats.dropRate.toFixed(1)}%`,
      performanceGrade: stats.performanceGrade,
      tasksExecuted: stats.tasksExecuted,
      queuedTasks: stats.queuedTasks
    });
  }
}

/**
 * RequestAnimationFrame Scheduler with advanced frame management
 */
export class FrameScheduler {
  constructor(options = {}) {
    this.frameBudgetManager = new FrameBudgetManager(options);
    this.animationFrameId = null;
    this.isRunning = false;
    this.debugLogging = options.debugLogging || false;
    this.frameCallback = null;

    // Performance monitoring
    this.schedulerStats = {
      startedAt: null,
      totalRuntime: 0,
      framesScheduled: 0,
      framesCompleted: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity
    };

    // Latency tracking
    this.frameTimestamps = [];
    this.maxLatencyHistory = 100;
  }

  /**
   * Start the frame scheduler with callback
   */
  start(frameCallback) {
    if (this.isRunning) {
      console.warn('[FrameScheduler] Already running');
      return false;
    }

    this.frameCallback = frameCallback;
    this.isRunning = true;
    this.schedulerStats.startedAt = performance.now();

    if (this.debugLogging) {
      console.log('[FrameScheduler] Started');
    }

    // Schedule first frame
    this._scheduleNextFrame();

    return true;
  }

  /**
   * Stop the frame scheduler
   */
  stop() {
    if (!this.isRunning) {
      return false;
    }

    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.schedulerStats.totalRuntime = performance.now() - this.schedulerStats.startedAt;

    if (this.debugLogging) {
      console.log('[FrameScheduler] Stopped. Runtime:', this.schedulerStats.totalRuntime.toFixed(2) + 'ms');
    }

    return true;
  }

  /**
   * Schedule a render task
   */
  scheduleTask(taskId, renderFunction, options = {}) {
    const task = new RenderTask(taskId, renderFunction, options);
    return this.frameBudgetManager.scheduleTask(task);
  }

  /**
   * Get combined scheduler and frame budget statistics
   */
  getStats() {
    return {
      scheduler: { ...this.schedulerStats, isRunning: this.isRunning },
      frameBudget: this.frameBudgetManager.getPerformanceStats(),
      frame: this.frameBudgetManager.getFrameStats()
    };
  }

  /**
   * Get performance grade for the current session
   */
  getPerformanceGrade() {
    const frameStats = this.frameBudgetManager.getPerformanceStats();
    const fps = frameStats.currentFps;
    const dropRate = frameStats.dropRate;

    if (fps >= 58 && dropRate < 2) return { grade: 'A', description: 'Excellent 60fps performance' };
    if (fps >= 50 && dropRate < 5) return { grade: 'B', description: 'Good performance' };
    if (fps >= 30 && dropRate < 10) return { grade: 'C', description: 'Acceptable performance' };
    if (fps >= 20 && dropRate < 20) return { grade: 'D', description: 'Poor performance' };
    return { grade: 'F', description: 'Unacceptable performance' };
  }

  /**
   * Schedule next animation frame
   */
  _scheduleNextFrame() {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame((timestamp) => {
      this._processFrame(timestamp);
    });

    this.schedulerStats.framesScheduled++;
  }

  /**
   * Process a single frame with timing and budget management
   */
  _processFrame(timestamp) {
    if (!this.isRunning) return;

    // Track latency
    const now = performance.now();
    const latency = now - timestamp;
    this._trackLatency(latency);

    // Start frame budgeting
    this.frameBudgetManager.startFrame();

    try {
      // Process queued tasks first
      this.frameBudgetManager.processQueue();

      // Execute main frame callback
      if (this.frameCallback) {
        this.frameCallback(timestamp);
      }

      this.schedulerStats.framesCompleted++;
    } catch (error) {
      console.error('[FrameScheduler] Frame processing error:', error);
    } finally {
      // End frame budgeting and get frame time
      const frameTime = this.frameBudgetManager.endFrame();

      // Schedule next frame
      this._scheduleNextFrame();
    }
  }

  /**
   * Track frame latency for performance monitoring
   */
  _trackLatency(latency) {
    this.frameTimestamps.push(latency);
    if (this.frameTimestamps.length > this.maxLatencyHistory) {
      this.frameTimestamps.shift();
    }

    this.schedulerStats.maxLatency = Math.max(this.schedulerStats.maxLatency, latency);
    this.schedulerStats.minLatency = Math.min(this.schedulerStats.minLatency, latency);

    // Update average latency
    if (this.frameTimestamps.length > 0) {
      const sum = this.frameTimestamps.reduce((a, b) => a + b, 0);
      this.schedulerStats.averageLatency = sum / this.frameTimestamps.length;
    }

    // Log high latency warnings
    if (latency > 8.0 && this.debugLogging) { // More than half a frame behind
      console.warn(`[FrameScheduler] High frame latency: ${latency.toFixed(2)}ms`);
    }
  }
}

/**
 * Factory function to create a frame scheduler with default options
 */
export function createFrameScheduler(options = {}) {
  return new FrameScheduler(options);
}

/**
 * Utility function to integrate frame scheduling with Container.svelte
 */
export function createFrameSchedulingIntegration(options = {}) {
  const frameScheduler = new FrameScheduler(options);

  return {
    // Scheduler instance
    scheduler: frameScheduler,

    // Convenience methods for common operations
    scheduleCriticalRender: (taskId, renderFunction) => {
      return frameScheduler.scheduleTask(taskId, renderFunction, {
        priority: 'critical',
        maxFrameTime: 8.0,
        timeout: 50
      });
    },

    scheduleNormalRender: (taskId, renderFunction) => {
      return frameScheduler.scheduleTask(taskId, renderFunction, {
        priority: 'normal',
        maxFrameTime: 16.67,
        timeout: 100
      });
    },

    scheduleBackgroundRender: (taskId, renderFunction) => {
      return frameScheduler.scheduleTask(taskId, renderFunction, {
        priority: 'low',
        maxFrameTime: 33.33,
        timeout: 500
      });
    },

    // Performance methods
    start: (callback) => frameScheduler.start(callback),
    stop: () => frameScheduler.stop(),
    getStats: () => frameScheduler.getStats(),
    getPerformanceGrade: () => frameScheduler.getPerformanceGrade(),
    hasBudget: (estimatedTime) => frameScheduler.frameBudgetManager.hasBudget(estimatedTime),
    clearQueue: () => frameScheduler.frameBudgetManager.clearQueue()
  };
}