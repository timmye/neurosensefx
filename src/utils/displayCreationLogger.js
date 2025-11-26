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