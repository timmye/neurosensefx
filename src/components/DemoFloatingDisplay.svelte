<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions, GEOMETRY } from '../stores/floatingStore.js';
  
  export let id;
  export let symbol = 'DEMO';
  export let position = { x: 200, y: 200 };
  
  // Clean component state - single source of truth
  let element;
  let canvas;
  let ctx;
  let isDragging = false;
  let isResizing = false;
  let dragOffset = { x: 0, y: 0 };
  let resizeStart = { position: null, size: null, mousePos: null, handle: null };
  
  // Component data from store only
  $: component = $floatingStore.displays.get(id);
  $: componentPosition = component?.position || position;
  $: componentSize = component?.size || GEOMETRY.COMPONENTS.DemoFloatingDisplay.defaultSize;
  $: isActive = component?.isActive || false;
  $: zIndex = component?.zIndex || 1;
  
  // Reactive dimensions based on GEOMETRY
  $: totalSize = {
    width: componentSize.width,
    height: componentSize.height
  };
  
  $: canvasSize = {
    width: componentSize.width - (GEOMETRY.DIMENSIONS.PADDING * 2),
    height: componentSize.height - GEOMETRY.DIMENSIONS.HEADER_HEIGHT - (GEOMETRY.DIMENSIONS.PADDING * 2)
  };
  
  // Canvas setup
  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      updateCanvasSize();
      renderDemo();
    }
  });
  
  function updateCanvasSize() {
    if (!canvas || !ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);
    
    canvas.style.width = canvasSize.width + 'px';
    canvas.style.height = canvasSize.height + 'px';
  }
  
  // Enhanced event handling - unified approach
  function handleMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    
    const rect = element.getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    isDragging = true;
    actions.setActiveDisplay(id);
    
    // Use enhanced move with collision detection and grid snapping
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    e.preventDefault();
  }
  
  function handleGlobalMouseMove(e) {
    if (!isDragging) return;
    
    // Calculate target position
    const targetPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    };
    
    // Apply enhanced transforms: collision detection + grid snapping + viewport constraints
    const settings = $floatingStore.settings;
    let finalPosition = targetPosition;
    
    // Apply grid snapping if enabled
    if (settings.gridSnapEnabled && settings.gridSize > 1) {
      const snapped = GEOMETRY.TRANSFORMS.snapToGridSmart(targetPosition, settings.gridSize);
      finalPosition = snapped;
    }
    
    // Apply collision detection if enabled
    if (settings.collisionDetectionEnabled && !settings.allowOverlap) {
      const safePosition = GEOMETRY.EDGES.findSafePositionEnhanced(id, finalPosition, componentSize, Array.from($floatingStore.displays.values()));
      if (safePosition) {
        finalPosition = safePosition;
      }
    }
    
    // Apply viewport constraints
    const constrained = GEOMETRY.TRANSFORMS.constrainToViewportEnhanced(finalPosition, totalSize);
    finalPosition = constrained;
    
    // Update position in store
    actions.updateGeometry(id, finalPosition);
  }
  
  function handleGlobalMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  }
  
  function handleClose() {
    actions.removeDisplay(id);
  }
  
  // Resize handling - integrated approach
  function handleResizeStart(e, handleType) {
    e.preventDefault();
    e.stopPropagation();
    
    resizeStart = {
      position: { ...componentPosition },
      size: { ...componentSize },
      mousePos: { x: e.clientX, y: e.clientY },
      handle: handleType
    };
    
    isResizing = true;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }
  
  function handleResizeMove(e) {
    if (!isResizing) return;
    
    const mousePos = { x: e.clientX, y: e.clientY };
    const delta = {
      x: mousePos.x - resizeStart.mousePos.x,
      y: mousePos.y - resizeStart.mousePos.y
    };
    
    // Calculate new size based on handle type
    let newSize = { ...resizeStart.size };
    let newPosition = { ...resizeStart.position };
    
    switch (resizeStart.handle) {
      case 'se': // Bottom-right
        newSize.width = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.width, resizeStart.size.width + delta.x);
        newSize.height = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.height, resizeStart.size.height + delta.y);
        break;
      case 'sw': // Bottom-left
        newSize.width = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.width, resizeStart.size.width - delta.x);
        newSize.height = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.height, resizeStart.size.height + delta.y);
        newPosition.x = resizeStart.position.x + (resizeStart.size.width - newSize.width);
        break;
      case 'ne': // Top-right
        newSize.width = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.width, resizeStart.size.width + delta.x);
        newSize.height = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.height, resizeStart.size.height - delta.y);
        newPosition.y = resizeStart.position.y + (resizeStart.size.height - newSize.height);
        break;
      case 'nw': // Top-left
        newSize.width = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.width, resizeStart.size.width - delta.x);
        newSize.height = Math.max(GEOMETRY.COMPONENTS.DemoFloatingDisplay.minSize.height, resizeStart.size.height - delta.y);
        newPosition.x = resizeStart.position.x + (resizeStart.size.width - newSize.width);
        newPosition.y = resizeStart.position.y + (resizeStart.size.height - newSize.height);
        break;
    }
    
    // Apply collision detection during resize if enabled
    if ($floatingStore.settings.collisionDetectionEnabled && !$floatingStore.settings.allowOverlap) {
      const safePosition = GEOMETRY.EDGES.findSafePositionEnhanced(id, newPosition, newSize, Array.from($floatingStore.displays.values()));
      if (safePosition) {
        newPosition = safePosition;
      }
    }
    
    // Apply viewport constraints
    const constrainedPosition = GEOMETRY.TRANSFORMS.constrainToViewportEnhanced(newPosition, newSize);
    
    // Update both position and size
    actions.updateGeometry(id, constrainedPosition, newSize);
  }
  
  function handleResizeEnd() {
    isResizing = false;
    resizeStart = { position: null, size: null, mousePos: null, handle: null };
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }
  
  // Demo canvas rendering
  function renderDemo() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    
    // Demo content
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, canvasSize.width / 2, canvasSize.height / 2 - 10);
    
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px monospace';
    ctx.fillText(`${canvasSize.width}×${canvasSize.height}`, canvasSize.width / 2, canvasSize.height / 2 + 10);
    
    // Position indicator
    ctx.fillStyle = '#10b981';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Pos: ${Math.round(componentPosition.x)},${Math.round(componentPosition.y)}`, 4, 4);
    
    // Collision indicator
    const hasCollision = GEOMETRY.EDGES.checkCollision(
      componentPosition, componentSize,
      { x: 0, y: 0 }, { width: 100, height: 100 } // Test obstacle
    );
    ctx.fillStyle = hasCollision ? '#ef4444' : '#10b981';
    ctx.fillText(`Collision: ${hasCollision ? 'YES' : 'NO'}`, 4, 16);
    
    // Grid snap indicator
    const settings = $floatingStore.settings;
    ctx.fillStyle = settings.gridSnapEnabled ? '#10b981' : '#6b7280';
    ctx.fillText(`Grid: ${settings.gridSnapEnabled ? 'ON' : 'OFF'} (${settings.gridSize}px)`, 4, 28);
    
    // Continue rendering if component is active
    if (isActive) {
      requestAnimationFrame(renderDemo);
    }
  }
  
  // Start rendering when component becomes active
  $: if (isActive && ctx) {
    renderDemo();
  }
  
  // Update canvas when size changes
  $: if (canvas && ctx && canvasSize.width && canvasSize.height) {
    updateCanvasSize();
    if (isActive) renderDemo();
  }
  
  // Cleanup
  onDestroy(() => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  });
</script>

<div 
  bind:this={element}
  class="demo-floating-display"
  class:active={isActive}
  style="left: {componentPosition.x}px; top: {componentPosition.y}px; width: {totalSize.width}px; height: {totalSize.height}px; z-index: {zIndex};"
  on:mousedown={handleMouseDown}
  data-display-id={id}
>
  <!-- Header -->
  <div class="header">
    <div class="title">
      <span class="symbol">{symbol}</span>
      <span class="badge">DEMO</span>
    </div>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  
  <!-- Canvas Content -->
  <div class="content">
    <canvas bind:this={canvas}></canvas>
  </div>
  
  <!-- Resize Handles - Integrated Approach -->
  <div class="resize-handles">
    <!-- Corner handles -->
    <div class="resize-handle nw" on:mousedown={(e) => handleResizeStart(e, 'nw')}></div>
    <div class="resize-handle ne" on:mousedown={(e) => handleResizeStart(e, 'ne')}></div>
    <div class="resize-handle se" on:mousedown={(e) => handleResizeStart(e, 'se')}></div>
    <div class="resize-handle sw" on:mousedown={(e) => handleResizeStart(e, 'sw')}></div>
    
    <!-- Edge handles -->
    <div class="resize-handle n" on:mousedown={(e) => handleResizeStart(e, 'n')}></div>
    <div class="resize-handle e" on:mousedown={(e) => handleResizeStart(e, 'e')}></div>
    <div class="resize-handle s" on:mousedown={(e) => handleResizeStart(e, 's')}></div>
    <div class="resize-handle w" on:mousedown={(e) => handleResizeStart(e, 'w')}></div>
  </div>
</div>

<style>
  .demo-floating-display {
    position: fixed;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .demo-floating-display.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 40px;
    padding: 0 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    cursor: grab;
  }
  
  .title {
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
  
  .badge {
    background: #4f46e5;
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
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
    height: calc(100% - 40px);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  canvas {
    display: block;
    background: #111827;
  }
  
  /* Integrated Resize Handles */
  .resize-handles {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }
  
  .resize-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: rgba(79, 70, 229, 0.8);
    border: 1px solid rgba(79, 70, 229, 1);
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: auto;
    cursor: pointer;
  }
  
  .demo-floating-display:hover .resize-handle {
    opacity: 1;
  }
  
  .resize-handle:hover {
    opacity: 1 !important;
    background: #6366f1;
    transform: scale(1.2);
  }
  
  /* Handle positioning */
  .resize-handle.nw { top: -4px; left: -4px; cursor: nw-resize; }
  .resize-handle.n { top: -4px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
  .resize-handle.ne { top: -4px; right: -4px; cursor: ne-resize; }
  .resize-handle.e { top: 50%; right: -4px; transform: translateY(-50%); cursor: e-resize; }
  .resize-handle.se { bottom: -4px; right: -4px; cursor: se-resize; }
  .resize-handle.s { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
  .resize-handle.sw { bottom: -4px; left: -4px; cursor: sw-resize; }
  .resize-handle.w { top: 50%; left: -4px; transform: translateY(-50%); cursor: w-resize; }
</style>
