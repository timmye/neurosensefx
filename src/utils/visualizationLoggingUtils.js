/**
 * Visualization Logging Utilities
 *
 * Helper functions to add display ID correlation to all visualization logs
 * without requiring manual modifications to each visualization file.
 */

/**
 * Enhanced wrapper for visualization functions with display correlation
 */
export function createLoggedVisualization(visualizationName, drawFunction) {
  return function loggedVisualization(ctx, renderingContext, config, state, yScale) {
    // Extract display context for correlation
    const displayId = renderingContext?.displayId || 'unknown';
    const symbol = renderingContext?.symbol || 'unknown';
    const startTime = performance.now();

    try {
      // Execute original visualization function
      const result = drawFunction(ctx, renderingContext, config, state, yScale);

      // Log successful execution with performance metrics
      const renderTime = performance.now() - startTime;
      const meets60fps = renderTime <= 16.67;

      if (!meets60fps) {
        console.warn(`⚠️ [${visualizationName}:${displayId}] Slow render: ${renderTime.toFixed(2)}ms for ${symbol}`);
      }

      return result;

    } catch (error) {
      // Enhanced error logging with display correlation
      console.error(`❌ [${visualizationName}:${displayId}] Rendering error for ${symbol}:`, {
        error: error.message,
        stack: error.stack,
        renderingContext: {
          hasContentArea: !!renderingContext?.contentArea,
          contentAreaSize: renderingContext?.contentArea ?
            `${renderingContext.contentArea.width}×${renderingContext.contentArea.height}` : 'N/A'
        },
        state: {
          hasVisualRange: !!(state?.visualLow && state?.visualHigh),
          hasCurrentPrice: !!state?.currentPrice,
          ready: state?.ready
        }
      });

      throw error;
    }
  };
}

/**
 * Create a wrapper that injects display context into rendering context
 */
export function enhanceRenderingContext(renderingContext, displayId, symbol) {
  return {
    ...renderingContext,
    displayId,
    symbol
  };
}

/**
 * Batch enhancement for multiple visualizations
 */
export function enhanceVisualizationFunctions(visualizationFunctions, displayId, symbol) {
  const enhancedFunctions = {};

  Object.entries(visualizationFunctions).forEach(([name, func]) => {
    if (typeof func === 'function') {
      enhancedFunctions[name] = createLoggedVisualization(name, func);
    }
  });

  return enhancedFunctions;
}

/**
 * Performance monitoring wrapper for rendering phases
 */
export function monitorRenderPhase(phaseName, renderingContext, renderFunction) {
  const displayId = renderingContext?.displayId || 'unknown';
  const symbol = renderingContext?.symbol || 'unknown';
  const startTime = performance.now();

  try {
    const result = renderFunction();

    const renderTime = performance.now() - startTime;
    console.log(`✅ [${phaseName}:${displayId}] ${renderTime.toFixed(2)}ms for ${symbol}`);

    return result;

  } catch (error) {
    console.error(`❌ [${phaseName}:${displayId}] Failed for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Validation wrapper for coordinate transformations
 */
export function validateCoordinateTransformation(displayId, symbol, transformType, input, output) {
  try {
    // Validate input types
    if (typeof input !== 'number' || isNaN(input) || !isFinite(input)) {
      throw new Error(`Invalid input: ${input}`);
    }

    if (typeof output !== 'number' || isNaN(output) || !isFinite(output)) {
      throw new Error(`Invalid output: ${output}`);
    }

    // Log successful transformation
    console.log(`📏 [${transformType}:${displayId}] ${symbol}: ${input} → ${output}`);

    return { valid: true, input, output };

  } catch (error) {
    console.error(`❌ [${transformType}:${displayId}] Coordinate transformation failed for ${symbol}:`, {
      input,
      output,
      error: error.message
    });

    return { valid: false, input, output, error: error.message };
  }
}

/**
 * Create display context enhancer for FloatingDisplay
 */
export function createDisplayContextEnhancer() {
  const displayContexts = new Map();

  return {
    // Create or get enhanced rendering context
    getContext: (displayId, symbol, baseContext) => {
      const key = `${displayId}:${symbol}`;

      if (!displayContexts.has(key)) {
        const enhancedContext = enhanceRenderingContext(baseContext, displayId, symbol);
        displayContexts.set(key, enhancedContext);
      }

      return displayContexts.get(key);
    },

    // Clear context cache
    clearContexts: () => {
      displayContexts.clear();
    },

    // Get all active contexts
    getActiveContexts: () => {
      return Array.from(displayContexts.entries());
    }
  };
}

/**
 * Global display context enhancer instance
 */
export const displayContextEnhancer = createDisplayContextEnhancer();