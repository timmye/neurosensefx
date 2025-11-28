<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { displayStore, displayActions, displays, activeDisplay } from '../stores/displayStore.js';
  import { subscribe, unsubscribe, wsStatus } from '../data/wsClient.js';
  import { scaleLinear } from 'd3-scale';
  import { writable } from 'svelte/store';
  import { markerStore } from '../stores/markerStore.js';
  import { displayContextEnhancer } from '../utils/visualizationLoggingUtils.js';

  // 🔄 STATIC IMPORTS: Import visualization functions directly to eliminate race conditions
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
  import { createZoomDetector, getCanvasDimensions, createCanvasSizingConfig } from '../utils/canvasSizing.js';

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

  // ✅ MEMORY MANAGEMENT: Import centralized memory management utilities
  import {
    createCleanupManager,
    setupComponentCleanup,
    globalMemoryTracker,
    initializeMemoryTracking
  } from '../utils/memoryManagementUtils.js';

  // 🚨 PERFORMANCE API FALLBACK: HMR-safe robust performance.now() with functional validation
  // Cache fallback state to avoid repeated corruption detection
  let useDateFallback = false;
  let lastCorruptionCheck = 0;
  const CORRUPTION_CHECK_INTERVAL = 1000; // Check every 1 second max

  // ✅ MEMORY MANAGEMENT: Initialize cleanup manager for this component
  let cleanupManager = null;

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

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Consistent export pattern
  export let config = {};  // Configuration from displayStore.defaultConfig
  export let state = {};   // Reactive state from dataProcessor
  export let id = '';      // Unique identifier for tracking

  // Legacy props for backward compatibility
  export let symbol;
  export let position = { x: 100, y: 100 };

  // Note: Debug logging moved to initializeComponent() function

  // Local state
  let element;
  let canvas;
  let ctx;

  // Canvas state tracking with enhanced monitoring
  let canvasReady = false;
  let canvasError = false;
  let canvasRetries = 0;
  const MAX_CANVAS_RETRIES = 3;

  // 🎨 CANVAS STATE MONITORING: Enhanced canvas lifecycle tracking
  let canvasStateHistory = [];
  let canvasLastValidation = null;
  let canvasPerformanceMetrics = {
    initializationTime: 0,
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    errors: []
  };

  // Marker state
  let markers = [];

  // Header visibility state for hover-based show/hide
  let headerVisible = false;
  let headerTimeout = null;

  // Declare variables to avoid ReferenceError
  let displayPosition = position;

  // local variables (config and state are already exported above)
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

  // 🔧 PERFORMANCE FIX: RequestAnimationFrame throttling variables
  let movementRafId = null;
  let resizeRafId = null;
  let pendingMovement = null;
  let pendingResize = null;

  // 🔧 PERFORMANCE FIX: Rate limiting to prevent RAF callback accumulation
  let lastMovementTime = 0;
  let lastResizeTime = 0;
  const MIN_MOVEMENT_INTERVAL = 8; // ~120fps max update rate
  const MIN_RESIZE_INTERVAL = 16; // ~60fps max update rate

  
  // ✅ COORDINATE SYSTEM: Reactive coordinate system info for performance
  let coordinateSystemInfo = null;
  $: coordinateSystemInfo = coordinateActions.getSystemInfo();

  
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
  $: state = display?.state || { ready: false, error: null, data: null };
  $: isActive = display?.isActive || false;
  $: zIndex = display?.zIndex || 1;
  $: displaySize = display?.size || { width: 220, height: 120 };

  
  // ✅ PRECISION VALIDATION: Initialize validators when display and symbol are available
  $: if (id && symbol) {
    precisionValidator = getPrecisionValidator(id, symbol);
    evidenceCollector = getEvidenceCollector(id, symbol);
    displayCreationLogger = getDisplayCreationLogger(id, symbol);
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
  let canvasSizingConfig = null;

  // ✅ CONSOLIDATED REACTIVE STATEMENT: Following Container.svelte working pattern
  // Single consolidated reactive statement for all canvas operations to prevent race conditions
  $: if (canvas && config && !canvasInitializing) {
    // 1. Container layer - use actual DOM measurements for precision
    const actualContainer = canvas.parentElement;
    const actualContainerSize = actualContainer ? {
      width: actualContainer.clientWidth,
      height: actualContainer.clientHeight
    } : (config.containerSize || { width: 220, height: 120 });

    // 2. Content area - account for border-box sizing using actual measurements
    // DEBUGGER: Border adjustment for precision matching
    const borderAdjustment = 4; // 2px border on each side
    const contentArea = {
      width: Math.max(46, actualContainerSize.width - borderAdjustment),   // Minus 4px for borders
      height: Math.max(46, actualContainerSize.height - borderAdjustment)  // Minus 4px for borders
    };

    console.log(`[DEBUGGER:FloatingDisplay:actualContainer] Using actual DOM container measurements:`, {
      actualContainerSize,
      configContainerSize: config.containerSize || { width: 220, height: 120 },
      contentArea,
      borderAdjustment
    });

    
    // 🔧 CRITICAL FIX: Sync coordinate store with contentArea for proper scaling
    if (coordinateActions && coordinateActions.updateBoundsFromContentArea) {
      coordinateActions.updateBoundsFromContentArea(contentArea);
    }

    // ✅ FIXED REACTIVITY: Update coordinate store with bounded system info (moved from separate reactive statement)
    if (contentArea && state?.midPrice && coordinateActions) {
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

    // 3. Create unified canvas sizing configuration with actual container measurements
    canvasSizingConfig = createCanvasSizingConfig(actualContainerSize, config, {
      padding: 0,           // ✅ NO PADDING in headerless design
      respectDpr: true      // ✅ DPR-aware crisp rendering
    });

    // Set canvas dimensions first
    const { canvas: canvasDims } = canvasSizingConfig.dimensions;
    canvas.width = canvasDims.width;
    canvas.height = canvasDims.height;

    // 🔧 CRITICAL FIX: Ensure canvas CSS exactly matches container for precision validation
    const domContainer = canvas.parentElement;
    if (domContainer) {
      // Use requestAnimationFrame to ensure DOM measurements are updated
      requestAnimationFrame(() => {
        const actualWidth = domContainer.clientWidth;
        const actualHeight = domContainer.clientHeight;

        // Set canvas CSS to exactly match container
        canvas.style.width = actualWidth + 'px';
        canvas.style.height = actualHeight + 'px';

        // Force layout recalculation to ensure precision validator sees correct values
        canvas.getBoundingClientRect();
      });
    } else {
      // Fallback to calculated dimensions if container not available
      canvas.style.width = canvasDims.cssWidth + 'px';
      canvas.style.height = canvasDims.cssHeight + 'px';
    }

    // ✅ PHASE 2 STANDARDIZATION: Remove manual DPR scaling - handled per-frame in draw function like Container.svelte
    // This ensures consistent DPR handling between Container.svelte and FloatingDisplay.svelte
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
    }
  }
  
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
  $: yScale = createBoundedYScale(state, config?.containerSize ? {
    width: Math.max(50, config.containerSize.width),
    height: Math.max(50, config.containerSize.height)
  } : { width: 220, height: 120 });
  
    
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
  
  
    
    
  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Initialize component with proper setup
  function initializeComponent() {
    console.log(`[FLOATING_DISPLAY:${id}] Component mounting`, {
      symbol,
      position,
      timestamp: Date.now()
    });

    // ✅ MEMORY MANAGEMENT: Initialize cleanup manager
    cleanupManager = createCleanupManager(id, 'FloatingDisplay');
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Setup store subscriptions if needed
  function setupStoreSubscriptions() {
    // FloatingDisplay uses reactive store bindings, no manual subscriptions needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Performance monitoring integration
  function startPerformanceMonitoring() {
    // Record memory usage for monitoring
    globalMemoryTracker.recordUsage();
  }

  // 🔧 PERFORMANCE FIX: Throttled movement update with requestAnimationFrame and rate limiting
  function scheduleMovementUpdate(movementData) {
    const now = getPerformanceTime();

    // 🔧 PERFORMANCE FIX: Rate limiting to prevent callback accumulation
    if (now - lastMovementTime < MIN_MOVEMENT_INTERVAL) {
      // Too soon, just update pending data but don't schedule new RAF
      pendingMovement = movementData;
      return;
    }

    // Cancel any pending update
    if (movementRafId) {
      cancelAnimationFrame(movementRafId);
    }

    // Store the latest movement data
    pendingMovement = movementData;
    lastMovementTime = now;

    movementRafId = requestAnimationFrame(() => {
      if (pendingMovement) {
        const { newPosition, dragStartTime } = pendingMovement;

        // CRITICAL FIX: Calculate previousPosition atomically within RAF callback
        // This prevents race conditions where previousPosition becomes stale
        const atomicPreviousPosition = { ...previousPosition };

        // Batch expensive operations
        try {
          const movementContext = {
            trigger: 'user_drag',
            duration: dragStartTime ? getPerformanceTime() - dragStartTime : 0,
            smooth: false
          };

          logContainerMovement(id, atomicPreviousPosition, newPosition, movementContext);
          displayActions.moveDisplay(id, newPosition);

          // CRITICAL FIX: Update previousPosition atomically after successful processing
          previousPosition = { ...newPosition };
        } catch (error) {
          console.warn('[FLOATING_DISPLAY] Failed to process movement:', error);
        }

        pendingMovement = null;
      }
      movementRafId = null;
    });
  }

  // 🔧 PERFORMANCE FIX: Throttled resize update with requestAnimationFrame and rate limiting
  function scheduleResizeUpdate(resizeData) {
    const now = getPerformanceTime();

    // 🔧 PERFORMANCE FIX: Rate limiting to prevent callback accumulation
    if (now - lastResizeTime < MIN_RESIZE_INTERVAL) {
      // Too soon, just update pending data but don't schedule new RAF
      pendingResize = resizeData;
      return;
    }

    pendingResize = resizeData;
    lastResizeTime = now;

    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
    }

    resizeRafId = requestAnimationFrame(() => {
      if (pendingResize) {
        const { element, event, resizeStartTime } = pendingResize;

        // Batch all DOM operations to prevent layout thrashing
        // Write all styles first
        element.style.width = event.rect.width + 'px';
        element.style.height = event.rect.height + 'px';

        // FIXED: Follow existing drag pattern - use event.rect directly
        const newPosition = {
          x: event.rect.left,
          y: event.rect.top
        };

        const newSize = {
          width: event.rect.width,
          height: event.rect.height
        };

        // Update state in batch (same pattern as drag)
        displayActions.resizeDisplay(id, newSize);
        displayActions.moveDisplay(id, newPosition);

        // Log performance metrics
        try {
          const resizeContext = {
            trigger: 'user_resize',
            duration: resizeStartTime ? getPerformanceTime() - resizeStartTime : 0,
            smooth: false
          };

          logContainerResize(id, previousDimensions, newSize, resizeContext);
        } catch (error) {
          console.warn('[FLOATING_DISPLAY] Failed to log resize:', error);
        }

        pendingResize = null;
      }
      resizeRafId = null;
    });
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Cleanup component resources
  function cleanupComponent() {
    console.log(`[FLOATING_DISPLAY:${id}] Cleaning up component`);
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Unsubscribe from stores
  function unsubscribeStores() {
    // FloatingDisplay uses reactive store bindings, no manual unsubscriptions needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Stop performance monitoring
  function stopPerformanceMonitoring() {
    // Final memory usage recording
    globalMemoryTracker.recordUsage();
  }

  // ✅ MEMORY MANAGEMENT: Enhanced resource cleanup with proper lifecycle management
  function setupResourceCleanup() {
    if (!cleanupManager) return;

    // Setup cleanup phases for orderly resource destruction
    cleanupManager.registerCleanupPhase('phase1_interactions', async () => {
      console.log(`[FLOATING_DISPLAY:${id}] Phase 1: Cleaning up interactions`);

      // Clean up interactable instance
      if (interactable) {
        workspaceGrid.unregisterInteractInstance(interactable);
        interactable.unset();
        interactable = null;
      }
    }, 10); // High priority - clean up first

    cleanupManager.registerCleanupPhase('phase2_animations', async () => {
      console.log(`[FLOATING_DISPLAY:${id}] Phase 2: Cleaning up animations`);

      // Cancel any pending render frames
      if (renderFrame) {
        cancelAnimationFrame(renderFrame);
        renderFrame = null;
      }
    }, 20);

    cleanupManager.registerCleanupPhase('phase3_canvas', async () => {
      console.log(`[FLOATING_DISPLAY:${id}] Phase 3: Cleaning up canvas resources`);

      // Clean up canvas context
      if (ctx) {
        // Clear canvas to prevent memory leaks
        if (canvas) {
          ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
        }
        ctx = null;
      }

      // Reset canvas state
      canvasReady = false;
      canvasError = false;
    }, 30);

    cleanupManager.registerCleanupPhase('phase4_timeouts', async () => {
      console.log(`[FLOATING_DISPLAY:${id}] Phase 4: Cleaning up timeouts and intervals`);

      // Clean up header timeout
      if (headerTimeout) {
        clearTimeout(headerTimeout);
        headerTimeout = null;
      }
    }, 40);

    cleanupManager.registerCleanupPhase('phase5_zoom_detector', async () => {
      console.log(`[FLOATING_DISPLAY:${id}] Phase 5: Cleaning up zoom detector`);

      // Clean up zoom detector
      if (cleanupZoomDetector) {
        cleanupZoomDetector();
        cleanupZoomDetector = null;
      }
    }, 50);

    // Register individual resources for tracking
    setupComponentCleanup(cleanupManager, {
      canvas,
      ctx,
      interactable,
      zoomDetector: cleanupZoomDetector,
      renderFrame,
      timeouts: headerTimeout ? [headerTimeout] : [],
      intervals: [],
      subscriptions: [],
      eventListeners: []
    });
  }

  // ✅ GRID SNAPPING: Enhanced interact.js setup with grid integration
  onMount(async () => {
    initializeComponent();
    setupStoreSubscriptions();
    startPerformanceMonitoring();


    // ✅ MEMORY MANAGEMENT: Setup resource cleanup after initialization
    setupResourceCleanup();

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

            // 🔧 PERFORMANCE FIX: Use throttled movement update
            // CRITICAL FIX: previousPosition is now handled atomically within RAF callback
            scheduleMovementUpdate({
              newPosition,
              dragStartTime
            });
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
            // 🔧 PERFORMANCE FIX: Use throttled resize update to prevent layout thrashing
            scheduleResizeUpdate({
              element,
              event,
              resizeStartTime
            });
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
    // Calculate content area from container size (consistent with render() function)
    const containerSize = config?.containerSize || { width: canvasWidth, height: canvasHeight };
    const contentArea = {
      width: Math.max(50, containerSize.width),
      height: Math.max(50, containerSize.height)
    };

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

  // ✅ REMOVED: updateCanvasDimensions() function - consolidated into reactive statement
  // This function was causing reactive chain breaks at line 660: contentArea = { ...newContentArea };
  // Canvas dimension updates are now handled directly in the consolidated reactive statement above

  // 🔧 CONSOLIDATED CANVAS STATE MANAGEMENT: Single entry point to prevent race conditions
  let canvasInitializing = false;

  // ✅ CONSOLIDATED CANVAS INITIALIZATION: Simplified without fragmented reactive statements
  // Canvas initialization is now handled directly in initializeCanvas() function
  // Config changes are handled by the main consolidated reactive statement above
  
  // 🎨 ENHANCED CANVAS INITIALIZATION: Comprehensive canvas setup with detailed logging
  function initializeCanvas() {
    const operationId = `CANVAS_INIT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const initStartTime = getPerformanceTime();

    console.log(`🎨 [${operationId}] Starting enhanced canvas initialization for display ${id}`, {
      attempt: canvasRetries + 1,
      maxAttempts: MAX_CANVAS_RETRIES,
      timestamp: Date.now(),
      hasCanvas: !!canvas,
      hasElement: !!element,
      canvasElementId: canvas?.id || 'no-id',
      canvasClass: canvas?.className || 'no-class'
    });

    // Phase 1: Canvas Element Validation
    if (!canvas) {
      console.error(`❌ [${operationId}] Canvas element not available`, {
        hasElement: !!element,
        elementId: element?.id || 'no-id',
        elementClass: element?.className || 'no-class',
        canvasSelector: 'bind:this={canvas}'
      });
      return;
    }

    // Phase 2: Concurrent Initialization Prevention
    if (canvasInitializing) {
      console.warn(`⚠️ [${operationId}] Canvas initialization already in progress, skipping duplicate call`, {
        currentAttempt: canvasRetries,
        operationInProgress: true
      });
      return;
    }

    // Set initialization lock
    canvasInitializing = true;
    console.log(`🔒 [${operationId}] Canvas initialization lock engaged`);

    // Phase 3: Canvas Element State Validation
    const canvasElementValidation = validateCanvasElement(canvas, operationId);
    if (!canvasElementValidation.isValid) {
      console.error(`❌ [${operationId}] Canvas element validation failed`, canvasElementValidation.errors);
      canvasInitializing = false;
      return;
    }

    canvasRetries++;

    try {
      // Phase 4: Canvas Context Creation with Detailed Logging
      console.log(`🎨 [${operationId}] Phase 4: Creating 2D rendering context`);
      const contextCreationStartTime = getPerformanceTime();

      ctx = canvas.getContext('2d', {
        alpha: false, // Performance optimization for opaque canvases
        desynchronized: false, // Safety: avoid tearing on some displays
        willReadFrequently: false // Performance optimization for drawing-only canvases
      });

      const contextCreationTime = getPerformanceTime() - contextCreationStartTime;

      if (!ctx) {
        throw new Error('Failed to get 2D context - getContext("2d") returned null');
      }

      console.log(`✅ [${operationId}] Canvas 2D context created successfully`, {
        creationTime: `${contextCreationTime.toFixed(2)}ms`,
        contextType: typeof ctx,
        contextId: ctx.constructor.name,
        canvasElement: canvas.tagName,
        canvasDimensions: { width: canvas.width, height: canvas.height }
      });

      // Phase 5: Canvas Context Configuration and Validation
      console.log(`🎨 [${operationId}] Phase 5: Configuring canvas context`);
      const contextConfigStartTime = getPerformanceTime();

      const contextValidation = validateAndConfigureCanvasContext(ctx, canvas, operationId);
      if (!contextValidation.isValid) {
        throw new Error(`Canvas context configuration failed: ${contextValidation.errors.join(', ')}`);
      }

      const contextConfigTime = getPerformanceTime() - contextConfigStartTime;
      console.log(`✅ [${operationId}] Canvas context configured successfully`, {
        configTime: `${contextConfigTime.toFixed(2)}ms`,
        configuration: contextValidation.configuration
      });

      // Phase 6: DPR Detection and Setup
      console.log(`🎨 [${operationId}] Phase 6: Setting up DPR awareness`);
      const dprSetupStartTime = getPerformanceTime();

      dpr = window.devicePixelRatio || 1;
      const browserDpr = window.devicePixelRatio;
      const effectiveDpr = canvasSizingConfig?.dimensions?.dpr || dpr;

      console.log(`📏 [${operationId}] DPR configuration established`, {
        browserDpr,
        effectiveDpr,
        canvasConfigDpr: canvasSizingConfig?.dimensions?.dpr,
        dprDifference: Math.abs(browserDpr - effectiveDpr)
      });

      // 🔧 ZOOM AWARENESS: Initialize zoom detector with enhanced logging
      cleanupZoomDetector = createZoomDetector((newDpr) => {
        const oldDpr = dpr;
        dpr = newDpr;

        console.log(`📏 [${operationId}] DPR change detected`, {
          oldDpr,
          newDpr,
          change: (newDpr - oldDpr).toFixed(3),
          percentChange: ((newDpr / oldDpr - 1) * 100).toFixed(1) + '%',
          timestamp: Date.now(),
          canvasDimensions: { width: canvas.width, height: canvas.height }
        });
      });

      const dprSetupTime = getPerformanceTime() - dprSetupStartTime;
      console.log(`✅ [${operationId}] DPR setup completed`, {
        setupTime: `${dprSetupTime.toFixed(2)}ms`
      });

      // Phase 7: Canvas Sizing and Coordinate System Setup
      console.log(`🎨 [${operationId}] Phase 7: Verifying canvas sizing and coordinate system`);
      const sizingValidation = validateCanvasSizing(canvas, canvasSizingConfig, operationId);
      if (!sizingValidation.isValid) {
        console.warn(`⚠️ [${operationId}] Canvas sizing validation warnings`, sizingValidation.warnings);
      }

      // Phase 8: Canvas Drawing Capabilities Test
      console.log(`🎨 [${operationId}] Phase 8: Testing canvas drawing capabilities`);
      const drawingTestStartTime = getPerformanceTime();

      const drawingCapabilities = testCanvasDrawingCapabilities(ctx, canvas, operationId);
      if (!drawingCapabilities.canDraw) {
        throw new Error(`Canvas drawing capabilities test failed: ${drawingCapabilities.errors.join(', ')}`);
      }

      const drawingTestTime = getPerformanceTime() - drawingTestStartTime;
      console.log(`✅ [${operationId}] Canvas drawing capabilities verified`, {
        testTime: `${drawingTestTime.toFixed(2)}ms`,
        capabilities: drawingCapabilities.capabilities
      });

      // Phase 9: Final State Validation
      console.log(`🎨 [${operationId}] Phase 9: Final canvas state validation`);
      const finalValidation = validateFinalCanvasState(canvas, ctx, operationId);

      if (!finalValidation.isValid) {
        console.error(`❌ [${operationId}] Final canvas state validation failed`, finalValidation.errors);
        throw new Error('Final canvas state validation failed');
      }

      // Success: Update component state
      canvasReady = true;
      canvasError = false;
      canvasRetries = 0;

      const totalInitTime = getPerformanceTime() - initStartTime;

      // 🎨 CANVAS STATE MONITORING: Update canvas state tracking
      updateCanvasState('initialization_completed', {
        initTime: totalInitTime,
        operationId,
        phases: {
          elementValidation: canvasElementValidation.isValid,
          contextCreation: true,
          contextConfiguration: contextValidation.isValid,
          dprSetup: true,
          sizingValidation: sizingValidation.isValid,
          drawingTest: drawingCapabilities.canDraw,
          finalValidation: finalValidation.isValid
        }
      });

      console.log(`🎉 [${operationId}] Canvas initialization completed successfully`, {
        totalTime: `${totalInitTime.toFixed(2)}ms`,
        performanceTarget: totalInitTime <= 16.67 ? '60fps' : 'suboptimal',
        canvasState: {
          ready: canvasReady,
          error: canvasError,
          contextAvailable: !!ctx,
          dprConfigured: !!dpr,
          sizingValid: sizingValidation.isValid
        },
        phases: {
          elementValidation: canvasElementValidation.isValid,
          contextCreation: true,
          contextConfiguration: contextValidation.isValid,
          dprSetup: true,
          sizingValidation: sizingValidation.isValid,
          drawingTest: drawingCapabilities.canDraw,
          finalValidation: finalValidation.isValid
        }
      });

      // ✅ BROWSER EVIDENCE COLLECTION: Collect real browser measurements
      if (evidenceCollector && element && canvas) {
        try {
          console.log(`🔍 [${operationId}] Collecting browser evidence`);
          collectBrowserEvidence(id, element, canvas);
        } catch (error) {
          console.warn(`⚠️ [${operationId}] Browser evidence collection failed:`, error.message);
        }
      }

      // ✅ MATHEMATICAL PRECISION VALIDATION: Validate canvas-container match
      if (precisionValidator && element && canvas) {
        try {
          console.log(`🎯 [${operationId}] Running mathematical precision validation`);
          // DEBUGGER: Account for border-box in precision validation
          const borderAdjustment = 4; // 2px border on each side
          const contentArea = {
            width: Math.max(46, (config?.containerSize?.width || 220) - borderAdjustment),
            height: Math.max(46, (config?.containerSize?.height || 120) - borderAdjustment)
          };
          validateCanvasContainerMatch(id, canvas, element, contentArea);
        } catch (error) {
          console.warn(`⚠️ [${operationId}] Canvas precision validation failed:`, error.message);
        }
      }

      // 🎨 CANVAS HEALTH CHECK: Perform health check after successful initialization
      const healthReport = performCanvasHealthCheck(operationId);
      if (!healthReport.isHealthy) {
        console.warn(`⚠️ [${operationId}] Canvas health issues detected after initialization`, healthReport.issues);
      }

      // Release initialization lock on success
      canvasInitializing = false;
      console.log(`🔓 [${operationId}] Canvas initialization lock released - SUCCESS`);

    } catch (error) {
      // Error handling with detailed context
      canvasReady = false;
      canvasError = true;
      ctx = null;

      const totalFailTime = getPerformanceTime() - initStartTime;

      // 🎨 CANVAS STATE MONITORING: Track canvas initialization error
      updateCanvasState('error', {
        error: error.message,
        operationId,
        attempt: canvasRetries,
        failTime: totalFailTime,
        context: 'canvas_initialization'
      });

      console.error(`❌ [${operationId}] Canvas initialization failed`, {
        error: error.message,
        stack: error.stack,
        attempt: `${canvasRetries}/${MAX_CANVAS_RETRIES}`,
        failTime: `${totalFailTime.toFixed(2)}ms`,
        canvasElement: !!canvas,
        canvasDimensions: canvas ? { width: canvas.width, height: canvas.height } : null,
        canvasContext: !!ctx,
        lastOperation: operationId
      });

      // 🎨 CANVAS DEBUG SNAPSHOT: Capture snapshot on error
      captureCanvasSnapshot(operationId, 'initialization_error');

      // Release initialization lock on error
      canvasInitializing = false;
      console.log(`🔓 [${operationId}] Canvas initialization lock released - ERROR`);

      if (canvasRetries >= MAX_CANVAS_RETRIES) {
        console.error(`🚨 [${operationId}] Maximum canvas initialization retries exceeded - giving up`);

        // 🎨 CANVAS STATE MONITORING: Track critical failure
        updateCanvasState('critical_failure', {
          reason: 'max_retries_exceeded',
          maxRetries: MAX_CANVAS_RETRIES,
          operationId
        });
      }
    }
  }

  // 🎨 CANVAS ELEMENT VALIDATION: Comprehensive canvas element health check
  function validateCanvasElement(canvas, operationId) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    console.log(`🔍 [${operationId}] Validating canvas element`);

    // Check if canvas is actually an HTMLCanvasElement
    if (!(canvas instanceof HTMLCanvasElement)) {
      validation.isValid = false;
      validation.errors.push(`Canvas is not HTMLCanvasElement: ${typeof canvas}`);
    }

    // Check canvas properties
    if (canvas) {
      // Check canvas dimensions
      if (typeof canvas.width !== 'number' || canvas.width <= 0) {
        validation.isValid = false;
        validation.errors.push(`Invalid canvas width: ${canvas.width}`);
      }

      if (typeof canvas.height !== 'number' || canvas.height <= 0) {
        validation.isValid = false;
        validation.errors.push(`Invalid canvas height: ${canvas.height}`);
      }

      // Check canvas CSS dimensions
      const computedStyle = window.getComputedStyle(canvas);
      const cssWidth = parseFloat(computedStyle.width);
      const cssHeight = parseFloat(computedStyle.height);

      if (cssWidth <= 0) {
        validation.warnings.push(`Canvas CSS width is invalid: ${cssWidth}px`);
      }

      if (cssHeight <= 0) {
        validation.warnings.push(`Canvas CSS height is invalid: ${cssHeight}px`);
      }

      console.log(`🔍 [${operationId}] Canvas element validation results`, {
        isValid: validation.isValid,
        canvasElement: canvas.tagName,
        canvasDimensions: { width: canvas.width, height: canvas.height },
        cssDimensions: { width: cssWidth, height: cssHeight },
        errors: validation.errors.length,
        warnings: validation.warnings.length
      });
    }

    return validation;
  }

  // 🎨 CANVAS CONTEXT VALIDATION AND CONFIGURATION: Setup and validate 2D context
  function validateAndConfigureCanvasContext(ctx, canvas, operationId) {
    const validation = {
      isValid: true,
      errors: [],
      configuration: {}
    };

    console.log(`🔍 [${operationId}] Validating and configuring canvas context`);

    try {
      // Validate context properties
      if (!ctx) {
        validation.isValid = false;
        validation.errors.push('Context is null or undefined');
        return validation;
      }

      // Test basic context capabilities
      const contextType = typeof ctx;
      if (contextType !== 'object') {
        validation.isValid = false;
        validation.errors.push(`Context is not object: ${contextType}`);
        return validation;
      }

      // Configure context for optimal performance
      ctx.imageSmoothingEnabled = false; // Crisp rendering for trading data
      validation.configuration.imageSmoothingEnabled = false;

      // Test text rendering capabilities
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      validation.configuration.textRendering = 'configured';

      // Test fill style
      ctx.fillStyle = '#111827';
      validation.configuration.fillStyle = 'configured';

      // Test clear rect
      ctx.clearRect(0, 0, 1, 1);
      validation.configuration.clearRect = 'functional';

      console.log(`✅ [${operationId}] Canvas context validation and configuration successful`, {
        configuration: validation.configuration,
        contextType: ctx.constructor.name,
        canvasId: canvas.id || 'no-id'
      });

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Context configuration error: ${error.message}`);
      console.error(`❌ [${operationId}] Canvas context configuration failed:`, error);
    }

    return validation;
  }

  // 🎨 CANVAS SIZING VALIDATION: Verify canvas dimensions and coordinate system
  function validateCanvasSizing(canvas, canvasSizingConfig, operationId) {
    const validation = {
      isValid: true,
      warnings: []
    };

    console.log(`🔍 [${operationId}] Validating canvas sizing`);

    if (!canvas || !canvasSizingConfig) {
      validation.warnings.push('Missing canvas or sizing config');
      return validation;
    }

    const { dimensions } = canvasSizingConfig;
    const actualCanvas = { width: canvas.width, height: canvas.height };
    const expectedCanvas = dimensions.canvas;

    // Check canvas dimensions match configuration
    const widthMatch = Math.abs(actualCanvas.width - expectedCanvas.width) <= 1; // Allow 1px rounding
    const heightMatch = Math.abs(actualCanvas.height - expectedCanvas.height) <= 1;

    if (!widthMatch) {
      validation.warnings.push(`Canvas width mismatch: actual=${actualCanvas.width}, expected=${expectedCanvas.width}`);
    }

    if (!heightMatch) {
      validation.warnings.push(`Canvas height mismatch: actual=${actualCanvas.height}, expected=${expectedCanvas.height}`);
    }

    console.log(`🔍 [${operationId}] Canvas sizing validation results`, {
      actualCanvas,
      expectedCanvas,
      widthMatch,
      heightMatch,
      dpr: dimensions.dpr,
      cssDimensions: dimensions.css,
      warnings: validation.warnings
    });

    validation.isValid = widthMatch && heightMatch;
    return validation;
  }

  // 🎨 CANVAS DRAWING CAPABILITIES TEST: Verify canvas can draw basic shapes
  function testCanvasDrawingCapabilities(ctx, canvas, operationId) {
    const testResult = {
      canDraw: true,
      capabilities: {},
      errors: []
    };

    console.log(`🎨 [${operationId}] Testing canvas drawing capabilities`);

    try {
      // Save original state
      ctx.save();

      // Test rectangle drawing
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 1, 1);
      testResult.capabilities.fillRect = true;

      // Test text drawing
      ctx.font = '10px monospace';
      ctx.fillStyle = '#000000';
      ctx.fillText('test', 0, 0);
      testResult.capabilities.fillText = true;

      // Test line drawing
      ctx.strokeStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(1, 1);
      ctx.stroke();
      testResult.capabilities.strokeLine = true;

      // Test state restoration
      ctx.restore();
      testResult.capabilities.stateManagement = true;

      console.log(`✅ [${operationId}] Canvas drawing capabilities verified`, testResult.capabilities);

    } catch (error) {
      testResult.canDraw = false;
      testResult.errors.push(`Drawing test failed: ${error.message}`);
      console.error(`❌ [${operationId}] Canvas drawing capabilities test failed:`, error);
    }

    return testResult;
  }

  // 🎨 FINAL CANVAS STATE VALIDATION: Comprehensive final state check
  function validateFinalCanvasState(canvas, ctx, operationId) {
    const validation = {
      isValid: true,
      errors: []
    };

    console.log(`🔍 [${operationId}] Performing final canvas state validation`);

    // Validate canvas element
    if (!canvas) {
      validation.errors.push('Canvas element is null');
    }

    // Validate context
    if (!ctx) {
      validation.errors.push('Canvas context is null');
    }

    // Validate dimensions
    if (canvas && (canvas.width <= 0 || canvas.height <= 0)) {
      validation.errors.push(`Invalid canvas dimensions: ${canvas.width}x${canvas.height}`);
    }

    validation.isValid = validation.errors.length === 0;

    console.log(`🔍 [${operationId}] Final canvas state validation`, {
      isValid: validation.isValid,
      errors: validation.errors,
      canvasElement: !!canvas,
      canvasContext: !!ctx,
      canvasDimensions: canvas ? { width: canvas.width, height: canvas.height } : null
    });

    return validation;
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
    // Calculate content area from container size (consistent with reactive statement)
    const containerSize = config?.containerSize || { width: canvasWidth, height: canvasHeight };
    const contentArea = {
      width: Math.max(50, containerSize.width),
      height: Math.max(50, containerSize.height)
    };

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

  


  // 🎨 ENHANCED RENDER PIPELINE: Comprehensive render function with detailed logging and VISUAL VERIFICATION TEST
  function render() {
    const operationId = `RENDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const renderStartTime = getPerformanceTime();


    console.log(`🎨 [${operationId}] Starting VISUAL VERIFICATION TEST render pipeline for display ${id}`, {
      timestamp: Date.now(),
      symbol: symbol || 'unknown',
      hasContext: !!ctx,
      hasState: !!state,
      hasConfig: !!config,
      hasCanvas: !!canvas,
      canvasReady,
      canvasError,
      stateReady: state?.ready,
      yScaleAvailable: !!yScale
    });

    // Phase 1: Render Prerequisites Validation
    const prerequisitesValidation = validateRenderPrerequisites(ctx, state, config, canvas, operationId);
    if (!prerequisitesValidation.isValid) {
      console.warn(`⚠️ [${operationId}] Render prerequisites not met`, {
        reasons: prerequisitesValidation.errors,
        critical: prerequisitesValidation.isCritical,
        operationId,
        timestamp: Date.now()
      });

      if (prerequisitesValidation.isCritical) {
        console.error(`🚨 [${operationId}] Critical render prerequisites missing - aborting render`);
        return;
      }
    }

    // Phase 2: Canvas State Validation with ENHANCED VERIFICATION
    const canvasStateValidation = validateCanvasState(ctx, canvas, operationId);
    if (!canvasStateValidation.isValid) {
      console.error(`❌ [${operationId}] Canvas state validation failed`, canvasStateValidation.errors);
      return;
    }

    // 🚨 VISUAL VERIFICATION TEST: CANVAS STATE ANALYSIS
    console.log(`🔍 [${operationId}] ENHANCED CANVAS STATE VERIFICATION`, {
      canvasElement: !!canvas,
      canvasDimensions: canvas ? { width: canvas.width, height: canvas.height } : 'null',
      canvasCSS: canvas ? {
        width: canvas.style.width,
        height: canvas.style.height,
        display: canvas.style.display,
        position: canvas.style.position,
        top: canvas.style.top,
        left: canvas.style.left
      } : 'null',
      contextState: ctx ? {
        fillStyle: ctx.fillStyle,
        strokeStyle: ctx.strokeStyle,
        globalAlpha: ctx.globalAlpha,
        globalCompositeOperation: ctx.globalCompositeOperation,
        font: ctx.font,
        textAlign: ctx.textAlign,
        textBaseline: ctx.textBaseline,
        transform: ctx.getTransform ? ctx.getTransform().toString() : 'unavailable'
      } : 'null',
      containerSize: config?.containerSize,
      contentArea: {
        width: Math.max(50, config?.containerSize?.width || 220),
        height: Math.max(50, config?.containerSize?.height || 120)
      }
    });

    // Phase 3: Create Rendering Context with Detailed Logging
    console.log(`🎨 [${operationId}] Phase 3: Creating rendering context`);
    const contextCreationStartTime = getPerformanceTime();

    const containerSize = config.containerSize || { width: canvasWidth, height: canvasHeight };
    const contentArea = {
      width: Math.max(50, containerSize.width),   // ✅ FULL WIDTH (no padding)
      height: Math.max(50, containerSize.height) // ✅ FULL HEIGHT (no header, no padding)
    };
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

    const contextCreationTime = getPerformanceTime() - contextCreationStartTime;
    console.log(`✅ [${operationId}] Rendering context created`, {
      creationTime: `${contextCreationTime.toFixed(2)}ms`,
      contentArea,
      adrAxisX,
      containerSize,
      renderingContextId: renderingContext.id || 'no-id'
    });

    // Phase 4: Canvas State Preparation with DPR Scaling
    console.log(`🎨 [${operationId}] Phase 4: Preparing canvas state`);
    const canvasPrepStartTime = getPerformanceTime();

    ctx.save();

    // Apply DPR scaling for this render cycle only
    const appliedDpr = canvasSizingConfig && canvasSizingConfig.dimensions.dpr > 1
      ? canvasSizingConfig.dimensions.dpr
      : 1;

    if (appliedDpr > 1) {
      ctx.scale(appliedDpr, appliedDpr);
      console.log(`📏 [${operationId}] DPR scaling applied`, {
        dpr: appliedDpr,
        scalingFactors: [appliedDpr, appliedDpr]
      });
    }

    // Phase 5: Canvas Clearing and Background Setup
    console.log(`🎨 [${operationId}] Phase 5: Clearing canvas and setting background`);
    const clearStartTime = getPerformanceTime();

    if (canvasSizingConfig) {
      const { canvasArea } = canvasSizingConfig.dimensions;
      // Since context is DPR-scaled, use full canvas dimensions (no division by DPR)
      ctx.clearRect(0, 0, canvasArea.width, canvasArea.height);
      // FIX: Restore canvas background fill to make visualizations visible
      // Canvas needs background color for visualizations to be properly displayed
      ctx.fillStyle = '#111827'; // Match CSS background color
      ctx.fillRect(0, 0, canvasArea.width, canvasArea.height);

      console.log(`🎨 [${operationId}] Canvas cleared and background filled using sizing config`, {
        canvasArea,
        backgroundColor: '#111827 (dark background for visualization visibility)'
      });
    } else {
      // Fallback to canvas dimensions
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // FIX: Restore canvas background fill to make visualizations visible
      // Canvas needs background color for visualizations to be properly displayed
      ctx.fillStyle = '#111827'; // Match CSS background color
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      console.log(`⚠️ [${operationId}] Canvas cleared and background filled using fallback dimensions`, {
        canvasDimensions: { width: canvas.width, height: canvas.height },
        backgroundColor: '#111827 (dark background for visualization visibility)',
        warning: 'Using fallback - sizing config missing'
      });
    }

    const clearTime = getPerformanceTime() - clearStartTime;
    console.log(`✅ [${operationId}] Canvas cleared and background set`, {
      clearTime: `${clearTime.toFixed(2)}ms`
    });

    // 🚨 VISUAL VERIFICATION TEST: FORCED VISIBLE SHAPES - PHASE 1
    console.log(`🚨 [${operationId}] VISUAL VERIFICATION TEST: Drawing guaranteed visible test shapes`);
    const testShapesStartTime = getPerformanceTime();

    try {
      // Save current state
      ctx.save();

      // Reset context to known good state for test shapes
      ctx.globalAlpha = 1.0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#FF0000'; // Bright red
      ctx.strokeStyle = '#00FF00'; // Bright green
      ctx.lineWidth = 3;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Test Shape 1: Bright red rectangle covering entire content area
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, contentArea.width, contentArea.height);
      console.log(`🚨 [${operationId}] Test Shape 1: Red rectangle drawn`, {
        dimensions: `${contentArea.width}x${contentArea.height}`,
        color: '#FF0000'
      });

      // Test Shape 2: Green circle in center
      ctx.fillStyle = '#00FF00';
      ctx.beginPath();
      ctx.arc(contentArea.width / 2, contentArea.height / 2, 30, 0, Math.PI * 2);
      ctx.fill();
      console.log(`🚨 [${operationId}] Test Shape 2: Green circle drawn`, {
        center: [contentArea.width / 2, contentArea.height / 2],
        radius: 30,
        color: '#00FF00'
      });

      // Test Shape 3: White text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Arial';
      ctx.fillText('VISUAL TEST', contentArea.width / 2, contentArea.height / 2);
      console.log(`🚨 [${operationId}] Test Shape 3: White text drawn`, {
        text: 'VISUAL TEST',
        position: [contentArea.width / 2, contentArea.height / 2],
        color: '#FFFFFF'
      });

      // Test Shape 4: Blue border
      ctx.strokeStyle = '#0000FF';
      ctx.lineWidth = 5;
      ctx.strokeRect(5, 5, contentArea.width - 10, contentArea.height - 10);
      console.log(`🚨 [${operationId}] Test Shape 4: Blue border drawn`, {
        dimensions: `${contentArea.width - 10}x${contentArea.height - 10}`,
        lineWidth: 5,
        color: '#0000FF'
      });

      // Test Shape 5: Yellow corners
      ctx.fillStyle = '#FFFF00';
      const cornerSize = 10;
      // Top-left
      ctx.fillRect(0, 0, cornerSize, cornerSize);
      // Top-right
      ctx.fillRect(contentArea.width - cornerSize, 0, cornerSize, cornerSize);
      // Bottom-left
      ctx.fillRect(0, contentArea.height - cornerSize, cornerSize, cornerSize);
      // Bottom-right
      ctx.fillRect(contentArea.width - cornerSize, contentArea.height - cornerSize, cornerSize, cornerSize);
      console.log(`🚨 [${operationId}] Test Shape 5: Yellow corners drawn`, {
        cornerSize,
        color: '#FFFF00'
      });

      // Restore context state
      ctx.restore();

      const testShapesTime = getPerformanceTime() - testShapesStartTime;
      console.log(`✅ [${operationId}] VISUAL VERIFICATION TEST: Test shapes drawn successfully`, {
        testShapesTime: `${testShapesTime.toFixed(2)}ms`,
        shapesDrawn: 5,
        visibility: 'GUARANTEED - should be visible regardless of data'
      });

    } catch (error) {
      console.error(`❌ [${operationId}] VISUAL VERIFICATION TEST: Failed to draw test shapes`, {
        error: error.message,
        stack: error.stack
      });
    }

    // Phase 6: Symbol Background Rendering
    console.log(`🎨 [${operationId}] Phase 6: Rendering symbol background`);
    const symbolBgStartTime = getPerformanceTime();

    renderSymbolBackground();

    const symbolBgTime = getPerformanceTime() - symbolBgStartTime;
    console.log(`✅ [${operationId}] Symbol background rendered`, {
      symbolBgTime: `${symbolBgTime.toFixed(2)}ms`,
      symbol: symbol || 'none'
    });

    const canvasPrepTime = getPerformanceTime() - canvasPrepStartTime;
    console.log(`✅ [${operationId}] Canvas preparation completed`, {
      prepTime: `${canvasPrepTime.toFixed(2)}ms`,
      dprApplied: appliedDpr,
      phases: {
        contextCreation: contextCreationTime,
        clearOperation: clearTime,
        testShapes: getPerformanceTime() - testShapesStartTime,
        symbolBackground: symbolBgTime
      }
    });

    // 🚨 VISUAL VERIFICATION TEST: DATA FLOW ANALYSIS
    console.log(`🔍 [${operationId}] VISUAL VERIFICATION TEST: Analyzing data flow to visualizations`, {
      stateAvailable: !!state,
      stateKeys: state ? Object.keys(state) : [],
      stateReady: state?.ready,
      hasMarketData: {
        currentPrice: !!state?.currentPrice,
        midPrice: !!state?.midPrice,
        visualLow: !!state?.visualLow,
        visualHigh: !!state?.visualHigh,
        volatility: !!state?.volatility,
        direction: !!state?.direction
      },
      yScaleAvailable: !!yScale,
      yScaleFunctional: yScale ? typeof yScale === 'function' : false,
      marketDataValues: {
        currentPrice: state?.currentPrice,
        midPrice: state?.midPrice,
        visualLow: state?.visualLow,
        visualHigh: state?.visualHigh,
        volatility: state?.volatility,
        direction: state?.direction,
        ready: state?.ready
      }
    });

    // Phase 7: Visualization Rendering with Comprehensive Error Handling and VISUAL VERIFICATION TEST
    if (state.visualLow && state.visualHigh && yScale) {
      console.log(`🎨 [${operationId}] Phase 7: Starting visualization rendering`);

      try {
        // ✅ PRECISION VALIDATION: Track first render with mathematical precision validation
        if (!renderingContext.firstRenderLogged && precisionValidator) {
          console.log(`🎯 [${operationId}] First render detected - precision validation initiated`);
          renderingContext.firstRenderLogged = true;
        }

        // 🚨 VISUAL VERIFICATION TEST: VISUAL REGRESSION COMPARISON
        console.log(`🚨 [${operationId}] VISUAL VERIFICATION TEST: Comparing actual visualizations vs test shapes`);
        const actualVisualizationStartTime = getPerformanceTime();

        // Save canvas state with test shapes for comparison
        ctx.save();

        // 🚨 SUB-TEST: Draw actual visualizations OVER test shapes to see which wins
        console.log(`🚨 [${operationId}] VISUAL VERIFICATION TEST: Drawing actual visualizations over test shapes`);

        // 🎯 ENHANCED DIRECT IMPORT DEBUG: Draw visualizations with comprehensive error handling
        const visualizationStartTime = getPerformanceTime();
        const visualizationResults = [];

        // Render each visualization with detailed error tracking
        const visualizations = [
          { name: 'VolatilityOrb', func: drawVolatilityOrb, params: [ctx, renderingContext, config, state, yScale] },
          { name: 'MarketProfile', func: drawMarketProfile, params: [ctx, renderingContext, config, state, yScale] },
          { name: 'DayRangeMeter', func: drawDayRangeMeter, params: [ctx, renderingContext, config, state, yScale] },
          { name: 'PriceFloat', func: drawPriceFloat, params: [ctx, renderingContext, config, state, yScale] },
          { name: 'PriceDisplay', func: drawPriceDisplay, params: [ctx, renderingContext, config, state, yScale] },
          { name: 'VolatilityMetric', func: drawVolatilityMetric, params: [ctx, renderingContext, config, state] },
          { name: 'PriceMarkers', func: drawPriceMarkers, params: [ctx, renderingContext, config, state, yScale, markers] }
        ];

        console.log(`🎨 [${operationId}] Processing ${visualizations.length} visualizations`, {
          availableFunctions: visualizations.filter(v => !!v.func).length
        });

        for (let vizIndex = 0; vizIndex < visualizations.length; vizIndex++) {
          const viz = visualizations[vizIndex];
          const vizOperationId = `${operationId}_VIZ_${vizIndex}_${viz.name}`;
          const vizStartTime = getPerformanceTime();
          let vizResult = {
            success: false,
            error: null,
            executionTime: 0,
            name: viz.name
          };

          console.log(`🎨 [${vizOperationId}] Starting visualization ${viz.name}`, {
            index: vizIndex,
            totalVisualizations: visualizations.length,
            hasFunction: !!viz.func,
            functionType: viz.func ? typeof viz.func : 'null',
            parameters: viz.params.length
          });

          try {
            // 🎨 VISUALIZATION PREREQUISITES: Static imports guarantee functions are available
            if (typeof viz.func !== 'function') {
              throw new Error(`Visualization is not a function: ${viz.name} (${typeof viz.func})`);
            }

            // 🎨 PRE-CALL VALIDATION: Validate canvas context before visualization
            const contextCheck = validateCanvasContextForVisualization(ctx, vizOperationId);
            if (!contextCheck.isValid) {
              throw new Error(`Canvas context validation failed: ${contextCheck.errors.join(', ')}`);
            }

            // 🎨 VISUALIZATION EXECUTION: Call visualization with detailed error context
            console.log(`🎨 [${vizOperationId}] Executing visualization ${viz.name}`);
            viz.func(...viz.params);

            vizResult.success = true;
            vizResult.executionTime = getPerformanceTime() - vizStartTime;

            // ✅ SUCCESS: Log successful visualization render
            console.log(`✅ [${vizOperationId}] ${viz.name} rendered successfully`, {
              executionTime: `${vizResult.executionTime.toFixed(2)}ms`,
              parameters: viz.params.length,
              symbol: symbol,
              canvasState: {
                transform: ctx.getTransform ? ctx.getTransform().toString() : 'unavailable',
                fillStyle: ctx.fillStyle,
                font: ctx.font
              }
            });

          } catch (error) {
            vizResult.error = error.message;
            vizResult.executionTime = getPerformanceTime() - vizStartTime;

            // ❌ ERROR: Log detailed failure information
            console.error(`❌ [${vizOperationId}] ${viz.name} render failed`, {
              error: error.message,
              stack: error.stack,
              executionTime: `${vizResult.executionTime.toFixed(2)}ms`,
              hasFunction: !!viz.func,
              functionType: viz.func ? typeof viz.func : 'null',
              parameters: viz.params.length,
              symbol: symbol,
              canvasState: {
                hasContext: !!ctx,
                contextType: ctx ? ctx.constructor.name : 'none'
              }
            });

            // 🚨 CRITICAL: Static imports should never fail - this indicates import issues
            if (process.env.NODE_ENV === 'development') {
              console.error(`🚨 [${vizOperationId}] CRITICAL: Static import failed for ${viz.name} - check import path and exports`);
              throw new Error(`Critical: Static import failed for ${viz.name} - check import path and exports`);
            }
          }

          visualizationResults.push(vizResult);

          // Log performance metrics with detailed context
          try {
            logVisualizationPerformance(id, viz.name, vizStartTime, renderingContext, state);
            console.log(`📊 [${vizOperationId}] Performance metrics logged for ${viz.name}`);
          } catch (logError) {
            console.warn(`⚠️ [${vizOperationId}] Performance logging failed for ${viz.name}:`, logError.message);
          }
        }

        // 📊 VISUALIZATION SUMMARY: Comprehensive performance analysis
        const totalRenderTime = getPerformanceTime() - visualizationStartTime;
        const successfulVisualizations = visualizationResults.filter(r => r.success).length;
        const failedVisualizations = visualizationResults.filter(r => !r.success).length;
        const meets60fps = totalRenderTime <= 16.67;

        console.log(`📊 [${operationId}] Visualization rendering completed`, {
          summary: {
            total: visualizationResults.length,
            successful: successfulVisualizations,
            failed: failedVisualizations,
            successRate: `${((successfulVisualizations / visualizationResults.length) * 100).toFixed(1)}%`
          },
          performance: {
            totalTime: `${totalRenderTime.toFixed(2)}ms`,
            averageVizTime: `${(totalRenderTime / visualizationResults.length).toFixed(2)}ms`,
            meets60fps,
            targetTime: '16.67ms'
          },
          context: {
            symbol,
            displayId: id,
            operationId,
            contentArea,
            dpr: appliedDpr
          },
          details: visualizationResults.map(r => ({
            name: r.name,
            success: r.success,
            time: `${r.executionTime.toFixed(2)}ms`,
            error: r.error
          }))
        });

        if (!meets60fps) {
          console.warn(`⚠️ [${operationId}] Performance warning: Total render time ${totalRenderTime.toFixed(2)}ms exceeds 60fps target`, {
            overrun: `${(totalRenderTime - 16.67).toFixed(2)}ms`,
            percentOverTarget: `${((totalRenderTime / 16.67 - 1) * 100).toFixed(1)}%`
          });
        }

        if (failedVisualizations > 0) {
          console.error(`❌ [${operationId}] ${failedVisualizations} visualizations failed to render`);
          if (process.env.NODE_ENV === 'development') {
            console.group(`🔍 [${operationId}] Failed Visualization Details`);
            visualizationResults.filter(r => !r.success).forEach(r => {
              console.error(`${r.name}: ${r.error}`);
            });
            console.groupEnd();
          }
        }

        // Log render trigger analysis
        console.log(`🔍 [${operationId}] Render trigger analysis`, {
          stateUpdate: state?.ready,
          configChange: !!config,
          yScaleChange: !!yScale,
          canvasReady
        });

      } catch (error) {
        // ✅ PRECISION VALIDATION: Track render errors
        console.error(`❌ [${operationId}] Critical render error for ${symbol}`, {
          error: error.message,
          stack: error.stack,
          hasCanvas: !!ctx,
          hasRenderingContext: !!renderingContext,
          hasYScale: !!yScale,
          hasState: !!state,
          hasConfig: !!config,
          canvasReady,
          stateReady: state?.ready
        });

        console.error(`[RENDER] Error in visualization functions:`, error);
      }
    } else {
      console.log(`🎨 [${operationId}] Skipping visualization rendering`, {
        reason: 'Prerequisites not met',
        hasVisualLow: !!state?.visualLow,
        hasVisualHigh: !!state?.visualHigh,
        hasYScale: !!yScale,
        stateReady: state?.ready
      });

      // 🚨 VISUAL VERIFICATION TEST: FINAL VERIFICATION - Test shapes should still be visible
      console.log(`🚨 [${operationId}] VISUAL VERIFICATION TEST: FINAL VERIFICATION`, {
        status: 'Test shapes should be visible regardless of market data',
        expectedBehavior: 'Bright red background with green circle and white "VISUAL TEST" text',
        troubleshooting: {
          ifStillBlack: [
            'Canvas drawing operations may be failing',
            'Context might be corrupted or invisible',
            'Canvas could be positioned outside viewport',
            'CSS issues might be hiding the canvas',
            'Browser rendering pipeline issues'
          ],
          checkBrowser: [
            'Open browser developer tools',
            'Inspect canvas element and its computed styles',
            'Check if canvas dimensions are valid',
            'Verify canvas is within viewport bounds',
            'Look for CSS transform issues'
          ]
        }
      });
    }

    // Phase 8: Canvas State Cleanup
    console.log(`🎨 [${operationId}] Phase 8: Cleaning up canvas state`);
    const cleanupStartTime = getPerformanceTime();

    ctx.restore();

    // 🔧 CRITICAL FIX: Explicit reset to identity matrix to prevent drift
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const cleanupTime = getPerformanceTime() - cleanupStartTime;

    // Final render completion logging
    const totalRenderTime = getPerformanceTime() - renderStartTime;
    const meetsPerformanceTarget = totalRenderTime <= 16.67;

    // 🎨 CANVAS STATE MONITORING: Track render completion
    updateCanvasState('render_completed', {
      renderTime: totalRenderTime,
      operationId,
      meetsPerformanceTarget,
      phases: {
        contextCreation: contextCreationTime,
        canvasPreparation: canvasPrepTime,
        cleanup: cleanupTime
      }
    });

    console.log(`🎉 [${operationId}] VISUAL VERIFICATION TEST: Render pipeline completed`, {
      totalTime: `${totalRenderTime.toFixed(2)}ms`,
      performanceTarget: meetsPerformanceTarget ? '60fps' : 'suboptimal',
      phases: {
        prerequisites: 'validated',
        canvasState: 'validated',
        contextCreation: `${contextCreationTime.toFixed(2)}ms`,
        canvasPreparation: `${canvasPrepTime.toFixed(2)}ms`,
        testShapes: 'DRAWN - should be visible',
        visualizations: state?.visualLow && state?.visualHigh && yScale ? 'executed' : 'skipped',
        cleanup: `${cleanupTime.toFixed(2)}ms`
      },
      finalState: {
        canvasReady,
        contextRestored: true,
        transformReset: true
      },
      visualVerificationTest: {
        status: 'COMPLETED',
        expectedResult: 'Bright red canvas with green circle, white text, blue border, yellow corners',
        ifNotVisible: [
          'Canvas context may be corrupted',
          'Drawing operations failing silently',
          'CSS positioning issues',
          'Browser rendering pipeline problems'
        ],
        nextSteps: [
          'Check browser developer tools console for errors',
          'Inspect canvas element in DOM',
          'Verify canvas computed styles',
          'Test with forced refresh (Ctrl+Shift+W on display, then recreate)'
        ]
      },
      success: true
    });

    // 🎨 PERFORMANCE MONITORING: Check for performance issues
    if (!meetsPerformanceTarget) {
      const performanceIssue = {
        overrun: totalRenderTime - 16.67,
        percentOver: ((totalRenderTime / 16.67 - 1) * 100),
        recommendations: totalRenderTime > 33.34 ?
          ['Consider optimizing visualizations', 'Check for memory leaks', 'Reduce visualization complexity'] :
          ['Minor optimization needed']
      };

      console.warn(`⚠️ [${operationId}] Performance target missed: ${totalRenderTime.toFixed(2)}ms > 16.67ms`, performanceIssue);

      // 🎨 CANVAS STATE MONITORING: Track performance issues
      updateCanvasState('performance_issue', {
        renderTime: totalRenderTime,
        overrun: performanceIssue.overrun,
        percentOver: performanceIssue.percentOver,
        operationId
      });

      // 🎨 CANVAS DEBUG SNAPSHOT: Capture snapshot on performance issues
      if (totalRenderTime > 50) { // Serious performance degradation
        captureCanvasSnapshot(operationId, 'performance_degradation');
      }
    }

    // 🎨 HEALTH MONITORING: Periodic health check (every 10 renders)
    if (canvasPerformanceMetrics.renderCount > 0 && canvasPerformanceMetrics.renderCount % 10 === 0) {
      console.log(`🏥 [${operationId}] Periodic health check triggered (render count: ${canvasPerformanceMetrics.renderCount})`);
      performCanvasHealthCheck(operationId);
    }
  }

  // 🎨 RENDER PREREQUISITES VALIDATION: Check all render prerequisites
  function validateRenderPrerequisites(ctx, state, config, canvas, operationId) {
    const validation = {
      isValid: true,
      isCritical: false,
      errors: []
    };

    console.log(`🔍 [${operationId}] Validating render prerequisites`);

    // Check for critical components
    if (!ctx) {
      validation.errors.push('Canvas context is null');
      validation.isCritical = true;
    }

    if (!canvas) {
      validation.errors.push('Canvas element is null');
      validation.isCritical = true;
    }

    if (!config) {
      validation.errors.push('Config is null');
      validation.isCritical = true;
    }

    // Check for state issues (non-critical for initial renders)
    if (!state) {
      validation.errors.push('State is null (may be loading)');
      validation.isCritical = false; // Allow render to proceed for loading states
    }

    console.log(`🔍 [${operationId}] Render prerequisites validation`, {
      isValid: validation.isValid,
      isCritical: validation.isCritical,
      errorCount: validation.errors.length,
      errors: validation.errors
    });

    return validation;
  }

  // 🎨 CANVAS STATE VALIDATION: Comprehensive canvas state check
  function validateCanvasState(ctx, canvas, operationId) {
    const validation = {
      isValid: true,
      errors: []
    };

    console.log(`🔍 [${operationId}] Validating canvas state`);

    try {
      if (!ctx) {
        validation.errors.push('Canvas context is null');
      } else {
        // Test basic canvas operations
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();

        console.log(`🔍 [${operationId}] Canvas context test passed`);
      }

      if (!canvas) {
        validation.errors.push('Canvas element is null');
      } else {
        // Check canvas dimensions
        if (canvas.width <= 0 || canvas.height <= 0) {
          validation.errors.push(`Invalid canvas dimensions: ${canvas.width}x${canvas.height}`);
        }

        console.log(`🔍 [${operationId}] Canvas element validation passed`, {
          dimensions: `${canvas.width}x${canvas.height}`,
          tagName: canvas.tagName
        });
      }

    } catch (error) {
      validation.errors.push(`Canvas state test failed: ${error.message}`);
      console.error(`❌ [${operationId}] Canvas state validation error:`, error);
    }

    validation.isValid = validation.errors.length === 0;

    console.log(`🔍 [${operationId}] Canvas state validation completed`, {
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      errors: validation.errors
    });

    return validation;
  }

  // 🎨 CANVAS CONTEXT VALIDATION FOR VISUALIZATION: Pre-visualization context check
  function validateCanvasContextForVisualization(ctx, operationId) {
    const validation = {
      isValid: true,
      errors: []
    };

    try {
      if (!ctx) {
        validation.errors.push('Context is null');
        return validation;
      }

      // Test fill style
      const originalFillStyle = ctx.fillStyle;
      ctx.fillStyle = '#000000';
      if (ctx.fillStyle !== '#000000') {
        validation.errors.push('Fill style cannot be set');
      }
      ctx.fillStyle = originalFillStyle;

      // Test font
      const originalFont = ctx.font;
      ctx.font = '12px monospace';
      if (ctx.font !== '12px monospace') {
        validation.errors.push('Font cannot be set');
      }
      ctx.font = originalFont;

    } catch (error) {
      validation.errors.push(`Context validation error: ${error.message}`);
    }

    validation.isValid = validation.errors.length === 0;
    return validation;
  }

  // 🎨 CANVAS STATE MONITORING: Comprehensive canvas lifecycle tracking
  function updateCanvasState(event, data = {}) {
    const timestamp = Date.now();
    const stateEntry = {
      timestamp,
      event,
      data,
      canvasReady,
      canvasError,
      canvasRetries,
      hasContext: !!ctx,
      hasCanvas: !!canvas
    };

    // Add to history (keep last 50 entries)
    canvasStateHistory.push(stateEntry);
    if (canvasStateHistory.length > 50) {
      canvasStateHistory = canvasStateHistory.slice(-50);
    }

    console.log(`📊 [CANVAS_STATE:${id}] ${event}`, {
      timestamp,
      stateEntry,
      historyLength: canvasStateHistory.length,
      performanceMetrics: { ...canvasPerformanceMetrics }
    });

    // Update performance metrics
    if (event === 'render_completed' && data.renderTime) {
      canvasPerformanceMetrics.renderCount++;
      canvasPerformanceMetrics.lastRenderTime = data.renderTime;

      const totalRenderTime = canvasPerformanceMetrics.averageRenderTime * (canvasPerformanceMetrics.renderCount - 1) + data.renderTime;
      canvasPerformanceMetrics.averageRenderTime = totalRenderTime / canvasPerformanceMetrics.renderCount;
    }

    if (event === 'initialization_completed' && data.initTime) {
      canvasPerformanceMetrics.initializationTime = data.initTime;
    }

    if (event === 'error') {
      canvasPerformanceMetrics.errors.push({
        timestamp,
        error: data.error,
        context: data.context
      });

      // Keep only last 20 errors
      if (canvasPerformanceMetrics.errors.length > 20) {
        canvasPerformanceMetrics.errors = canvasPerformanceMetrics.errors.slice(-20);
      }
    }
  }

  // 🎨 CANVAS HEALTH CHECK: Comprehensive canvas health monitoring
  function performCanvasHealthCheck(operationId) {
    console.log(`🏥 [${operationId}] Performing comprehensive canvas health check`);
    const healthCheckStartTime = getPerformanceTime();

    const healthReport = {
      isHealthy: true,
      issues: [],
      warnings: [],
      metrics: {
        stateHistory: canvasStateHistory.length,
        errorCount: canvasPerformanceMetrics.errors.length,
        renderCount: canvasPerformanceMetrics.renderCount,
        averageRenderTime: canvasPerformanceMetrics.averageRenderTime,
        initializationTime: canvasPerformanceMetrics.initializationTime
      }
    };

    // Check canvas element health
    if (!canvas) {
      healthReport.isHealthy = false;
      healthReport.issues.push('Canvas element is null');
    } else {
      if (canvas.width <= 0 || canvas.height <= 0) {
        healthReport.isHealthy = false;
        healthReport.issues.push(`Invalid canvas dimensions: ${canvas.width}x${canvas.height}`);
      }

      // Check for canvas memory leaks (basic check)
      const imageData = ctx?.getImageData(0, 0, 1, 1);
      if (!imageData) {
        healthReport.warnings.push('Cannot read canvas pixel data - potential context issue');
      }
    }

    // Check context health
    if (!ctx) {
      healthReport.isHealthy = false;
      healthReport.issues.push('Canvas context is null');
    } else {
      // Test basic context operations
      try {
        const testState = ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
      } catch (error) {
        healthReport.isHealthy = false;
        healthReport.issues.push(`Canvas context operation failed: ${error.message}`);
      }
    }

    // Check performance health
    if (canvasPerformanceMetrics.renderCount > 0) {
      const fpsTarget = 16.67; // 60fps target
      const currentFps = canvasPerformanceMetrics.averageRenderTime;

      if (currentFps > fpsTarget * 2) { // More than 2x slower than 60fps
        healthReport.warnings.push(`Performance degradation: ${(currentFps / fpsTarget).toFixed(1)}x slower than 60fps target`);
      }
    }

    // Check error rate
    if (canvasPerformanceMetrics.errors.length > 5) {
      healthReport.warnings.push(`High error rate: ${canvasPerformanceMetrics.errors.length} errors recorded`);
    }

    // Check initialization health
    if (canvasRetries >= MAX_CANVAS_RETRIES) {
      healthReport.isHealthy = false;
      healthReport.issues.push(`Maximum initialization retries exceeded: ${canvasRetries}/${MAX_CANVAS_RETRIES}`);
    }

    const healthCheckTime = getPerformanceTime() - healthCheckStartTime;

    console.log(`🏥 [${operationId}] Canvas health check completed`, {
      isHealthy: healthReport.isHealthy,
      checkTime: `${healthCheckTime.toFixed(2)}ms`,
      issues: healthReport.issues.length,
      warnings: healthReport.warnings.length,
      metrics: healthReport.metrics
    });

    if (!healthReport.isHealthy) {
      console.error(`🚨 [${operationId}] Canvas health issues detected:`, healthReport.issues);
    }

    if (healthReport.warnings.length > 0) {
      console.warn(`⚠️ [${operationId}] Canvas health warnings:`, healthReport.warnings);
    }

    return healthReport;
  }

  // 🎨 CANVAS DEBUG SNAPSHOT: Capture current canvas state for debugging
  function captureCanvasSnapshot(operationId, reason = 'manual') {
    console.log(`📸 [${operationId}] Capturing canvas snapshot`, { reason });

    const snapshot = {
      timestamp: Date.now(),
      reason,
      state: {
        canvasReady,
        canvasError,
        canvasRetries,
        hasContext: !!ctx,
        hasCanvas: !!canvas,
        stateReady: state?.ready
      },
      canvas: canvas ? {
        width: canvas.width,
        height: canvas.height,
        tagName: canvas.tagName,
        className: canvas.className,
        id: canvas.id
      } : null,
      context: ctx ? {
        fillStyle: ctx.fillStyle,
        font: ctx.font,
        textAlign: ctx.textAlign,
        textBaseline: ctx.textBaseline,
        imageSmoothingEnabled: ctx.imageSmoothingEnabled,
        transform: ctx.getTransform ? ctx.getTransform().toString() : 'unavailable'
      } : null,
      performance: { ...canvasPerformanceMetrics },
      stateHistory: canvasStateHistory.slice(-10), // Last 10 entries
      contentArea: config?.containerSize ? {
        width: Math.max(50, config.containerSize.width),
        height: Math.max(50, config.containerSize.height)
      } : null
    };

    console.log(`📸 [${operationId}] Canvas snapshot captured`, snapshot);
    updateCanvasState('snapshot_captured', { reason, snapshot });

    return snapshot;
  }
  
  // ✅ ENHANCED CANVAS INITIALIZATION TRIGGER: Initialize canvas when ready with comprehensive logging
  $: canvasInitTrigger: if (canvas && !canvasReady && !canvasInitializing && state?.ready) {
    console.log(`🎨 [CANVAS_TRIGGER:${id}] Canvas initialization triggered`, {
      hasCanvas: !!canvas,
      canvasReady,
      canvasInitializing,
      canvasRetries,
      stateReady: state?.ready,
      symbol,
      timestamp: Date.now()
    });

    // Add small delay to ensure DOM is fully ready
    setTimeout(() => {
      if (canvas && !canvasReady && !canvasInitializing) {
        initializeCanvas();
      }
    }, 0);
  }

  // ✅ RENDER TRIGGER: Simple reactive render trigger
  $: renderTrigger: if (state && config && yScale && canvasReady) {
    scheduleRender();
  }
  
  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Destroy lifecycle with enhanced memory management
  onDestroy(async () => {
    console.log(`[FLOATING_DISPLAY:${id}] Starting component destruction`);
    const destructionStartTime = performance.now();

    try {
      // 🔧 PERFORMANCE FIX: Cancel pending requestAnimationFrame callbacks
      if (movementRafId) {
        cancelAnimationFrame(movementRafId);
        movementRafId = null;
      }
      if (resizeRafId) {
        cancelAnimationFrame(resizeRafId);
        resizeRafId = null;
      }

      // Clear pending operations
      pendingMovement = null;
      pendingResize = null;

      // ✅ MEMORY MANAGEMENT: Execute comprehensive cleanup using cleanup manager
      if (cleanupManager) {
        const cleanupResults = await cleanupManager.destroy();

        // Log cleanup performance metrics
        const cleanupTime = performance.now() - destructionStartTime;
        if (!cleanupResults.meetsPerformanceTarget) {
          console.warn(`[FLOATING_DISPLAY:${id}] Cleanup performance exceeded target: ${cleanupTime.toFixed(2)}ms`);
        }

        console.log(`[FLOATING_DISPLAY:${id}] Cleanup summary:`, {
          totalTime: cleanupTime.toFixed(2),
          meetsTarget: cleanupResults.meetsPerformanceTarget,
          resourcesCleaned: cleanupResults.resourceResults.cleanedResources,
          phasesCompleted: cleanupResults.phaseResults.completedPhases
        });
      } else {
        // Fallback cleanup if cleanup manager wasn't initialized
        console.warn(`[FLOATING_DISPLAY:${id}] Cleanup manager not available, using fallback cleanup`);
        await fallbackCleanup();
      }

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

      // Execute legacy cleanup functions for backward compatibility
      cleanupComponent();
      unsubscribeStores();
      stopPerformanceMonitoring();

      // Final memory usage recording
      globalMemoryTracker.recordUsage();

      const totalDestructionTime = performance.now() - destructionStartTime;
      console.log(`[FLOATING_DISPLAY:${id}] Component destruction completed in ${totalDestructionTime.toFixed(2)}ms`);

    } catch (error) {
      console.error(`[FLOATING_DISPLAY:${id}] Error during component destruction:`, error);
    }
  });

  // ✅ MEMORY MANAGEMENT: Fallback cleanup for legacy support
  async function fallbackCleanup() {
    console.log(`[FLOATING_DISPLAY:${id}] Executing fallback cleanup`);

    // Phase 1: Clean up interactions
    if (interactable) {
      try {
        workspaceGrid.unregisterInteractInstance(interactable);
        interactable.unset();
        interactable = null;
      } catch (error) {
        console.warn(`[FLOATING_DISPLAY:${id}] Error cleaning up interactable:`, error);
      }
    }

    // Phase 2: Clean up animations
    if (renderFrame) {
      try {
        cancelAnimationFrame(renderFrame);
        renderFrame = null;
      } catch (error) {
        console.warn(`[FLOATING_DISPLAY:${id}] Error canceling render frame:`, error);
      }
    }

    // Phase 3: Clean up canvas resources
    if (ctx) {
      try {
        if (canvas) {
          ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
        }
        ctx = null;
      } catch (error) {
        console.warn(`[FLOATING_DISPLAY:${id}] Error cleaning up canvas context:`, error);
      }
    }

    // Phase 4: Clean up timeouts
    if (headerTimeout) {
      try {
        clearTimeout(headerTimeout);
        headerTimeout = null;
      } catch (error) {
        console.warn(`[FLOATING_DISPLAY:${id}] Error clearing header timeout:`, error);
      }
    }

    // Phase 5: Clean up zoom detector
    if (cleanupZoomDetector) {
      try {
        cleanupZoomDetector();
        cleanupZoomDetector = null;
      } catch (error) {
        console.warn(`[FLOATING_DISPLAY:${id}] Error cleaning up zoom detector:`, error);
      }
    }

    // Reset component state
    canvasReady = false;
    canvasError = false;
  }

  // 🎨 GLOBAL CANVAS DEBUGGING: Expose canvas debugging functions for development
  if (process.env.NODE_ENV === 'development') {
    // Make canvas monitoring available globally for debugging
    window[`canvasDebug_${id}`] = {
      getStateHistory: () => [...canvasStateHistory],
      getPerformanceMetrics: () => ({ ...canvasPerformanceMetrics }),
      captureSnapshot: (reason) => captureCanvasSnapshot(`DEBUG_${Date.now()}`, reason || 'manual_debug'),
      performHealthCheck: () => performCanvasHealthCheck(`DEBUG_${Date.now()}`),
      getCanvasState: () => ({
        canvasReady,
        canvasError,
        canvasRetries,
        hasContext: !!ctx,
        hasCanvas: !!canvas,
        stateReady: state?.ready
      })
    };

    console.log(`🔧 [DEBUG:${id}] Canvas debugging interface exposed`, {
      globalKey: `canvasDebug_${id}`,
      availableMethods: ['getStateHistory', 'getPerformanceMetrics', 'captureSnapshot', 'performHealthCheck', 'getCanvasState']
    });
  }
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
    /* 🔧 CRITICAL ALIGNMENT FIX: Remove ALL padding and margins to achieve zero offset */
    padding: 0px;
    margin: 0px;
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
    /* DEBUGGER: Simplified canvas positioning - fill available content area exactly */
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    margin: 0px;
    padding: 0px;
    border: none;
    border-radius: 4px; /* Account for container border radius */
    /* cursor removed - let interact.js control resize cursors */
    /* FIXED: Removed pointer-events: none - was breaking keyboard shortcuts after canvas creation */

    /* ✅ PERFORMANCE: Hardware acceleration for smooth rendering */
    transform: translateZ(0); /* Force hardware acceleration */
    /* 🔧 CRITICAL ALIGNMENT FIX: No overflow to maintain strict boundaries */
    overflow: hidden;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    /* 🔧 CRITICAL ALIGNMENT FIX: Position to account for container border (2px offset) */
    position: absolute;
    top: -2px;  /* Offset by border width to align with container edge */
    left: -2px; /* Offset by border width to align with container edge */
    /* 🔧 CRITICAL ALIGNMENT FIX: Include border in dimensions for perfect alignment */
    width: calc(100% + 4px);  /* Add 2px border on each side */
    height: calc(100% + 4px); /* Add 2px border on each side */
    margin: 0px;
    padding: 0px;
    color: #6b7280;
    gap: 8px;
    background: #111827;
    /* 🔧 CRITICAL ALIGNMENT FIX: Match container border radius exactly */
    border-radius: 6px;
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
