<script>
  import { createEventDispatcher } from 'svelte';
  import { Icon } from '../atoms/index.js';
  
  export let position = 'right'; // 'top', 'right', 'bottom', 'left'
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let isVisible = true;
  export let isHovered = false;
  export let isActive = false;
  
  const dispatch = createEventDispatcher();
  
  // Handle mouse events
  function handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    
    dispatch('dragStart', {
      position,
      startX: event.clientX,
      startY: event.clientY,
      button: event.button
    });
    
    // Add global event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Add active state
    isActive = true;
  }
  
  function handleMouseMove(event) {
    if (!isActive) return;
    
    dispatch('dragMove', {
      position,
      deltaX: event.clientX,
      deltaY: event.clientY,
      movementX: event.movementX,
      movementY: event.movementY
    });
  }
  
  function handleMouseUp(event) {
    if (!isActive) return;
    
    dispatch('dragEnd', {
      position,
      endX: event.clientX,
      endY: event.clientY
    });
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Remove active state
    isActive = false;
  }
  
  // Handle touch events
  function handleTouchStart(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const touch = event.touches[0];
    
    dispatch('dragStart', {
      position,
      startX: touch.clientX,
      startY: touch.clientY,
      isTouch: true
    });
    
    // Add global touch event listeners
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    isActive = true;
  }
  
  function handleTouchMove(event) {
    if (!isActive) return;
    event.preventDefault();
    
    const touch = event.touches[0];
    
    dispatch('dragMove', {
      position,
      deltaX: touch.clientX,
      deltaY: touch.clientY,
      isTouch: true
    });
  }
  
  function handleTouchEnd(event) {
    if (!isActive) return;
    
    dispatch('dragEnd', {
      position,
      isTouch: true
    });
    
    // Remove global touch event listeners
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    isActive = false;
  }
  
  // Get cursor style based on position
  $: cursorStyle = (() => {
    switch (position) {
      case 'top':
      case 'bottom':
        return 'ns-resize';
      case 'left':
      case 'right':
        return 'ew-resize';
      default:
        return 'move';
    }
  })();
  
  // Get icon based on position
  $: icon = (() => {
    switch (position) {
      case 'top':
        return 'chevron-up';
      case 'right':
        return 'chevron-right';
      case 'bottom':
        return 'chevron-down';
      case 'left':
        return 'chevron-left';
      default:
        return 'move';
    }
  })();
  
  // Cleanup on destroy
  import { onDestroy } from 'svelte';
  
  onDestroy(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  });
</script>

{#if isVisible}
  <div
    class="drag-handle"
    class:position-{position}
    class:size-{size}
    class:hovered={isHovered}
    class:active={isActive}
    style="cursor: {cursorStyle}"
    on:mousedown={handleMouseDown}
    on:touchstart={handleTouchStart}
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
    role="button"
    tabindex="0"
    aria-label="Drag handle"
    aria-describedby="drag-help"
  >
    <div class="handle-visual">
      <Icon name={icon} size={size === 'sm' ? 'xs' : size === 'lg' ? 'sm' : 'xs'} />
    </div>
    
    <!-- Touch target for mobile -->
    <div class="touch-target"></div>
  </div>
{/if}

<!-- Hidden help text for screen readers -->
<div id="drag-help" class="sr-only">
  Use arrow keys to move, or drag with mouse or touch to reposition
</div>

<style>
  .drag-handle {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    transition: all var(--motion-fast) var(--ease-snappy);
    z-index: 10;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  
  .drag-handle:hover,
  .drag-handle.hovered {
    background: var(--color-focus);
    border-color: var(--color-focus);
    transform: scale(1.1);
  }
  
  .drag-handle.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    transform: scale(1.2);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }
  
  /* Position variants */
  .drag-handle.position-top {
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .drag-handle.position-right {
    top: 50%;
    right: -4px;
    transform: translateY(-50%);
  }
  
  .drag-handle.position-bottom {
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .drag-handle.position-left {
    top: 50%;
    left: -4px;
    transform: translateY(-50%);
  }
  
  /* Size variants */
  .drag-handle.size-sm {
    width: 16px;
    height: 16px;
  }
  
  .drag-handle.size-md {
    width: 20px;
    height: 20px;
  }
  
  .drag-handle.size-lg {
    width: 24px;
    height: 24px;
  }
  
  /* Hover state overrides for position */
  .drag-handle.position-top:hover,
  .drag-handle.position-top.hovered {
    transform: translateX(-50%) scale(1.1);
  }
  
  .drag-handle.position-right:hover,
  .drag-handle.position-right.hovered {
    transform: translateY(-50%) scale(1.1);
  }
  
  .drag-handle.position-bottom:hover,
  .drag-handle.position-bottom.hovered {
    transform: translateX(-50%) scale(1.1);
  }
  
  .drag-handle.position-left:hover,
  .drag-handle.position-left.hovered {
    transform: translateY(-50%) scale(1.1);
  }
  
  /* Active state overrides for position */
  .drag-handle.position-top.active {
    transform: translateX(-50%) scale(1.2);
  }
  
  .drag-handle.position-right.active {
    transform: translateY(-50%) scale(1.2);
  }
  
  .drag-handle.position-bottom.active {
    transform: translateX(-50%) scale(1.2);
  }
  
  .drag-handle.position-left.active {
    transform: translateY(-50%) scale(1.2);
  }
  
  /* Handle visual */
  .handle-visual {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: color var(--motion-fast) var(--ease-snappy);
  }
  
  .drag-handle:hover .handle-visual,
  .drag-handle.hovered .handle-visual {
    color: white;
  }
  
  .drag-handle.active .handle-visual {
    color: white;
  }
  
  /* Touch target for mobile */
  .touch-target {
    position: absolute;
    top: -10px;
    left: -10px;
    right: -10px;
    bottom: -10px;
    /* Invisible but expands touch area */
  }
  
  /* Focus styles for keyboard navigation */
  .drag-handle:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  /* Screen reader only text */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .drag-handle {
      border-width: 2px;
    }
    
    .drag-handle:hover,
    .drag-handle.hovered,
    .drag-handle.active {
      border-width: 3px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .drag-handle {
      transition: none;
    }
    
    .drag-handle:hover,
    .drag-handle.hovered,
    .drag-handle.active {
      transform: none;
    }
    
    .drag-handle.position-top:hover,
    .drag-handle.position-top.hovered,
    .drag-handle.position-top.active {
      transform: translateX(-50%);
    }
    
    .drag-handle.position-right:hover,
    .drag-handle.position-right.hovered,
    .drag-handle.position-right.active {
      transform: translateY(-50%);
    }
    
    .drag-handle.position-bottom:hover,
    .drag-handle.position-bottom.hovered,
    .drag-handle.position-bottom.active {
      transform: translateX(-50%);
    }
    
    .drag-handle.position-left:hover,
    .drag-handle.position-left.hovered,
    .drag-handle.position-left.active {
      transform: translateY(-50%);
    }
  }
</style>
