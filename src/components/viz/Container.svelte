<script>
  import { onMount, onDestroy } from 'svelte';
  import { scaleLinear } from 'd3-scale';
  import { drawDayRangeMeter } from '../../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../../lib/viz/priceDisplay.js';
  import { drawMarketProfile } from '../../lib/viz/marketProfile.js';
  import { drawVolatilityOrb } from '../../lib/viz/volatilityOrb.js';
  import { drawVolatilityMetric } from '../../lib/viz/volatilityMetric.js';
    import { drawPriceMarkers } from '../../lib/viz/priceMarkers.js'; // Import drawPriceMarkers
  import { markerStore } from '../../stores/markerStore.js'; // Import markerStore
  import { displayActions } from '../../stores/displayStore.js'; // Import displayActions for context menu
  import { writable } from 'svelte/store';
  import { Environment, EnvironmentConfig } from '../../lib/utils/environmentUtils.js';
    
  // Debug: Verify imports are working
  console.log('[Container] Imports loaded:', {
    drawVolatilityOrb: typeof drawVolatilityOrb,
    drawDayRangeMeter: typeof drawDayRangeMeter,
    drawMarketProfile: typeof drawMarketProfile
  });

  // 🔧 UNIFIED SIZING: Import canvas sizing utilities
  import { createCanvasSizingConfig, configureCanvasContext, CANVAS_CONSTANTS, boundsUtils, createZoomDetector } from '../../utils/canvasSizing.js';

    export let config;
  export let state;
  export let id;

  let canvas;
  let ctx;
  let dpr = 1;
  let y; // Declare y scale at top level to be accessible everywhere

  let markers = []; // Local variable to hold markers from store
  // State for flash animation
  let flashOpacity = 0;
  let flashDuration = 300; // ms
  let flashStartTime = 0;
  
  // 🔧 CLEAN FOUNDATION: Rendering context for clean parameter pipeline
  let renderingContext = null;
  let canvasSizingConfig = null;

  // 🌍 ENVIRONMENT INDICATOR: Environment detection and display state
  let showEnvironmentIndicator = false;
  let environmentDetails = null;
  let indicatorTooltip = '';

  onMount(() => {
    ctx = canvas.getContext('2d');
    dpr = window.devicePixelRatio || 1;

  
    // 🔧 ZOOM AWARENESS: Initialize zoom detector
    const cleanupZoomDetector = createZoomDetector((newDpr) => {
      console.log(`[CONTAINER_ZOOM_AWARENESS] DPR changed to ${newDpr}`);
      dpr = newDpr;

  
      // Recalculate canvas sizing with new DPR
      if (config) {
        const containerSize = config.containerSize || { width: 220, height: 120 }; // ✅ HEADERLESS: Correct default
        canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
          includeHeader: true,
          padding: config.padding,
          headerHeight: config.headerHeight,
          respectDpr: true
        });

        // Update canvas with new dimensions (no configureCanvasContext call - scaling done in draw)
        const { canvas: canvasDims } = canvasSizingConfig.dimensions;
        canvas.width = canvasDims.width;
        canvas.height = canvasDims.height;

        // 🔧 CRITICAL FIX: Set CSS dimensions to match container exactly
        canvas.style.width = canvasDims.cssWidth + 'px';
        canvas.style.height = canvasDims.cssHeight + 'px';

        console.log(`[CONTAINER_ZOOM_AWARENESS] Canvas updated for new DPR:`, {
          newDpr,
          canvasDimensions: `${canvasDims.width}x${canvasDims.height}`
        });
      }
    });

    // Store cleanup function for onDestroy
    onDestroy(() => {
      if (cleanupZoomDetector) {
        cleanupZoomDetector();
      }
    });
  });

  // 🔧 CLEAN FOUNDATION: Container → Content → Rendering pipeline
  $: if (canvas && config) {
    // 1. Container layer - physical dimensions
    const containerSize = config.containerSize || { width: 220, height: 120 }; // ✅ HEADERLESS: Correct default
    
    // 2. Content area - derived from container
    const contentArea = {
      width: containerSize.width - (config.padding * 2),
      height: containerSize.height - config.headerHeight - config.padding
    };
    
    // 3. ADR axis - positioned relative to content
    const adrAxisX = contentArea.width * config.adrAxisPosition;
    
    // 4. Create rendering context for visualizations
    renderingContext = {
      containerSize,
      contentArea,
      adrAxisX,
      // Derived values for backward compatibility
      visualizationsContentWidth: contentArea.width,
      meterHeight: contentArea.height,
      adrAxisXPosition: adrAxisX
    };
    
    // Create unified canvas sizing configuration
    canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
      includeHeader: true,
      padding: config.padding,
      headerHeight: config.headerHeight,
      respectDpr: true
    });
    
    // Set canvas dimensions first
    const { canvas: canvasDims } = canvasSizingConfig.dimensions;
    canvas.width = canvasDims.width;
    canvas.height = canvasDims.height;

    // 🔧 CRITICAL FIX: Set CSS dimensions to match container exactly
    canvas.style.width = canvasDims.cssWidth + 'px';
    canvas.style.height = canvasDims.cssHeight + 'px';

    console.log('[CONTAINER] Clean foundation renderingContext:', renderingContext);
  }

  // 🌍 ENVIRONMENT INDICATOR: Reactive environment detection and tooltip generation
  $: {
    const config = EnvironmentConfig.current;
    showEnvironmentIndicator = config.showEnvironmentIndicator;

    if (showEnvironmentIndicator) {
      environmentDetails = {
        mode: Environment.current,
        isDevelopment: Environment.isDevelopment,
        isProduction: Environment.isProduction,
        config: config
      };

      // Generate descriptive tooltip
      if (Environment.isDevelopment) {
        indicatorTooltip = 'Development Mode - Hot reload enabled, debug logging active';
      } else {
        indicatorTooltip = 'Production Mode - Optimized for performance';
      }
    }
  }

    // 🎨 CANVAS CONTEXT MENU: Direct handler for canvas right-click (Svelte approach)
  function handleCanvasContextMenu(event) {
    console.log('🎨 [CONTAINER] Canvas context menu triggered (Svelte handler)');

    // Create canvas context
    const context = {
      type: 'canvas',
      targetId: id,
      targetType: 'display',
      displayId: id,
      symbol: state?.symbol || 'unknown'
    };

    // Show canvas context menu
    displayActions.showContextMenu(event.clientX, event.clientY, id, 'display', context);
  }

  // This reactive block triggers a redraw whenever core data, config, or marker store changes
  $: if (ctx && state && config && $markerStore !== undefined) {
    // We access $markerStore here to make this block reactive to its changes
    markers = $markerStore; // Update local markers variable

    // Trigger draw when state, config, or markerStore changes
    // The check for ctx, state, config ensures everything is ready
    draw(state, renderingContext, markers); // Pass rendering context and markers array to draw function
  }

  // Frame-throttled mouse move handler for optimal 60fps performance

  
  
  
  
  // 🔧 DEBUGGER: Automated drift detection system
  let renderFrameCount = 0;
  let lastRenderTime = 0;
  let lastPositionSnapshot = null;
  let driftHistory = [];

  function draw(currentState, currentRenderingContext, currentMarkers) {
    // 🔧 ARCHITECTURAL FIX: Error boundaries around canvas operations
    if (!ctx || !currentState || !currentRenderingContext) return;

    const startTime = performance.now();
    renderFrameCount++;

    try {
      // 🔧 DEBUGGER: Canvas state monitoring
      const canvasRect = canvas.getBoundingClientRect();
      const currentDpr = window.devicePixelRatio || 1;

      // 🔧 DEBUGGER: Position tracking for drift detection
      const positionSnapshot = {
        timestamp: startTime,
        frameCount: renderFrameCount,
        canvasRect: {
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
          height: canvasRect.height
        },
        canvasSize: {
          width: canvas.width,
          height: canvas.height,
          cssWidth: canvas.style.width,
          cssHeight: canvas.style.height
        },
        dpr: currentDpr,
        contentArea: currentRenderingContext.contentArea,
        renderingContext: {
          adrAxisX: currentRenderingContext.adrAxisX,
          containerSize: currentRenderingContext.containerSize
        },
        stateData: {
          currentPrice: currentState.currentPrice,
          visualLow: currentState.visualLow,
          visualHigh: currentState.visualHigh
        },
        transform: {
          a: ctx.getTransform().a,
          b: ctx.getTransform().b,
          c: ctx.getTransform().c,
          d: ctx.getTransform().d,
          e: ctx.getTransform().e,
          f: ctx.getTransform().f
        }
      };

      // 🔧 DEBUGGER: Detect position changes (drift detection)
      if (lastPositionSnapshot) {
        const positionDelta = {
          leftDelta: canvasRect.left - lastPositionSnapshot.canvasRect.left,
          topDelta: canvasRect.top - lastPositionSnapshot.canvasRect.top,
          widthDelta: canvasRect.width - lastPositionSnapshot.canvasRect.width,
          heightDelta: canvasRect.height - lastPositionSnapshot.canvasRect.height,
          dprDelta: currentDpr - lastPositionSnapshot.dpr,
          timeDelta: startTime - lastPositionSnapshot.timestamp
        };

        // Log significant position changes (>0.1px or timing >100ms)
        if (Math.abs(positionDelta.leftDelta) > 0.1 ||
            Math.abs(positionDelta.topDelta) > 0.1 ||
            Math.abs(positionDelta.timeDelta) > 100) {

          console.warn('[DEBUGGER:DRIFT:Container:draw] Position drift detected:', {
            displayId: id,
            positionDelta,
            currentSnapshot: positionSnapshot,
            previousSnapshot: lastPositionSnapshot,
            cause: 'Position change detected between render frames'
          });

          driftHistory.push({
            timestamp: startTime,
            frameCount: renderFrameCount,
            delta: positionDelta,
            snapshot: positionSnapshot
          });

          // Keep only last 10 drift events
          if (driftHistory.length > 10) {
            driftHistory.shift();
          }
        }
      }

      // 🔧 CLEAN FOUNDATION: Save context and apply DPR scaling each render frame
      ctx.save();

      // 🔧 DEBUGGER: Context transform monitoring
      const beforeTransform = ctx.getTransform();

    // Apply DPR scaling for this render cycle only
    if (canvasSizingConfig && canvasSizingConfig.dimensions.dpr > 1) {
      ctx.scale(canvasSizingConfig.dimensions.dpr, canvasSizingConfig.dimensions.dpr);
    }

    // 🔧 DEBUGGER: Monitor transform changes
    const afterTransform = ctx.getTransform();
    const transformChange = {
      before: beforeTransform,
      after: afterTransform,
      dprApplied: canvasSizingConfig?.dimensions?.dpr || 1
    };

    if (renderFrameCount % 60 === 0) { // Log every 60 frames
      console.log('[DEBUGGER:Container:draw] Transform monitoring:', {
        displayId: id,
        frameCount: renderFrameCount,
        transformChange
      });
    }

    // 🔧 CLEAN FOUNDATION: Use rendering context for all operations
    const { contentArea, adrAxisX } = currentRenderingContext;

    // 🔧 BOUNDARY FIX: Establish clipping region to constrain all visualizations
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, contentArea.width, contentArea.height);
    ctx.clip();

    // Initialize/update y-scale for the current render frame
    y = scaleLinear().domain([currentState.visualLow, currentState.visualHigh]).range([contentArea.height, 0]);

    // 🔧 DEBUGGER: Canvas clearing monitoring
    const clearStart = performance.now();
    const clearBefore = ctx.getImageData(0, 0, Math.min(contentArea.width, 100), Math.min(contentArea.height, 100));

    // 🔧 FIX: Use full canvas dimensions for clearing - context is already DPR-scaled
    if (canvasSizingConfig) {
      const { canvasArea } = canvasSizingConfig.dimensions;
      // Since context is DPR-scaled, use full canvas dimensions (no division by DPR)
      ctx.clearRect(0, 0, canvasArea.width, canvasArea.height);
      ctx.fillStyle = '#111827'; // Ensure background is always drawn
      ctx.fillRect(0, 0, canvasArea.width, canvasArea.height);
    } else {
      // Fallback to content area dimensions (context is already DPR-scaled)
      ctx.clearRect(0, 0, contentArea.width, contentArea.height);
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, contentArea.width, contentArea.height);
    }

    const clearAfter = ctx.getImageData(0, 0, Math.min(contentArea.width, 100), Math.min(contentArea.height, 100));
    const clearTime = performance.now() - clearStart;

    // 🔧 DEBUGGER: Verify canvas was properly cleared
    const canvasCleared = !clearAfter.data.some((pixel, index) => {
      return index % 4 !== 3 && pixel !== clearBefore.data[index]; // Ignore alpha channel
    });

    if (!canvasCleared && clearTime > 1) {
      console.warn('[DEBUGGER:Container:draw] Canvas clearing anomaly:', {
        displayId: id,
        frameCount: renderFrameCount,
        clearTime,
        canvasCleared,
        beforeSize: clearBefore.data.length,
        afterSize: clearAfter.data.length
      });
    }

    // --- Draw Core Visualizations ---
    // 🔧 CLEAN FOUNDATION: Pass rendering context to all visualization functions

    // 🔧 DEBUGGER: Visualization function timing and error tracking
    const vizTimers = new Map();

    // --- Draw Volatility Orb (Background Layer - MUST be first) ---
    console.log('[Container] About to call drawVolatilityOrb:', {
      drawVolatilityOrbExists: typeof drawVolatilityOrb,
      hasCtx: !!ctx,
      hasRenderingContext: !!currentRenderingContext,
      hasConfig: !!config,
      hasState: !!currentState,
      showVolatilityOrb: config?.showVolatilityOrb,
      stateHasVolatility: 'volatility' in (currentState || {}),
      stateVolatility: currentState?.volatility
    });

    try {
      const vizStart = performance.now();
      drawVolatilityOrb(ctx, currentRenderingContext, config, currentState, y);
      const vizTime = performance.now() - vizStart;
      vizTimers.set('volatilityOrb', vizTime);
      console.log('[Container] drawVolatilityOrb completed successfully', { vizTime });
    } catch (error) {
      console.error('[Container] Volatility Orb render error:', error);
    }

    try {
      const vizStart = performance.now();
      drawMarketProfile(ctx, currentRenderingContext, config, currentState, y);
      const vizTime = performance.now() - vizStart;
      vizTimers.set('marketProfile', vizTime);
    } catch (error) {
      console.error('[Container] Market Profile render error:', error);
      vizTimers.set('marketProfile', -1);
    }

    // --- Draw Volatility Metric (just in front of background) ---
    try {
      const vizStart = performance.now();
      drawVolatilityMetric(ctx, currentRenderingContext, config, currentState);
      const vizTime = performance.now() - vizStart;
      vizTimers.set('volatilityMetric', vizTime);
    } catch (error) {
      console.error('[Container] Volatility Metric render error:', error);
      vizTimers.set('volatilityMetric', -1);
    }

    try {
      const vizStart = performance.now();
      drawDayRangeMeter(ctx, currentRenderingContext, config, currentState, y);
      const vizTime = performance.now() - vizStart;
      vizTimers.set('dayRangeMeter', vizTime);
    } catch (error) {
      console.error('[Container] Day Range Meter render error:', error);
      vizTimers.set('dayRangeMeter', -1);
    }


    // --- Draw Price Markers (behind Price Float and Price Display) ---
    try {
      const vizStart = performance.now();
      drawPriceMarkers(ctx, currentRenderingContext, config, currentState, y, currentMarkers);
      const vizTime = performance.now() - vizStart;
      vizTimers.set('priceMarkers', vizTime);
    } catch (error) {
      console.error('[Container] Price Markers render error:', error);
      vizTimers.set('priceMarkers', -1);
    }

    try {
      const vizStart = performance.now();
      drawPriceFloat(ctx, currentRenderingContext, config, currentState, y);
      const vizTime = performance.now() - vizStart;
      vizTimers.set('priceFloat', vizTime);
    } catch (error) {
      console.error('[Container] Price Float render error:', error);
      vizTimers.set('priceFloat', -1);
    }

    try {
      const vizStart = performance.now();
      drawPriceDisplay(ctx, currentRenderingContext, config, currentState, y);
      const vizTime = performance.now() - vizStart;
      vizTimers.set('priceDisplay', vizTime);
    } catch (error) {
      console.error('[Container] Price Display render error:', error);
      vizTimers.set('priceDisplay', -1);
    }
    
    
    // --- Draw Flash Overlay ---
    if (flashOpacity > 0) {
      const elapsedTime = performance.now() - flashStartTime;
      const newOpacity = config.flashIntensity * (1 - (elapsedTime / flashDuration));

      flashOpacity = Math.max(0, newOpacity);

      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(200, 200, 220, ${flashOpacity})`;
        if (canvasSizingConfig) {
          const { canvasArea, dpr } = canvasSizingConfig.dimensions;
          const flashWidth = canvasArea.width / dpr;
          const flashHeight = canvasArea.height / dpr;
          ctx.fillRect(0, 0, flashWidth, flashHeight);
        } else {
          const dpr = window.devicePixelRatio || 1;
          const flashWidth = contentArea.width / dpr;
          const flashHeight = contentArea.height / dpr;
          ctx.fillRect(0, 0, flashWidth, flashHeight);
        }
      }
    }

    // 🔧 CLEAN FOUNDATION: Restore context to prevent cumulative transformations
    const beforeRestore = ctx.getTransform();

    // 🔧 BOUNDARY FIX: Restore clipping region before other restores
    ctx.restore(); // Restore from clipping region save

    ctx.restore(); // Original context restore
    const afterRestore = ctx.getTransform();

    // 🔧 CRITICAL FIX: Explicit reset to identity matrix to prevent drift
    // This ensures complete transform reset even if restore() is incomplete
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 🔧 DEBUGGER: Performance monitoring and diagnostics
    const totalTime = performance.now() - startTime;
    const renderingStats = {
      displayId: id,
      frameCount: renderFrameCount,
      totalTime,
      vizTimers: Object.fromEntries(vizTimers),
      positionSnapshot,
      transformChanges: {
        beforeRestore,
        afterRestore
      },
      driftEvents: driftHistory.length,
      timestamp: startTime
    };

  
    // Log performance warnings
    if (totalTime > 16.67) { // More than one frame time (60fps)
      console.warn('[DEBUGGER:PERF:Container:draw] Slow render detected:', renderingStats);

          }

    // Log comprehensive diagnostics every 300 frames (5 seconds at 60fps)
    if (renderFrameCount % 300 === 0) {
      console.log('[DEBUGGER:DIAG:Container:draw] Rendering diagnostics:', renderingStats);

      // Log drift summary if we have drift events
      if (driftHistory.length > 0) {
        console.warn('[DEBUGGER:DRIFT:Container:draw] Drift summary:', {
          displayId: id,
          totalDriftEvents: driftHistory.length,
          recentDrifts: driftHistory.slice(-5),
          avgTimeBetweenDrifts: driftHistory.length > 1
            ? (driftHistory[driftHistory.length - 1].timestamp - driftHistory[0].timestamp) / (driftHistory.length - 1)
            : 0
        });

              }
    }

    // Update position tracking for next frame
    lastPositionSnapshot = positionSnapshot;
    lastRenderTime = startTime;

    } catch (error) {
      console.error('[CANVAS_ERROR] Container draw operation failed:', error);

      // Attempt to restore context even if drawing failed
      try {
        if (ctx) ctx.restore();
      } catch (restoreError) {
        console.error('[CANVAS_ERROR] Failed to restore context:', restoreError);
      }

      // Set error state to prevent further rendering attempts
      canvasError = true;
      canvasReady = false;

      // Attempt to reset canvas after error
      setTimeout(() => {
        canvasError = false;
        canvasReady = false; // Force re-initialization
      }, 1000);
    }
  }
</script>

<div class="viz-container" data-display-id={id} style="width: {config.containerSize.width}px;">
  <canvas bind:this={canvas} on:contextmenu|preventDefault|stopPropagation={handleCanvasContextMenu}></canvas>

  {#if showEnvironmentIndicator && environmentDetails}
    <div
      class="environment-indicator {environmentDetails.mode}"
      class:development={environmentDetails.isDevelopment}
      class:production={environmentDetails.isProduction}
      title={indicatorTooltip}
      aria-label={indicatorTooltip}
      role="status"
      aria-live="polite"
    >
      <span class="indicator-dot"></span>
      <span class="indicator-text">
        {environmentDetails.isDevelopment ? 'DEV' : 'PROD'}
      </span>
    </div>
  {/if}
</div>

<style>
  .viz-container {
    position: relative;
    height: 100%;
    line-height: 0;
  }
  canvas {
    display: block;
    background-color: #111827;
    width: 100%;
  }

  /* 🌍 Environment Indicator Styles */
  .environment-indicator {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    pointer-events: auto;
    z-index: 10;
    transition: all 0.2s ease;
    opacity: 0.7;
    backdrop-filter: blur(4px);
  }

  .environment-indicator:hover {
    opacity: 1;
    transform: scale(1.05);
  }

  .indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  .indicator-text {
    color: #ffffff;
    font-family: 'JetBrains Mono', 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    white-space: nowrap;
  }

  /* Development mode styling - warning orange to indicate non-production */
  .environment-indicator.development {
    background: rgba(251, 146, 60, 0.15);
    border: 1px solid rgba(251, 146, 60, 0.3);
    color: #fb923c;
  }

  .environment-indicator.development .indicator-dot {
    background-color: #fb923c;
    box-shadow: 0 0 4px rgba(251, 146, 60, 0.5);
  }

  .environment-indicator.development:hover {
    background: rgba(251, 146, 60, 0.25);
    border-color: rgba(251, 146, 60, 0.5);
  }

  /* Production mode styling - calm green/blue to indicate stable environment */
  .environment-indicator.production {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #22c55e;
  }

  .environment-indicator.production .indicator-dot {
    background-color: #22c55e;
    box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
  }

  .environment-indicator.production:hover {
    background: rgba(34, 197, 94, 0.25);
    border-color: rgba(34, 197, 94, 0.5);
  }

  /* Pulse animation for the indicator dot */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.2);
    }
  }

  /* Responsive adjustments for smaller displays */
  @media (max-width: 300px) {
    .environment-indicator {
      top: 4px;
      right: 4px;
      padding: 3px 4px;
      font-size: 9px;
    }

    .indicator-dot {
      width: 5px;
      height: 5px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .environment-indicator {
      opacity: 0.9;
      border-width: 2px;
    }

    .environment-indicator:hover {
      opacity: 1;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .environment-indicator {
      transition: none;
    }

    .indicator-dot {
      animation: none;
    }
  }
</style>
