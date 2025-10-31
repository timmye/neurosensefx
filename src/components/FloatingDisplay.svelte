<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions, geometryActions, interactionActions, GEOMETRY } from '../stores/floatingStore.js';
  import { connectionManager } from '../data/ConnectionManager.js';
  import { scaleLinear } from 'd3-scale';
  import { writable } from 'svelte/store';
  import { markerStore } from '../stores/markerStore.js';
  
  // Import drawing functions
  import { drawMarketProfile } from '../lib/viz/marketProfile.js';
  import { drawDayRangeMeter } from '../lib/viz/dayRangeMeter.js';
  import { drawVolatilityOrb } from '../lib/viz/volatilityOrb.js';
  import { drawPriceFloat } from '../lib/viz/priceFloat.js';
  import { drawPriceDisplay } from '../lib/viz/priceDisplay.js';
  import { drawVolatilityMetric } from '../lib/viz/volatilityMetric.js';
  import { drawPriceMarkers } from '../lib/viz/priceMarkers.js';
  import { drawHoverIndicator } from '../lib/viz/hoverIndicator.js';
  
  // 🔧 UNIFIED SIZING: Import canvas sizing utilities
  import { createCanvasSizingConfig, configureCanvasContext, configUtils } from '../utils/canvasSizing.js';
  
  // Component props
  export let id;
  export let symbol;
  export let position = { x: 100, y: 100 };
  
  // Local state
  let element;
  let canvas;
  let ctx;
  let dpr = 1;
  
  // REMOVED: Local interaction state variables - now using unified interactionState
  // let isResizing = false;
  // let resizeHandle = null;
  // let isHovered = false;
  
  // 🔧 DEBUG: Add simple hover state tracking for testing
  let isHovered = false;
  
  // 🔧 CRITICAL FIX: Add drag state management variables to prevent infinite loops
  let isDragging = false;
  let lastMouseTime = 0;
  let mousemoveListenerExists = false;
  let mouseupListenerExists = false;
  
  // Actual event handlers to prevent memory leaks
  let actualMouseMoveHandler = null;
  let actualMouseUpHandler = null;
  
  // Production canvas and data state
  let canvasData = {};
  let config = {};
  let state = {};
  let isReady = false;
  let display = null;
  let isActive = false;
  let currentZIndex = 1;
  let showResizeHandles = false;
  
  // Hover and marker state
  const hoverState = writable(null);
  let markers = [];
  
  // SIMPLIFIED SOLUTION: Direct store access with no cyclical dependencies
  $: display = $floatingStore.displays?.get(id);
  $: config = display?.config || {};
  $: state = display?.state || {};
  $: isReady = display?.ready || false;
  $: isActive = display?.isActive || false;
  $: currentZIndex = display?.zIndex || 1;
  
  // Store-derived position and size (Reference Canvas Pattern)
  $: displayPosition = display?.position || position;
  
  // 🔧 UNIFIED SIZING: Canvas sizing configuration for FloatingDisplay
  let canvasSizingConfig = null;
  let normalizedConfig = {};
  
  // 🔧 UNIFIED SIZING: Use unified canvas sizing for display size
  $: if (display && config) {
    // 🔧 FIX: Use proper default container dimensions from GEOMETRY foundation
    const containerSize = {
      width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,   // 240px default width
      height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height  // 160px default height (includes header)
    };
    
    // Create unified canvas sizing configuration
    canvasSizingConfig = createCanvasSizingConfig(containerSize, config, {
      includeHeader: true,
      padding: 8,
      headerHeight: 40,
      respectDpr: true
    });
    
    // Update normalized config for rendering
    normalizedConfig = canvasSizingConfig.config;
    
    console.log(`[FLOATING_DISPLAY_SIZING] Unified canvas sizing applied:`, {
      displayId: id,
      containerSize,
      canvasDimensions: canvasSizingConfig.dimensions,
      normalizedConfig: Object.keys(normalizedConfig).reduce((acc, key) => {
        if (typeof normalizedConfig[key] === 'number') {
          acc[key] = normalizedConfig[key];
        }
        return acc;
      }, {})
    });
  }
  
  // 🔧 UNIFIED SIZING: Calculate display size from canvas sizing config
  $: displaySize = canvasSizingConfig ? {
    width: canvasSizingConfig.dimensions.container.width,
    height: canvasSizingConfig.dimensions.container.height
  } : {
    width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,
    height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height
  };
  
  // Update markers from store
  $: if ($markerStore !== undefined) {
    markers = $markerStore;
  }
  
  // WORKING: All functions from CleanFloatingElement - no changes
  
  function getAllFloatingElements() {
    return Array.from(document.querySelectorAll('.enhanced-floating'))
      .filter(el => el !== element)
      .map(el => ({
        element: el,
        x: parseInt(el.style.left) || 0,
        y: parseInt(el.style.top) || 0,
        width: el.offsetWidth,
        height: el.offsetHeight
      }));
  }
  
  function checkCollision(newX, newY, newWidth = displaySize.width, newHeight = displaySize.height) {
    const workspaceSettings = $floatingStore.workspaceSettings || {};
    if (!workspaceSettings.collisionDetectionEnabled) return { canMove: true };
    
    const others = getAllFloatingElements();
    
    for (const other of others) {
      const otherBounds = {
        left: other.x,
        right: other.x + other.width,
        top: other.y,
        bottom: other.y + other.height
      };
      
      const newBounds = {
        left: newX,
        right: newX + newWidth,
        top: newY,
        bottom: newY + newHeight
      };
      
      if (newBounds.left < otherBounds.right &&
          newBounds.right > otherBounds.left &&
          newBounds.top < otherBounds.bottom &&
          newBounds.bottom > otherBounds.top) {
        
        const currentBounds = {
          left: displayPosition.x,
          right: displayPosition.x + displaySize.width,
          top: displayPosition.y,
          bottom: displayPosition.y + displaySize.height
        };
        
        const positions = [
          { x: otherBounds.left - newWidth, y: newY },
          { x: otherBounds.right, y: newY },
          { x: newX, y: otherBounds.top - newHeight },
          { x: newX, y: otherBounds.bottom }
        ];
        
        let bestPosition = null;
        let minDistance = Infinity;
        
        for (const pos of positions) {
          const distance = Math.sqrt(
            Math.pow(pos.x - currentBounds.left, 2) + 
            Math.pow(pos.y - currentBounds.top, 2)
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            bestPosition = pos;
          }
        }
        
        return { 
          canMove: false, 
          collision: other,
          suggestedPosition: bestPosition
        };
      }
    }
    
    return { canMove: true };
  }
  
  function snapToGrid(value) {
    const workspaceSettings = $floatingStore.workspaceSettings || {};
    if (!workspaceSettings.gridSnapEnabled) return value;
    
    const gridSize = workspaceSettings.gridSize || 20;
    const threshold = gridSize / 2;
    
    const offset = value % gridSize;
    const shouldSnap = offset < threshold || offset > (gridSize - threshold);
    
    return shouldSnap ? Math.round(value / gridSize) * gridSize : value;
  }
  
  function handleMouseDown(e) {
    console.log(`[MOUSE_DOWN] Mouse down on display ${id}`, {
      target: e.target,
      targetClass: e.target.className,
      isResizeHandle: e.target.classList.contains('resize-handle'),
      button: e.button
    });
    
    if (e.button !== 0) return;
    
    if (e.target.classList.contains('resize-handle')) {
      console.log(`[MOUSE_DOWN] Ignoring resize handle click`);
      return;
    }
    
    // 🔧 CRITICAL FIX: Only enable dragging if not already dragging
    if (!isDragging) {
      isDragging = true;
      console.log(`[MOUSE_DOWN] Set isDragging = true for display ${id}`);
    } else {
      console.log(`[MOUSE_DOWN] Already dragging - ignoring mouse down`);
      return;
    }
    
    // ✅ STORE ACTION: Use central store for dragging - no local state
    const rect = element.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    console.log(`[MOUSE_DOWN] Starting drag with offset:`, offset);
    actions.startDrag('display', id, offset);
    actions.setActiveDisplay(id);
    
    // 🔧 CRITICAL FIX: Store actual handlers for proper cleanup
    actualMouseMoveHandler = handleMouseMove;
    actualMouseUpHandler = handleMouseUp;
    mousemoveListenerExists = true;
    mouseupListenerExists = true;
    
    document.addEventListener('mousemove', actualMouseMoveHandler);
    document.addEventListener('mouseup', actualMouseUpHandler);
    
    console.log(`[EVENT_LISTENER_DEBUG] Added mouse event listeners`, { 
      mousemoveListenerExists, 
      mouseupListenerExists 
    });
    
    e.preventDefault();
  }
  
  function handleMouseMove(e) {
    console.log(`[MOUSE_MOVE] Handling mouse move for display ${id}`, {
      mode: $floatingStore.interactionState.mode,
      activeDisplayId: $floatingStore.interactionState.activeDisplayId,
      draggedItem: $floatingStore.draggedItem,
      resizeState: $floatingStore.resizeState
    });
    
    // 🔧 CRITICAL FIX: Add 16ms throttle to prevent infinite loops
    const currentTime = Date.now();
    if (currentTime - lastMouseTime < 16) { // 60fps throttle
      console.log(`[MOUSE_MOVE_THROTTLE] Throttled mouse move event`);
      return;
    }
    lastMouseTime = currentTime;
    
    // Only process if actively dragging this display
    if (isDragging && $floatingStore.interactionState.activeDisplayId === id) {
      console.log(`[MOUSE_MOVE_THROTTLE] Processing drag for display ${id}`);
    } else {
      console.log(`[MOUSE_MOVE_THROTTLE] Skipping - not dragging this display`);
      return;
    }
    
    // NEW: Unified interaction system - mode-based delegation
    const mode = $floatingStore.interactionState.mode;
    const activeDisplayId = $floatingStore.interactionState.activeDisplayId;
    
    if (activeDisplayId === id) {
      const mousePos = interactionActions.coordinateSystem.mouseToElement(e, element);
      console.log(`[MOUSE_MOVE] Delegating to interaction system for mode: ${mode}`);
      
      switch (mode) {
        case 'dragging':
          // Delegate to unified interaction system
          interactionActions.updateInteraction(mousePos);
          break;
        case 'resizing':
          // Delegate to unified interaction system
          interactionActions.updateInteraction(mousePos);
          break;
        default:
          console.log(`[MOUSE_MOVE] Checking legacy interactions`);
          // Check legacy draggedItem for backward compatibility
          if ($floatingStore.draggedItem?.type === 'display' && $floatingStore.draggedItem?.id === id) {
            console.log(`[MOUSE_MOVE] Using legacy drag system`);
            // Get raw mouse movement delta
            const mouseDeltaX = e.movementX || 0;
            const mouseDeltaY = e.movementY || 0;
            
            // Get current position and apply direct mouse delta for 1:1 scaling
            const currentPosition = $floatingStore.displays.get(id)?.position || { x: 0, y: 0 };
            let newX = currentPosition.x + mouseDeltaX;
            let newY = currentPosition.y + mouseDeltaY;
            
            // ✅ ENABLED: Apply grid snapping if enabled in workspace settings
            const workspaceSettings = $floatingStore.workspaceSettings || {};
            if (workspaceSettings.gridSnapEnabled) {
              const gridSize = workspaceSettings.gridSize || 20;
              newX = Math.round(newX / gridSize) * gridSize;
              newY = Math.round(newY / gridSize) * gridSize;
            }
            
            // ✅ ENABLED: Apply viewport boundary constraints
            const displaySize = {
              width: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.width,
              height: GEOMETRY.COMPONENTS.FloatingDisplay.defaultSize.height
            };
            const constrainedPosition = GEOMETRY.TRANSFORMS.constrainToViewport(
              { x: newX, y: newY }, 
              displaySize
            );
            
            // ✅ ENABLED: Check collision detection if enabled
            if (workspaceSettings.collisionDetectionEnabled) {
              const collision = checkCollision(constrainedPosition.x, constrainedPosition.y);
              if (collision.canMove) {
                actions.updateDrag({ x: constrainedPosition.x, y: constrainedPosition.y });
              } else if (collision.suggestedPosition) {
                // Apply grid snapping to suggested position
                let suggestedX = collision.suggestedPosition.x;
                let suggestedY = collision.suggestedPosition.y;
                if (workspaceSettings.gridSnapEnabled) {
                  const gridSize = workspaceSettings.gridSize || 20;
                  suggestedX = Math.round(suggestedX / gridSize) * gridSize;
                  suggestedY = Math.round(suggestedY / gridSize) * gridSize;
                }
                actions.updateDrag({ x: suggestedX, y: suggestedY });
              }
            } else {
              // No collision detection - just apply constrained position
              actions.updateDrag({ x: constrainedPosition.x, y: constrainedPosition.y });
            }
          } else if ($floatingStore.resizeState?.isResizing && $floatingStore.resizeState?.displayId === id) {
            console.log(`[MOUSE_MOVE] Using legacy resize system`);
            // ✅ STORE ACTION: Already working - store manages resize
            const mousePos = { x: e.clientX, y: e.clientY };
            actions.updateResize(mousePos);
          }
          break;
      }
    }
  }
  
  function handleMouseUp() {
    console.log(`[MOUSE_UP] Mouse up called for display ${id}`, {
      isDragging,
      mousemoveListenerExists,
      mouseupListenerExists
    });
    
    // 🔧 CRITICAL FIX: Reset dragging state
    isDragging = false;
    console.log(`[MOUSE_UP] Set isDragging = false for display ${id}`);
    
    // NEW: Use unified interaction system
    interactionActions.endInteraction();
    
    // Also update legacy store for backward compatibility
    actions.endDrag();
    actions.endResize();
    
    // 🔧 CRITICAL FIX: Remove ALL listeners to prevent duplicates
    if (mousemoveListenerExists && actualMouseMoveHandler) {
      document.removeEventListener('mousemove', actualMouseMoveHandler);
      mousemoveListenerExists = false;
      console.log(`[EVENT_LISTENER_DEBUG] Removed mousemove listener`);
    }
    
    if (mouseupListenerExists && actualMouseUpHandler) {
      document.removeEventListener('mouseup', actualMouseUpHandler);
      mouseupListenerExists = false;
      console.log(`[EVENT_LISTENER_DEBUG] Removed mouseup listener`);
    }
    
    // Clear handler references
    actualMouseMoveHandler = null;
    actualMouseUpHandler = null;
    
    console.log(`[EVENT_LISTENER_DEBUG] Cleanup completed`, { 
      isDragging, 
      mousemoveListenerExists, 
      mouseupListenerExists 
    });
  }
  
  function handleResizeStart(e, handle) {
    console.log(`[RESIZE_START] ${handle} handle clicked for display ${id}`, {
      event: e,
      target: e.target,
      targetClass: e.target.className,
      button: e.button,
      mouseClientX: e.clientX,
      mouseClientY: e.clientY
    });
    
    // NEW: Use unified interaction system
    const mousePos = interactionActions.coordinateSystem.mouseToElement(e, element);
    
    console.log(`[RESIZE_START] Starting interaction system with mousePos:`, mousePos);
    
    interactionActions.startInteraction({
      mode: 'resizing',
      displayId: id,
      resizeHandle: handle,
      startData: {
        mousePosition: mousePos,
        displayPosition: displayPosition,
        displaySize: displaySize
      }
    });
    
    console.log(`[RESIZE_START] Interaction started successfully`);
    
    // Also update legacy store for backward compatibility
    actions.startResize(id, handle, displayPosition, displaySize, { x: e.clientX, y: e.clientY });
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.stopPropagation();
    e.preventDefault();
  }
  
  function checkIfOnlyTouching(other, newX, newY, newWidth, newHeight) {
    const otherBounds = {
      left: other.x,
      right: other.x + other.width,
      top: other.y,
      bottom: other.y + other.height
    };
    
    const newBounds = {
      left: newX,
      right: newX + newWidth,
      top: newY,
      bottom: newY + newHeight
    };
    
    const tolerance = 1;
    
    const touchingLeft = Math.abs(newBounds.right - otherBounds.left) <= tolerance;
    const touchingRight = Math.abs(newBounds.left - otherBounds.right) <= tolerance;
    const touchingTop = Math.abs(newBounds.bottom - otherBounds.top) <= tolerance;
    const touchingBottom = Math.abs(newBounds.top - otherBounds.bottom) <= tolerance;
    
    const horizontalTouch = touchingLeft || touchingRight;
    const verticalTouch = touchingTop || touchingBottom;
    
    const horizontalOverlap = newBounds.left < otherBounds.right && newBounds.right > otherBounds.left;
    const verticalOverlap = newBounds.top < otherBounds.bottom && newBounds.bottom > otherBounds.top;
    
    return (horizontalTouch && !verticalOverlap) || (verticalTouch && !horizontalOverlap);
  }
  
  // Production event handlers
  function handleContextMenu(e) {
    e.preventDefault();
    actions.setActiveDisplay(id);
    
    // Use unified context menu system
    const context = {
      type: e.target.closest('canvas') ? 'canvas' : 
            e.target.closest('.header') ? 'header' : 'workspace',
      targetId: id,
      targetType: 'display'
    };
    
    actions.showUnifiedContextMenu(e.clientX, e.clientY, context);
  }
  
  function handleClose() {
    actions.removeDisplay(id);
  }
  
  // REFERENCE CANVAS PATTERN: Base reference dimensions
  const REFERENCE_CANVAS = { width: 220, height: 120 };
  
  // Current canvas dimensions (can be resized)
  let canvasWidth = REFERENCE_CANVAS.width;
  let canvasHeight = REFERENCE_CANVAS.height;
  
  // 🔧 UNIFIED CONFIG HANDLING: Use configUtils for clean percentage/absolute detection
  function scaleToCanvas(config, currentCanvasWidth, currentCanvasHeight) {
    if (!config) return {};
    
    // 🔧 UNIFIED CONFIG HANDLING: Use configUtils for consistent value detection
    const normalizedConfig = configUtils.normalizeConfig(config);
    
    return {
      // Layout parameters - handle both percentage and absolute values
      visualizationsContentWidth: normalizedConfig.visualizationsContentWidth <= 200
        ? (normalizedConfig.visualizationsContentWidth / 100) * currentCanvasWidth
        : normalizedConfig.visualizationsContentWidth || currentCanvasWidth,
      meterHeight: normalizedConfig.meterHeight <= 200
        ? (normalizedConfig.meterHeight / 100) * currentCanvasHeight
        : normalizedConfig.meterHeight || currentCanvasHeight,
      centralAxisXPosition: (config.centralAxisXPosition / 100) * currentCanvasWidth,
      
      // Price display parameters (always percentage-based)
      priceFloatWidth: (config.priceFloatWidth / 100) * currentCanvasWidth,
      priceFloatHeight: (config.priceFloatHeight / 100) * currentCanvasHeight,
      priceFloatXOffset: (config.priceFloatXOffset / 100) * currentCanvasWidth,
      priceFontSize: (config.priceFontSize / 100) * currentCanvasHeight,
      priceHorizontalOffset: (config.priceHorizontalOffset / 100) * currentCanvasWidth,
      priceDisplayPadding: (config.priceDisplayPadding / 100) * currentCanvasWidth,
      
      // Volatility parameters (always percentage-based)
      volatilityOrbBaseWidth: (config.volatilityOrbBaseWidth / 100) * currentCanvasWidth,
      
      // Pass through non-scaled parameters unchanged
      ...Object.fromEntries(
        Object.entries(config).filter(([key]) => ![
          'visualizationsContentWidth', 'meterHeight', 'centralAxisXPosition',
          'priceFloatWidth', 'priceFloatHeight', 'priceFloatXOffset', 'priceFontSize',
          'priceHorizontalOffset', 'priceDisplayPadding', 'volatilityOrbBaseWidth'
        ].includes(key))
      )
    };
  }
  
  // 🔧 CRITICAL FIX: Debounce scaledConfig during resize to prevent temporary overscaling
  let resizeDebounceTimer = null;
  let lastDisplaySize = { width: 0, height: 0 };
  
  $: if (displaySize && (displaySize.width !== lastDisplaySize.width || displaySize.height !== lastDisplaySize.height)) {
    lastDisplaySize = { ...displaySize };
    
    // Clear existing timer
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer);
    }
    
    // Debounce during resize operations
    const isResizing = $floatingStore.resizeState?.isResizing;
    if (isResizing) {
      // During resize, wait a bit longer to settle
      resizeDebounceTimer = setTimeout(() => {
        scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
      }, 50);
    } else {
      // Not resizing, update immediately
      scaledConfig = scaleToCanvas(config, displaySize.width, displaySize.height - 40);
    }
  }
  
  // Initialize scaledConfig
  let scaledConfig = {};
  
  // FIXED: Use scaled config height for yScale calculation
  $: yScale = state?.visualLow && state?.visualHigh && scaledConfig?.meterHeight
    ? scaleLinear().domain([state.visualLow, state.visualHigh]).range([scaledConfig.meterHeight, 0])
    : null;
  
  // UNIFIED: Use config directly for rendering (no conversion needed)
  $: renderingConfig = config;
  
  function handleCanvasMouseMove(event) {
    if (!yScale) return;
    
    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    const calculatedPrice = yScale.invert(cssY);
    
    hoverState.set({ y: cssY, price: calculatedPrice });
  }
  
  function handleCanvasMouseLeave() {
    hoverState.set(null);
  }
  
  function handleCanvasClick(event) {
    if (!yScale) return;
    
    const rect = canvas.getBoundingClientRect();
    const cssY = event.clientY - rect.top;
    
    const hitThreshold = 5;
    
    const clickedMarker = markers.find(marker => {
      const markerY = yScale(marker.price);
      return Math.abs(cssY - markerY) < hitThreshold;
    });
    
    if (clickedMarker) {
      markerStore.remove(clickedMarker.id);
    } else {
      const clickedPrice = yScale.invert(cssY);
      markerStore.add(clickedPrice);
    }
  }
  
  // 🔧 UNIFIED SIZING: Initialize canvas with unified sizing approach
  onMount(async () => {
    console.log(`[FLOATING_DISPLAY] Mounting display ${id} for symbol ${symbol}`);
    
    // Initialize canvas context
    if (canvas) {
      ctx = canvas.getContext('2d');
      dpr = window.devicePixelRatio || 1;
      
      // Set default canvas size using reference dimensions
      canvas.width = REFERENCE_CANVAS.width;
      canvas.height = REFERENCE_CANVAS.height;
      canvasWidth = REFERENCE_CANVAS.width;
      canvasHeight = REFERENCE_CANVAS.height;
      
      console.log(`[CANVAS_INIT] Set initial canvas size: ${REFERENCE_CANVAS.width}x${REFERENCE_CANVAS.height}`);
    }
    
    // Subscribe to data through ConnectionManager
    try {
      console.log(`[FLOATING_DISPLAY] Subscribing to data for ${symbol}`);
      await connectionManager.subscribeCanvas(id, symbol);
      console.log(`[FLOATING_DISPLAY] Successfully subscribed to ${symbol}`);
    } catch (error) {
      console.error(`[FLOATING_DISPLAY] Failed to subscribe to ${symbol}:`, error);
    }
    
    const checkCanvas = setInterval(() => {
      if (canvas && !ctx) {
        ctx = canvas.getContext('2d');
        dpr = window.devicePixelRatio || 1;
        
        // Ensure canvas has proper default size
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = REFERENCE_CANVAS.width;
          canvas.height = REFERENCE_CANVAS.height;
          console.log(`[CANVAS_FIX] Reset canvas to reference size: ${REFERENCE_CANVAS.width}x${REFERENCE_CANVAS.height}`);
        }
        
        clearInterval(checkCanvas);
      }
    }, 100);
    
    return () => {
      clearInterval(checkCanvas);
      // Unsubscribe from data when component is destroyed
      console.log(`[FLOATING_DISPLAY] Unsubscribing from data for ${symbol}`);
      connectionManager.unsubscribeCanvas(id);
    };
  });
  
  // 🔧 UNIFIED SIZING: Update canvas using unified sizing config
  $: if (canvas && ctx && canvasSizingConfig) {
    const currentWidth = canvas.width;
    const currentHeight = canvas.height;
    const { canvas: newCanvasDims } = canvasSizingConfig.dimensions;
    
    // STABILITY: Add threshold to prevent micro-updates and infinite loops
    const widthThreshold = 5; // Minimum 5px change required
    const heightThreshold = 5; // Minimum 5px change required
    const widthDiff = Math.abs(currentWidth - newCanvasDims.width);
    const heightDiff = Math.abs(currentHeight - newCanvasDims.height);
    
    console.log(`[CANVAS_RESIZE] Unified sizing check: current=${currentWidth}x${currentHeight}, new=${newCanvasDims.width}x${newCanvasDims.height}, diff=${widthDiff}x${heightDiff}`, {
      canvasSizingConfig,
      newCanvasDims,
      thresholds: { widthThreshold, heightThreshold }
    });
    
    if (widthDiff > widthThreshold || heightDiff > heightThreshold) {
      updateCanvasSizeUnified(newCanvasDims.width, newCanvasDims.height);
    }
  }
  
  function updateCanvasSizeUnified(newWidth, newHeight) {
    if (!canvas || !ctx) return;
    
    // 🔧 UNIFIED SIZING: Use canvas sizing configuration for consistent updates
    if (canvasSizingConfig) {
      // Configure canvas context with unified sizing
      configureCanvasContext(ctx, canvasSizingConfig.dimensions);
      
      // Update canvas dimensions from unified config
      const { canvas: canvasDims } = canvasSizingConfig.dimensions;
      canvas.width = canvasDims.width;
      canvas.height = canvasDims.height;
      
      console.log(`[CANVAS_UPDATE_UNIFIED] Setting canvas size from unified config: ${canvasDims.width}x${canvasDims.height}`, {
        canvasDimensions: canvasDims,
        containerDimensions: canvasSizingConfig.dimensions.container,
        normalizedConfig: canvasSizingConfig.config
      });
    } else {
      // Fallback to manual sizing
      const safeWidth = Math.min(2000, Math.max(100, newWidth));
      const safeHeight = Math.min(2000, Math.max(80, newHeight));
      
      canvas.width = safeWidth;
      canvas.height = safeHeight;
      
      if (dpr !== 1) {
        ctx.scale(dpr, dpr);
      }
    }
  }
  
  // 🔧 PERFORMANCE OPTIMIZATION: Add debouncing for reactive rendering
  let renderFrame;
  let lastRenderTime = 0;
  let renderDebounceTimer = null;
  let lastRenderState = null;
  
  function render(timestamp = 0) {
    console.log(`[RENDER_PIPELINE] Render function called at timestamp: ${timestamp}`, {
      hasCtx: !!ctx,
      hasState: !!state,
      hasConfig: !!config,
      hasCanvas: !!canvas,
      canvasWidth: canvas?.width,
      canvasHeight: canvas?.height,
      visualLow: state?.visualLow,
      visualHigh: state?.visualHigh,
      scaledConfig: scaledConfig ? Object.keys(scaledConfig) : null
    });

    if (!ctx || !state || !config || !canvas) {
      console.log(`[RENDER_PIPELINE] Render blocked - missing fundamentals:`, {
        hasCtx: !!ctx,
        hasState: !!state,
        hasConfig: !!config,
        hasCanvas: !!canvas
      });
      return;
    }
    
    // 🔧 STEP 1: CLEAR CANVAS AND PREPARE FOR VISUALIZATIONS
    console.log(`[RENDER_PIPELINE] Clearing canvas and preparing for visualizations...`);
    
    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 🔧 COMMENTED OUT: Test shapes - visualizations are working, remove test artifacts
    // Draw test rectangle (should be visible)
    // ctx.fillStyle = '#ff0000';
    // ctx.fillRect(10, 10, 50, 30);
    // console.log(`[RENDER_PIPELINE] Drew test rectangle at (10, 10) with size (50, 30)`);
    
    // Draw test text (should be visible)
    // ctx.fillStyle = '#ffffff';
    // ctx.font = '12px Arial';
    // ctx.fillText('TEST TEXT', 10, 60);
    // console.log(`[RENDER_PIPELINE] Drew test text at (10, 60)`);
    
    // 🔧 STEP 2: TEST YSCALE CALCULATION
    if (state.visualLow && state.visualHigh && scaledConfig?.meterHeight) {
      const renderYScale = scaleLinear().domain([state.visualLow, state.visualHigh]).range([scaledConfig.meterHeight, 0]);
      console.log(`[RENDER_PIPELINE] yScale created successfully:`, {
        domain: [state.visualLow, state.visualHigh],
        range: [scaledConfig.meterHeight, 0],
        testValue: state.visualLow,
        testResult: renderYScale(state.visualLow)
      });
      
      // 🔧 STEP 3: TEST VISUALIZATION FUNCTIONS
      try {
        console.log(`[RENDER_PIPELINE] Calling drawMarketProfile...`);
        drawMarketProfile(ctx, scaledConfig, state, renderYScale);
        console.log(`[RENDER_PIPELINE] drawMarketProfile completed`);
        
        console.log(`[RENDER_PIPELINE] Calling drawDayRangeMeter...`);
        drawDayRangeMeter(ctx, scaledConfig, state, renderYScale);
        console.log(`[RENDER_PIPELINE] drawDayRangeMeter completed`);
        
        console.log(`[RENDER_PIPELINE] Calling drawPriceFloat...`);
        drawPriceFloat(ctx, scaledConfig, state, renderYScale);
        console.log(`[RENDER_PIPELINE] drawPriceFloat completed`);
        
        console.log(`[RENDER_PIPELINE] Calling drawPriceDisplay...`);
        drawPriceDisplay(ctx, scaledConfig, state, renderYScale, scaledConfig.visualizationsContentWidth);
        console.log(`[RENDER_PIPELINE] drawPriceDisplay completed`);
        
        console.log(`[RENDER_PIPELINE] All visualization functions completed successfully`);
      } catch (error) {
        console.error(`[RENDER_PIPELINE] Error in visualization functions:`, error);
      }
    } else {
      console.log(`[RENDER_PIPELINE] Cannot create yScale - missing requirements:`, {
        hasVisualLow: !!state.visualLow,
        hasVisualHigh: !!state.visualHigh,
        hasMeterHeight: !!scaledConfig?.meterHeight,
        visualLow: state?.visualLow,
        visualHigh: state?.visualHigh,
        meterHeight: scaledConfig?.meterHeight
      });
    }
    
    // 🔧 STEP 4: TEST HOVER AND MARKERS
    try {
      drawPriceMarkers(ctx, scaledConfig, state, yScale, markers); // Use proper yScale
      console.log(`[RENDER_PIPELINE] drawPriceMarkers completed`);
      
      drawHoverIndicator(ctx, scaledConfig, state, yScale, $hoverState); // Use proper yScale
      console.log(`[RENDER_PIPELINE] drawHoverIndicator completed`);
    } catch (error) {
      console.error(`[RENDER_PIPELINE] Error in hover/markers:`, error);
    }
    
    //console.log(`[RENDER_PIPELINE] Render frame completed - should see test rectangle and text`);
  }
  
  // 🔧 SIMPLIFIED TRIGGER: Remove complex dependencies that block rendering
  $: if (ctx && state && config) {
    // Add debug logging to identify exact failure point
    console.log(`[RENDER_TRIGGER_DEBUG] Render conditions check:`, {
      hasCtx: !!ctx,
      hasState: !!state,
      hasConfig: !!config,
      hasIsReady: !!isReady,
      hasYScale: !!yScale,
      visualLow: state?.visualLow,
      visualHigh: state?.visualHigh,
      meterHeight: scaledConfig?.meterHeight,
      canvasWidth: canvas?.width,
      canvasHeight: canvas?.height
    });
    
    // 🔧 SIMPLIFIED TRIGGER: Remove isReady and yScale from critical path
    // They should be true but don't block rendering if data is available
    if (state.visualLow && state.visualHigh) {
      // Calculate yScale on-demand if not available
      const currentYScale = yScale || (
        scaledConfig?.meterHeight 
          ? scaleLinear().domain([state.visualLow, state.visualHigh]).range([scaledConfig.meterHeight, 0])
          : null
      );
      
      if (currentYScale) {
        if (renderFrame) {
          cancelAnimationFrame(renderFrame);
        }
        
        // Override yScale for this render call
        const originalYScale = yScale;
        yScale = currentYScale;
        render();
        yScale = originalYScale;
      } else {
        console.log(`[RENDER_DEBUG] Cannot create yScale - missing meterHeight:`, scaledConfig);
      }
    } else {
      console.log(`[RENDER_DEBUG] Cannot render - missing visualLow/visualHigh:`, {
        visualLow: state?.visualLow,
        visualHigh: state?.visualHigh
      });
    }
  }
  
  // 🔧 FIXED: Show resize handles on hover AND during active interaction
  $: showResizeHandles = $floatingStore.interactionState.mode === 'resizing' || 
                         $floatingStore.resizeState?.isResizing ||
                         $floatingStore.interactionState.activeDisplayId === id ||
                         $floatingStore.resizeState?.displayId === id ||
                         // 🔧 CRITICAL FIX: Also show handles when hovering (simple hover state)
                         $floatingStore.interactionState.mode === 'idle' && $floatingStore.interactionState.activeDisplayId === id;
  
  // DEBUG: Add resize handle visibility debugging
  console.log(`[RESIZE_DEBUG] Resize handle visibility check for display ${id}:`, {
    interactionMode: $floatingStore.interactionState.mode,
    isResizing: $floatingStore.resizeState?.isResizing,
    activeDisplayId: $floatingStore.interactionState.activeDisplayId,
    resizeDisplayId: $floatingStore.resizeState?.displayId,
    currentDisplayId: id,
    showResizeHandles
  });
  
  onDestroy(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // 🔧 PERFORMANCE OPTIMIZATION: Clean up render frame and timers
    if (renderFrame) {
      cancelAnimationFrame(renderFrame);
    }
    if (renderDebounceTimer) {
      clearTimeout(renderDebounceTimer);
    }
    if (resizeDebounceTimer) {
      clearTimeout(resizeDebounceTimer);
    }
  });
</script>

<div 
  bind:this={element}
  class="enhanced-floating"
  class:hovered={showResizeHandles}
  class:active={isActive}
  style="left: {displayPosition.x}px; top: {displayPosition.y}px; width: {displaySize.width}px; height: {displaySize.height}px; z-index: {currentZIndex};"
  on:contextmenu={handleContextMenu}
  on:mousedown={handleMouseDown}
  on:mouseenter={() => {
    // Hover state is now managed through resize handle visibility logic
    // No local state needed
  }}
  on:mouseleave={() => {
    // Hover state is now managed through resize handle visibility logic
    // No local state needed
  }}
  data-display-id={id}
>
  <!-- Header -->
  <div class="header" on:mousedown={handleMouseDown}>
    <div class="symbol-info">
      <span class="symbol">{symbol}</span>
      {#if isActive}
        <div class="active-indicator"></div>
      {/if}
    </div>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  
  <!-- Canvas Content -->
  <div class="content">
    {#if isReady}
      <canvas 
        bind:this={canvas}
        on:mousemove={handleCanvasMouseMove}
        on:mouseleave={handleCanvasMouseLeave}
        on:click={handleCanvasClick}
      ></canvas>
    {:else}
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Initializing {symbol}...</p>
      </div>
    {/if}
  </div>
  
  <!-- WORKING Resize Handles from CleanFloatingElement -->
  {#if showResizeHandles}
    <div class="resize-handle nw" on:mousedown={(e) => handleResizeStart(e, 'nw')}></div>
    <div class="resize-handle ne" on:mousedown={(e) => handleResizeStart(e, 'ne')}></div>
    <div class="resize-handle se" on:mousedown={(e) => handleResizeStart(e, 'se')}></div>
    <div class="resize-handle sw" on:mousedown={(e) => handleResizeStart(e, 'sw')}></div>
    
    <div class="resize-handle n" on:mousedown={(e) => handleResizeStart(e, 'n')}></div>
    <div class="resize-handle s" on:mousedown={(e) => handleResizeStart(e, 's')}></div>
    <div class="resize-handle e" on:mousedown={(e) => handleResizeStart(e, 'e')}></div>
    <div class="resize-handle w" on:mousedown={(e) => handleResizeStart(e, 'w')}></div>
    {/if}
</div>

<style>
  /* WORKING: Exact CSS from CleanFloatingElement */
  .enhanced-floating {
    position: fixed;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .enhanced-floating:hovered {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .enhanced-floating.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    cursor: grab;
    border-radius: 6px 6px 0 0;
  }
  
  .symbol-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .symbol {
    font-weight: bold;
    color: #d1d5db;
    font-size: 14px;
    font-family: 'Courier New', monospace;
  }
  
  .active-indicator {
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .close-btn {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 18px;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
  }
  
  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }
  
  .content {
    padding: 8px;
    background: #111827;
    border-radius: 0 0 6px 6px;
    height: calc(100% - 41px);
    overflow: hidden;
    box-sizing: border-box;
  }
  
  canvas {
    display: block;
    background-color: #111827;
    width: 100%;
    height: 100%;
    /* 🔧 CRITICAL FIX: Remove object-fit to prevent CSS/JS dimension conflicts */
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    gap: 8px;
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
  
  /* WORKING: Exact resize handle CSS from CleanFloatingElement */
  .resize-handle {
    position: absolute;
    background: #4f46e5;
    border: 1px solid #6366f1;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .enhanced-floating:hovered .resize-handle,
  .resize-handle:hover {
    opacity: 1;
  }
  
  .resize-handle:hover {
    background: #6366f1;
  }
  
  .resize-handle.nw {
    top: -4px;
    left: -4px;
    width: 8px;
    height: 8px;
    cursor: nw-resize;
  }
  
  .resize-handle.ne {
    top: -4px;
    right: -4px;
    width: 8px;
    height: 8px;
    cursor: ne-resize;
  }
  
  .resize-handle.se {
    bottom: -4px;
    right: -4px;
    width: 8px;
    height: 8px;
    cursor: se-resize;
  }
  
  .resize-handle.sw {
    bottom: -4px;
    left: -4px;
    width: 8px;
    height: 8px;
    cursor: sw-resize;
  }
  
  .resize-handle.n {
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 8px;
    cursor: n-resize;
  }
  
  .resize-handle.s {
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 8px;
    cursor: s-resize;
  }
  
  .resize-handle.e {
    top: 50%;
    right: -4px;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    cursor: e-resize;
  }
  
  .resize-handle.w {
    top: 50%;
    left: -4px;
    transform: translateY(-50%);
    width: 8px;
    height: 8px;
    cursor: w-resize;
  }
</style>
