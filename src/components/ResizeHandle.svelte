<script>
  import { interactionManager } from '../managers/InteractionManager.js';
  
  export let handleType; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
  export let isVisible = true;
  export let displayId; // NEW: Parent display ID for InteractionManager
  
  // ✅ SIMPLIFIED: Use InteractionManager directly - no global listeners, no dispatch
  function handleMouseDown(e) {
    console.log(`[RESIZE_HANDLE] Pure trigger: ${handleType} handle clicked for display ${displayId}`);
    
    // ✅ VALIDATION: Check required props before proceeding
    if (!displayId) {
      console.error(`[RESIZE_HANDLE] ERROR: displayId is required but not provided`);
      return;
    }
    
    // ✅ CRITICAL FIX: Remove event blocking to allow mouse move events to reach document listeners
    // REMOVED: e.preventDefault();  // ❌ This was blocking mouse move events
    // REMOVED: e.stopPropagation(); // ❌ This was blocking mouse move events
    
    // ✅ ERROR HANDLING: Safely find display element
    const displayElement = document.querySelector(`[data-display-id="${displayId}"]`);
    if (!displayElement) {
      console.error(`[RESIZE_HANDLE] ERROR: Display element not found for ID ${displayId}`);
      return;
    }
    
    const bounds = displayElement.getBoundingClientRect();
    if (!bounds) {
      console.error(`[RESIZE_HANDLE] ERROR: Could not get bounds for display ${displayId}`);
      return;
    }
    
    // ✅ DIRECT: Use InteractionManager instead of dispatch - single authority
    try {
      interactionManager.handleMouseDown(
        displayId,
        'resize',
        handleType,
        { x: e.clientX, y: e.clientY },
        { 
          position: { x: bounds.left, y: bounds.top },
          size: { width: bounds.width, height: bounds.height }
        }
      );
    } catch (error) {
      console.error(`[RESIZE_HANDLE] ERROR: Failed to start resize interaction:`, error);
    }
  }
</script>

<div
  class="resize-handle {handleType}"
  style="display: {isVisible ? 'block' : 'none'};"
  on:mousedown={handleMouseDown}
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
  
  /* Handle positioning and cursor styles */
  .resize-handle.nw { 
    top: 0; 
    left: 0; 
    cursor: nw-resize; 
  }
  .resize-handle.n { 
    top: 0; 
    left: 50%; 
    transform: translateX(-50%); 
    cursor: n-resize; 
  }
  .resize-handle.ne { 
    top: 0; 
    right: 0; 
    cursor: ne-resize; 
  }
  .resize-handle.e { 
    top: 50%; 
    right: 0; 
    transform: translateY(-50%); 
    cursor: e-resize; 
  }
  .resize-handle.se { 
    bottom: 0; 
    right: 0; 
    cursor: se-resize; 
  }
  .resize-handle.s { 
    bottom: 0; 
    left: 50%; 
    transform: translateX(-50%); 
    cursor: s-resize; 
  }
  .resize-handle.sw { 
    bottom: 0; 
    left: 0; 
    cursor: sw-resize; 
  }
  .resize-handle.w { 
    top: 50%; 
    left: 0; 
    transform: translateY(-50%); 
    cursor: w-resize; 
  }
  
  /* Corner handles are slightly larger */
  .resize-handle.nw:hover,
  .resize-handle.ne:hover,
  .resize-handle.se:hover,
  .resize-handle.sw:hover {
    width: calc(var(--handle-size, 8px) + 2px);
    height: calc(var(--handle-size, 8px) + 2px);
  }
</style>
