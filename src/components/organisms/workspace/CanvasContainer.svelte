<script>
  import { onMount, onDestroy, createEventDispatcher, setContext } from 'svelte';
  import { workspaceStore } from '../../stores/workspaceStore.js';
  import { performanceStore } from '../../stores/performanceStore.js';
  import { indicatorRegistry, createIndicator } from '../../viz/indicators/index.js';
  
  export let canvasId;
  export let symbol;
  export let position = { x: 0, y: 0 };
  export let size = { width: 220, height: 120 };
  export let settings = {};
  export let activeIndicators = ['priceFloat'];
  export let isVisible = true;
  export let zIndex = 0;
  export let isDragging = false;
  export let isResizable = true;
  export let isSelected = false;
  
  const dispatch = createEventDispatcher();
  
  // Canvas and context references
  let canvasElement;
  let ctx;
  let indicatorInstances = new Map();
  let animationFrameId;
  let lastRenderTime = 0;
  let renderCount = 0;
  
  // State for dragging
  let dragOffset = { x: 0, y: 0 };
  let isDragActive = false;
  
  // State for resizing
  let resizeHandle = null;
  let resizeStart = { x: 0, y: 0, width: 0, height: 0 };
  
  // Provide canvas context to child components
  setContext('canvasId', canvasId);
  setContext('symbol', symbol);
  
  // Reactive indicator instances
  $: if (activeIndicators && ctx) {
    updateIndicatorInstances();
  }
  
  // Market data subscription
  let marketData = {
    currentPrice: 1.23456,
    previousPrice: 1.23455,
    priceChange: 0.00001,
    priceChangePercent: 0.08,
    dayHigh: 1.23500,
    dayLow: 1.23300,
    adrHigh: 1.23600,
    adrLow: 1.23200,
    adrPercentage: 45.5,
    visualHigh: 1.23600,
    visualLow: 1.23200,
    priceHistory: [],
    volatility: 0.0001,
    lastTickTime: Date.now()
  };
  
  // Initialize canvas and indicators
  onMount(() => {
    if (canvasElement) {
      ctx = canvasElement.getContext('2d');
      
      // Set canvas size
      updateCanvasSize();
      
      // Initialize indicators
      updateIndicatorInstances();
      
      // Start render loop
      startRenderLoop();
      
      // Simulate market data updates
      startMarketDataSimulation();
    }
  });
  
  onDestroy(() => {
    // Cleanup indicators
    indicatorInstances.forEach(instance => {
      if (instance.destroy) {
        instance.destroy();
      }
    });
    indicatorInstances.clear();
    
    // Cancel animation frame
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });
  
  function updateCanvasSize() {
    if (canvasElement) {
      // Set actual canvas size
      canvasElement.width = size.width;
      canvasElement.height = size.height;
      
      // Set CSS size
      canvasElement.style.width = `${size.width}px`;
      canvasElement.style.height = `${size.height}px`;
    }
  }
  
  function updateIndicatorInstances() {
    if (!ctx) return;
    
    // Clear existing instances
    indicatorInstances.forEach(instance => {
      if (instance.destroy) {
        instance.destroy();
      }
    });
    indicatorInstances.clear();
    
    // Create new instances
    activeIndicators.forEach(indicatorId => {
      try {
        const indicatorSettings = settings[indicatorId] || {};
        const instance = createIndicator(indicatorId, ctx, indicatorSettings);
        
        if (instance) {
          indicatorInstances.set(indicatorId, instance);
          
          // Initialize indicator
          if (instance.initialize) {
            instance.initialize();
          }
        }
      } catch (error) {
        console.error(`Failed to create indicator ${indicatorId}:`, error);
      }
    });
  }
  
  function startRenderLoop() {
    // Original architecture uses reactive rendering, not continuous animation loop
    // This function is kept for compatibility but the actual rendering is reactive
    console.log('CanvasContainer: Using reactive render-on-demand approach (compatible with original architecture)');
  }
  
  function startMarketDataSimulation() {
    // Simulate market data updates
    const updateInterval = setInterval(() => {
      if (!isVisible) return;
      
      // Simulate price movement
      const priceChange = (Math.random() - 0.5) * 0.0001;
      const newPrice = marketData.currentPrice + priceChange;
      
      marketData = {
        ...marketData,
        previousPrice: marketData.currentPrice,
        currentPrice: newPrice,
        priceChange: newPrice - marketData.previousPrice,
        priceChangePercent: ((newPrice - marketData.previousPrice) / marketData.previousPrice) * 100,
        dayHigh: Math.max(marketData.dayHigh, newPrice),
        dayLow: Math.min(marketData.dayLow, newPrice),
        lastTickTime: Date.now(),
        priceHistory: [...marketData.priceHistory.slice(-99), newPrice], // Keep last 100 prices
        volatility: Math.abs(priceChange)
      };
      
      // Update ADR occasionally
      if (Math.random() < 0.1) {
        marketData.adrPercentage = 30 + Math.random() * 40;
        marketData.adrHigh = newPrice + (marketData.adrPercentage / 100) * 0.01;
        marketData.adrLow = newPrice - (marketData.adrPercentage / 100) * 0.01;
      }
      
    }, 1000); // Update every second
    
    // Cleanup on destroy
    onDestroy(() => clearInterval(updateInterval));
  }
  
  // Drag handlers
  function handleMouseDown(event) {
    if (!isDragging) return;
    
    const rect = canvasElement.getBoundingClientRect();
    dragOffset.x = event.clientX - rect.left - position.x;
    dragOffset.y = event.clientY - rect.top - position.y;
    isDragActive = true;
    
    dispatch('dragStart', { canvasId, position });
  }
  
  function handleMouseMove(event) {
    if (!isDragActive) return;
    
    const newX = event.clientX - dragOffset.x;
    const newY = event.clientY - dragOffset.y;
    
    position = { x: newX, y: newY };
    
    dispatch('dragMove', { canvasId, position });
  }
  
  function handleMouseUp() {
    if (!isDragActive) return;
    
    isDragActive = false;
    dispatch('dragEnd', { canvasId, position });
    
    // Update workspace store
    workspaceStore.updateCanvas(canvasId, { position });
  }
  
  // Resize handlers
  function handleResizeStart(event, handle) {
    if (!isResizable) return;
    
    event.stopPropagation();
    resizeHandle = handle;
    resizeStart = {
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height
    };
    
    dispatch('resizeStart', { canvasId, size, handle });
  }
  
  function handleResizeMove(event) {
    if (!resizeHandle) return;
    
    const deltaX = event.clientX - resizeStart.x;
    const deltaY = event.clientY - resizeStart.y;
    
    let newSize = { ...size };
    
    switch (resizeHandle) {
      case 'se':
        newSize.width = Math.max(100, resizeStart.width + deltaX);
        newSize.height = Math.max(60, resizeStart.height + deltaY);
        break;
      case 'e':
        newSize.width = Math.max(100, resizeStart.width + deltaX);
        break;
      case 's':
        newSize.height = Math.max(60, resizeStart.height + deltaY);
        break;
    }
    
    size = newSize;
    updateCanvasSize();
    
    dispatch('resizeMove', { canvasId, size });
  }
  
  function handleResizeEnd() {
    if (!resizeHandle) return;
    
    const handle = resizeHandle;
    resizeHandle = null;
    
    dispatch('resizeEnd', { canvasId, size, handle });
    
    // Update workspace store
    workspaceStore.updateCanvas(canvasId, { size });
  }
  
  // Selection handlers
  function handleClick(event) {
    if (!isDragActive && !resizeHandle) {
      dispatch('select', { canvasId, event });
    }
  }
  
  function handleDoubleClick() {
    dispatch('doubleClick', { canvasId });
  }
  
  // Context menu
  function handleContextMenu(event) {
    event.preventDefault();
    dispatch('contextMenu', { canvasId, event });
  }
  
  // Indicator management
  function toggleIndicator(indicatorId) {
    const newIndicators = activeIndicators.includes(indicatorId)
      ? activeIndicators.filter(id => id !== indicatorId)
      : [...activeIndicators, indicatorId];
    
    activeIndicators = newIndicators;
    
    workspaceStore.updateCanvas(canvasId, { 
      indicators: activeIndicators,
      settings: { ...settings, [indicatorId]: {} }
    });
    
    dispatch('indicatorsChanged', { canvasId, indicators: activeIndicators });
  }
  
  function updateIndicatorSettings(indicatorId, newSettings) {
    const updatedSettings = { ...settings };
    updatedSettings[indicatorId] = { ...updatedSettings[indicatorId], ...newSettings };
    settings = updatedSettings;
    
    // Update instance if it exists
    const instance = indicatorInstances.get(indicatorId);
    if (instance && instance.updateSettings) {
      instance.updateSettings(newSettings);
    }
    
    workspaceStore.updateCanvas(canvasId, { settings });
    dispatch('settingsChanged', { canvasId, indicatorId, settings: newSettings });
  }
  
  // Keyboard shortcuts
  function handleKeydown(event) {
    if (!isSelected) return;
    
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        dispatch('delete', { canvasId });
        break;
      case ' ':
        event.preventDefault();
        isVisible = !isVisible;
        break;
      case 'r':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Reset to default size
          size = { width: 220, height: 120 };
          updateCanvasSize();
          workspaceStore.updateCanvas(canvasId, { size });
        }
        break;
    }
  }
  
  // Global event listeners
  onMount(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
    window.removeEventListener('keydown', handleKeydown);
  });
  
  // Reactive rendering - matches original Container.svelte approach
  $: if (ctx && marketData && size && isVisible) {
    render();
  }
  
  // Reactive updates
  $: if (canvasElement && ctx) {
    updateCanvasSize();
  }
  
  function render() {
    if (!ctx || !isVisible || !marketData || !size) return;
    
    try {
      // Clear canvas
      ctx.clearRect(0, 0, size.width, size.height);
      
      // Set canvas background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(0, 0, size.width, size.height);
      
      // Render each indicator
      indicatorInstances.forEach((instance, indicatorId) => {
        if (instance && instance.render) {
          const startTime = performance.now();
          
          instance.render(marketData, {
            width: size.width,
            height: size.height,
            canvasId
          });
          
          const renderTime = performance.now() - startTime;
          
          // Update performance metrics
          performanceStore.recordIndicatorRender(indicatorId, renderTime);
        }
      });
      
      renderCount++;
      
      // Dispatch render event
      dispatch('rendered', {
        canvasId,
        renderCount,
        timestamp: performance.now()
      });
      
    } catch (error) {
      console.error('Render error:', error);
    }
  }
</script>

<div 
  class="canvas-container"
  class:selected={isSelected}
  class:dragging={isDragActive}
  class:resizing={resizeHandle !== null}
  style="left: {position.x}px; top: {position.y}px; width: {size.width}px; height: {size.height}px; z-index: {zIndex};"
  on:click={handleClick}
  on:dblclick={handleDoubleClick}
  on:contextmenu={handleContextMenu}
>
  <!-- Canvas element -->
  <canvas 
    bind:this={canvasElement}
    class="canvas-element"
    on:mousedown={handleMouseDown}
  />
  
  <!-- Canvas controls overlay -->
  <div class="canvas-controls" class:visible={isSelected}>
    <!-- Indicator toggles -->
    <div class="indicator-controls">
      {#each indicatorRegistry.getIndicatorIds() as indicatorId}
        <button 
          class="indicator-toggle"
          class:active={activeIndicators.includes(indicatorId)}
          title="{indicatorRegistry.getMetadata(indicatorId)?.name || indicatorId}"
          on:click={() => toggleIndicator(indicatorId)}
        >
          {indicatorRegistry.getMetadata(indicatorId)?.icon || '●'}
        </button>
      {/each}
    </div>
    
    <!-- Canvas actions -->
    <div class="canvas-actions">
      <button 
        class="action-button"
        title="Toggle visibility"
        on:click={() => isVisible = !isVisible}
      >
        {isVisible ? '👁️' : '👁️‍🗨️'}
      </button>
      
      <button 
        class="action-button"
        title="Settings"
        on:click={() => dispatch('settings', { canvasId })}
      >
        ⚙️
      </button>
      
      <button 
        class="action-button delete"
        title="Delete canvas"
        on:click={() => dispatch('delete', { canvasId })}
      >
        🗑️
      </button>
    </div>
  </div>
  
  <!-- Resize handles -->
  {#if isResizable && isSelected}
    <div 
      class="resize-handle e"
      on:mousedown={(e) => handleResizeStart(e, 'e')}
    />
    <div 
      class="resize-handle s"
      on:mousedown={(e) => handleResizeStart(e, 's')}
    />
    <div 
      class="resize-handle se"
      on:mousedown={(e) => handleResizeStart(e, 'se')}
    />
  {/if}
  
  <!-- Selection border -->
  {#if isSelected}
    <div class="selection-border" />
  {/if}
</div>

<style>
  .canvas-container {
    position: absolute;
    background: var(--bg-canvas);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    overflow: hidden;
    cursor: move;
    user-select: none;
    transition: border-color var(--motion-fast) var(--ease-snappy);
  }
  
  .canvas-container:hover {
    border-color: var(--border-default);
  }
  
  .canvas-container.selected {
    border-color: var(--color-focus);
    box-shadow: 0 0 0 1px var(--color-focus);
  }
  
  .canvas-container.dragging {
    opacity: 0.8;
    cursor: grabbing;
    z-index: 1000;
  }
  
  .canvas-container.resizing {
    cursor: nwse-resize;
  }
  
  .canvas-element {
    display: block;
    width: 100%;
    height: 100%;
  }
  
  .canvas-controls {
    position: absolute;
    top: 4px;
    right: 4px;
    left: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    opacity: 0;
    transition: opacity var(--motion-fast) var(--ease-snappy);
    pointer-events: none;
  }
  
  .canvas-controls.visible {
    opacity: 1;
    pointer-events: auto;
  }
  
  .selected .canvas-controls {
    opacity: 1;
    pointer-events: auto;
  }
  
  .indicator-controls {
    display: flex;
    gap: 2px;
  }
  
  .indicator-toggle {
    padding: 2px 6px;
    font-size: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 2px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .indicator-toggle:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .indicator-toggle.active {
    background: var(--color-focus);
    color: white;
    border-color: var(--color-focus);
  }
  
  .canvas-actions {
    display: flex;
    gap: 2px;
  }
  
  .action-button {
    padding: 2px 6px;
    font-size: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: 2px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .action-button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  .action-button.delete:hover {
    background: var(--color-danger);
    color: white;
    border-color: var(--color-danger);
  }
  
  .resize-handle {
    position: absolute;
    background: var(--color-focus);
    opacity: 0;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .selected .resize-handle {
    opacity: 0.6;
  }
  
  .resize-handle:hover {
    opacity: 1;
  }
  
  .resize-handle.e {
    top: 4px;
    right: 0;
    bottom: 4px;
    width: 4px;
    cursor: ew-resize;
  }
  
  .resize-handle.s {
    left: 4px;
    right: 4px;
    bottom: 0;
    height: 4px;
    cursor: ns-resize;
  }
  
  .resize-handle.se {
    right: 0;
    bottom: 0;
    width: 8px;
    height: 8px;
    cursor: nwse-resize;
    border-radius: 0 0 4px 0;
  }
  
  .selection-border {
    position: absolute;
    top: -2px;
    left: -2px;
    right: -2px;
    bottom: -2px;
    border: 2px solid var(--color-focus);
    border-radius: 6px;
    pointer-events: none;
  }
</style>
