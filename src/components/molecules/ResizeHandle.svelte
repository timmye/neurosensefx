<script>
  import { createEventDispatcher } from 'svelte';
  import { Icon } from '../atoms/index.js';
  
  export let position = 'se'; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let isVisible = true;
  export let isHovered = false;
  export let isActive = false;
  export let constraints = {
    minWidth: 100,
    minHeight: 60,
    maxWidth: 800,
    maxHeight: 600
  };
  
  const dispatch = createEventDispatcher();
  
  // Handle mouse events
  function handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const rect = event.target.parentElement.getBoundingClientRect();
    
    dispatch('resizeStart', {
      position,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
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
    
    dispatch('resizeMove', {
      position,
      deltaX: event.clientX,
      deltaY: event.clientY,
      movementX: event.movementX,
      movementY: event.movementY
    });
  }
  
  function handleMouseUp(event) {
    if (!isActive) return;
    
    dispatch('resizeEnd', {
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
    const rect = event.target.parentElement.getBoundingClientRect();
    
    dispatch('resizeStart', {
      position,
      startX: touch.clientX,
      startY: touch.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      startLeft: rect.left,
      startTop: rect.top,
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
    
    dispatch('resizeMove', {
      position,
      deltaX: touch.clientX,
      deltaY: touch.clientY,
      isTouch: true
    });
  }
  
  function handleTouchEnd(event) {
    if (!isActive) return;
    
    dispatch('resizeEnd', {
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
      case 'nw':
        return 'nw-resize';
      case 'n':
        return 'ns-resize';
      case 'ne':
        return 'ne-resize';
      case 'e':
        return 'ew-resize';
      case 'se':
        return 'se-resize';
      case 's':
        return 'ns-resize';
      case 'sw':
        return 'sw-resize';
      case 'w':
        return 'ew-resize';
      default:
        return 'default';
    }
  })();
  
  // Get icon based on position
  $: icon = (() => {
    switch (position) {
      case 'nw':
        return 'maximize-2';
      case 'n':
        return 'chevron-up';
      case 'ne':
        return 'maximize-2';
      case 'e':
        return 'chevron-right';
      case 'se':
        return 'maximize-2';
      case 's':
        return 'chevron-down';
      case 'sw':
        return 'maximize-2';
      case 'w':
        return 'chevron-left';
      default:
        return 'maximize-2';
    }
  })();
  
  // Get rotation for icon based on position
  $: iconRotation = (() => {
    switch (position) {
      case 'nw':
        return -45;
      case 'ne':
        return 45;
      case 'se':
        return 135;
      case 'sw':
        return -135;
      default:
        return 0;
    }
  })();
  
  // Get positioning styles
  $: positionStyles = (() => {
    switch (position) {
      case 'nw':
        return { top: '-4px', left: '-4px' };
      case 'n':
        return { top: '-4px', left: '50%', transform: 'translateX(-50%)' };
      case 'ne':
        return { top: '-4px', right: '-4px' };
      case 'e':
        return { top: '50%', right: '-4px', transform: 'translateY(-50%)' };
      case 'se':
        return { bottom: '-4px', right: '-4px' };
      case 's':
        return { bottom: '-4px', left: '50%', transform: 'translateX(-50%)' };
      case 'sw':
        return { bottom: '-4px', left: '-4px' };
      case 'w':
        return { top: '50%', left: '-4px', transform: 'translateY(-50%)' };
      default:
        return {};
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
    class="resize-handle"
    class:position-{position}
    class:size-{size}
    class:hovered={isHovered}
    class:active={isActive}
    style="cursor: {cursorStyle}; {Object.entries(positionStyles).map(([k, v]) => `${k}: ${v}`).join('; ')}"
    on:mousedown={handleMouseDown}
    on:touchstart={handleTouchStart}
    on:mouseenter={() => isHovered = true}
    on:mouseleave={() => isHovered = false}
    role="button"
    tabindex="0"
    aria-label="Resize handle {position}"
    aria-describedby="resize-help"
  >
    <div class="handle-visual" style:transform={`rotate(${iconRotation}deg)`}>
      <Icon name={icon} size={size === 'sm' ? 'xs' : size === 'lg' ? 'sm' : 'xs'} />
    </div>
    
    <!-- Resize dots for corner handles -->
    {#if ['nw', 'ne', 'se', 'sw'].includes(position)}
      <div class="resize-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    {/if}
    
    <!-- Touch target for mobile -->
    <div class="touch-target"></div>
  </div>
{/if}

<!-- Hidden help text for screen readers -->
<div id="resize-help" class="sr-only">
  Use to resize the element. Drag to adjust size, or use keyboard shortcuts with Shift + Arrow keys
</div>

<style>
  .resize-handle {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    transition: all var(--motion-fast) var(--ease-snappy);
    z-index: 15;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  
  .resize-handle:hover,
  .resize-handle.hovered {
    background: var(--color-focus);
    border-color: var(--color-focus);
    transform: scale(1.1);
  }
  
  .resize-handle.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    transform: scale(1.2);
    box-shadow: 0 0 0 2px var(--color-primary-light);
  }
  
  /* Position-specific hover overrides */
  .resize-handle.position-n:hover,
  .resize-handle.position-n.hovered {
    transform: translateX(-50%) scale(1.1);
  }
  
  .resize-handle.position-s:hover,
  .resize-handle.position-s.hovered {
    transform: translateX(-50%) scale(1.1);
  }
  
  .resize-handle.position-e:hover,
  .resize-handle.position-e.hovered {
    transform: translateY(-50%) scale(1.1);
  }
  
  .resize-handle.position-w:hover,
  .resize-handle.position-w.hovered {
    transform: translateY(-50%) scale(1.1);
  }
  
  .resize-handle.position-n.active {
    transform: translateX(-50%) scale(1.2);
  }
  
  .resize-handle.position-s.active {
    transform: translateX(-50%) scale(1.2);
  }
  
  .resize-handle.position-e.active {
    transform: translateY(-50%) scale(1.2);
  }
  
  .resize-handle.position-w.active {
    transform: translateY(-50%) scale(1.2);
  }
  
  /* Size variants */
  .resize-handle.size-sm {
    width: 12px;
    height: 12px;
  }
  
  .resize-handle.size-md {
    width: 16px;
    height: 16px;
  }
  
  .resize-handle.size-lg {
    width: 20px;
    height: 20px;
  }
  
  /* Corner handles are slightly larger */
  .resize-handle.position-nw,
  .resize-handle.position-ne,
  .resize-handle.position-se,
  .resize-handle.position-sw {
    width: 16px;
    height: 16px;
  }
  
  .resize-handle.size-md.position-nw,
  .resize-handle.size-md.position-ne,
  .resize-handle.size-md.position-se,
  .resize-handle.size-md.position-sw {
    width: 20px;
    height: 20px;
  }
  
  .resize-handle.size-lg.position-nw,
  .resize-handle.size-lg.position-ne,
  .resize-handle.size-lg.position-se,
  .resize-handle.size-lg.position-sw {
    width: 24px;
    height: 24px;
  }
  
  /* Handle visual */
  .handle-visual {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: color var(--motion-fast) var(--ease-snappy);
  }
  
  .resize-handle:hover .handle-visual,
  .resize-handle.hovered .handle-visual {
    color: white;
  }
  
  .resize-handle.active .handle-visual {
    color: white;
  }
  
  /* Resize dots for corner handles */
  .resize-dots {
    position: absolute;
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .resize-handle:hover .resize-dots,
  .resize-handle.hovered .resize-dots,
  .resize-handle.active .resize-dots {
    opacity: 1;
  }
  
  .dot {
    width: 2px;
    height: 2px;
    background: currentColor;
    border-radius: 50%;
  }
  
  /* Position dots for each corner */
  .resize-handle.position-nw .resize-dots {
    bottom: 1px;
    right: 1px;
    flex-direction: column;
  }
  
  .resize-handle.position-ne .resize-dots {
    bottom: 1px;
    left: 1px;
    flex-direction: column;
  }
  
  .resize-handle.position-se .resize-dots {
    top: 1px;
    left: 1px;
    flex-direction: column-reverse;
  }
  
  .resize-handle.position-sw .resize-dots {
    top: 1px;
    right: 1px;
    flex-direction: column-reverse;
  }
  
  /* Touch target for mobile */
  .touch-target {
    position: absolute;
    top: -8px;
    left: -8px;
    right: -8px;
    bottom: -8px;
    /* Invisible but expands touch area */
  }
  
  /* Focus styles for keyboard navigation */
  .resize-handle:focus {
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
    .resize-handle {
      border-width: 2px;
    }
    
    .resize-handle:hover,
    .resize-handle.hovered,
    .resize-handle.active {
      border-width: 3px;
    }
    
    .resize-dots .dot {
      width: 3px;
      height: 3px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .resize-handle {
      transition: none;
    }
    
    .resize-handle:hover,
    .resize-handle.hovered,
    .resize-handle.active {
      transform: none;
    }
    
    .resize-handle.position-n:hover,
    .resize-handle.position-n.hovered,
    .resize-handle.position-n.active {
      transform: translateX(-50%);
    }
    
    .resize-handle.position-s:hover,
    .resize-handle.position-s.hovered,
    .resize-handle.position-s.active {
      transform: translateX(-50%);
    }
    
    .resize-handle.position-e:hover,
    .resize-handle.position-e.hovered,
    .resize-handle.position-e.active {
      transform: translateY(-50%);
    }
    
    .resize-handle.position-w:hover,
    .resize-handle.position-w.hovered,
    .resize-handle.position-w.active {
      transform: translateY(-50%);
    }
    
    .resize-dots {
      transition: none;
    }
  }
</style>
