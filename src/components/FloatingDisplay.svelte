<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { displayStore, displayActions, displays, activeDisplay } from '../stores/displayStore.js';
  import { subscribe, unsubscribe, wsStatus } from '../data/wsClient.js';
  import { scaleLinear } from 'd3-scale';
  import { writable } from 'svelte/store';
  import { markerStore } from '../stores/markerStore.js';
  import { displayContextEnhancer } from '../utils/visualizationLoggingUtils.js';
        
  // Import drawing functions
  import { drawMarketProfile } from '../lib/viz/marketProfile.js';
  import { drawDayRangeMeter } from '../lib/viz/dayRangeMeter.js';
  import { drawPriceFloat } from '../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawVolatilityMetric } from '../lib/viz/volatilityMetric.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  
  
  // ✅ INTERACT.JS: Import interact.js for drag and resize
  import interact from 'interactjs';
  
  // ✅ GRID SNAPPING: Import workspace grid utility
  import { workspaceGrid } from '../utils/workspaceGrid.js';

  // 🔧 ZOOM AWARENESS: Import zoom detection utilities
  import { createZoomDetector, getCanvasDimensions } from '../utils/canvasSizing.js';

  // ✅ CSS CLIP-PATH BOUNDS: Import coordinate store for reactive bounds
  import { currentBounds, coordinateActions } from '../stores/coordinateStore.js';

  // ✅ MATHEMATICAL PRECISION VALIDATION: Import exact validation system
  import {
    getPrecisionValidator,
    removePrecisionValidator,
    validateCanvasContainerMatch,
    validateVisualizationBounds,
    validateCoordinateTransformation,
    validateDayRangeMeterPrecision
  } from '../utils/canvasPrecisionValidator.js';

  // ✅ BROWSER EVIDENCE COLLECTION: Import real browser measurements
  import {
    getEvidenceCollector,
    removeEvidenceCollector,
    collectBrowserEvidence,
    collectCoordinateEvidence
  } from '../utils/browserEvidenceCollector.js';

  // ✅ ENHANCED DISPLAY CREATION LOGGING: Import comprehensive logging system
  import {
    getDisplayCreationLogger,
    removeDisplayCreationLogger,
    logContainerResize,
    logContainerMovement,
    logWebSocketToRenderLatency,
    logRenderScheduling,
    logVisualizationPerformance
  } from '../utils/displayCreationLogger.js';

  // ✅ COORDINATE VALIDATION: Import centralized YScale validation system
  import { CoordinateValidator } from '../utils/coordinateValidator.js';

  // 🚨 PERFORMANCE API FALLBACK: HMR-safe robust performance.now() with functional validation
  // Cache fallback state to avoid repeated corruption detection
  let useDateFallback = false;
  let lastCorruptionCheck = 0;
  const CORRUPTION_CHECK_INTERVAL = 1000; // Check every 1 second max

  function getPerformanceTime() {
    // HMR-RACE-CONDITION-SAFE: Ultra-robust performance timing with HMR corruption detection
    // This function is hardened against Hot Module Replacement race conditions that can
    // corrupt the performance API where typeof checks pass but actual calls fail
    try {
      // If we've recently detected corruption, use Date.now() to avoid repeated failures
      const now = Date.now();
      if (useDateFallback && (now - lastCorruptionCheck) < CORRUPTION_CHECK_INTERVAL) {
        return now;
      }

      // Attempt to use performance.now() with comprehensive safety checks
      if (typeof performance !== 'undefined' &&
          performance &&
          typeof performance.now === 'function') {

        // CRITICAL: Try the actual call to detect HMR corruption
        // This is the key - typeof checks aren't enough during HMR races
        try {
          const perfResult = performance.now();

          // Validate the result is a finite number
          if (typeof perfResult === 'number' && isFinite(perfResult) && perfResult >= 0) {
            // Performance API working correctly, reset corruption flag
            useDateFallback = false;
            lastCorruptionCheck = now;
            return perfResult;
          } else {
            // Performance returned invalid result, assume corruption
            console.warn('[GET_PERFORMANCE_TIME] Performance API returned invalid result:', perfResult);
            useDateFallback = true;
            lastCorruptionCheck = now;
            return Date.now();
          }
        } catch (perfError) {
          // CRITICAL: This is where "performance.now is not a function" occurs
          // despite typeof checks passing - classic HMR corruption signature
          console.warn('[GET_PERFORMANCE_TIME] Performance API corrupted during call:', perfError.message);
          useDateFallback = true;
          lastCorruptionCheck = now;
          return Date.now();
        }
      }

      // Performance API not available, use Date.now() fallback
      useDateFallback = true;
      lastCorruptionCheck = now;
      return Date.now();

    } catch (criticalError) {
      // Ultimate safety net - any unexpected error uses Date.now()
      console.error('[GET_PERFORMANCE_TIME] Critical error, using Date.now() fallback:', criticalError.message);
      useDateFallback = true;
      lastCorruptionCheck = Date.now();
      return Date.now();
    }
  }

  // Component props
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };

  // 🔧 DEBUG: Log component mount immediately
  console.log(`[FLOATING_DISPLAY:${id}] Component mounting`, {
    symbol,
    position,
    timestamp: Date.now()
  });

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

  // Header visibility state for hover-based show/hide
  let headerVisible = false;
  let headerTimeout = null;

  // Declare variables to avoid ReferenceError
  let displayPosition = position;

    let config = {};
  let state = {};
  let isActive = false;
  let zIndex = 1;
  let displaySize = { width: 220, height: 120 }; // ✅ HEADERLESS: Correct display size (no header)
  
  // Local state for interact.js instance
  let interactable = null;

  // ✅ ENHANCED LOGGING: Track previous dimensions and position for logging
  let previousDimensions = { width: 220, height: 120 };
  let previousPosition = { x: 100, y: 100 };
  let dragStartTime = null;
  let resizeStartTime = null;
  let lastWebSocketTimestamp = null;

  
  // ✅ COORDINATE SYSTEM: Reactive coordinate system info for performance
  let coordinateSystemInfo = null;
  $: coordinateSystemInfo = coordinateActions.getSystemInfo();

  // ✅ SAFE COORDINATE UPDATES: Update coordinate store with bounded system info
  $: coordinateStoreUpdate: if (contentArea && state?.midPrice && coordinateActions) {

    // Update coordinate store with current bounds for reactive transformations
    try {
      coordinateActions.updatePriceRange({
        midPrice: state.midPrice,
        projectedAdrHigh: state.projectedAdrHigh,
        projectedAdrLow: state.projectedAdrLow,
        todaysHigh: state.todaysHigh,
        todaysLow: state.todaysLow
      });
    } catch (error) {
      console.warn('[FLOATING_DISPLAY] Failed to update coordinate store:', error);
      // Continue without coordinate store update - don't let this break rendering
    }
  }

  // ✅ MATHEMATICAL PRECISION VALIDATION: Initialize precision validator and evidence collector
  let precisionValidator;
  let evidenceCollector;
  let displayCreationLogger;
  let display; // Missing display variable declaration

  // ✅ UNIFIED STORE: Reactive display store binding
  $: display = $displays?.get(id);

  // Display properties reactive updates
  $: displayPosition = display?.position || position;
  $: config = display?.config || {};
  $: state = display?.state || {};
  $: isActive = display?.isActive || false;
  $: zIndex = display?.zIndex || 1;
  $: displaySize = display?.size || { width: 220, height: 120 };

  // ✅ PRECISION VALIDATION: Initialize validators when display and symbol are available
  $: if (id && symbol) {
    precisionValidator = getPrecisionValidator(id, symbol);
    evidenceCollector = getEvidenceCollector(id, symbol);
    displayCreationLogger = getDisplayCreationLogger(id, symbol);
  }

  // 🔧 DEBUG: Log state changes and store content
  $: {
    const previousState = state; // Track state changes for debugging
    if (state?.ready !== previousState?.ready) {
      console.log(`[FLOATING_DISPLAY:${id}] State ready changed: ${previousState?.ready} → ${state?.ready}`, {
        symbol,
        hasState: !!state,
        stateKeys: state ? Object.keys(state) : [],
        ready: state?.ready,
        canvasReady,
        canvasError
      });
    }

    console.log(`[FLOATING_DISPLAY:${id}] Store lookup`, {
      totalDisplays: $displays?.size || 0,
      displayIds: Array.from($displays?.keys() || []),
      foundDisplay: !!display,
      displayKeys: display ? Object.keys(display) : [],
      hasState: !!(display?.state)
    });
  }

  // ✅ ENHANCED LOGGING: Log position and size changes
  $: logPositionAndSizeChanges();
  
  // Update markers from store
  $: markerStoreSync: if ($markerStore !== undefined) {
    markers = $markerStore;
  }

    
  // 🔧 CONTAINER-STYLE: Use contentArea approach like Container.svelte (headerless design)
  let canvasWidth = 220;  // Default container width (no header)
  let canvasHeight = 120; // Default container height (no header)
  let dpr = 1;

  // 🔧 PHASE 1B FIX: Remove fixed 12px reduction to allow full container usage
  $: contentArea = {
    width: Math.max(50, displaySize?.width || 220), // Use full container width - no fixed reduction
    height: Math.max(50, displaySize?.height || 120) // Use full container height - no fixed reduction
  };
  
  // ✅ SAFE COORDINATE HELPER: Bounded YScale with adaptive bounds and clamping
  function createBoundedYScale(state, contentArea) {
    if (!state?.midPrice || !contentArea) return null;

    // Calculate adaptive safety margin based on market conditions
    const adrValue = (state.projectedAdrHigh || state.visualHigh) - (state.projectedAdrLow || state.visualLow);
    const currentRange = state.visualHigh - state.visualLow;
    const volatilityRatio = currentRange / Math.max(adrValue, 0.0001); // Avoid division by zero

    // Dynamic safety margin: 0.5 (50% ADR) adjusted for volatility
    const baseMargin = 0.5;
    const volatilityMultiplier = Math.min(2.0, 1 + volatilityRatio);
    const safetyMargin = baseMargin * volatilityMultiplier;

    // Calculate bounds centered on daily open (ADR 0) with adaptive safety margin
    const dailyOpen = state.midPrice;
    const lowerBound = dailyOpen - (adrValue * safetyMargin);
    const upperBound = dailyOpen + (adrValue * safetyMargin);

    // Ensure minimum range to prevent collapse
    const minRange = adrValue * 0.3; // At least 30% of ADR
    const finalLowerBound = Math.min(lowerBound, upperBound - minRange);
    const finalUpperBound = Math.max(upperBound, finalLowerBound + minRange);

    return scaleLinear()
      .domain([finalLowerBound, finalUpperBound])
      .range([contentArea.height, 0])
      .clamp(true); // CRITICAL: Prevent coordinate overflow
  }

  // yScale calculation using bounded coordinate system
  $: yScale = createBoundedYScale(state, contentArea);
  
    
  // Header visibility handlers for hover-based show/hide
  function showHeader() {
    if (headerTimeout) {
      clearTimeout(headerTimeout);
      headerTimeout = null;
    }
    headerVisible = true;
  }

  function hideHeader() {
    // Delay hiding to prevent flickering when moving between header and container
    headerTimeout = setTimeout(() => {
      headerVisible = false;
      headerTimeout = null;
    }, 300);
  }

  // Container-level event handlers (always work regardless of canvas state)
  function handleContainerClose() {
    displayActions.removeDisplay(id);
  }

  // ✅ ENHANCED LOGGING: Log position/size changes from display store updates
  function logPositionAndSizeChanges() {
    if (!displayCreationLogger) return;

    const currentPosition = displayPosition || { x: 100, y: 100 };
    const currentSize = displaySize || { width: 220, height: 120 };

    // Log position changes
    if (currentPosition.x !== previousPosition.x || currentPosition.y !== previousPosition.y) {
      try {
        const movementContext = {
          trigger: 'store_update',
          duration: 0,
          smooth: false
        };

        logContainerMovement(id, previousPosition, currentPosition, movementContext);
        previousPosition = { ...currentPosition };
      } catch (error) {
        console.warn('[FLOATING_DISPLAY] Failed to log position change:', error);
      }
    }

    // Log size changes
    if (currentSize.width !== previousDimensions.width || currentSize.height !== previousDimensions.height) {
      try {
        const resizeContext = {
          trigger: 'store_update',
          duration: 0,
          animated: false
        };

        logContainerResize(id, previousDimensions, currentSize, resizeContext);
        previousDimensions = { ...currentSize };
      } catch (error) {
        console.warn('[FLOATING_DISPLAY] Failed to log size change:', error);
      }
    }
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
  
  
    
    
  // ✅ GRID SNAPPING: Enhanced interact.js setup with grid integration
  onMount(async () => {
    // CRITICAL FIX: Detect duplicate component instances to prevent two canvases
    const existingInstances = document.querySelectorAll(`[data-display-id="${id}"]`);
    if (existingInstances.length > 1) {
      console.error(`[FLOATING_DISPLAY:${id}] CRITICAL: Duplicate component detected! Existing instances:`, existingInstances.length);
      // This is a duplicate instance - destroy it to prevent multiple canvases
      return;
    }

    // Wait for canvas to be available
    await tick();

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
            // ✅ ENHANCED LOGGING: Track drag start time
            dragStartTime = getPerformanceTime();
          },
          onmove: (event) => {
            // ✅ GRID SNAPPING: event.rect already includes snapped coordinates
            const newPosition = {
              x: event.rect.left,
              y: event.rect.top
            };

            // ✅ ENHANCED LOGGING: Log container movement event
            try {
              const movementContext = {
                trigger: 'user_drag',
                duration: dragStartTime ? getPerformanceTime() - dragStartTime : 0,
                smooth: false
              };

              logContainerMovement(id, previousPosition, newPosition, movementContext);
              previousPosition = newPosition;
            } catch (error) {
              // Silently handle logging errors to prevent breaking drag functionality
              console.warn('[FLOATING_DISPLAY] Failed to log movement event:', error);
            }

            displayActions.moveDisplay(id, newPosition);
          },
          onend: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of drag end
            workspaceGrid.setDraggingState(false);
            // ✅ ENHANCED LOGGING: Reset drag start time
            dragStartTime = null;
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
            // ✅ ENHANCED LOGGING: Track resize start time
            resizeStartTime = getPerformanceTime();
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

            // 🔧 CRITICAL FIX: Trigger immediate canvas resize update
            const containerSize = {
              width: event.rect.width,
              height: event.rect.height
            };

            // Config update is now handled by unified resizeDisplay function

            // ✅ ENHANCED LOGGING: Log container resize event
            try {
              const currentDimensions = { width: event.rect.width, height: event.rect.height };
              const resizeContext = {
                trigger: 'user_drag',
                duration: resizeStartTime ? getPerformanceTime() - resizeStartTime : 0,
                animated: false
              };

              logContainerResize(id, previousDimensions, currentDimensions, resizeContext);
              previousDimensions = currentDimensions;
            } catch (error) {
              // Silently handle logging errors to prevent breaking resize functionality
              console.warn('[FLOATING_DISPLAY] Failed to log resize event:', error);
            }

            displayActions.moveDisplay(id, newPosition);
            displayActions.resizeDisplay(id, event.rect.width, event.rect.height, { updateConfig: false });
          },
          onend: (event) => {
            // ✅ GRID FEEDBACK: Notify workspace grid of resize end
            workspaceGrid.setDraggingState(false);
            // ✅ ENHANCED LOGGING: Reset resize start time
            resizeStartTime = null;

            // ✅ CRITICAL FIX: Final config sync after resize completes
            const finalSize = {
              width: event.rect.width,
              height: event.rect.height
            };
            displayActions.resizeDisplay(id, finalSize.width, finalSize.height, {
              updateConfig: true // Re-enable for final sync
            });
          }
        });
      
      // Register interactable with workspace grid for dynamic updates
      workspaceGrid.registerInteractInstance(interactable);

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
  
  
  // ✅ ATOMIC RESIZE TRANSACTION: Comprehensive coordinate validation
  function validateYScaleConsistency(yScale, state, contentArea) {
    if (!yScale || !state || !contentArea) {
      return { isValid: false, reason: 'Missing required inputs for YScale validation' };
    }

    try {
      // Test critical coordinate transformations
      const testPrices = [
        state.midPrice,
        state.visualLow,
        state.visualHigh,
        state.midPrice * 0.99, // Small variation test
        state.midPrice * 1.01
      ].filter(price => price !== undefined && price !== null);

      const results = testPrices.map(price => {
        const y = yScale(price);
        return {
          price,
          y,
          isValid: typeof y === 'number' && !isNaN(y) && isFinite(y),
          inBounds: y >= -50 && y <= contentArea.height + 50 // 50px tolerance
        };
      });

      const allValid = results.every(r => r.isValid);
      const allInBounds = results.every(r => r.inBounds);

      return {
        isValid: allValid && allInBounds,
        testCount: testPrices.length,
        validResults: results.filter(r => r.isValid).length,
        inBoundsResults: results.filter(r => r.inBounds).length,
        sampleResults: results.slice(0, 3) // Include first 3 results for debugging
      };
    } catch (error) {
      return {
        isValid: false,
        reason: error.message,
        error: true
      };
    }
  }

  // ✅ ATOMIC RESIZE TRANSACTION: Verify coordinate system synchronization
  function areCoordinatesSynchronized() {
    // Validate canvas dimensions match contentArea
    const canvasMatchesContentArea = canvas &&
      canvas.width === Math.round(contentArea.width * dpr) &&
      canvas.height === Math.round(contentArea.height * dpr);

    // Validate YScale exists and is functional
    const yScaleValid = yScale && typeof yScale === 'function';

    // Use reactive coordinate system info for optimal performance
    // Validate coordinate store bounds match contentArea
    const coordinateStoreValid = coordinateSystemInfo &&
      coordinateSystemInfo.bounds &&
      coordinateSystemInfo.bounds.y &&
      coordinateSystemInfo.bounds.y[1] === contentArea.height;

    return {
      synchronized: canvasMatchesContentArea && yScaleValid && coordinateStoreValid,
      canvasMatchesContentArea,
      yScaleValid,
      coordinateStoreValid,
      details: {
        canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
        expectedCanvasSize: {
          width: Math.round(contentArea.width * dpr),
          height: Math.round(contentArea.height * dpr)
        },
        coordinateStoreBounds: coordinateSystemInfo?.bounds || null,
        coordinateSystemInfo: coordinateSystemInfo
      }
    };
  }

  // 🔧 SIMPLIFIED: Direct canvas update without transaction overhead
  function updateCanvasDimensions(newContentArea, resizeContext = {}) {
    if (!canvas || !ctx || !newContentArea) return;

    console.log(`[FLOATING_DISPLAY] Simple resize: ${contentArea.width}x${contentArea.height} → ${newContentArea.width}x${newContentArea.height}`);

    // Update contentArea
    contentArea = { ...newContentArea };

    // Update canvas dimensions directly (following Container.svelte pattern)
    const integerCanvasWidth = Math.round(contentArea.width * dpr);
    const integerCanvasHeight = Math.round(contentArea.height * dpr);

    canvas.width = integerCanvasWidth;
    canvas.height = integerCanvasHeight;
    canvas.style.width = contentArea.width + 'px';
    canvas.style.height = contentArea.height + 'px';

    // Apply DPR scaling
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Update coordinate store and trigger render
    coordinateActions?.updateBounds({
      x: [0, contentArea.width],
      y: [0, contentArea.height]
    });
    scheduleRender();
  }

  // 🔧 CONSOLIDATED CANVAS STATE MANAGEMENT: Single entry point to prevent race conditions
  let canvasInitializing = false;

  // Single reactive statement for all canvas operations to prevent concurrent initialization
  $: canvasStateChange: if (canvas && state?.ready && !canvasError && !canvasInitializing) {
    handleCanvasStateChange();
  }

  function handleCanvasStateChange() {
    // State machine: initialization → ready → config updates
    if (!ctx && !canvasReady) {
      // Initialize canvas first
      initializeCanvas();
    } else if (ctx && canvasReady && config) {
      // Handle config changes after canvas is ready
      handleConfigChanges();
    }
  }

  function handleConfigChanges() {
    // Calculate new contentArea from config (full container, no header)
    const containerSize = config.containerSize || { width: 220, height: 120 };
    // 🔧 PHASE 1B FIX: Remove fixed reduction - use full container dimensions
    const newContentArea = {
      width: Math.max(50, containerSize.width),  // Use full container width - maintain 50px minimum
      height: Math.max(50, containerSize.height) // Use full container height - maintain 50px minimum
    };

    // 🔧 CRITICAL FIX: Reduced threshold for responsive resizing
    const widthChange = Math.abs(contentArea.width - newContentArea.width);
    const heightChange = Math.abs(contentArea.height - newContentArea.height);

    // More sensitive to changes for responsive interaction
    if (widthChange > 2 || heightChange > 2) {
      console.log(`[FLOATING_DISPLAY] Config change detected:`, {
        id,
        containerSize,
        newContentArea,
        currentContentArea: contentArea,
        changes: { widthChange, heightChange }
      });

      updateCanvasDimensions(newContentArea, {
        trigger: 'reactive_config_change',
        source: 'config_reactive_update',
        oldSize: { width: contentArea.width, height: contentArea.height },
        changes: { widthChange, heightChange }
      });
    }
  }
  
  // Canvas initialization function with retry logic and comprehensive logging
  function initializeCanvas() {
    if (!canvas) {
      console.error('[FLOATING_DISPLAY] Canvas element not available');
      return;
    }

    // Prevent concurrent initialization
    if (canvasInitializing) {
      console.warn('[FLOATING_DISPLAY] Canvas initialization already in progress, skipping duplicate call');
      return;
    }

    // Set initialization lock
    canvasInitializing = true;

    // ✅ MATHEMATICAL PRECISION VALIDATION: Start canvas initialization validation
    console.log(`🎯 [PRECISION:${id}] Canvas initialization started - Attempt ${canvasRetries + 1}/${MAX_CANVAS_RETRIES}`);

    canvasRetries++;

    try {
      ctx = canvas.getContext('2d');
      if (ctx) {
        canvasReady = true;
        canvasError = false;
        canvasRetries = 0;

        dpr = window.devicePixelRatio || 1;

        // 🔧 ZOOM AWARENESS: Initialize zoom detector
        cleanupZoomDetector = createZoomDetector((newDpr) => {
          dpr = newDpr;

          // ✅ PRECISION VALIDATION: Track DPR changes for canvas precision
          console.log(`📏 [PRECISION:${id}] DPR change: ${dpr} → ${newDpr}`);

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
            // 🔧 CRITICAL FIX: Apply DPR scaling to match physical canvas dimensions
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // This ensures coordinate systems align between physical canvas and logical rendering
            ctx.imageSmoothingEnabled = false;
          }
        });


        // 🔧 PHASE 1B FIX: Use consolidated canvas dimension function with full container usage
        const containerSize = config.containerSize || { width: 220, height: 120 };
        // 🔧 PHASE 1B FIX: Remove fixed reduction - use full container dimensions
        const newContentArea = {
          width: Math.max(50, containerSize.width),  // Use full container width - maintain 50px minimum
          height: Math.max(50, containerSize.height) // Use full container height - maintain 50px minimum
        };

        console.log(`[FLOATING_DISPLAY] Canvas initial sizing:`, {
          id,
          containerSize,
          newContentArea
        });

        // Use the consolidated function to prevent duplicate code and race conditions
        updateCanvasDimensions(newContentArea);

        // ✅ BROWSER EVIDENCE COLLECTION: Collect real browser measurements for canvas-container validation
        if (evidenceCollector && element && canvas) {
          try {
            collectBrowserEvidence(id, element, canvas);
          } catch (error) {
            console.warn('[FLOATING_DISPLAY] Browser evidence collection failed:', error);
          }
        }

        // ✅ MATHEMATICAL PRECISION VALIDATION: Validate canvas-container match exactly
        if (precisionValidator && element && canvas) {
          try {
            validateCanvasContainerMatch(id, canvas, element, newContentArea);
          } catch (error) {
            console.warn('[FLOATING_DISPLAY] Canvas precision validation failed:', error);
          }
        }

        // Release initialization lock on success
        canvasInitializing = false;
        console.log(`✅ [PRECISION:${id}] Canvas initialization completed successfully`);

      } else {
        throw new Error('Failed to get 2D context');
      }
    } catch (error) {
      canvasReady = false;
      canvasError = true;
      ctx = null;
      console.error(`[FLOATING_DISPLAY] Canvas initialization failed (attempt ${canvasRetries}/${MAX_CANVAS_RETRIES}):`, error);

      // ✅ PRECISION VALIDATION: Track canvas initialization failure
      console.error(`❌ [PRECISION:${id}] Canvas initialization failed (attempt ${canvasRetries}/${MAX_CANVAS_RETRIES}):`, error.message);

      // Release initialization lock on error
      canvasInitializing = false;

      if (canvasRetries >= MAX_CANVAS_RETRIES) {
        console.error(`[FLOATING_DISPLAY] Maximum canvas initialization retries exceeded`);
      }
    }
  }

    
  // 🔧 CLEAN FOUNDATION: Create rendering context for visualization functions
  let renderingContext = null;

  // ✅ ULTRA-MINIMAL: Simple rendering - no complex dependencies
  let renderFrame = null;
  let cleanupZoomDetector = null; // Zoom detector cleanup function

  // 🔧 CRITICAL TRADING SAFETY FIX: NEVER skip market data updates
  // Always render the latest market data immediately - no deduplication for trading safety
  function scheduleRender() {
    // 🚨 CRITICAL FIX: Always render market data, coordinate issues handled separately
    if (!areCoordinatesSynchronized()) {
      console.warn(`[FLOATING_DISPLAY:${id}] Coordinate systems not synchronized, rendering with latest market data`);
      // NEVER skip rendering - always show latest market data to traders
    }

    // Cancel any existing render frame to replace with latest data
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }

    // Always schedule new render with latest market data - NEVER skip updates
    renderFrame = requestAnimationFrame(() => {
      renderFrame = null;
      render();
    });
  }

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

  


  function render() {
    if (!ctx || !state || !config || !canvas) {
      return;
    }

    const startTime = getPerformanceTime();

    // 🔧 CLEAN FOUNDATION: Create rendering context (use reactive global contentArea)
    const containerSize = config.containerSize || { width: canvasWidth, height: canvasHeight };
    // ✅ FIXED: Use reactive global contentArea to maintain reactivity chain
    // Local contentArea calculation removed to fix container resize scaling issue
    const adrAxisX = contentArea.width * config.adrAxisPosition;

    // ✅ VISUALIZATION LOGGING: Enhance rendering context with display correlation
    renderingContext = displayContextEnhancer.getContext(id, symbol, {
      containerSize,
      contentArea,
      adrAxisX,
      // Derived values for backward compatibility
      visualizationsContentWidth: contentArea.width,
      meterHeight: contentArea.height,
      adrAxisXPosition: adrAxisX
    });

    // Clear canvas and set background
    // 🔧 CRITICAL FIX: Clear full physical canvas dimensions, not logical area
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw symbol background first (behind all other visualizations)
    renderSymbolBackground();

    // Draw visualizations with performance tracking
    if (state.visualLow && state.visualHigh && yScale) {
      try {
        // ✅ PRECISION VALIDATION: Track first render with mathematical precision validation
        if (!renderingContext.firstRenderLogged && precisionValidator) {
          console.log(`🎯 [PRECISION:${id}] First render initiated for ${symbol}`);
          renderingContext.firstRenderLogged = true;
        }

        // Draw visualizations in correct order for layering with performance tracking
        const visualizationStartTime = getPerformanceTime();

        drawVolatilityOrb(ctx, renderingContext, config, state, yScale);
        logVisualizationPerformance(id, 'VolatilityOrb', visualizationStartTime, renderingContext, state);

        drawMarketProfile(ctx, renderingContext, config, state, yScale);
        logVisualizationPerformance(id, 'MarketProfile', visualizationStartTime, renderingContext, state);

        drawDayRangeMeter(ctx, renderingContext, config, state, yScale);
        logVisualizationPerformance(id, 'DayRangeMeter', visualizationStartTime, renderingContext, state);

        drawPriceFloat(ctx, renderingContext, config, state, yScale);
        logVisualizationPerformance(id, 'PriceFloat', visualizationStartTime, renderingContext, state);

        drawPriceDisplay(ctx, renderingContext, config, state, yScale);
        logVisualizationPerformance(id, 'PriceDisplay', visualizationStartTime, renderingContext, state);

        drawVolatilityMetric(ctx, renderingContext, config, state);
        logVisualizationPerformance(id, 'VolatilityMetric', visualizationStartTime, renderingContext, state);

        drawPriceMarkers(ctx, renderingContext, config, state, yScale, markers);
        logVisualizationPerformance(id, 'PriceMarkers', visualizationStartTime, renderingContext, state);

        // Log total render time
        const totalRenderTime = getPerformanceTime() - visualizationStartTime;
        const meets60fps = totalRenderTime <= 16.67;

        if (!meets60fps) {
          console.warn(`⚠️ [DISPLAY:${id}] Total render time ${totalRenderTime.toFixed(2)}ms exceeds 60fps target`);
        }

      } catch (error) {
        // ✅ PRECISION VALIDATION: Track render errors
        console.error(`❌ [PRECISION:${id}] Render error for ${symbol}:`, {
          error: error.message,
          hasCanvas: !!ctx,
          hasRenderingContext: !!renderingContext,
          hasYScale: !!yScale
        });

        console.error(`[RENDER] Error in visualization functions:`, error);
      }
    }
  }
  
  // ✅ ULTRA-MINIMAL: Simple render trigger with deduplication
  $: renderTrigger: if (state && config && yScale) {
    scheduleRender();
  }
  
  // 🔧 ARCHITECTURAL FIX: Consolidated cleanup with proper resource management
  onDestroy(() => {
    // ✅ MATHEMATICAL PRECISION VALIDATION: Generate final precision compliance report
    if (precisionValidator) {
      try {
        const precisionReport = precisionValidator.generatePrecisionReport();
        console.log(`[PRECISION:${id}] Mathematical precision completed for ${symbol}:`, precisionReport);
      } catch (error) {
        console.warn(`[PRECISION:${id}] Error generating precision report:`, error);
      }
    }

    // ✅ BROWSER EVIDENCE COLLECTION: Generate final evidence compliance report
    if (evidenceCollector) {
      try {
        const evidenceReport = evidenceCollector.generateEvidenceReport();
        console.log(`[EVIDENCE:${id}] Browser evidence completed for ${symbol}:`, evidenceReport);
      } catch (error) {
        console.warn(`[EVIDENCE:${id}] Error generating evidence report:`, error);
      }
    }

    // Cleanup header timeout
    if (headerTimeout) {
      clearTimeout(headerTimeout);
      headerTimeout = null;
    }

    // Cleanup render frame - cancel any pending render
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
      renderFrame = null;
    }

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
  role="region"
  aria-label="Trading display for {symbol}"
  on:mouseenter={showHeader}
  on:mouseleave={hideHeader}
>
  <!-- Container Header - appears on hover -->
  <div class="container-header" class:error={canvasError} class:visible={headerVisible}>
    <div class="symbol-info">
      {#if canvasError}
        <span class="error-symbol">⚠️ Failed to load {symbol}</span>
      {:else}
        <span class="symbol-name">{symbol}</span>
      {/if}
    </div>
    <div class="header-controls">
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
      <p>Initializing {symbol}... (ready: {state?.ready}, error: {canvasError})</p>
      {#if !state?.ready || canvasError}
        <div style="font-size: 10px; color: #666; margin-top: 5px;">
          {!state?.ready && !canvasError && 'Waiting for worker state...'}
          {canvasError && `Canvas error: ${canvasError}`}
          {state?.ready && canvasError && 'State ready but canvas failed'}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* ✅ ULTRA-MINIMAL: Headerless design CSS - maximize trading data display */
  .enhanced-floating {
    position: fixed; /* CRITICAL: Must remain fixed for interact.js drag functionality */
    background: #111827; /* Dark background for better contrast */
    border: 2px solid #374151;
    border-radius: 6px; /* Slightly smaller radius for headerless design */
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    /* 🔧 CRITICAL FIX: Changed overflow from hidden to visible to prevent canvas clipping */
    overflow: visible;
    box-sizing: border-box; /* CRITICAL FIX: Include border in width/height calculations */
    /* 🔧 CRITICAL FIX: Add padding to account for border and ensure canvas fits perfectly */
    padding: 2px;
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
    /* 🔧 PHASE 1B FIX: Remove CSS constraints that prevent horizontal scaling visibility */
    width: 100%; /* Use full container width - no fixed reduction */
    height: 100%; /* Use full container height - no fixed reduction */
    margin: 2px; /* Center within padding */
    border-radius: 4px; /* Match container border radius */
    /* cursor removed - let interact.js control resize cursors */
    /* FIXED: Removed pointer-events: none - was breaking keyboard shortcuts after canvas creation */

    /* ✅ PERFORMANCE: Hardware acceleration for smooth rendering */
    transform: translateZ(0); /* Force hardware acceleration */
    /* 🔧 PHASE 1B FIX: Allow expansion beyond container for horizontal scaling visibility */
    overflow: visible;
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

  /* Container Header - opacity-based show/hide without transforms */
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
    /* 🔧 CRITICAL FIX: Opacity transitions instead of transforms to prevent canvas positioning issues */
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease;
    z-index: 10; /* Further reduced to prevent canvas interaction interference */
    border-radius: 6px 6px 0 0;
    pointer-events: none; /* Prevent header from blocking canvas interactions when hidden */
  }

  /* Header visible state - show with opacity */
  .container-header.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto; /* Re-enable pointer events when visible */
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
