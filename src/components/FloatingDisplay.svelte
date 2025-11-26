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

  // ✅ CSS CLIP-PATH BOUNDS: Reactive clip-path calculation for Y-axis overflow prevention
  let clipPathBounds = { top: 0, right: 0, bottom: 0, left: 0 };

  // ✅ COORDINATE SYSTEM: Reactive coordinate system info for performance
  let coordinateSystemInfo = null;
  $: coordinateSystemInfo = coordinateActions.getSystemInfo();

  // Enhanced Y-axis overflow detection with dynamic clipping
  $: if (contentArea && state?.visualLow && state?.visualHigh && yScale && coordinateActions) {
    // Default: no clipping (show full container)
    let topClip = 0;
    let bottomClip = 0;

    // Calculate Y positions for critical price levels
    const extremeHighY = yScale(state.visualHigh * 1.5); // 150% of current high
    const extremeLowY = yScale(state.visualLow * 0.5);  // 50% of current low
    const adrHighY = yScale(state.projectedAdrHigh || state.visualHigh);
    const adrLowY = yScale(state.projectedAdrLow || state.visualLow);

    // 🔧 CRITICAL FIX: Increased overflow tolerance from ±20px to ±50px for normal market movements
    // Detect upward overflow (elements extending above container)
    if (extremeHighY < -50) {
      // Elements extend significantly above container - clip top portion
      topClip = Math.abs(extremeHighY) + 20; // Increased buffer from 10px to 20px
      // 🔧 CRITICAL FIX: Reduced maximum clipping from 30% to 15% to preserve essential trading information
      topClip = Math.min(topClip, contentArea.height * 0.15);
    }

    // Detect downward overflow (elements extending below container)
    if (extremeLowY > contentArea.height + 50) {
      // Elements extend significantly below container - clip bottom portion
      bottomClip = extremeLowY - contentArea.height + 20; // Increased buffer from 10px to 20px
      // 🔧 CRITICAL FIX: Reduced maximum clipping from 30% to 15% to preserve essential trading information
      bottomClip = Math.min(bottomClip, contentArea.height * 0.15);
    }

    // 🔧 CRITICAL FIX: Special handling for ADR boundaries - prevent clipping of essential ADR information
    // Use more conservative clipping for ADR boundaries (essential trading info)
    if (adrHighY < -25) {
      // ADR high extends above - use minimal clipping only if significantly outside
      topClip = Math.max(topClip, Math.abs(adrHighY) + 10);
    }
    if (adrLowY > contentArea.height + 25) {
      // ADR low extends below - use minimal clipping only if significantly outside
      bottomClip = Math.max(bottomClip, adrLowY - contentArea.height + 10);
    }

    // Update clip-path bounds
    clipPathBounds = {
      top: Math.round(topClip),
      right: 0, // No horizontal clipping needed
      bottom: Math.round(bottomClip),
      left: 0   // No horizontal clipping needed
    };

    // 🔧 CRITICAL FIX: Add error handling for coordinate store updates
    try {
      // Update coordinate store with current bounds for reactive transformations
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

    // 🔧 CRITICAL FIX: Add debugging information for clipping behavior
    if (topClip > 0 || bottomClip > 0) {
      console.log('[FLOATING_DISPLAY] Clipping applied:', {
        symbol,
        contentArea: { width: contentArea.width, height: contentArea.height },
        extremeY: { high: extremeHighY, low: extremeLowY },
        adrY: { high: adrHighY, low: adrLowY },
        clipping: { top: topClip, bottom: bottomClip },
        finalBounds: clipPathBounds
      });
    }
  } else {
    // Fallback: no clipping when data unavailable
    clipPathBounds = { top: 0, right: 0, bottom: 0, left: 0 };
  }

  // Reactive clip-path string for CSS with hardware acceleration
  $: cssClipPath = clipPathBounds.top || clipPathBounds.bottom
    ? `inset(${clipPathBounds.top}px ${clipPathBounds.right}px ${clipPathBounds.bottom}px ${clipPathBounds.left}px)`
    : 'none'; // Use 'none' for better performance when no clipping needed

  // ✅ MATHEMATICAL PRECISION VALIDATION: Initialize precision validator and evidence collector
  let precisionValidator;
  let evidenceCollector;
  let displayCreationLogger;
  $: if (id && symbol) {
    precisionValidator = getPrecisionValidator(id, symbol);
    evidenceCollector = getEvidenceCollector(id, symbol);
    displayCreationLogger = getDisplayCreationLogger(id, symbol);
  }

  // ✅ UNIFIED STORE: Simple store binding - no reactive conflicts
  $: display = $displays?.get(id);

  // 🔧 DEBUG: Log displays store content and display lookup
  console.log(`[FLOATING_DISPLAY:${id}] Store lookup`, {
    totalDisplays: $displays?.size || 0,
    displayIds: Array.from($displays?.keys() || []),
    foundDisplay: !!display,
    displayKeys: display ? Object.keys(display) : [],
    hasState: !!(display?.state)
  });

  $: {
    displayPosition = display?.position || position;
    config = display?.config || {};
    const previousState = state; // Track state changes for debugging
    state = display?.state || {}; // ✅ FIXED: Get state from unified displayStore

    // 🔧 DEBUG: Log state changes to diagnose canvas rendering issue
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

    isActive = display?.isActive || false;
    zIndex = display?.zIndex || 1;
    displaySize = display?.size || { width: 220, height: 120 }; // ✅ HEADERLESS: Correct fallback size

    // ✅ PRECISION MONITORING: Track display state changes for precision validation
    if (state?.ready && precisionValidator) {
      // State is ready - precision validation will occur during render phase
    }

    // ✅ ENHANCED LOGGING: Log position and size changes
    logPositionAndSizeChanges();
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

        const yScaleFunction = scaleLinear().domain([centeredVisualLow, centeredVisualHigh]).range([contentArea.height, 0]);

        // ✅ COORDINATE PRECISION VALIDATION: Validate YScale mathematical precision
        if (precisionValidator && contentArea && state) {
          try {
            const canvasDimensions = getCanvasDimensions(contentArea);
            validateCoordinateTransformation(id, yScaleFunction, {
              low: centeredVisualLow,
              high: centeredVisualHigh
            }, canvasDimensions);
          } catch (error) {
            console.warn('[FLOATING_DISPLAY] Coordinate precision validation failed:', error);
          }
        }

        // ✅ BROWSER EVIDENCE: Collect coordinate system evidence
        if (evidenceCollector && canvas && yScaleFunction && state) {
          try {
            collectCoordinateEvidence(id, canvas, yScaleFunction, {
              low: centeredVisualLow,
              high: centeredVisualHigh
            });
          } catch (error) {
            console.warn('[FLOATING_DISPLAY] Coordinate evidence collection failed:', error);
          }
        }

        return yScaleFunction;
      })()
    : null;
  
    
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

            // Update display config to trigger reactive canvas resize
            displayActions.updateDisplayConfig(id, 'containerSize', containerSize);

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
            displayActions.resizeDisplay(id, event.rect.width, event.rect.height);
          },
          onend: () => {
            // ✅ GRID FEEDBACK: Notify workspace grid of resize end
            workspaceGrid.setDraggingState(false);
            // ✅ ENHANCED LOGGING: Reset resize start time
            resizeStartTime = null;
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
  
  // ✅ ATOMIC RESIZE TRANSACTION: Generate unique transaction IDs for tracking
  let transactionCounter = 0;
  function generateTransactionId() {
    return `atomic-${id}-${Date.now()}-${++transactionCounter}`;
  }

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

  // ✅ ATOMIC RESIZE TRANSACTION: Main atomic resize transaction function
  function executeAtomicResizeTransaction(newContentArea, resizeContext = {}) {
    // Prevent concurrent transactions to maintain atomicity
    if (transactionInProgress) {
      console.warn(`[FLOATING_DISPLAY:${id}] Transaction already in progress, queuing new transaction`);
      if (pendingTransaction) {
        // Replace pending transaction with latest
        pendingTransaction = { newContentArea, resizeContext };
      } else {
        pendingTransaction = { newContentArea, resizeContext };
      }
      return;
    }

    transactionInProgress = true;
    const transactionId = generateTransactionId();
    const startTime = getPerformanceTime();
    const oldContentArea = { ...contentArea };

    console.log(`🔄 [RESIZE_TRANSACTION:${id}] Starting atomic resize transaction:`, {
      transactionId,
      oldSize: { width: oldContentArea.width, height: oldContentArea.height },
      newSize: { width: newContentArea.width, height: newContentArea.height },
      trigger: resizeContext.trigger || 'unknown',
      timestamp: startTime
    });

    try {
      // Phase 1: Validate input parameters
      if (!newContentArea || newContentArea.width <= 0 || newContentArea.height <= 0) {
        throw new Error('Invalid contentArea dimensions provided');
      }

      if (!canvas || !ctx) {
        throw new Error('Canvas context not available');
      }

      // Phase 2: Update contentArea BEFORE any other operations (atomic)
      contentArea = { ...newContentArea };

      // Phase 3: Update canvas dimensions FIRST (critical ordering)
      const integerCanvasWidth = Math.round(contentArea.width * dpr);
      const integerCanvasHeight = Math.round(contentArea.height * dpr);
      const cssWidth = integerCanvasWidth / dpr;
      const cssHeight = integerCanvasHeight / dpr;

      canvas.width = integerCanvasWidth;
      canvas.height = integerCanvasHeight;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      // 🔧 CRITICAL FIX: Apply DPR scaling to match physical canvas dimensions
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      // Phase 4: Update coordinate store synchronously
      coordinateActions.updateBounds({
        x: [0, contentArea.width],
        y: [0, contentArea.height]
      });

      // Phase 5: Verify YScale consistency
      const yScaleValidation = validateYScaleConsistency(yScale, state, contentArea);

      // Phase 6: Validate ADR alignment (trading-critical)
      const adrAlignment = CoordinateValidator.validateADRAlignment(yScale, state, contentArea, id);

      // Phase 7: Check overall coordinate synchronization
      const synchronizationCheck = areCoordinatesSynchronized();

      const allValidationsPassed = yScaleValidation.isValid &&
                                  adrAlignment.isValid &&
                                  synchronizationCheck.synchronized;

      // Phase 8: Log comprehensive transaction results
      const transactionDuration = getPerformanceTime() - startTime;

      console.log(`✅ [RESIZE_TRANSACTION:${id}] Transaction completed:`, {
        transactionId,
        duration: `${transactionDuration.toFixed(2)}ms`,
        meets60fpsTarget: transactionDuration <= 16.67,
        validations: {
          yScale: yScaleValidation.isValid,
          adrAlignment: adrAlignment.isValid,
          synchronization: synchronizationCheck.synchronized
        },
        metrics: {
          maxADRDeviation: adrAlignment.maxDeviation,
          yScaleTestResults: yScaleValidation.testCount,
          synchronizationDetails: synchronizationCheck.details
        }
      });

      // Phase 9: Implement graceful validation degradation
      const criticalValidationsPassed = yScaleValidation.isValid && synchronizationCheck.synchronized;

      if (allValidationsPassed) {
        // ✅ All validations passed - proceed with full render
        canvasWidth = contentArea.width;
        canvasHeight = contentArea.height;

        logRenderScheduling(id, 'atomic_resize_complete', {
          transactionId,
          duration: transactionDuration,
          validationsPassed: true
        });

        scheduleRender();

      } else if (criticalValidationsPassed) {
        // ⚠️ Non-critical validation failures (ADR alignment) - render with best effort
        console.warn(`⚠️ [RESIZE_TRANSACTION:${id}] Non-critical validation failures - rendering with best effort:`, {
          transactionId,
          failedValidations: {
            adrAlignment: !adrAlignment.isValid
          },
          errors: {
            adrAlignmentErrors: adrAlignment.testResults.filter(r => !r.passed)
          },
          note: 'Market data will continue to display with reduced positioning accuracy'
        });

        // Update canvas tracking variables and render anyway
        canvasWidth = contentArea.width;
        canvasHeight = contentArea.height;

        logRenderScheduling(id, 'atomic_resize_best_effort', {
          transactionId,
          duration: transactionDuration,
          validationsPassed: false,
          criticalValidationsPassed: true,
          renderMode: 'best_effort'
        });

        scheduleRender();

      } else {
        // ❌ Critical validation failures - render safe minimum with warnings
        console.error(`❌ [RESIZE_TRANSACTION:${id}] Critical validation failures - rendering safe minimum:`, {
          transactionId,
          failedValidations: {
            yScale: !yScaleValidation.isValid,
            adrAlignment: !adrAlignment.isValid,
            synchronization: !synchronizationCheck.synchronized
          },
          errors: {
            yScaleError: yScaleValidation.reason,
            adrAlignmentErrors: adrAlignment.testResults.filter(r => !r.passed),
            synchronizationErrors: synchronizationCheck
          },
          note: 'Essential market visualization maintained - full functionality pending validation recovery'
        });

        // Update canvas tracking variables for safe rendering
        canvasWidth = contentArea.width;
        canvasHeight = contentArea.height;

        logRenderScheduling(id, 'atomic_resize_safe_minimum', {
          transactionId,
          duration: transactionDuration,
          validationsPassed: false,
          criticalValidationsPassed: false,
          renderMode: 'safe_minimum'
        });

        // Schedule render even for critical failures to maintain market visibility
        scheduleRender();
      }

      // Log transaction completion
      const logger = getDisplayCreationLogger(id);
      logger.logAtomicResizeTransaction(transactionId, oldContentArea, newContentArea, {
        yScaleValid: yScaleValidation,
        adrAlignment: adrAlignment,
        synchronization: synchronizationCheck
      }, {
        duration: transactionDuration,
        meets60fpsTarget: transactionDuration <= 16.67
      });

      // Cleanup transaction state and process pending transaction
      transactionInProgress = false;
      const pending = pendingTransaction;
      pendingTransaction = null;

      if (pending) {
        // Process pending transaction in next frame to prevent recursion
        requestAnimationFrame(() => {
          executeAtomicResizeTransaction(pending.newContentArea, pending.resizeContext);
        });
      }

      return {
        transactionId,
        success: allValidationsPassed,
        duration: transactionDuration,
        validations: {
          yScaleValidation,
          adrAlignment,
          synchronizationCheck
        }
      };

    } catch (error) {
      // Defensive timing calculation with robust HMR-safe performance API
      let transactionDuration = 0;
      try {
        // Use our robust HMR-safe getPerformanceTime() function
        const errorTimingNow = getPerformanceTime();
        transactionDuration = errorTimingNow - startTime;
      } catch (timingError) {
        // This should never happen with our robust implementation, but handle it gracefully
        console.warn(`[RESIZE_TRANSACTION:${id}] Unexpected timing error:`, timingError.message);
        transactionDuration = 0; // Set to 0 if timing fails completely
      }
      console.error(`❌ [RESIZE_TRANSACTION:${id}] Transaction failed:`, {
        transactionId,
        error: error.message,
        stack: error.stack,
        duration: `${transactionDuration.toFixed(2)}ms`,
        context: {
          oldContentArea,
          newContentArea,
          hasCanvas: !!canvas,
          hasContext: !!ctx,
          hasCoordinateActions: !!coordinateActions
        }
      });

      // Cleanup transaction state even on error
      transactionInProgress = false;
      const pending = pendingTransaction;
      pendingTransaction = null;

      if (pending) {
        // Process pending transaction in next frame to prevent recursion
        requestAnimationFrame(() => {
          executeAtomicResizeTransaction(pending.newContentArea, pending.resizeContext);
        });
      }

      return {
        transactionId,
        success: false,
        duration: transactionDuration,
        error: error.message
      };
    }
  }

  // 🔧 CRITICAL FIX: Consolidated canvas dimension management to prevent race conditions
  function updateCanvasDimensions(newContentArea) {
    // Legacy wrapper for backward compatibility - use atomic transaction
    executeAtomicResizeTransaction(newContentArea, {
      trigger: 'legacy_wrapper',
      source: 'updateCanvasDimensions'
    });
  }

  // 🔧 CONSOLIDATED CANVAS STATE MANAGEMENT: Single entry point to prevent race conditions
  let canvasInitializing = false;
  let transactionInProgress = false;
  let pendingTransaction = null;

  // Single reactive statement for all canvas operations to prevent concurrent initialization
  $: if (canvas && state?.ready && !canvasError && !canvasInitializing) {
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
    // 🔧 CRITICAL FIX: Account for padding and border in container calculations
    const paddingTotal = 8; // 2px padding + 2px margin on each side for canvas
    const borderWidth = 4; // 2px border on each side
    const totalAdjustment = paddingTotal + borderWidth;
    const newContentArea = {
      width: Math.max(50, containerSize.width - totalAdjustment),  // Minimum 50px
      height: Math.max(50, containerSize.height - totalAdjustment) // Minimum 50px
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

      executeAtomicResizeTransaction(newContentArea, {
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


        // 🔧 CRITICAL FIX: Use consolidated canvas dimension function with correct calculations
        const containerSize = config.containerSize || { width: 220, height: 120 };
        // 🔧 CRITICAL FIX: Account for padding, border, and margin in container
        const paddingTotal = 8; // 2px padding + 2px margin on each side for canvas
        const borderWidth = 4; // 2px border on each side
        const totalAdjustment = paddingTotal + borderWidth;
        const newContentArea = {
          width: Math.max(50, containerSize.width - totalAdjustment),  // Minimum 50px
          height: Math.max(50, containerSize.height - totalAdjustment) // Minimum 50px
        };

        console.log(`[FLOATING_DISPLAY] Canvas initial sizing:`, {
          id,
          containerSize,
          totalAdjustment,
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
      console.warn(`[FLOATING_DISPLAY:${displayId}] Coordinate systems not synchronized, rendering with latest market data`);
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

    // 🔧 CLEAN FOUNDATION: Create rendering context (headerless design)
    const containerSize = config.containerSize || { width: canvasWidth, height: canvasHeight };
    // 🔧 CRITICAL FIX: Account for padding, border, and margin in container
    const paddingTotal = 8; // 2px padding + 2px margin on each side for canvas
    const borderWidth = 4; // 2px border on each side
    const totalAdjustment = paddingTotal + borderWidth;
    const contentArea = {
      width: Math.max(50, containerSize.width - totalAdjustment),  // Minimum 50px
      height: Math.max(50, containerSize.height - totalAdjustment) // Minimum 50px
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
  $: if (state && config && yScale) {
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
      style="clip-path: {cssClipPath};"
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
    /* 🔧 CRITICAL FIX: Canvas properly fills padded container without overflow */
    width: calc(100% - 4px); /* Account for padding */
    height: calc(100% - 4px); /* Account for padding */
    margin: 2px; /* Center within padding */
    border-radius: 4px; /* Match container border radius */
    /* cursor removed - let interact.js control resize cursors */
    /* FIXED: Removed pointer-events: none - was breaking keyboard shortcuts after canvas creation */

    /* ✅ CSS CLIP-PATH BOUNDS: Hardware acceleration for smooth clipping */
    will-change: clip-path;
    transform: translateZ(0); /* Force hardware acceleration */

    /* Ensure clip-path transitions are smooth for resize events */
    transition: clip-path 0.1s ease-out;
    /* 🔧 CRITICAL FIX: Ensure canvas stays within container */
    overflow: hidden;
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
