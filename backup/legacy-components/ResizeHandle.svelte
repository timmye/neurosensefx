<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { floatingStore, actions, GEOMETRY } from '../stores/floatingStore.js';
  
  export let displayId;
  export let handleType; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
  export let isVisible = true;
  export let position = { x: 0, y: 0 };
  export let size = { width: 220, height: 120 };
  
  const dispatch = createEventDispatcher();
  
  let isHovered = false;
  let isResizing = false;
  
  // ✅ FIXED: Use simple CSS positioning like the working test - no offset calculations
  $: cursorStyle = {
    'nw': 'nw-resize', 'n': 'n-resize', 'ne': 'ne-resize',
    'e': 'e-resize', 'se': 'se-resize', 's': 's-resize',
    'sw': 'sw-resize', 'w': 'w-resize'
  }[handleType] || 'default';
  
  // ✅ SIMPLIFIED: Remove dual visibility control - let parent control visibility completely
  $: showHandle = isVisible;
  
  function handleMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log(`[RESIZE_HANDLE_DEBUG] ${handleType} handle clicked for display ${displayId}`);
    
    const startMousePos = { x: e.clientX, y: e.clientY };
    const startPosition = { ...position };
    const startSize = { ...size };
    
    console.log(`[RESIZE_HANDLE_DEBUG] Starting resize:`, {
      displayId, handleType, startMousePos, startPosition, startSize
    });
    
    // Start resize operation
    actions.startResize(displayId, handleType, startPosition, startSize, startMousePos);
    
    isResizing = true;
    dispatch('resizeStart', { displayId, handleType, startPosition, startSize, startMousePos });
    
    // Add global event listeners
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = cursorStyle;
  }
  
  function handleGlobalMouseMove(e) {
    if (!isResizing) return;
    
    const mousePos = { x: e.clientX, y: e.clientY };
    actions.updateResize(mousePos);
    dispatch('resizeUpdate', { displayId, handleType, mousePos });
  }
  
  function handleGlobalMouseUp(e) {
    if (!isResizing) return;
    
    isResizing = false;
    actions.endResize();
    dispatch('resizeEnd', { displayId, handleType });
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    
    // Restore body styles
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
  
  // Cleanup on component destroy
  onDestroy(() => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
</script>

<div
  class="resize-handle {handleType}"
  class:active={isResizing}
  class:hovered={isHovered}
  style="cursor: {cursorStyle}; display: {showHandle ? 'block' : 'none'};"
  on:mousedown={handleMouseDown}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
></div>

<style>
  .resize-handle {
    position: absolute;
    width: var(--handle-size, 8px);
    height: var(--handle-size, 8px);
    background: rgba(79, 70, 229, 0.8);
    border: 1px solid rgba(79, 70, 229, 1);
    border-radius: 2px;
    cursor: nwse-resize;
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 1000;
  }
  
  .resize-handle:hover {
    opacity: 1;
    background: #6366f1;
    transform: scale(1.2);
  }
  
  .resize-handle.active {
    opacity: 1;
    background: #818cf8;
    transform: scale(1.3);
  }
  
  /* ✅ FIXED: Handle positioning matches test exactly - no offset calculations */
  .resize-handle.nw { top: 0; left: 0; cursor: nw-resize; }
  .resize-handle.n { top: 0; left: 50%; transform: translateX(-50%); cursor: n-resize; }
  .resize-handle.ne { top: 0; right: 0; cursor: ne-resize; }
  .resize-handle.e { top: 50%; right: 0; transform: translateY(-50%); cursor: e-resize; }
  .resize-handle.se { bottom: 0; right: 0; cursor: se-resize; }
  .resize-handle.s { bottom: 0; left: 50%; transform: translateX(-50%); cursor: s-resize; }
  .resize-handle.sw { bottom: 0; left: 0; cursor: sw-resize; }
  .resize-handle.w { top: 50%; left: 0; transform: translateY(-50%); cursor: w-resize; }
  
  /* Corner handles are slightly larger */
  .resize-handle:nth-child(1n):hover,
  .resize-handle:nth-child(3n):hover,
  .resize-handle:nth-child(5n):hover,
  .resize-handle:nth-child(7n):hover {
    width: calc(var(--handle-size, 8px) + 2px);
    height: calc(var(--handle-size, 8px) + 2px);
  }
</style>
