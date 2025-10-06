<script>
  import { createEventDispatcher } from 'svelte';
  
  export let isVisible = false;
  export let startPoint = { x: 0, y: 0 };
  export let endPoint = { x: 0, y: 0 };
  export let selectedCount = 0;
  export let selectionMode = 'replace'; // 'replace', 'add', 'subtract'
  
  const dispatch = createEventDispatcher();
  
  // Calculate selection box dimensions
  $: boxDimensions = (() => {
    if (!isVisible) return { width: 0, height: 0, left: 0, top: 0 };
    
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    
    return { left, top, width, height };
  })();
  
  // Get selection mode icon
  $: selectionModeIcon = (() => {
    switch (selectionMode) {
      case 'add':
        return 'plus-square';
      case 'subtract':
        return 'minus-square';
      default:
        return 'square';
    }
  })();
  
  // Get selection mode color
  $: selectionModeColor = (() => {
    switch (selectionMode) {
      case 'add':
        return 'var(--color-success)';
      case 'subtract':
        return 'var(--color-danger)';
      default:
        return 'var(--color-focus)';
    }
  })();
  
  // Handle keyboard shortcuts
  function handleKeydown(event) {
    if (!isVisible) return;
    
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        dispatch('selectionCancel');
        break;
      case 'Enter':
        event.preventDefault();
        dispatch('selectionComplete', { 
          startPoint, 
          endPoint, 
          selectionMode 
        });
        break;
      case 'Shift':
        event.preventDefault();
        selectionMode = selectionMode === 'add' ? 'subtract' : 'add';
        break;
    }
  }
  
  // Update selection box position
  function updateSelection(start, end) {
    startPoint = start;
    endPoint = end;
  }
  
  // Clear selection
  function clearSelection() {
    isVisible = false;
    selectedCount = 0;
    selectionMode = 'replace';
  }
  
  // Expose methods to parent
  export { updateSelection, clearSelection };
  
  // Add global keyboard listener
  import { onMount, onDestroy } from 'svelte';
  
  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if isVisible}
  <!-- Selection box overlay -->
  <div class="selection-overlay">
    <!-- Main selection rectangle -->
    <div
      class="selection-box"
      style="
        left: {boxDimensions.left}px;
        top: {boxDimensions.top}px;
        width: {boxDimensions.width}px;
        height: {boxDimensions.height}px;
        border-color: {selectionModeColor};
        background: {selectionModeColor}15;
      "
    >
      <!-- Selection handles -->
      <div class="selection-handles">
        <!-- Corner handles -->
        <div class="handle corner nw" style="border-color: {selectionModeColor}"></div>
        <div class="handle corner ne" style="border-color: {selectionModeColor}"></div>
        <div class="handle corner se" style="border-color: {selectionModeColor}"></div>
        <div class="handle corner sw" style="border-color: {selectionModeColor}"></div>
        
        <!-- Edge handles -->
        <div class="handle edge n" style="border-color: {selectionModeColor}"></div>
        <div class="handle edge e" style="border-color: {selectionModeColor}"></div>
        <div class="handle edge s" style="border-color: {selectionModeColor}"></div>
        <div class="handle edge w" style="border-color: {selectionModeColor}"></div>
      </div>
    </div>
    
    <!-- Selection info panel -->
    {#if boxDimensions.width > 50 && boxDimensions.height > 30}
      <div
        class="selection-info"
        style="
          left: {boxDimensions.left + boxDimensions.width + 8}px;
          top: {boxDimensions.top}px;
        "
      >
        <div class="info-content">
          <div class="selection-mode" style="color: {selectionModeColor}">
            <span class="mode-icon">{selectionMode.toUpperCase()}</span>
          </div>
          <div class="selection-count">
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
          </div>
          <div class="selection-size">
            {Math.round(boxDimensions.width)} × {Math.round(boxDimensions.height)}
          </div>
        </div>
        
        <!-- Keyboard shortcuts hint -->
        <div class="shortcuts-hint">
          <div class="shortcut">
            <kbd>Enter</kbd> Confirm
          </div>
          <div class="shortcut">
            <kbd>Esc</kbd> Cancel
          </div>
          <div class="shortcut">
            <kbd>Shift</kbd> Toggle mode
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Selection grid lines (for alignment) -->
    <svg class="selection-grid" style="pointer-events: none;">
      <!-- Vertical grid lines -->
      <line
        x1={boxDimensions.left}
        y1={0}
        x2={boxDimensions.left}
        y2={window.innerHeight}
        stroke={selectionModeColor}
        stroke-width="1"
        stroke-dasharray="2,4"
        opacity="0.3"
      />
      <line
        x1={boxDimensions.left + boxDimensions.width}
        y1={0}
        x2={boxDimensions.left + boxDimensions.width}
        y2={window.innerHeight}
        stroke={selectionModeColor}
        stroke-width="1"
        stroke-dasharray="2,4"
        opacity="0.3"
      />
      
      <!-- Horizontal grid lines -->
      <line
        x1={0}
        y1={boxDimensions.top}
        x2={window.innerWidth}
        y2={boxDimensions.top}
        stroke={selectionModeColor}
        stroke-width="1"
        stroke-dasharray="2,4"
        opacity="0.3"
      />
      <line
        x1={0}
        y1={boxDimensions.top + boxDimensions.height}
        x2={window.innerWidth}
        y2={boxDimensions.top + boxDimensions.height}
        stroke={selectionModeColor}
        stroke-width="1"
        stroke-dasharray="2,4"
        opacity="0.3"
      />
    </svg>
  </div>
{/if}

<style>
  .selection-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1000;
  }
  
  .selection-box {
    position: absolute;
    border: 2px solid var(--color-focus);
    background: var(--color-focus-light);
    transition: all 0.1s ease-out;
    pointer-events: none;
  }
  
  /* Selection handles */
  .selection-handles {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
  
  .handle {
    position: absolute;
    background: var(--bg-elevated);
    border: 2px solid var(--color-focus);
    pointer-events: auto;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .handle:hover {
    transform: scale(1.2);
    box-shadow: 0 0 0 1px var(--color-focus-light);
  }
  
  /* Corner handles */
  .handle.corner {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }
  
  .handle.corner.nw {
    top: -4px;
    left: -4px;
    cursor: nw-resize;
  }
  
  .handle.corner.ne {
    top: -4px;
    right: -4px;
    cursor: ne-resize;
  }
  
  .handle.corner.se {
    bottom: -4px;
    right: -4px;
    cursor: se-resize;
  }
  
  .handle.corner.sw {
    bottom: -4px;
    left: -4px;
    cursor: sw-resize;
  }
  
  /* Edge handles */
  .handle.edge {
    width: 6px;
    height: 6px;
    border-radius: 1px;
  }
  
  .handle.edge.n {
    top: -3px;
    left: 50%;
    transform: translateX(-50%);
    cursor: ns-resize;
  }
  
  .handle.edge.e {
    top: 50%;
    right: -3px;
    transform: translateY(-50%);
    cursor: ew-resize;
  }
  
  .handle.edge.s {
    bottom: -3px;
    left: 50%;
    transform: translateX(-50%);
    cursor: ns-resize;
  }
  
  .handle.edge.w {
    top: 50%;
    left: -3px;
    transform: translateY(-50%);
    cursor: ew-resize;
  }
  
  /* Selection info panel */
  .selection-info {
    position: absolute;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-2);
    box-shadow: var(--shadow-md);
    min-width: 120px;
    pointer-events: none;
    z-index: 1001;
  }
  
  .info-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .selection-mode {
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .mode-icon {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  .selection-count {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
  }
  
  .selection-size {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .shortcuts-hint {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .shortcut {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  kbd {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xs);
    padding: 1px 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-secondary);
  }
  
  /* Selection grid */
  .selection-grid {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    .selection-box {
      border-width: 3px;
    }
    
    .handle {
      border-width: 3px;
    }
    
    .selection-info {
      border-width: 2px;
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .selection-box {
      transition: none;
    }
    
    .handle {
      transition: none;
    }
    
    .handle:hover {
      transform: none;
    }
  }
  
  /* Mobile optimizations */
  @media (max-width: 768px) {
    .selection-info {
      min-width: 100px;
      padding: var(--space-1);
    }
    
    .shortcuts-hint {
      display: none;
    }
    
    .handle.corner {
      width: 12px;
      height: 12px;
    }
    
    .handle.edge {
      width: 10px;
      height: 10px;
    }
  }
</style>
