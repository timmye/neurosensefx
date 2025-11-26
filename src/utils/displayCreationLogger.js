/**
 * Display Creation Pipeline Logger
 *
 * Comprehensive logging system for tracking the complete trader display lifecycle
 * from symbol selection to fully functional visualizations with real-time market data.
 *
 * Purpose: Provide full confidence in visualization accuracy for traders
 *
 * Key Features:
 * - Complete display creation pipeline tracking
 * - Performance metrics and timing measurements
 * - YScale and coordinate system validation
 * - WebSocket data flow monitoring
 * - Error context and recovery tracking
 */

/**
 * Display Creation Logger - Complete lifecycle tracking
 */
export class DisplayCreationLogger {
  constructor(displayId, symbol) {
    this.displayId = displayId;
    this.symbol = symbol;
    this.creationStartTime = performance.now();
    this.phases = new Map();
    this.metrics = {
      totalCreationTime: null,
      canvasInitTime: null,
      dataSubscriptionTime: null,
      firstRenderTime: null,
      yScaleValidationTime: null
    };
    this.errors = [];
    this.warnings = [];
    this.stateSnapshots = new Map();
  }

  /**
   * Log a phase in the display creation pipeline
   */
  logPhase(phaseName, data = {}, status = 'started') {
    const timestamp = performance.now();
    const relativeTime = timestamp - this.creationStartTime;

    const phaseData = {
      phaseName,
      status, // 'started', 'completed', 'failed'
      timestamp,
      relativeTime,
      data
    };

    // Store phase data
    if (!this.phases.has(phaseName)) {
      this.phases.set(phaseName, []);
    }
    this.phases.get(phaseName).push(phaseData);

    // Log to console with structured format
    const statusIcon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄';
    console.log(`${statusIcon} [DISPLAY:${this.displayId}] ${phaseName} (${relativeTime.toFixed(2)}ms)`, data);

    // Update metrics if phase completed
    if (status === 'completed') {
      this.updatePhaseMetric(phaseName, relativeTime);
    }

    return phaseData;
  }

  /**
   * Update phase-specific metrics
   */
  updatePhaseMetric(phaseName, relativeTime) {
    switch (phaseName) {
      case 'canvas_initialization':
        this.metrics.canvasInitTime = relativeTime;
        break;
      case 'data_subscription':
        this.metrics.dataSubscriptionTime = relativeTime;
        break;
      case 'first_render':
        this.metrics.firstRenderTime = relativeTime;
        break;
      case 'yscale_validation':
        this.metrics.yScaleValidationTime = relativeTime;
        break;
    }
  }

  /**
   * Log YScale validation with comprehensive coordinate testing
   */
  logYScaleValidation(yScale, contentArea, priceRange, state) {
    const phaseData = this.logPhase('yscale_validation', {
      contentArea: { width: contentArea.width, height: contentArea.height },
      priceRange: { low: priceRange.low, high: priceRange.high },
      symbol: this.symbol
    }, 'started');

    try {
      // Test critical price points for trader accuracy
      const testPoints = [
        { name: 'visualLow', price: state.visualLow },
        { name: 'visualHigh', price: state.visualHigh },
        { name: 'midPrice', price: state.midPrice },
        { name: 'currentPrice', price: state.currentPrice },
        { name: 'todaysHigh', price: state.todaysHigh },
        { name: 'todaysLow', price: state.todaysLow }
      ].filter(point => point.price !== undefined && point.price !== null);

      const validationResults = [];
      let inBoundsCount = 0;
      let totalRange = 0;

      testPoints.forEach((point, index) => {
        const y = yScale(point.price);
        const inBounds = typeof y === 'number' && !isNaN(y) && isFinite(y) &&
                       y >= -50 && y <= contentArea.height + 50; // 50px tolerance

        if (inBounds) inBoundsCount++;

        validationResults.push({
          name: point.name,
          price: point.price,
          y: y,
          inBounds,
          percentage: ((y / contentArea.height) * 100).toFixed(1)
        });

        // Calculate total Y range for coverage analysis
        if (index === 0) {
          totalRange = y;
        } else {
          totalRange = Math.abs(totalRange - y);
        }
      });

      // Coverage analysis
      const coveragePercentage = (totalRange / contentArea.height) * 100;
      const fullCoverage = coveragePercentage >= 80; // 80% threshold for good coverage

      const validationResult = {
        symbol: this.symbol,
        displayId: this.displayId,
        testPoints: validationResults,
        inBoundsCount,
        totalTested: testPoints.length,
        boundsCompliance: (inBoundsCount / testPoints.length) * 100,
        coveragePercentage,
        fullCoverage,
        contentAreaHeight: contentArea.height,
        totalYRange: totalRange
      };

      // Log validation results
      console.group(`📏 [DISPLAY:${this.displayId}] YScale Validation Results`);
      console.log('Symbol:', this.symbol);
      console.log('Test Points:', validationResults);
      console.log('Bounds Compliance:', validationResult.boundsCompliance.toFixed(1) + '%');
      console.log('Coverage:', coveragePercentage.toFixed(1) + '% of canvas height');
      console.log('Full Coverage:', fullCoverage ? '✅ PASS' : '⚠️ INSUFFICIENT');

      if (!fullCoverage) {
        console.warn('⚠️ YScale coverage may be insufficient for accurate trading visualization');
      }
      console.groupEnd();

      this.logPhase('yscale_validation', validationResult, 'completed');
      return validationResult;

    } catch (error) {
      const errorData = {
        error: error.message,
        stack: error.stack,
        yScaleFunction: !!yScale,
        contentArea,
        priceRange
      };

      console.error(`❌ [DISPLAY:${this.displayId}] YScale validation failed:`, errorData);
      this.logPhase('yscale_validation', errorData, 'failed');
      this.errors.push({ phase: 'yscale_validation', error: errorData });
      throw error;
    }
  }

  /**
   * Log canvas initialization with detailed metrics
   */
  logCanvasInitialization(canvas, contentArea, config) {
    const phaseData = this.logPhase('canvas_initialization', {
      canvasElement: !!canvas,
      canvasDimensions: { width: canvas.width, height: canvas.height },
      cssDimensions: { width: canvas.clientWidth, height: canvas.clientHeight },
      contentArea: { width: contentArea.width, height: contentArea.height },
      devicePixelRatio: window.devicePixelRatio || 1,
      config: { containerSize: config.containerSize }
    }, 'started');

    try {
      // Validate canvas setup
      const validation = {
        canvasExists: !!canvas,
        hasContext: !!canvas.getContext('2d'),
        dimensionsValid: canvas.width > 0 && canvas.height > 0,
        dprAware: canvas.width === Math.round(contentArea.width * (window.devicePixelRatio || 1)),
        contentAreaValid: contentArea.width > 0 && contentArea.height > 0
      };

      const isValid = Object.values(validation).every(Boolean);

      if (isValid) {
        console.log(`✅ [DISPLAY:${this.displayId}] Canvas initialized successfully:`, {
          symbol: this.symbol,
          canvasSize: `${canvas.width}×${canvas.height}`,
          contentArea: `${contentArea.width}×${contentArea.height}`,
          dpr: window.devicePixelRatio || 1
        });
        this.logPhase('canvas_initialization', validation, 'completed');
      } else {
        console.error(`❌ [DISPLAY:${this.displayId}] Canvas initialization failed:`, validation);
        this.logPhase('canvas_initialization', validation, 'failed');
        this.errors.push({ phase: 'canvas_initialization', error: validation });
      }

      return { isValid, validation };

    } catch (error) {
      const errorData = { error: error.message, canvas: !!canvas, contentArea };
      console.error(`❌ [DISPLAY:${this.displayId}] Canvas initialization error:`, errorData);
      this.logPhase('canvas_initialization', errorData, 'failed');
      this.errors.push({ phase: 'canvas_initialization', error: errorData });
      throw error;
    }
  }

  /**
   * Log visualization rendering with performance tracking
   */
  logVisualizationRender(visualizationName, renderStartTime, renderContext, state) {
    const renderEndTime = performance.now();
    const renderTime = renderEndTime - renderStartTime;

    const renderData = {
      visualizationName,
      renderTime,
      symbol: this.symbol,
      displayId: this.displayId,
      renderContext: {
        hasContentArea: !!renderContext.contentArea,
        contentAreaSize: renderContext.contentArea ?
          `${renderContext.contentArea.width}×${renderContext.contentArea.height}` : 'N/A'
      },
      state: {
        hasVisualRange: !!(state.visualLow && state.visualHigh),
        hasCurrentPrice: !!state.currentPrice,
        ready: state.ready
      }
    };

    // Performance validation
    const performanceTarget = 16.67; // 60fps target (1000ms / 60)
    const meetsPerformanceTarget = renderTime <= performanceTarget;

    if (meetsPerformanceTarget) {
      console.log(`🎨 [DISPLAY:${this.displayId}] ${visualizationName} rendered in ${renderTime.toFixed(2)}ms`);
    } else {
      console.warn(`⚠️ [DISPLAY:${this.displayId}] ${visualizationName} slow render: ${renderTime.toFixed(2)}ms (>60fps target)`);
    }

    return renderData;
  }

  /**
   * Log WebSocket data flow for market data
   */
  logDataFlow(flowType, data) {
    const flowData = {
      flowType, // 'subscription_sent', 'data_received', 'first_tick', 'subscription_confirmed'
      timestamp: performance.now(),
      symbol: this.symbol,
      displayId: this.displayId,
      data
    };

    const flowIcons = {
      subscription_sent: '📤',
      data_received: '📥',
      first_tick: '🔄',
      subscription_confirmed: '✅'
    };

    const icon = flowIcons[flowType] || '📊';
    console.log(`${icon} [DISPLAY:${this.displayId}] Data flow: ${flowType}`, data);

    return flowData;
  }

  /**
   * Log container resize events with detailed metrics
   *
   * @param {Object} oldDimensions - Previous container dimensions {width, height}
   * @param {Object} newDimensions - New container dimensions {width, height}
   * @param {Object} resizeContext - Additional context about the resize operation
   * @param {string} resizeContext.trigger - What caused the resize ('user_drag', 'window_resize', 'layout_change')
   * @param {number} resizeContext.duration - How long the resize took (ms)
   * @returns {Object} Resize event data with performance metrics
   */
  logContainerResize(oldDimensions, newDimensions, resizeContext = {}) {
    const timestamp = performance.now();
    const relativeTime = timestamp - this.creationStartTime;

    const widthDelta = newDimensions.width - oldDimensions.width;
    const heightDelta = newDimensions.height - oldDimensions.height;
    const areaDelta = (newDimensions.width * newDimensions.height) - (oldDimensions.width * oldDimensions.height);

    const resizeData = {
      oldDimensions: { ...oldDimensions },
      newDimensions: { ...newDimensions },
      changes: {
        widthDelta,
        heightDelta,
        areaDelta,
        widthPercentageChange: oldDimensions.width > 0 ? (widthDelta / oldDimensions.width) * 100 : 0,
        heightPercentageChange: oldDimensions.height > 0 ? (heightDelta / oldDimensions.height) * 100 : 0
      },
      resizeContext: {
        trigger: resizeContext.trigger || 'unknown',
        duration: resizeContext.duration || 0,
        animated: resizeContext.animated || false
      },
      timestamp,
      relativeTime,
      symbol: this.symbol,
      displayId: this.displayId
    };

    // Determine resize significance
    const isSignificantResize = Math.abs(widthDelta) > 10 || Math.abs(heightDelta) > 10;
    const resizeIcon = isSignificantResize ? '📏' : '📐';

    // Performance validation for resize operations
    const performanceThreshold = 16.67; // 60fps target
    const exceedsPerformanceThreshold = resizeContext.duration > performanceThreshold;

    if (exceedsPerformanceThreshold) {
      console.warn(`⚠️ [DISPLAY:${this.displayId}] Slow resize detected: ${resizeContext.duration.toFixed(2)}ms`, resizeData);
    } else {
      console.log(`${resizeIcon} [DISPLAY:${this.displayId}] Container resized: ${oldDimensions.width}×${oldDimensions.height} → ${newDimensions.width}×${newDimensions.height}`, resizeData);
    }

    // Update metrics
    if (!this.metrics.containerResizeMetrics) {
      this.metrics.containerResizeMetrics = [];
    }
    this.metrics.containerResizeMetrics.push(resizeData);

    return resizeData;
  }

  /**
   * Log container movement/position changes
   *
   * @param {Object} oldPosition - Previous position {x, y}
   * @param {Object} newPosition - New position {x, y}
   * @param {Object} movementContext - Additional context about the movement
   * @param {string} movementContext.trigger - What caused the movement ('user_drag', 'auto_layout', 'keyboard_navigation')
   * @param {number} movementContext.duration - How long the movement took (ms)
   * @param {boolean} movementContext.smooth - Whether the movement was animated
   * @returns {Object} Movement event data with trajectory information
   */
  logContainerMovement(oldPosition, newPosition, movementContext = {}) {
    const timestamp = performance.now();
    const relativeTime = timestamp - this.creationStartTime;

    const deltaX = newPosition.x - oldPosition.x;
    const deltaY = newPosition.y - oldPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const movementData = {
      oldPosition: { ...oldPosition },
      newPosition: { ...newPosition },
      trajectory: {
        deltaX,
        deltaY,
        distance,
        angle: Math.atan2(deltaY, deltaX) * (180 / Math.PI), // Convert to degrees
        direction: this.getCardinalDirection(deltaX, deltaY)
      },
      movementContext: {
        trigger: movementContext.trigger || 'unknown',
        duration: movementContext.duration || 0,
        smooth: movementContext.smooth || false,
        velocity: movementContext.duration > 0 ? distance / movementContext.duration : 0
      },
      timestamp,
      relativeTime,
      symbol: this.symbol,
      displayId: this.displayId
    };

    // Determine movement significance
    const isSignificantMovement = distance > 5; // 5px threshold
    const movementIcon = movementContext.trigger === 'user_drag' ? '✋' :
                        movementContext.trigger === 'keyboard_navigation' ? '⌨️' : '📍';

    // Performance validation for movement operations
    const performanceThreshold = 16.67; // 60fps target
    const exceedsPerformanceThreshold = movementContext.duration > performanceThreshold;

    if (exceedsPerformanceThreshold && isSignificantMovement) {
      console.warn(`⚠️ [DISPLAY:${this.displayId}] Slow movement detected: ${movementContext.duration.toFixed(2)}ms`, movementData);
    } else if (isSignificantMovement) {
      console.log(`${movementIcon} [DISPLAY:${this.displayId}] Container moved: (${oldPosition.x}, ${oldPosition.y}) → (${newPosition.x}, ${newPosition.y})`, movementData);
    }

    // Update metrics
    if (!this.metrics.containerMovementMetrics) {
      this.metrics.containerMovementMetrics = [];
    }
    this.metrics.containerMovementMetrics.push(movementData);

    return movementData;
  }

  /**
   * Log end-to-end WebSocket to render latency correlation
   *
   * @param {Object} webSocketTimestamp - WebSocket message timestamp
   * @param {Object} renderTimestamp - When the data was rendered to canvas
   * @param {Object} latencyContext - Additional context for the latency measurement
   * @param {string} latencyContext.dataType - Type of data ('tick', 'bar', 'quote')
   * @param {string} latencyContext.visualizationType - Which visualization was updated
   * @param {number} latencyContext.processingComplexity - Estimated processing complexity (1-10)
   * @returns {Object} Comprehensive latency analysis
   */
  logWebSocketToRenderLatency(webSocketTimestamp, renderTimestamp, latencyContext = {}) {
    const measurementTime = performance.now();
    const relativeTime = measurementTime - this.creationStartTime;

    // Calculate various latency components
    const totalLatency = renderTimestamp.time - webSocketTimestamp.time;
    const webSocketToApp = webSocketTimestamp.appReceived - webSocketTimestamp.time;
    const appToRender = renderTimestamp.time - webSocketTimestamp.appReceived;
    const renderQueueTime = renderTimestamp.renderStarted - renderTimestamp.queued;
    const actualRenderTime = renderTimestamp.renderCompleted - renderTimestamp.renderStarted;

    const latencyData = {
      timestamps: {
        webSocketReceived: webSocketTimestamp.time,
        appProcessed: webSocketTimestamp.appReceived,
        renderQueued: renderTimestamp.queued,
        renderStarted: renderTimestamp.renderStarted,
        renderCompleted: renderTimestamp.renderCompleted,
        measurementTime
      },
      latencyBreakdown: {
        totalLatency,
        webSocketToApp,
        appToRender,
        renderQueueTime,
        actualRenderTime,
        pipelineOverhead: totalLatency - actualRenderTime
      },
      performanceAnalysis: {
        meetsSub100msTarget: totalLatency < 100,
        meetsSub16msRender: actualRenderTime < 16.67,
        bottleneckStage: this.identifyBottleneck(webSocketToApp, appToRender, renderQueueTime, actualRenderTime),
        efficiency: (actualRenderTime / totalLatency) * 100
      },
      context: {
        dataType: latencyContext.dataType || 'unknown',
        visualizationType: latencyContext.visualizationType || 'unknown',
        processingComplexity: latencyContext.processingComplexity || 5,
        symbol: this.symbol,
        displayId: this.displayId
      },
      relativeTime
    };

    // Performance validation with trader-critical thresholds
    const criticalLatencyThreshold = 100; // 100ms for real-time trading
    const hasCriticalLatency = totalLatency > criticalLatencyThreshold;

    if (hasCriticalLatency) {
      console.error(`🚨 [DISPLAY:${this.displayId}] CRITICAL LATENCY: ${totalLatency.toFixed(2)}ms (>100ms trading threshold)`, latencyData);
    } else if (totalLatency > 50) {
      console.warn(`⚠️ [DISPLAY:${this.displayId}] Elevated latency: ${totalLatency.toFixed(2)}ms`, latencyData);
    } else {
      console.log(`⚡ [DISPLAY:${this.displayId}] WebSocket→Render latency: ${totalLatency.toFixed(2)}ms`, latencyData);
    }

    // Update metrics
    if (!this.metrics.latencyMeasurements) {
      this.metrics.latencyMeasurements = [];
    }
    this.metrics.latencyMeasurements.push(latencyData);

    // Update aggregate latency metrics
    this.metrics.averageLatency = this.metrics.latencyMeasurements.reduce((sum, m) => sum + m.latencyBreakdown.totalLatency, 0) / this.metrics.latencyMeasurements.length;
    this.metrics.maxLatency = Math.max(...this.metrics.latencyMeasurements.map(m => m.latencyBreakdown.totalLatency));
    this.metrics.latencyConsistency = this.calculateLatencyConsistency();

    return latencyData;
  }

  /**
   * Log render scheduling and pipeline performance
   *
   * @param {string} schedulingPhase - Current phase in render pipeline
   * @param {Object} schedulingData - Data specific to this scheduling phase
   * @param {string} schedulingData.renderType - Type of render ('full', 'incremental', 'damage_rect')
   * @param {Array} schedulingData.visualizations - List of visualizations being rendered
   * @param {Object} schedulingData.trigger - What triggered this render cycle
   * @param {Object} schedulingData.priority - Render priority information
   * @returns {Object} Scheduling event data with pipeline analysis
   */
  logRenderScheduling(schedulingPhase, schedulingData = {}) {
    const timestamp = performance.now();
    const relativeTime = timestamp - this.creationStartTime;

    const schedulingEvent = {
      phase: schedulingPhase, // 'requested', 'scheduled', 'started', 'completed', 'deferred', 'cancelled'
      timestamp,
      relativeTime,
      renderData: {
        renderType: schedulingData.renderType || 'full',
        visualizationCount: (schedulingData.visualizations || []).length,
        visualizations: schedulingData.visualizations || [],
        trigger: schedulingData.trigger || { type: 'unknown', source: 'system' },
        priority: schedulingData.priority || { level: 'normal', reason: 'standard' }
      },
      pipeline: {
        phaseIndex: this.getRenderPipelinePhaseIndex(schedulingPhase),
        estimatedDuration: schedulingData.estimatedDuration || 0,
        resourceUtilization: schedulingData.resourceUtilization || { cpu: 'unknown', memory: 'unknown' },
        frameBudgetRemaining: this.calculateFrameBudgetRemaining(timestamp)
      },
      context: {
        symbol: this.symbol,
        displayId: this.displayId,
        activeAnimations: schedulingData.activeAnimations || 0,
        pendingUpdates: schedulingData.pendingUpdates || 0,
        memoryPressure: schedulingData.memoryPressure || 'normal'
      }
    };

    // Phase-specific logging with performance indicators
    const phaseIcons = {
      requested: '📋',
      scheduled: '⏰',
      started: '🚀',
      completed: '✅',
      deferred: '⏸️',
      cancelled: '❌'
    };

    const icon = phaseIcons[schedulingPhase] || '🔄';

    // Performance analysis for render scheduling
    const frameBudget = 16.67; // 60fps target
    const frameBudgetPressure = schedulingEvent.pipeline.frameBudgetRemaining < 5; // Less than 5ms remaining

    if (frameBudgetPressure && schedulingPhase === 'scheduled') {
      console.warn(`⚠️ [DISPLAY:${this.displayId}] Frame budget pressure: ${schedulingEvent.pipeline.frameBudgetRemaining.toFixed(2)}ms remaining`, schedulingEvent);
    } else {
      console.log(`${icon} [DISPLAY:${this.displayId}] Render ${schedulingPhase}: ${schedulingData.renderType || 'unknown'} render (${schedulingEvent.renderData.visualizationCount} viz)`, schedulingEvent);
    }

    // Update metrics
    if (!this.metrics.renderSchedulingEvents) {
      this.metrics.renderSchedulingEvents = [];
    }
    this.metrics.renderSchedulingEvents.push(schedulingEvent);

    // Track render frequency and scheduling patterns
    this.updateRenderSchedulingMetrics(schedulingEvent);

    return schedulingEvent;
  }

  /**
   * Helper method to determine cardinal direction from delta values
   */
  getCardinalDirection(deltaX, deltaY) {
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    const normalizedAngle = (angle + 360) % 360;

    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'E';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'SE';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'S';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'SW';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'W';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'NW';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'N';
    return 'NE';
  }

  /**
   * Helper method to identify performance bottlenecks in latency pipeline
   */
  identifyBottleneck(webSocketToApp, appToRender, renderQueueTime, actualRenderTime) {
    const stages = [
      { name: 'websocket', time: webSocketToApp },
      { name: 'app_processing', time: appToRender },
      { name: 'render_queue', time: renderQueueTime },
      { name: 'actual_render', time: actualRenderTime }
    ];

    return stages.reduce((max, stage) => stage.time > max.time ? stage : max).name;
  }

  /**
   * Helper method to calculate latency consistency (coefficient of variation)
   */
  calculateLatencyConsistency() {
    if (!this.metrics.latencyMeasurements || this.metrics.latencyMeasurements.length < 2) {
      return 100; // Perfect consistency with single measurement
    }

    const latencies = this.metrics.latencyMeasurements.map(m => m.latencyBreakdown.totalLatency);
    const mean = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const variance = latencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / latencies.length;
    const standardDeviation = Math.sqrt(variance);

    // Coefficient of variation (lower is more consistent)
    return mean > 0 ? ((1 - (standardDeviation / mean)) * 100) : 100;
  }

  /**
   * Helper method to get render pipeline phase index
   */
  getRenderPipelinePhaseIndex(phase) {
    const phases = ['requested', 'scheduled', 'started', 'completed', 'deferred', 'cancelled'];
    return phases.indexOf(phase);
  }

  /**
   * Helper method to calculate remaining frame budget
   */
  calculateFrameBudgetRemaining(currentTime) {
    if (!this.lastFrameTime) {
      this.lastFrameTime = currentTime;
      return 16.67; // Full frame budget on first measurement
    }

    const timeSinceLastFrame = currentTime - this.lastFrameTime;
    const frameBudgetRemaining = 16.67 - (timeSinceLastFrame % 16.67);

    this.lastFrameTime = currentTime;
    return Math.max(0, frameBudgetRemaining);
  }

  /**
   * Helper method to update render scheduling metrics
   */
  updateRenderSchedulingMetrics(schedulingEvent) {
    if (!this.metrics.renderSchedulingMetrics) {
      this.metrics.renderSchedulingMetrics = {
        totalRenders: 0,
        completedRenders: 0,
        averageRenderTime: 0,
        renderFrequency: 0,
        phaseDistribution: {}
      };
    }

    const metrics = this.metrics.renderSchedulingMetrics;
    metrics.totalRenders++;

    if (schedulingEvent.phase === 'completed') {
      metrics.completedRenders++;

      // Calculate average render time based on render scheduling events
      const completedRenders = this.metrics.renderSchedulingEvents.filter(e => e.phase === 'completed');
      if (completedRenders.length > 0) {
        const renderTimes = completedRenders.map(e => e.timestamp - (this.metrics.renderSchedulingEvents
          .filter(ev => ev.phase === 'started' && ev.timestamp < e.timestamp)
          .pop()?.timestamp || e.timestamp));
        metrics.averageRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length;
      }
    }

    // Track phase distribution
    metrics.phaseDistribution[schedulingEvent.phase] = (metrics.phaseDistribution[schedulingEvent.phase] || 0) + 1;
  }

  /**
   * Create state snapshot for debugging
   */
  createStateSnapshot(snapshotName, additionalData = {}) {
    const snapshot = {
      snapshotName,
      timestamp: performance.now(),
      displayId: this.displayId,
      symbol: this.symbol,
      relativeTime: performance.now() - this.creationStartTime,
      phases: Array.from(this.phases.entries()),
      metrics: { ...this.metrics },
      errors: [...this.errors],
      warnings: [...this.warnings],
      ...additionalData
    };

    this.stateSnapshots.set(snapshotName, snapshot);
    return snapshot;
  }

  /**
   * Complete the display creation logging
   */
  complete() {
    this.metrics.totalCreationTime = performance.now() - this.creationStartTime;

    const summary = {
      displayId: this.displayId,
      symbol: this.symbol,
      totalCreationTime: this.metrics.totalCreationTime,
      metrics: this.metrics,
      phasesCompleted: Array.from(this.phases.keys()),
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      success: this.errors.length === 0
    };

    console.group(`🎉 [DISPLAY:${this.displayId}] Creation Complete`);
    console.log('Symbol:', this.symbol);
    console.log('Total Time:', `${this.metrics.totalCreationTime.toFixed(2)}ms`);
    console.log('Phases Completed:', summary.phasesCompleted);
    console.log('Success:', summary.success ? '✅' : '❌');

    if (this.errors.length > 0) {
      console.warn('Errors:', this.errors);
    }

    if (this.warnings.length > 0) {
      console.info('Warnings:', this.warnings);
    }

    console.groupEnd();

    return summary;
  }

  /**
   * Generate comprehensive diagnostic report
   */
  generateDiagnosticReport() {
    return {
      displayId: this.displayId,
      symbol: this.symbol,
      creationStartTime: this.creationStartTime,
      phases: Object.fromEntries(this.phases),
      metrics: this.metrics,
      errors: this.errors,
      warnings: this.warnings,
      stateSnapshots: Object.fromEntries(this.stateSnapshots),
      completedAt: performance.now()
    };
  }

  /**
   * 🔧 PHASE 5: Log Atomic Resize Transaction for Rock-Solid Coordinate Consistency
   *
   * @param {string} transactionId - Unique identifier for the atomic transaction
   * @param {Object} oldContentArea - Previous content area dimensions {width, height}
   * @param {Object} newContentArea - New content area dimensions {width, height}
   * @param {Object} validationResults - Results from coordinate system validations
   * @param {Object} performance - Performance metrics for the transaction
   * @param {number} performance.duration - Total transaction duration in milliseconds
   * @param {Object} resizeContext - Context about what triggered the resize
   * @returns {Object} Comprehensive atomic transaction logging data
   */
  logAtomicResizeTransaction(transactionId, oldContentArea, newContentArea, validationResults, performance, resizeContext = {}) {
    const timestamp = performance.now();
    const relativeTime = timestamp - this.creationStartTime;

    const transactionData = {
      transactionId,
      timestamp,
      relativeTime,
      displayId: this.displayId,
      symbol: this.symbol,
      contentAreaChange: {
        from: { width: oldContentArea.width, height: oldContentArea.height },
        to: { width: newContentArea.width, height: newContentArea.height },
        delta: {
          width: newContentArea.width - oldContentArea.width,
          height: newContentArea.height - oldContentArea.height,
          area: (newContentArea.width * newContentArea.height) - (oldContentArea.width * oldContentArea.height)
        }
      },
      validationResults: {
        yScaleValid: validationResults.yScale?.isValid || false,
        yScaleDeviation: validationResults.yScale?.maxDeviation || 0,
        adrAlignmentValid: validationResults.adrAlignment?.isValid || false,
        adrAlignmentDeviation: validationResults.adrAlignment?.maxDeviation || 0,
        synchronizationCheck: validationResults.synchronizationCheck?.synchronized || false,
        allValidationsPassed: validationResults.allValidationsPassed || false
      },
      performance: {
        transactionDuration: performance.duration,
        meets60fpsTarget: performance.duration <= 16.67,
        meetsSub100msTarget: performance.duration <= 100,
        breakdown: performance.breakdown || {}
      },
      resizeContext: {
        trigger: resizeContext.trigger || 'unknown',
        userInitiated: resizeContext.userInitiated || false,
        sequential: resizeContext.sequential || false
      },
      tradingPrecision: {
        withinTradingPrecision: (validationResults.adrAlignment?.maxDeviation || 0) <= 1.0,
        withinAcceptableRange: (validationResults.adrAlignment?.maxDeviation || 0) <= 2.0,
        adrCenteringAccuracy: validationResults.adrAlignment?.maxDeviation || 0
      }
    };

    // Log transaction completion with appropriate icon based on results
    const transactionIcon = transactionData.validationResults.allValidationsPassed ? '✅' : '⚠️';
    const performanceIcon = transactionData.performance.meets60fpsTarget ? '🚀' : '🐌';
    const precisionIcon = transactionData.tradingPrecision.withinTradingPrecision ? '🎯' : '📏';

    console.log(`${transactionIcon} ${performanceIcon} ${precisionIcon} [DISPLAY:${this.displayId}] ATOMIC RESIZE TRANSACTION COMPLETE: ${transactionId}`, transactionData);

    // Log warnings for any validation failures
    if (!transactionData.validationResults.allValidationsPassed) {
      console.warn(`⚠️ [DISPLAY:${this.displayId}] Atomic resize transaction validation failures:`, {
        transactionId,
        yScaleValid: transactionData.validationResults.yScaleValid,
        adrAlignmentValid: transactionData.validationResults.adrAlignmentValid,
        synchronizationCheck: transactionData.validationResults.synchronizationCheck,
        maxDeviation: transactionData.validationResults.adrAlignmentDeviation
      });
    }

    // Log performance warnings for slow transactions
    if (!transactionData.performance.meets60fpsTarget) {
      console.warn(`⚠️ [DISPLAY:${this.displayId}] Slow atomic resize transaction: ${performance.duration.toFixed(2)}ms (exceeds 16ms 60fps target)`, {
        transactionId,
        duration: performance.duration,
        frameBudgetOverrun: performance.duration - 16.67
      });
    }

    // Update metrics for atomic transactions
    if (!this.metrics.atomicResizeTransactions) {
      this.metrics.atomicResizeTransactions = [];
    }
    this.metrics.atomicResizeTransactions.push(transactionData);

    // Log phase for comprehensive tracking
    this.logPhase('atomic_resize_transaction', {
      transactionId,
      validationResults: transactionData.validationResults,
      performance: transactionData.performance,
      tradingPrecision: transactionData.tradingPrecision
    }, 'completed');

    return transactionData;
  }
}

/**
 * Display Creation Logger Registry
 */
const displayLoggers = new Map();

/**
 * Get or create display creation logger
 */
export function getDisplayCreationLogger(displayId, symbol) {
  if (!displayLoggers.has(displayId)) {
    displayLoggers.set(displayId, new DisplayCreationLogger(displayId, symbol));
  }
  return displayLoggers.get(displayId);
}

/**
 * Remove display creation logger
 */
export function removeDisplayCreationLogger(displayId) {
  const logger = displayLoggers.get(displayId);
  if (logger) {
    logger.complete();
    displayLoggers.delete(displayId);
  }
}

/**
 * Get all display creation loggers
 */
export function getAllDisplayCreationLoggers() {
  return Array.from(displayLoggers.values());
}

/**
 * Generate global display creation report
 */
export function generateGlobalDisplayCreationReport() {
  const loggers = getAllDisplayCreationLoggers();
  const reports = loggers.map(logger => logger.generateDiagnosticReport());

  const globalReport = {
    timestamp: Date.now(),
    totalDisplays: loggers.length,
    successfulDisplays: reports.filter(r => r.errors.length === 0).length,
    averageCreationTime: reports.length > 0 ?
      reports.reduce((sum, r) => sum + (r.metrics.totalCreationTime || 0), 0) / reports.length : 0,
    commonErrors: {},
    phaseSuccessRates: {},
    displayReports: reports
  };

  // Calculate common errors
  reports.forEach(report => {
    report.errors.forEach(error => {
      const phase = error.phase || 'unknown';
      globalReport.commonErrors[phase] = (globalReport.commonErrors[phase] || 0) + 1;
    });
  });

  // Calculate phase success rates
  const allPhases = new Set(reports.flatMap(r => Object.keys(r.phases)));
  allPhases.forEach(phase => {
    const completed = reports.filter(r =>
      r.phases[phase] && r.phases[phase].some(p => p.status === 'completed')
    ).length;
    globalReport.phaseSuccessRates[phase] = (completed / reports.length) * 100;
  });

  return globalReport;
}

/**
 * Convenience function for quick display creation logging
 */
export function logDisplayCreationPhase(displayId, phaseName, data, status = 'started') {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logPhase(phaseName, data, status);
}

/**
 * Convenience function for YScale validation
 */
export function validateAndLogYScale(displayId, yScale, contentArea, priceRange, state) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logYScaleValidation(yScale, contentArea, priceRange, state);
}

/**
 * Convenience function for canvas initialization logging
 */
export function validateAndLogCanvasInit(displayId, canvas, contentArea, config) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logCanvasInitialization(canvas, contentArea, config);
}

/**
 * Convenience function for visualization render logging
 */
export function logVisualizationPerformance(displayId, visualizationName, renderStartTime, renderContext, state) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logVisualizationRender(visualizationName, renderStartTime, renderContext, state);
}

/**
 * Convenience function for data flow logging
 */
export function logDisplayDataFlow(displayId, flowType, data) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logDataFlow(flowType, data);
}

/**
 * Convenience function for container resize logging
 */
export function logContainerResize(displayId, oldDimensions, newDimensions, resizeContext = {}) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logContainerResize(oldDimensions, newDimensions, resizeContext);
}

/**
 * Convenience function for container movement logging
 */
export function logContainerMovement(displayId, oldPosition, newPosition, movementContext = {}) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logContainerMovement(oldPosition, newPosition, movementContext);
}

/**
 * Convenience function for WebSocket to render latency logging
 */
export function logWebSocketToRenderLatency(displayId, webSocketTimestamp, renderTimestamp, latencyContext = {}) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logWebSocketToRenderLatency(webSocketTimestamp, renderTimestamp, latencyContext);
}

/**
 * Convenience function for render scheduling logging
 */
export function logRenderScheduling(displayId, schedulingPhase, schedulingData = {}) {
  const logger = getDisplayCreationLogger(displayId);
  return logger.logRenderScheduling(schedulingPhase, schedulingData);
}