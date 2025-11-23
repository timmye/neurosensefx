<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { displayStore, displayActions, displays, activeDisplay } from '../stores/displayStore.js';
  import { subscribe, unsubscribe, wsStatus } from '../data/wsClient.js';
  import { scaleLinear } from 'd3-scale';
  import { writable } from 'svelte/store';
  import { markerStore } from '../stores/markerStore.js';
  import { canvasDriftMonitor } from '../lib/diagnostics/canvasDriftMonitor.js'; // 🔧 DEBUGGER: Import drift monitor
  import { CoordinateSystemDebugger } from '../lib/diagnostics/coordinateSystemDebugger.js'; // 🔧 DEBUGGER: Import coordinate system debugger
      
  // Import drawing functions
  import { drawMarketProfile } from '../lib/viz/marketProfile.js';
  import { drawDayRangeMeter } from '../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawVolatilityMetric } from '../lib/viz/volatilityMetric.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  
  // Debug: Verify imports are working
  console.log('[FloatingDisplay] Imports loaded:', {
    drawVolatilityOrb: typeof drawVolatilityOrb,
    drawDayRangeMeter: typeof drawDayRangeMeter,
    drawMarketProfile: typeof drawMarketProfile
  });

  // ✅ INTERACT.JS: Import interact.js for drag and resize
  import interact from 'interactjs';
  
  // ✅ GRID SNAPPING: Import workspace grid utility
  import { workspaceGrid } from '../utils/workspaceGrid.js';
  
  // 🔧 ZOOM AWARENESS: Import zoom detection utilities
  import { createZoomDetector } from '../utils/canvasSizing.js';
  
  // Component props
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };
  
  // Local state
  let element;
  let canvas;
  let ctx;

  // Canvas state tracking
  let canvasReady = false;
  let canvasError = false;
  let canvasRetries = 0;
  const MAX_CANVAS_RETRIES = 3;

  // Marker state
  let markers = [];
  
  // Declare variables to avoid ReferenceError
  let displayPosition = position;

    let config = {};
  let state = {};
  let isActive = false;
  let zIndex = 1;
  let displaySize = { width: 220, height: 120 }; // ✅ HEADERLESS: Correct display size (no header)
  
  // Local state for interact.js instance
  let interactable = null;
  
  // ✅ UNIFIED STORE: Simple store binding - no reactive conflicts
  $: display = $displays?.get(id);
  $: {
    displayPosition = display?.position || position;
    config = display?.config || {};
    state = display?.state || {}; // ✅ FIXED: Get state from unified displayStore
    isActive = display?.isActive || false;
    zIndex = display?.zIndex || 1;
    displaySize = display?.size || { width: 220, height: 120 }; // ✅ HEADERLESS: Correct fallback size
    
    }
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }

    
  // 🔧 CONTAINER-STYLE: Use contentArea approach like Container.svelte (headerless design)
  let canvasWidth = 220;  // Default container width (no header)
  let canvasHeight = 120; // Default container height (no header)
  let dpr = 1;

  // 🔧 CONTAINER-STYLE: contentArea calculations like Container.svelte (headerless design)
  let contentArea = { width: 220, height: 120 }; // Full content area (220×120 container - no header)
  
  // yScale calculation using contentArea height, centered on daily open price for ADR alignment
  $: yScale = state?.visualLow && state?.visualHigh && contentArea
    ? (() => {
        // 🔧 CRITICAL FIX: Ensure ADR 0 (daily open) aligns with canvas 50% height
        // Center the visual range around the daily open price to guarantee ADR 0 = canvas center
        const dailyOpen = state.midPrice; // This is ADR 0
        const currentRange = state.visualHigh - state.visualLow;
        const halfRange = currentRange / 2;

        // Force the visual range to be centered on daily open
        const centeredVisualLow = dailyOpen - halfRange;
        const centeredVisualHigh = dailyOpen + halfRange;

        console.log('[ADR_ALIGNMENT_FIX] Centering visual range around daily open:', {
          dailyOpen,
          originalRange: [state.visualLow, state.visualHigh],
          centeredRange: [centeredVisualLow, centeredVisualHigh],
          canvasCenterY: contentArea.height / 2
        });

        return scaleLinear().domain([centeredVisualLow, centeredVisualHigh]).range([contentArea.height, 0]);
      })()
    : null;
  
    
  // Container-level event handlers (always work regardless of canvas state)
  function handleContainerClose() {
    displayActions.removeDisplay(id);
  }

  function handleContainerRefresh() {
    if (canvasError) {
      // Retry canvas initialization
      canvasRetries = 0;
      canvasError = false;
      canvasReady = false;
      ctx = null;
      // Trigger re-initialization on next tick
      tick().then(() => {
        if (canvas && state?.ready) {
          initializeCanvas();
        }
      });
    } else {
      // Normal refresh behavior
      const refreshDisplay = $displays.get(id);
      if (refreshDisplay) {
        import('../data/wsClient.js').then(({ subscribe }) => {
          subscribe(refreshDisplay.symbol);
        });
      }
    }
  }

  // 🎨 CANVAS CONTEXT MENU: Direct handler for canvas right-click (the fix!)
  function handleCanvasContextMenu(event) {
    console.log('🎨 [FLOATING_DISPLAY] Canvas context menu triggered');

    // Create canvas context
    const context = {
      type: 'canvas',
      targetId: id,
      targetType: 'display',
      displayId: id,
      symbol: symbol || 'unknown'
    };

    // Show canvas context menu
    displayActions.showContextMenu(event.clientX, event.clientY, id, 'display', context);
  }

  // Legacy canvas-specific handlers (for canvas-click detection)
  function handleClose() {
    handleContainerClose();
  }

  function handleRefresh() {
    handleContainerRefresh();
  }

  // 🔧 DEBUGGER: Test ADR alignment
  function testAdrAlignment() {
    if (window.coordinateDebugger) {
      window.coordinateDebugger.checkAdrAlignment(id);
      console.log(`[DEBUGGER:FLOATING_DISPLAY:${id}] ADR alignment test initiated`);
    }
  }

  // 🔧 DEBUGGER: Test mouse interaction
  function testMouseInteraction() {
    if (window.coordinateDebugger) {
      window.coordinateDebugger.testMouseInteraction(id);
      console.log(`[DEBUGGER:FLOATING_DISPLAY:${id}] Mouse interaction test initiated`);
    }
  }
  
  
    
    
  // ✅ GRID SNAPPING: Enhanced interact.js setup with grid integration
  onMount(async () => {

    // Wait for canvas to be available
    await tick();

    // 🔧 DEBUGGER: Register this floating display with drift monitor
    if (element) {
      canvasDriftMonitor.registerElement(id, element, 'floating');
    }

    // 🔧 DEBUGGER: Activate coordinate system debugging
    if (element && canvas) {
      const debugHelper = window.coordinateDebugger.activateElement(id, element, canvas);
      console.log(`[DEBUGGER:FLOATING_DISPLAY:${id}] Coordinate system debugging activated`);
    }

    // ✅ GRID ENHANCED: Setup interact.js with grid snapping
    if (element) {
      // Create interactable instance
      interactable = interact(element);
      
      // 🔧 CRITICAL FIX: Disable inertia to prevent post-drag CSS transform animations
      // Previous inertia: true caused canvas to continue moving after drag end
      interactable
        .draggable({
          inertia: false, // FIXED: Prevents easing animations after drag
          modifiers: workspaceGrid.getInteractModifiers(),
          onstart: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of drag start
            workspaceGrid.setDraggingState(true);

            // 🔧 DEBUGGER: Track drag start
            trackPositionChange('dragStart', displayPosition, displaySize, 'interact.js drag start');
          },
          onmove: (event) => {
            // ✅ GRID SNAPPING: event.rect already includes snapped coordinates
            const newPosition = {
              x: event.rect.left,
              y: event.rect.top
            };

            displayActions.moveDisplay(id, newPosition);

            // 🔧 DEBUGGER: Track drag movement
            trackPositionChange('dragMove', newPosition, displaySize, 'interact.js drag move');
          },
          onend: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of drag end
            workspaceGrid.setDraggingState(false);

            // 🔧 DEBUGGER: Track drag end
            trackPositionChange('dragEnd', displayPosition, displaySize, 'interact.js drag end');
          }
        })
        .resizable({
          edges: { left: true, right: true, bottom: true, top: true },
          margin: 6, // 6px tolerance zone for all resize edges (consistent middle ground)
          modifiers: [
            interact.modifiers.restrictSize({
              min: { width: 220, height: 120 }
            }),
            // ✅ GRID SNAPPING: Add grid snapping for resize
            ...(workspaceGrid.enabled ? [interact.modifiers.snap({
              targets: workspaceGrid.getInteractSnappers(),
              relativePoints: [{ x: 0, y: 0 }],
              range: workspaceGrid.snapThreshold
            })] : [])
          ],
          onstart: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of resize start
            workspaceGrid.setDraggingState(true);

            // 🔧 DEBUGGER: Track resize start
            trackPositionChange('resizeStart', displayPosition, displaySize, 'interact.js resize start');
          },
          onmove: (event) => {
            // ✅ GRID SNAPPING: Update element style for visual feedback
            element.style.width = event.rect.width + 'px';
            element.style.height = event.rect.height + 'px';

            const newPosition = {
              x: event.rect.left,
              y: event.rect.top
            };
            const newSize = {
              width: event.rect.width,
              height: event.rect.height
            };

            displayActions.moveDisplay(id, newPosition);
            displayActions.resizeDisplay(id, event.rect.width, event.rect.height);

            // 🔧 DEBUGGER: Track resize movement
            trackPositionChange('resizeMove', newPosition, newSize, 'interact.js resize move');
          },
          onend: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of resize end
            workspaceGrid.setDraggingState(false);

            // 🔧 DEBUGGER: Track resize end
            trackPositionChange('resizeEnd', displayPosition, displaySize, 'interact.js resize end');
          }
        });
      
      // Register interactable with workspace grid for dynamic updates
      workspaceGrid.registerInteractInstance(interactable);

      // 🔧 DEBUGGER: Connect interact.js instance to coordinate debugger
      if (window.coordinateDebugger) {
        const elementData = window.coordinateDebugger.elementData?.get(id);
        if (elementData) {
          elementData.setInteractInstance(interactable);
          console.log(`[DEBUGGER:FLOATING_DISPLAY:${id}] Interact.js instance connected to debugger`);
        }
      }

      // Click to activate
      interactable.on('tap', (event) => {
        displayActions.setActiveDisplay(id);
      });

      }

    return () => {

      // ✅ CLEANUP: Enhanced cleanup with grid unregistration
      if (interactable) {
        workspaceGrid.unregisterInteractInstance(interactable);
        interactable.unset();
        interactable = null;
      }
    };
  });
  
  // 🔧 CONTAINER-STYLE: Update canvas with pixel-perfect dimensions (headerless design)
  $: if (canvas && ctx && config) {
    // Calculate new contentArea from config (full container, no header)
    const containerSize = config.containerSize || { width: 220, height: 120 };
    const newContentArea = {
      width: containerSize.width,  // ✅ HEADERLESS: Full container width
      height: containerSize.height // ✅ HEADERLESS: Full container height
    };

    // Only update if significant change
    if (Math.abs(contentArea.width - newContentArea.width) > 5 ||
        Math.abs(contentArea.height - newContentArea.height) > 5) {

      // Update contentArea for reactive use
      contentArea = newContentArea;

      // 🔧 PIXEL-PERFIX: Use integer canvas dimensions for crisp rendering
      const integerCanvasWidth = Math.round(contentArea.width * dpr);
      const integerCanvasHeight = Math.round(contentArea.height * dpr);

      // Calculate corresponding CSS dimensions
      const cssWidth = integerCanvasWidth / dpr;
      const cssHeight = integerCanvasHeight / dpr;

      // Apply pixel-perfect dimensions
      canvas.width = integerCanvasWidth;
      canvas.height = integerCanvasHeight;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';

      // 🔧 FIX: Remove DPR scaling here - Container.svelte handles it per render frame
      // ctx.scale(dpr, dpr); // REMOVED - Prevents double scaling with Container.svelte
      // ctx.translate(0.5, 0.5); // REMOVED - Individual visualizations handle their own sub-pixel alignment
      ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for crisp lines

      canvasWidth = contentArea.width;
      canvasHeight = contentArea.height;

          }
  }
  
  // Canvas initialization function with retry logic
  function initializeCanvas() {
    if (!canvas) {
      console.error('[FLOATING_DISPLAY] Canvas element not available');
      return;
    }

    canvasRetries++;

    try {
      ctx = canvas.getContext('2d');
      if (ctx) {
        canvasReady = true;
        canvasError = false;
        canvasRetries = 0;

        dpr = window.devicePixelRatio || 1;

        // 🔧 ZOOM AWARENESS: Initialize zoom detector
        const cleanupZoomDetector = createZoomDetector((newDpr) => {
          dpr = newDpr;

          // Recalculate canvas dimensions with new DPR
          if (contentArea) {
            const integerCanvasWidth = Math.round(contentArea.width * dpr);
            const integerCanvasHeight = Math.round(contentArea.height * dpr);
            const cssWidth = integerCanvasWidth / dpr;
            const cssHeight = integerCanvasHeight / dpr;

            // Apply new pixel-perfect dimensions
            canvas.width = integerCanvasWidth;
            canvas.height = integerCanvasHeight;
            canvas.style.width = cssWidth + 'px';
            canvas.style.height = cssHeight + 'px';

            // Reconfigure canvas context for new DPR
            // 🔧 FIX: Remove DPR scaling here - Container.svelte handles it per render frame
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            // ctx.scale(dpr, dpr); // REMOVED - Prevents double scaling with Container.svelte
            // ctx.translate(0.5, 0.5); // REMOVED - Individual visualizations handle their own transforms
            ctx.imageSmoothingEnabled = false;
          }
        });

        // Store cleanup function for onDestroy - will be handled in the main onDestroy block
        // Note: Zoom detector cleanup moved to main onDestroy for proper lifecycle management

        // 🔧 CONTAINER-STYLE: Calculate contentArea from config (headerless design)
        const containerSize = config.containerSize || { width: 220, height: 120 };
        const newContentArea = {
          width: containerSize.width,  // ✅ HEADERLESS: Full container width
          height: containerSize.height // ✅ HEADERLESS: Full container height
        };

        // Update contentArea for reactive use
        contentArea = newContentArea;

        // 🔧 PIXEL-PERFECT: Use integer canvas dimensions for crisp rendering
        const integerCanvasWidth = Math.round(contentArea.width * dpr);
        const integerCanvasHeight = Math.round(contentArea.height * dpr);

        // Calculate corresponding CSS dimensions
        const cssWidth = integerCanvasWidth / dpr;
        const cssHeight = integerCanvasHeight / dpr;

        // Apply pixel-perfect dimensions
        canvas.width = integerCanvasWidth;
        canvas.height = integerCanvasHeight;
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';

        // 🔧 FIX: Remove DPR scaling here - Container.svelte handles it per render frame
        // ctx.scale(dpr, dpr); // REMOVED - Prevents double scaling with Container.svelte
        // ctx.translate(0.5, 0.5); // REMOVED - Individual visualizations handle their own sub-pixel alignment
        ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for crisp lines

        canvasWidth = contentArea.width;
        canvasHeight = contentArea.height;

        console.log(`[FLOATING_DISPLAY] Canvas initialized successfully`);
      } else {
        throw new Error('Failed to get 2D context');
      }
    } catch (error) {
      canvasReady = false;
      canvasError = true;
      ctx = null;
      console.error(`[FLOATING_DISPLAY] Canvas initialization failed (attempt ${canvasRetries}/${MAX_CANVAS_RETRIES}):`, error);

      if (canvasRetries >= MAX_CANVAS_RETRIES) {
        console.error(`[FLOATING_DISPLAY] Maximum canvas initialization retries exceeded`);
      }
    }
  }

  // 🔧 CONTAINER-STYLE: Initialize canvas with pixel-perfect dimensions
  $: if (state?.ready && canvas && !ctx && !canvasReady && !canvasError) {
    initializeCanvas();
  }
  
  // 🔧 CLEAN FOUNDATION: Create rendering context for visualization functions
  let renderingContext = null;

  // ✅ ULTRA-MINIMAL: Simple rendering - no complex dependencies
  let renderFrame;
  let pendingRender = false; // 🔧 CRITICAL FIX: Prevent concurrent render frames

  // 🔧 CRITICAL FIX: Render deduplication to prevent race conditions
  function scheduleRender() {
    if (!pendingRender) {
      pendingRender = true;
      renderFrame = requestAnimationFrame(() => {
        pendingRender = false;
        renderFrame = null;
        render();
      });
    }
  }

  // 🔧 DEBUGGER: FloatingDisplay position and interaction tracking
  let interactionHistory = [];
  let lastPositionState = null;
  let resizeHistory = [];
  let renderCount = 0;

    // Function to render symbol as canvas background (drawn before other visualizations)
  function renderSymbolBackground() {
    if (!ctx || !contentArea) return;

    // Save context state
    ctx.save();

    // Draw symbol background (top-left, behind other visualizations)
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = 'rgba(209, 213, 219, 0.15)'; // Very subtle - will be in background
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const symbolText = symbol || '';
    ctx.fillText(symbolText, 8, 8);

    // Restore context state
    ctx.restore();
  }

  // 🔧 DEBUGGER: Track position changes and interactions
  function trackPositionChange(eventType, newPosition, newSize, cause = 'unknown') {
    const timestamp = performance.now();
    const currentState = {
      timestamp,
      eventType,
      displayId: id,
      symbol,
      position: newPosition || displayPosition,
      size: newSize || displaySize,
      cause,
      elementRect: element ? element.getBoundingClientRect() : null,
      canvasRect: canvas ? canvas.getBoundingClientRect() : null,
      windowSize: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      dpr: window.devicePixelRatio || 1
    };

    // Detect position changes
    if (lastPositionState) {
      const positionDelta = {
        xDelta: currentState.position.x - lastPositionState.position.x,
        yDelta: currentState.position.y - lastPositionState.position.y,
        widthDelta: currentState.size.width - lastPositionState.size.width,
        heightDelta: currentState.size.height - lastPositionState.size.height,
        timeDelta: timestamp - lastPositionState.timestamp,
        dprDelta: currentState.dpr - lastPositionState.dpr
      };

      // 🔧 FIXED: Log only significant position changes (>1px or timing >200ms)
      // Previous thresholds (0.1px, 50ms) were too sensitive and caused false positives
      if (Math.abs(positionDelta.xDelta) > 1.0 ||
          Math.abs(positionDelta.yDelta) > 1.0 ||
          Math.abs(positionDelta.widthDelta) > 1.0 ||
          Math.abs(positionDelta.heightDelta) > 1.0 ||
          Math.abs(positionDelta.timeDelta) > 200) {

        console.warn('[DEBUGGER:DRIFT:FloatingDisplay] Position change detected:', {
          ...currentState,
          positionDelta,
          previousState: lastPositionState,
          interactionCause: cause
        });

        interactionHistory.push({
          ...currentState,
          positionDelta
        });

        // Keep only last 20 interaction events
        if (interactionHistory.length > 20) {
          interactionHistory.shift();
        }
      }
    }

    lastPositionState = currentState;
  }



  function render() {
    if (!ctx || !state || !config || !canvas) {
      return;
    }

    const startTime = performance.now();
    renderCount++;

    // 🔧 DEBUGGER: Canvas state monitoring for FloatingDisplay
    const canvasRect = canvas.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const currentDpr = window.devicePixelRatio || 1;

    // 🔧 DEBUGGER: Track render position drift
    if (renderCount % 60 === 0) { // Log every 60 frames
      console.log('[DEBUGGER:FloatingDisplay:render] Render monitoring:', {
        displayId: id,
        symbol,
        frameCount: renderCount,
        canvasRect: {
          left: canvasRect.left,
          top: canvasRect.top,
          width: canvasRect.width,
          height: canvasRect.height
        },
        elementRect: {
          left: elementRect.left,
          top: elementRect.top,
          width: elementRect.width,
          height: elementRect.height
        },
        displayPosition,
        displaySize,
        dpr: currentDpr,
        interactionHistoryCount: interactionHistory.length
      });
    }

    // 🔧 CLEAN FOUNDATION: Create rendering context (headerless design)
    const containerSize = config.containerSize || { width: canvasWidth, height: canvasHeight };
    const contentArea = {
      width: containerSize.width,  // ✅ HEADERLESS: Full container width
      height: containerSize.height // ✅ HEADERLESS: Full container height
    };
    const adrAxisX = contentArea.width * config.adrAxisPosition;

    renderingContext = {
      containerSize,
      contentArea,
      adrAxisX,
      // Derived values for backward compatibility
      visualizationsContentWidth: contentArea.width,
      meterHeight: contentArea.height,
      adrAxisXPosition: adrAxisX
    };

    // 🔧 DEBUGGER: Canvas clearing monitoring
    const clearStart = performance.now();
    ctx.clearRect(0, 0, contentArea.width, contentArea.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, contentArea.width, contentArea.height);
    const clearTime = performance.now() - clearStart;

    // Track position changes during render
    trackPositionChange('render', displayPosition, displaySize, `render frame ${renderCount}`);

    // Draw symbol background first (behind all other visualizations)
    renderSymbolBackground();

    // 🔧 DEBUGGER: Visualization timing
    const vizTimers = new Map();

    // Draw visualizations
    if (state.visualLow && state.visualHigh && yScale) {
      try {
        // Draw Volatility Orb (Background Layer - MUST be first)
        let vizStart = performance.now();
        drawVolatilityOrb(ctx, renderingContext, config, state, yScale);
        vizTimers.set('volatilityOrb', performance.now() - vizStart);

        vizStart = performance.now();
        drawMarketProfile(ctx, renderingContext, config, state, yScale);
        vizTimers.set('marketProfile', performance.now() - vizStart);

        vizStart = performance.now();
        drawDayRangeMeter(ctx, renderingContext, config, state, yScale);
        vizTimers.set('dayRangeMeter', performance.now() - vizStart);

        vizStart = performance.now();
        drawPriceFloat(ctx, renderingContext, config, state, yScale);
        vizTimers.set('priceFloat', performance.now() - vizStart);

        vizStart = performance.now();
        drawPriceDisplay(ctx, renderingContext, config, state, yScale);
        vizTimers.set('priceDisplay', performance.now() - vizStart);

        vizStart = performance.now();
        drawVolatilityMetric(ctx, renderingContext, config, state);
        vizTimers.set('volatilityMetric', performance.now() - vizStart);

        vizStart = performance.now();
        drawPriceMarkers(ctx, renderingContext, config, state, yScale, markers);
        vizTimers.set('priceMarkers', performance.now() - vizStart);
              } catch (error) {
        console.error(`[RENDER] Error in visualization functions:`, error);
      }
    }

    // 🔧 DEBUGGER: Performance monitoring
    const totalTime = performance.now() - startTime;
    if (totalTime > 16.67 || renderCount % 300 === 0) { // Log slow renders or every 300 frames
      console.log('[DEBUGGER:PERF:FloatingDisplay:render] Performance stats:', {
        displayId: id,
        symbol,
        frameCount: renderCount,
        totalTime,
        clearTime,
        vizTimers: Object.fromEntries(vizTimers),
        contentArea,
        currentDpr
      });
    }
      }
  
  // ✅ ULTRA-MINIMAL: Simple render trigger with deduplication
  $: if (state && config && yScale) {
    scheduleRender();
  }
  
  // 🔧 ARCHITECTURAL FIX: Consolidated cleanup with proper resource management
  onDestroy(() => {
    // 🔧 DEBUGGER: Unregister from drift monitor
    canvasDriftMonitor.unregisterElement(id);

    // 🔧 DEBUGGER: Deactivate coordinate system debugging
    if (window.coordinateDebugger) {
      window.coordinateDebugger.deactivateElement(id);
      console.log(`[DEBUGGER:FLOATING_DISPLAY:${id}] Coordinate system debugging deactivated`);
    }

    // Cleanup render frame and deduplication state
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
      renderFrame = null;
    }
    pendingRender = false; // 🔧 CRITICAL FIX: Reset deduplication flag

    // Cleanup zoom detector (memory leak fix)
    if (cleanupZoomDetector) {
      cleanupZoomDetector();
      cleanupZoomDetector = null;
    }

    // Cleanup interact.js instance
    if (interactable) {
      interactable.unset();
      interactable = null;
    }

    // Cleanup canvas context
    if (ctx) {
      ctx = null;
    }

    // Reset canvas ready state
    canvasReady = false;
    canvasError = false;
  });
</script>

<div
  bind:this={element}
  class="enhanced-floating headerless"
  class:active={isActive}
  style="left: {displayPosition.x}px; top: {displayPosition.y}px; width: {displaySize.width}px; height: {displaySize.height}px; z-index: {zIndex};"
  data-display-id={id}
>
  <!-- Container Header - appears on hover -->
  <div class="container-header" class:error={canvasError}>
    <div class="symbol-info">
      {#if canvasError}
        <span class="error-symbol">⚠️ Failed to load {symbol}</span>
      {:else}
        <span class="symbol-name">{symbol}</span>
      {/if}
    </div>
    <div class="header-controls">
      <!-- 🔧 DEBUGGER: Debug buttons -->
      <button
        class="header-btn debug-btn"
        on:click={testAdrAlignment}
        title="Test ADR alignment"
        aria-label="Test ADR alignment"
      >
        ADR
      </button>
      <button
        class="header-btn debug-btn"
        on:click={testMouseInteraction}
        title="Test mouse interaction"
        aria-label="Test mouse interaction"
      >
        🖱️
      </button>
      <button
        class="header-btn refresh-btn"
        class:error={canvasError}
        on:click={handleContainerRefresh}
        title={canvasError ? "Retry canvas initialization" : "Refresh data"}
        aria-label={canvasError ? "Retry canvas initialization" : "Refresh data"}
      >
        {#if canvasError}
          ⚠️
        {:else}
          ↻
        {/if}
      </button>
      <button
        class="header-btn close-btn"
        on:click={handleContainerClose}
        title="Close display"
        aria-label="Close display"
      >
        ×
      </button>
    </div>
  </div>

  <!-- Canvas fills entire container area (headerless design) -->
  {#if state?.ready && !canvasError}
    <canvas
      bind:this={canvas}
      class="full-canvas"
      on:contextmenu|preventDefault|stopPropagation={handleCanvasContextMenu}
    ></canvas>
    {:else}
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Initializing {symbol}...</p>
    </div>
  {/if}
</div>

<style>
  /* ✅ ULTRA-MINIMAL: Headerless design CSS - maximize trading data display */
  .enhanced-floating {
    position: fixed;
    background: #111827; /* Dark background for better contrast */
    border: 2px solid #374151;
    border-radius: 6px; /* Slightly smaller radius for headerless design */
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    overflow: hidden; /* Prevent canvas overflow */
  }

  .enhanced-floating:hover {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .enhanced-floating.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .enhanced-floating:active {
    cursor: grabbing;
  }

  /* Full canvas fills entire container area (headerless design) */
  .full-canvas {
    display: block;
    width: 100%;
    height: 100%;
    /* cursor removed - let interact.js control resize cursors */
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    gap: 8px;
    background: #111827;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #374151;
    border-top: 2px solid #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Active state visual feedback (border glow instead of header dot) */
  .enhanced-floating.active::before {
    content: '';
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border-radius: 6px;
    background: linear-gradient(45deg, #4f46e5, #8b5cf6);
    opacity: 0.3;
    z-index: -1;
    animation: activeGlow 2s ease-in-out infinite alternate;
  }

  @keyframes activeGlow {
    0% { opacity: 0.2; }
    100% { opacity: 0.4; }
  }

  /* Container Header - visible by default, no transform animations */
  .container-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 28px;
    background: rgba(17, 24, 39, 0.95);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #374151;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 8px;
    /* 🔧 CRITICAL FIX: Removed ALL transform animations that caused canvas positioning issues */
    /* No more transform: translateY(-100%) or hover transitions - was causing canvas to render below container top */
    z-index: 100; /* Reduced to prevent resize interference, still above canvas */
    border-radius: 6px 6px 0 0;
  }

  .container-header.error {
    background: rgba(127, 29, 29, 0.95);
    border-bottom-color: #dc2626;
  }

  .symbol-info {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: #d1d5db;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .error-symbol {
    color: #fbbf24;
  }

  .header-controls {
    display: flex;
    gap: 4px;
  }

  .header-btn {
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    /* 🔧 CRITICAL FIX: Removed 'all' transition that affected positioning */
    /* transition: all 0.15s ease; REMOVED - was causing canvas drift */
    /* Keep only non-positioning transitions */
    transition: background-color 0.15s ease, color 0.15s ease;
    background: rgba(37, 99, 235, 0.9);
    color: white;
  }

  .header-btn:hover {
    /* 🔧 CRITICAL FIX: Removed transform scale that interfered with interact.js mouse events */
    /* transform: scale(1.1); REMOVED - was causing mouse interaction misalignment after drag */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    background: rgba(59, 130, 246, 0.9); /* Alternative hover feedback without transform */
  }

  .close-btn {
    background: rgba(239, 68, 68, 0.9);
  }

  .refresh-btn.error {
    background: rgba(251, 146, 60, 0.9);
    color: white;
  }

  .debug-btn {
    background: rgba(139, 92, 246, 0.9); /* Purple for debug buttons */
    color: white;
    font-size: 10px;
    padding: 2px 4px;
  }

  /* Ensure container maintains rounded corners when header is visible */
  .enhanced-floating:hover {
    border-radius: 6px;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .enhanced-floating.active::before {
      animation: none;
    }

    .container-header {
      transition: none;
    }

    .header-btn {
      transition: none;
    }

    .header-btn:hover {
      /* No transform to remove - already removed from main hover state */
      background: rgba(59, 130, 246, 0.9); /* Consistent hover feedback */
    }
  }
</style>
