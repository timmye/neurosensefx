<script>
  export let id;
  export let x = 100;
  export let y = 100;
  export let width = 200;
  export let height = 150;
  export let title = "Floating Element";
  export let minWidth = 100;
  export let minHeight = 80;
  export let collisionDetection = false;
  export let gridSnapping = false;
  export let gridSize = 20;
  
  // Local state
  let element;
  let isDragging = false;
  let isResizing = false;
  let resizeHandle = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let elementStartX = 0;
  let elementStartY = 0;
  let resizeStartWidth = 0;
  let resizeStartHeight = 0;
  let isHovered = false;
  
  // Get all other floating elements for collision detection
  function getAllFloatingElements() {
    return Array.from(document.querySelectorAll('.clean-floating'))
      .filter(el => el !== element)
      .map(el => ({
        element: el,
        x: parseInt(el.style.left) || 0,
        y: parseInt(el.style.top) || 0,
        width: el.offsetWidth,
        height: el.offsetHeight
      }));
  }
  
  // Improved collision detection with boundary resolution
  function checkCollision(newX, newY, newWidth = width, newHeight = height) {
    if (!collisionDetection) return { canMove: true };
    
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
      
      // Check if collision occurs
      if (newBounds.left < otherBounds.right &&
          newBounds.right > otherBounds.left &&
          newBounds.top < otherBounds.bottom &&
          newBounds.bottom > otherBounds.top) {
        
        // Calculate the non-overlapping position
        const currentBounds = {
          left: x,
          right: x + width,
          top: y,
          bottom: y + height
        };
        
        // Determine the best position to move to (closest non-colliding position)
        const positions = [
          // Slide to the left
          { x: otherBounds.left - newWidth, y: newY },
          // Slide to the right  
          { x: otherBounds.right, y: newY },
          // Slide to the top
          { x: newX, y: otherBounds.top - newHeight },
          // Slide to the bottom
          { x: newX, y: otherBounds.bottom }
        ];
        
        // Find the position with minimum distance from current position
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
  
  // Simple grid snapping
  function snapToGrid(value) {
    if (!gridSnapping) return value;
    return Math.round(value / gridSize) * gridSize;
  }
  
  // Handle drag start
  function handleMouseDown(e) {
    if (e.target.classList.contains('resize-handle')) return;
    if (e.button !== 0) return; // Left click only
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    elementStartX = x;
    elementStartY = y;
    
    element.style.cursor = 'grabbing';
    element.style.zIndex = 1000;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault();
  }
  
  // Handle mouse move (drag and resize)
  function handleMouseMove(e) {
    if (isDragging) {
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      let newX = elementStartX + deltaX;
      let newY = elementStartY + deltaY;
      
      // Apply grid snapping
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
      
      // Check collision
      const collision = checkCollision(newX, newY);
      if (collision.canMove) {
        x = newX;
        y = newY;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      } else if (collision.suggestedPosition) {
        // Use the suggested position to snap to the edge
        x = snapToGrid(collision.suggestedPosition.x);
        y = snapToGrid(collision.suggestedPosition.y);
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      }
    } else if (isResizing) {
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      
      let newWidth = resizeStartWidth;
      let newHeight = resizeStartHeight;
      let newX = x;
      let newY = y;
      
      // Calculate resize based on handle
      switch (resizeHandle) {
        case 'se':
          newWidth = Math.max(minWidth, resizeStartWidth + deltaX);
          newHeight = Math.max(minHeight, resizeStartHeight + deltaY);
          break;
        case 'sw':
          newWidth = Math.max(minWidth, resizeStartWidth - deltaX);
          newHeight = Math.max(minHeight, resizeStartHeight + deltaY);
          if (newWidth !== minWidth) {
            newX = x + (resizeStartWidth - newWidth);
          }
          break;
        case 'ne':
          newWidth = Math.max(minWidth, resizeStartWidth + deltaX);
          newHeight = Math.max(minHeight, resizeStartHeight - deltaY);
          if (newHeight !== minHeight) {
            newY = y + (resizeStartHeight - newHeight);
          }
          break;
        case 'nw':
          newWidth = Math.max(minWidth, resizeStartWidth - deltaX);
          newHeight = Math.max(minHeight, resizeStartHeight - deltaY);
          if (newWidth !== minWidth) {
            newX = x + (resizeStartWidth - newWidth);
          }
          if (newHeight !== minHeight) {
            newY = y + (resizeStartHeight - newHeight);
          }
          break;
        case 'n':
          newHeight = Math.max(minHeight, resizeStartHeight - deltaY);
          if (newHeight !== minHeight) {
            newY = y + (resizeStartHeight - newHeight);
          }
          break;
        case 's':
          newHeight = Math.max(minHeight, resizeStartHeight + deltaY);
          break;
        case 'e':
          newWidth = Math.max(minWidth, resizeStartWidth + deltaX);
          break;
        case 'w':
          newWidth = Math.max(minWidth, resizeStartWidth - deltaX);
          if (newWidth !== minWidth) {
            newX = x + (resizeStartWidth - newWidth);
          }
          break;
      }
      
      // Apply grid snapping
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
      newWidth = snapToGrid(newWidth);
      newHeight = snapToGrid(newHeight);
      
      // Check collision for new position/size (allow touching during resize)
      const collision = checkCollision(newX, newY, newWidth, newHeight);
      if (collision.canMove) {
        x = newX;
        y = newY;
        width = newWidth;
        height = newHeight;
        
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
      } else {
        // During resize, allow the resize if we're just touching edges (not overlapping)
        const touchingOnly = checkIfOnlyTouching(collision.collision, newX, newY, newWidth, newHeight);
        if (touchingOnly) {
          x = newX;
          y = newY;
          width = newWidth;
          height = newHeight;
          
          element.style.left = `${x}px`;
          element.style.top = `${y}px`;
          element.style.width = `${width}px`;
          element.style.height = `${height}px`;
        }
      }
    }
  }
  
  // Handle mouse up
  function handleMouseUp() {
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
    
    element.style.cursor = 'grab';
    element.style.zIndex = '';
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
  
  // Handle resize start
  function handleResizeStart(e, handle) {
    isResizing = true;
    resizeHandle = handle;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    elementStartX = x;
    elementStartY = y;
    resizeStartWidth = width;
    resizeStartHeight = height;
    
    element.style.cursor = `${handle}-resize`;
    element.style.zIndex = 1000;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.stopPropagation();
    e.preventDefault();
  }
  
  // Handle close
  function handleClose() {
    element.remove();
    dispatch('close', { id });
  }
  
  // Check if elements are only touching (not overlapping) - allows resize when touching
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
    
    // Small tolerance to allow touching
    const tolerance = 1;
    
    // Check if bounds are just touching (not overlapping)
    const touchingLeft = Math.abs(newBounds.right - otherBounds.left) <= tolerance;
    const touchingRight = Math.abs(newBounds.left - otherBounds.right) <= tolerance;
    const touchingTop = Math.abs(newBounds.bottom - otherBounds.top) <= tolerance;
    const touchingBottom = Math.abs(newBounds.top - otherBounds.bottom) <= tolerance;
    
    // Allow if touching on any edge but not overlapping
    const horizontalTouch = touchingLeft || touchingRight;
    const verticalTouch = touchingTop || touchingBottom;
    
    // Check for actual overlap (not just touching)
    const horizontalOverlap = newBounds.left < otherBounds.right && newBounds.right > otherBounds.left;
    const verticalOverlap = newBounds.top < otherBounds.bottom && newBounds.bottom > otherBounds.top;
    
    // Allow resize if touching but not overlapping, or if touching on one axis and not overlapping on the other
    return (horizontalTouch && !verticalOverlap) || (verticalTouch && !horizontalOverlap);
  }
  
  // Cleanup
  $: if (element) {
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  }
</script>

<div 
  bind:this={element}
  class="clean-floating"
  class:hovered={isHovered}
  style="left: {x}px; top: {y}px; width: {width}px; height: {height}px;"
  on:mousedown={handleMouseDown}
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
>
  <!-- Header -->
  <div class="header" on:mousedown={handleMouseDown}>
    <div class="title">{title}</div>
    <button class="close-btn" on:click={handleClose}>×</button>
  </div>
  
  <!-- Content -->
  <div class="content">
    <slot />
  </div>
  
  <!-- Resize Handles -->
  {#if isHovered || isResizing}
    <!-- Corner handles -->
    <div class="resize-handle nw" on:mousedown={(e) => handleResizeStart(e, 'nw')}></div>
    <div class="resize-handle ne" on:mousedown={(e) => handleResizeStart(e, 'ne')}></div>
    <div class="resize-handle se" on:mousedown={(e) => handleResizeStart(e, 'se')}></div>
    <div class="resize-handle sw" on:mousedown={(e) => handleResizeStart(e, 'sw')}></div>
    
    <!-- Edge handles -->
    <div class="resize-handle n" on:mousedown={(e) => handleResizeStart(e, 'n')}></div>
    <div class="resize-handle s" on:mousedown={(e) => handleResizeStart(e, 's')}></div>
    <div class="resize-handle e" on:mousedown={(e) => handleResizeStart(e, 'e')}></div>
    <div class="resize-handle w" on:mousedown={(e) => handleResizeStart(e, 'w')}></div>
  {/if}
</div>

<style>
  .clean-floating {
    position: fixed;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .clean-floating:hovered {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
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
  
  .title {
    color: #d1d5db;
    font-weight: bold;
    font-size: 14px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
  
  .resize-handle {
    position: absolute;
    background: #4f46e5;
    border: 1px solid #6366f1;
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .clean-floating:hovered .resize-handle,
  .resize-handle:hover {
    opacity: 1;
  }
  
  .resize-handle:hover {
    background: #6366f1;
  }
  
  /* Corner handles */
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
  
  /* Edge handles */
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
