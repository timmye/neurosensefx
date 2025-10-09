<script>
  import { onMount, createEventDispatcher, setContext } from 'svelte';
  import { workspaceStore, uiStateStore } from '../../../stores/index.js';
  
  const dispatch = createEventDispatcher();
  
  // Interaction state
  let activeCanvas = null;
  let interactionMode = 'normal'; // 'normal', 'resize', 'rotate', 'context'
  let resizeHandle = null;
  let rotateStart = null;
  let contextMenu = null;
  
  // Resize state
  let isResizing = false;
  let resizeStart = { x: 0, y: 0, width: 0, height: 0 };
  let resizeConstraints = null;
  let resizeHandles = [];
  
  // Rotate state
  let isRotating = false;
  let rotationStart = { angle: 0, x: 0, y: 0 };
  
  // Context menu state
  let contextMenuPosition = { x: 0, y: 0 };
  let contextMenuItems = [];
  
  // Gesture state
  let gestureStart = null;
  let isGesturing = false;
  let gestureType = null;
  
  // Configuration
  let config = {
    enableResize: true,
    enableRotate: true,
    enableContextMenu: true,
    enableGestures: true,
    enableKeyboardShortcuts: true,
    resizeThreshold: 5,
    rotateThreshold: 10,
    minCanvasSize: { width: 100, height: 60 },
    maxCanvasSize: { width: 800, height: 600 },
    snapToSize: false,
    sizePresets: [
      { width: 220, height: 120, name: 'Small' },
      { width: 320, height: 180, name: 'Medium' },
      { width: 440, height: 240, name: 'Large' }
    ],
    rotationSnap: true,
    rotationSnapAngle: 15,
    contextMenuDelay: 200
  };
  
  // Context for child components
  setContext('canvasInteractionManager', {
    startResize,
    startRotate,
    showContextMenu,
    hideContextMenu,
    setInteractionMode,
    getInteractionMode: () => interactionMode,
    getActiveCanvas: () => activeCanvas
  });
  
  // Initialize interaction manager
  onMount(() => {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Touch events for mobile
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  });
  
  // Mouse event handlers
  function handleMouseDown(event) {
    const canvas = getCanvasFromElement(event.target);
    const handle = getResizeHandle(event.target);
    
    if (handle && canvas && config.enableResize) {
      startResize(canvas, handle, event);
    } else if (canvas && event.shiftKey && config.enableRotate) {
      startRotate(canvas, event);
    } else if (canvas) {
      setActiveCanvas(canvas);
      setInteractionMode('normal');
    } else {
      hideContextMenu();
      setActiveCanvas(null);
    }
  }
  
  function handleMouseMove(event) {
    if (isResizing && activeCanvas) {
      updateResize(event);
    } else if (isRotating && activeCanvas) {
      updateRotation(event);
    } else {
      updateCursor(event);
    }
  }
  
  function handleMouseUp(event) {
    if (isResizing) {
      endResize(event);
    } else if (isRotating) {
      endRotation(event);
    }
  }
  
  function handleContextMenu(event) {
    event.preventDefault();
    const canvas = getCanvasFromElement(event.target);
    
    if (canvas && config.enableContextMenu) {
      showContextMenu(canvas, event.clientX, event.clientY);
    }
  }
  
  function handleKeyDown(event) {
    if (!config.enableKeyboardShortcuts || !activeCanvas) return;
    
    const { key, ctrlKey, shiftKey, altKey } = event;
    
    // Resize shortcuts
    if (key === 'ArrowUp' && shiftKey) {
      event.preventDefault();
      resizeCanvas(activeCanvas, 0, -10, altKey ? -10 : 0);
    } else if (key === 'ArrowDown' && shiftKey) {
      event.preventDefault();
      resizeCanvas(activeCanvas, 0, 10, altKey ? 10 : 0);
    } else if (key === 'ArrowLeft' && shiftKey) {
      event.preventDefault();
      resizeCanvas(activeCanvas, -10, 0, altKey ? -10 : 0);
    } else if (key === 'ArrowRight' && shiftKey) {
      event.preventDefault();
      resizeCanvas(activeCanvas, 10, 0, altKey ? 10 : 0);
    }
    
    // Rotation shortcuts
    if (key === 'r' && ctrlKey) {
      event.preventDefault();
      rotateCanvasBy(activeCanvas, config.rotationSnapAngle);
    } else if (key === 'r' && ctrlKey && shiftKey) {
      event.preventDefault();
      rotateCanvasBy(activeCanvas, -config.rotationSnapAngle);
    }
    
    // Size presets
    if (key >= '1' && key <= '9' && ctrlKey) {
      const presetIndex = parseInt(key) - 1;
      if (config.sizePresets[presetIndex]) {
        event.preventDefault();
        applySizePreset(activeCanvas, config.sizePresets[presetIndex]);
      }
    }
    
    // Context menu
    if (key === 'ContextMenu' || (key === 'F10' && shiftKey)) {
      event.preventDefault();
      const rect = activeCanvas.element.getBoundingClientRect();
      showContextMenu(activeCanvas, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }
  
  function handleKeyUp(event) {
    // Handle key release if needed
  }
  
  // Touch event handlers
  function handleTouchStart(event) {
    if (!config.enableGestures) return;
    
    const touch = event.touches[0];
    const canvas = getCanvasFromElement(touch.target);
    
    if (canvas) {
      gestureStart = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
        canvas
      };
    }
  }
  
  function handleTouchMove(event) {
    if (!config.enableGestures || !gestureStart) return;
    
    event.preventDefault();
    const touch = event.touches[0];
    const deltaX = touch.clientX - gestureStart.x;
    const deltaY = touch.clientY - gestureStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (!isGesturing && distance > config.resizeThreshold) {
      isGesturing = true;
      
      if (event.touches.length === 2) {
        // Pinch to resize
        gestureType = 'pinch';
        startTouchResize(event);
      } else if (event.touches.length === 1) {
        // Single touch drag
        gestureType = 'drag';
      }
    }
    
    if (isGesturing) {
      if (gestureType === 'pinch') {
        updateTouchResize(event);
      }
    }
  }
  
  function handleTouchEnd(event) {
    if (isGesturing) {
      if (gestureType === 'pinch') {
        endTouchResize();
      }
    }
    
    isGesturing = false;
    gestureType = null;
    gestureStart = null;
  }
  
  // Resize functionality
  function startResize(canvas, handle, event) {
    isResizing = true;
    activeCanvas = canvas;
    resizeHandle = handle;
    interactionMode = 'resize';
    
    const rect = canvas.element.getBoundingClientRect();
    resizeStart = {
      x: event.clientX,
      y: event.clientY,
      width: canvas.size.width,
      height: canvas.size.height,
      left: rect.left,
      top: rect.top
    };
    
    setupResizeConstraints(canvas);
    
    dispatch('resizeStart', {
      canvas,
      handle,
      startSize: { width: canvas.size.width, height: canvas.size.height }
    });
  }
  
  function updateResize(event) {
    if (!isResizing || !activeCanvas) return;
    
    const deltaX = event.clientX - resizeStart.x;
    const deltaY = event.clientY - resizeStart.y;
    
    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    
    // Calculate new size based on handle
    switch (resizeHandle) {
      case 'se':
        newWidth = resizeStart.width + deltaX;
        newHeight = resizeStart.height + deltaY;
        break;
      case 'sw':
        newWidth = resizeStart.width - deltaX;
        newHeight = resizeStart.height + deltaY;
        break;
      case 'ne':
        newWidth = resizeStart.width + deltaX;
        newHeight = resizeStart.height - deltaY;
        break;
      case 'nw':
        newWidth = resizeStart.width - deltaX;
        newHeight = resizeStart.height - deltaY;
        break;
      case 'n':
        newHeight = resizeStart.height - deltaY;
        break;
      case 's':
        newHeight = resizeStart.height + deltaY;
        break;
      case 'e':
        newWidth = resizeStart.width + deltaX;
        break;
      case 'w':
        newWidth = resizeStart.width - deltaX;
        break;
    }
    
    // Apply constraints
    if (resizeConstraints) {
      newWidth = Math.max(config.minCanvasSize.width, Math.min(resizeConstraints.maxWidth, newWidth));
      newHeight = Math.max(config.minCanvasSize.height, Math.min(resizeConstraints.maxHeight, newHeight));
    }
    
    // Snap to size presets
    if (config.snapToSize) {
      const snappedSize = snapToSizePreset(newWidth, newHeight);
      newWidth = snappedSize.width;
      newHeight = snappedSize.height;
    }
    
    // Update canvas size
    workspaceStore.updateCanvas(activeCanvas.id, {
      size: { width: newWidth, height: newHeight }
    });
    
    dispatch('resizeMove', {
      canvas: activeCanvas,
      size: { width: newWidth, height: newHeight },
      handle: resizeHandle
    });
  }
  
  function endResize(event) {
    if (!isResizing || !activeCanvas) return;
    
    const finalSize = activeCanvas.size;
    
    dispatch('resizeEnd', {
      canvas: activeCanvas,
      size: finalSize,
      handle: resizeHandle
    });
    
    isResizing = false;
    resizeHandle = null;
    resizeConstraints = null;
    interactionMode = 'normal';
  }
  
  function resizeCanvas(canvas, deltaX, deltaY, deltaWidth = 0, deltaHeight = 0) {
    const newWidth = Math.max(config.minCanvasSize.width, canvas.size.width + deltaWidth);
    const newHeight = Math.max(config.minCanvasSize.height, canvas.size.height + deltaHeight);
    const newX = canvas.position.x + deltaX;
    const newY = canvas.position.y + deltaY;
    
    workspaceStore.updateCanvas(canvas.id, {
      position: { x: newX, y: newY },
      size: { width: newWidth, height: newHeight }
    });
  }
  
  // Rotation functionality
  function startRotate(canvas, event) {
    isRotating = true;
    activeCanvas = canvas;
    interactionMode = 'rotate';
    
    const rect = canvas.element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    rotationStart = {
      angle: canvas.rotation || 0,
      x: centerX,
      y: centerY,
      startX: event.clientX,
      startY: event.clientY
    };
    
    dispatch('rotateStart', {
      canvas,
      startAngle: rotationStart.angle
    });
  }
  
  function updateRotation(event) {
    if (!isRotating || !activeCanvas) return;
    
    const deltaX = event.clientX - rotationStart.startX;
    const deltaY = event.clientY - rotationStart.startY;
    
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    angle += 90; // Adjust for visual rotation
    
    // Apply rotation snap
    if (config.rotationSnap) {
      angle = Math.round(angle / config.rotationSnapAngle) * config.rotationSnapAngle;
    }
    
    workspaceStore.updateCanvas(activeCanvas.id, { rotation: angle });
    
    dispatch('rotateMove', {
      canvas: activeCanvas,
      angle
    });
  }
  
  function endRotation(event) {
    if (!isRotating || !activeCanvas) return;
    
    const finalAngle = activeCanvas.rotation || 0;
    
    dispatch('rotateEnd', {
      canvas: activeCanvas,
      angle: finalAngle
    });
    
    isRotating = false;
    rotationStart = null;
    interactionMode = 'normal';
  }
  
  function rotateCanvasBy(canvas, deltaAngle) {
    const currentAngle = canvas.rotation || 0;
    const newAngle = currentAngle + deltaAngle;
    
    workspaceStore.updateCanvas(canvas.id, { rotation: newAngle });
    
    dispatch('canvasRotated', {
      canvas,
      angle: newAngle,
      deltaAngle
    });
  }
  
  // Context menu functionality
  function showContextMenu(canvas, x, y) {
    activeCanvas = canvas;
    contextMenuPosition = { x, y };
    contextMenuItems = generateContextMenuItems(canvas);
    
    dispatch('contextMenuShow', {
      canvas,
      position: { x, y },
      items: contextMenuItems
    });
  }
  
  function hideContextMenu() {
    contextMenu = null;
    contextMenuItems = [];
    
    dispatch('contextMenuHide');
  }
  
  function generateContextMenuItems(canvas) {
    const items = [];
    
    // Size presets
    items.push({
      type: 'submenu',
      label: 'Size Preset',
      icon: 'maximize-2',
      items: config.sizePresets.map(preset => ({
        label: preset.name,
        icon: 'square',
        action: () => applySizePreset(canvas, preset)
      }))
    });
    
    // Rotation
    items.push({
      type: 'submenu',
      label: 'Rotation',
      icon: 'rotate-cw',
      items: [
        { label: '0°', action: () => rotateCanvasBy(canvas, -canvas.rotation) },
        { label: '45°', action: () => rotateCanvasBy(canvas, 45 - (canvas.rotation || 0)) },
        { label: '90°', action: () => rotateCanvasBy(canvas, 90 - (canvas.rotation || 0)) },
        { label: '180°', action: () => rotateCanvasBy(canvas, 180 - (canvas.rotation || 0)) },
        { type: 'separator' },
        { label: 'Rotate 15° CW', action: () => rotateCanvasBy(canvas, 15) },
        { label: 'Rotate 15° CCW', action: () => rotateCanvasBy(canvas, -15) }
      ]
    });
    
    // Alignment
    items.push({ type: 'separator' });
    items.push({
      type: 'submenu',
      label: 'Align',
      icon: 'align-center',
      items: [
        { label: 'Center Horizontal', action: () => alignCanvas(canvas, 'center-horizontal') },
        { label: 'Center Vertical', action: () => alignCanvas(canvas, 'center-vertical') },
        { type: 'separator' },
        { label: 'Left Edge', action: () => alignCanvas(canvas, 'left') },
        { label: 'Right Edge', action: () => alignCanvas(canvas, 'right') },
        { label: 'Top Edge', action: () => alignCanvas(canvas, 'top') },
        { label: 'Bottom Edge', action: () => alignCanvas(canvas, 'bottom') }
      ]
    });
    
    // Actions
    items.push({ type: 'separator' });
    items.push({
      label: 'Duplicate',
      icon: 'copy',
      action: () => duplicateCanvas(canvas)
    });
    items.push({
      label: 'Reset Size',
      icon: 'refresh-cw',
      action: () => resetCanvasSize(canvas)
    });
    items.push({
      label: 'Reset Rotation',
      icon: 'rotate-ccw',
      action: () => rotateCanvasBy(canvas, -canvas.rotation)
    });
    
    // Destructive actions
    items.push({ type: 'separator' });
    items.push({
      label: 'Delete',
      icon: 'trash-2',
      variant: 'danger',
      action: () => deleteCanvas(canvas)
    });
    
    return items;
  }
  
  // Touch resize functionality
  function startTouchResize(event) {
    if (event.touches.length !== 2 || !gestureStart?.canvas) return;
    
    isResizing = true;
    activeCanvas = gestureStart.canvas;
    interactionMode = 'resize';
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    
    resizeStart = {
      distance,
      width: activeCanvas.size.width,
      height: activeCanvas.size.height
    };
  }
  
  function updateTouchResize(event) {
    if (!isResizing || !activeCanvas || event.touches.length !== 2) return;
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
    
    const scale = distance / resizeStart.distance;
    const newWidth = Math.max(config.minCanvasSize.width, resizeStart.width * scale);
    const newHeight = Math.max(config.minCanvasSize.height, resizeStart.height * scale);
    
    workspaceStore.updateCanvas(activeCanvas.id, {
      size: { width: newWidth, height: newHeight }
    });
  }
  
  function endTouchResize() {
    isResizing = false;
    interactionMode = 'normal';
  }
  
  // Utility functions
  function getCanvasFromElement(element) {
    const canvasElement = element.closest('.canvas-container');
    if (!canvasElement) return null;
    
    const canvasId = canvasElement.dataset.canvasId;
    if (!canvasId) return null;
    
    const workspace = workspaceStore.get();
    return workspace.layout.canvases.find(c => c.id === canvasId);
  }
  
  function getResizeHandle(element) {
    return element.closest('.resize-handle')?.dataset.handle || null;
  }
  
  function setupResizeConstraints(canvas) {
    const container = document.querySelector('.workspace-container');
    if (!container) {
      resizeConstraints = null;
      return;
    }
    
    const rect = container.getBoundingClientRect();
    const canvasRect = canvas.element.getBoundingClientRect();
    
    resizeConstraints = {
      maxWidth: rect.width - (canvasRect.left - rect.left),
      maxHeight: rect.height - (canvasRect.top - rect.top)
    };
  }
  
  function snapToSizePreset(width, height) {
    let closestPreset = config.sizePresets[0];
    let minDistance = Infinity;
    
    config.sizePresets.forEach(preset => {
      const distance = Math.sqrt(
        Math.pow(width - preset.width, 2) + Math.pow(height - preset.height, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPreset = preset;
      }
    });
    
    return minDistance < 50 ? closestPreset : { width, height };
  }
  
  function applySizePreset(canvas, preset) {
    workspaceStore.updateCanvas(canvas.id, {
      size: { width: preset.width, height: preset.height }
    });
    
    dispatch('sizePresetApplied', {
      canvas,
      preset
    });
  }
  
  function resetCanvasSize(canvas) {
    const defaultSize = config.sizePresets[0] || { width: 220, height: 120 };
    
    workspaceStore.updateCanvas(canvas.id, {
      size: { width: defaultSize.width, height: defaultSize.height }
    });
    
    dispatch('canvasSizeReset', { canvas });
  }
  
  function duplicateCanvas(canvas) {
    const newCanvas = {
      ...canvas,
      id: `canvas_${Date.now()}`,
      position: {
        x: canvas.position.x + 20,
        y: canvas.position.y + 20
      }
    };
    
    workspaceStore.addCanvas(newCanvas);
    
    dispatch('canvasDuplicated', {
      originalCanvas: canvas,
      newCanvas
    });
  }
  
  function deleteCanvas(canvas) {
    workspaceStore.removeCanvas(canvas.id);
    
    dispatch('canvasDeleted', { canvas });
    
    if (activeCanvas?.id === canvas.id) {
      activeCanvas = null;
    }
  }
  
  function alignCanvas(canvas, alignment) {
    const workspace = workspaceStore.get();
    const container = document.querySelector('.workspace-container');
    
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    let newPosition = { ...canvas.position };
    
    switch (alignment) {
      case 'center-horizontal':
        newPosition.x = (rect.width - canvas.size.width) / 2;
        break;
      case 'center-vertical':
        newPosition.y = (rect.height - canvas.size.height) / 2;
        break;
      case 'left':
        newPosition.x = 0;
        break;
      case 'right':
        newPosition.x = rect.width - canvas.size.width;
        break;
      case 'top':
        newPosition.y = 0;
        break;
      case 'bottom':
        newPosition.y = rect.height - canvas.size.height;
        break;
    }
    
    workspaceStore.updateCanvas(canvas.id, { position: newPosition });
    
    dispatch('canvasAligned', {
      canvas,
      alignment,
      position: newPosition
    });
  }
  
  function setActiveCanvas(canvas) {
    activeCanvas = canvas;
    
    dispatch('activeCanvasChanged', { canvas });
  }
  
  function setInteractionMode(mode) {
    interactionMode = mode;
    
    dispatch('interactionModeChanged', { mode });
  }
  
  function updateCursor(event) {
    const handle = getResizeHandle(event.target);
    const canvas = getCanvasFromElement(event.target);
    
    if (handle) {
      // Set resize cursor based on handle
      const cursors = {
        'nw': 'nw-resize',
        'ne': 'ne-resize',
        'sw': 'sw-resize',
        'se': 'se-resize',
        'n': 'n-resize',
        's': 's-resize',
        'e': 'e-resize',
        'w': 'w-resize'
      };
      
      document.body.style.cursor = cursors[handle] || 'default';
    } else if (canvas && event.shiftKey) {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }
  }
  
  // Public API
  export function updateConfiguration(newConfig) {
    config = { ...config, ...newConfig };
  }
  
  export function getConfiguration() {
    return { ...config };
  }
  
  export function getInteractionState() {
    return {
      activeCanvas,
      interactionMode,
      isResizing,
      isRotating,
      resizeHandle,
      contextMenuVisible: contextMenuItems.length > 0
    };
  }
</script>

<!-- Resize Handles -->
{#if activeCanvas}
  <div class="resize-handles" data-canvas-id={activeCanvas.id}>
    <div class="resize-handle nw" data-handle="nw"></div>
    <div class="resize-handle ne" data-handle="ne"></div>
    <div class="resize-handle sw" data-handle="sw"></div>
    <div class="resize-handle se" data-handle="se"></div>
    <div class="resize-handle n" data-handle="n"></div>
    <div class="resize-handle s" data-handle="s"></div>
    <div class="resize-handle e" data-handle="e"></div>
    <div class="resize-handle w" data-handle="w"></div>
  </div>
{/if}

<!-- Context Menu -->
{#if contextMenuItems.length > 0}
  <div 
    class="context-menu"
    style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
  >
    {#each contextMenuItems as item}
      {#if item.type === 'separator'}
        <div class="context-menu-separator"></div>
      {:else if item.type === 'submenu'}
        <div class="context-menu-item has-submenu">
          <Icon name={item.icon} size="xs" />
          <span>{item.label}</span>
          <Icon name="chevron-right" size="xs" />
          <div class="context-menu-submenu">
            {#each item.items as subItem}
              {#if subItem.type === 'separator'}
                <div class="context-menu-separator"></div>
              {:else}
                <div 
                  class="context-menu-item"
                  class:danger={subItem.variant === 'danger'}
                  on:click={() => {
                    subItem.action();
                    hideContextMenu();
                  }}
                >
                  <Icon name={subItem.icon} size="xs" />
                  <span>{subItem.label}</span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {:else}
        <div 
          class="context-menu-item"
          class:danger={item.variant === 'danger'}
          on:click={() => {
            item.action();
            hideContextMenu();
          }}
        >
          <Icon name={item.icon} size="xs" />
          <span>{item.label}</span>
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .resize-handles {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1000;
  }
  
  .resize-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--color-primary);
    border: 1px solid var(--bg-primary);
    border-radius: 2px;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .resize-handles:hover .resize-handle {
    opacity: 1;
  }
  
  .resize-handle.nw { top: -4px; left: -4px; cursor: nw-resize; }
  .resize-handle.ne { top: -4px; right: -4px; cursor: ne-resize; }
  .resize-handle.sw { bottom: -4px; left: -4px; cursor: sw-resize; }
  .resize-handle.se { bottom: -4px; right: -4px; cursor: se-resize; }
  .resize-handle.n { top: -4px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
  .resize-handle.s { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
  .resize-handle.e { right: -4px; top: 50%; transform: translateY(-50%); cursor: e-resize; }
  .resize-handle.w { left: -4px; top: 50%; transform: translateY(-50%); cursor: w-resize; }
  
  .context-menu {
    position: fixed;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: var(--space-1);
    min-width: 180px;
    z-index: 9999;
    user-select: none;
  }
  
  .context-menu-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    transition: all 0.2s ease;
  }
  
  .context-menu-item:hover {
    background: var(--bg-secondary);
  }
  
  .context-menu-item.danger {
    color: var(--color-danger);
  }
  
  .context-menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  
  .context-menu-separator {
    height: 1px;
    background: var(--border-subtle);
    margin: var(--space-1) 0;
  }
  
  .context-menu-item.has-submenu {
    position: relative;
  }
  
  .context-menu-submenu {
    position: absolute;
    left: 100%;
    top: -1px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: var(--space-1);
    min-width: 150px;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
  }
  
  .context-menu-item.has-submenu:hover .context-menu-submenu {
    opacity: 1;
    visibility: visible;
  }
  
  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .resize-handle {
      width: 12px;
      height: 12px;
    }
    
    .context-menu {
      min-width: 160px;
      font-size: var(--font-size-xs);
    }
  }
</style>
