<script>
  import { onMount, createEventDispatcher, setContext } from 'svelte';
  import { workspaceStore, uiStateStore } from '../../../stores/index.js';
  import { GridSnapIndicator } from '../../molecules/index.js';
  
  const dispatch = createEventDispatcher();
  
  // Drag state
  let isDragging = false;
  let draggedCanvas = null;
  let dragStartPos = { x: 0, y: 0 };
  let canvasStartPos = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let dragConstraints = null;
  let dragBounds = null;
  
  // Multi-selection state
  let selectedCanvases = [];
  let selectionBox = null;
  let isSelecting = false;
  let selectionStart = { x: 0, y: 0 };
  
  // Visual feedback state
  let dragPreview = null;
  let dropZones = [];
  let validDropZone = null;
  let dragGhost = null;
  
  // Grid integration
  let gridComponent = null;
  let snapIndicator = { show: false, point: null };
  
  // Performance optimization
  let rafId = null;
  let lastUpdate = 0;
  const UPDATE_THROTTLE = 16; // 60fps
  
  // Configuration
  let config = {
    enableGridSnap: true,
    enableCanvasSnap: true,
    enableMultiSelect: true,
    enableDragPreview: true,
    enableDropZones: true,
    dragThreshold: 5,
    selectionThreshold: 10,
    enableConstraints: true,
    enableAutoScroll: true,
    autoScrollMargin: 50,
    autoScrollSpeed: 10
  };
  
  // Context for child components
  setContext('dragDropManager', {
    startDrag,
    endDrag,
    isDragging: () => isDragging,
    getDraggedCanvas: () => draggedCanvas,
    getSelectedCanvases: () => selectedCanvases,
    selectCanvas,
    deselectCanvas,
    clearSelection
  });
  
  // Initialize drag drop manager
  onMount(() => {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  });
  
  // Mouse event handlers
  function handleMouseDown(event) {
    const canvas = getCanvasFromElement(event.target);
    
    if (canvas) {
      if (event.ctrlKey || event.metaKey) {
        // Multi-selection with Ctrl/Cmd
        toggleCanvasSelection(canvas);
      } else if (event.shiftKey && selectedCanvases.length > 0) {
        // Range selection with Shift
        selectCanvasRange(canvas);
      } else if (!selectedCanvases.includes(canvas)) {
        // Start new selection/drag
        if (selectedCanvases.length === 0) {
          startDrag(canvas, event);
        } else {
          clearSelection();
          startDrag(canvas, event);
        }
      }
    } else if (config.enableMultiSelect) {
      // Start selection box
      startSelectionBox(event);
    }
  }
  
  function handleMouseMove(event) {
    if (isDragging && draggedCanvas) {
      updateDragPosition(event);
    } else if (isSelecting) {
      updateSelectionBox(event);
    }
  }
  
  function handleMouseUp(event) {
    if (isDragging) {
      endDrag(event);
    } else if (isSelecting) {
      endSelectionBox(event);
    }
  }
  
  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      cancelDrag();
      clearSelection();
    } else if (event.key === 'Delete' && selectedCanvases.length > 0) {
      deleteSelectedCanvases();
    } else if (event.ctrlKey && event.key === 'a') {
      event.preventDefault();
      selectAllCanvases();
    }
  }
  
  function handleKeyUp(event) {
    // Handle key release if needed
  }
  
  // Drag functionality
  function startDrag(canvas, event) {
    if (!canvas || isDragging) return;
    
    isDragging = true;
    draggedCanvas = canvas;
    
    const rect = canvas.element.getBoundingClientRect();
    dragStartPos = { x: event.clientX, y: event.clientY };
    canvasStartPos = { x: canvas.position.x, y: canvas.position.y };
    dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    // Setup drag constraints
    setupDragConstraints(canvas);
    
    // Setup drag preview
    if (config.enableDragPreview) {
      createDragPreview(canvas);
    }
    
    // Setup drop zones
    if (config.enableDropZones) {
      identifyDropZones();
    }
    
    // Add drag styles
    canvas.element.classList.add('dragging');
    document.body.classList.add('dragging');
    
    dispatch('dragStart', {
      canvas,
      position: canvasStartPos,
      selectedCanvases: [...selectedCanvases]
    });
  }
  
  function updateDragPosition(event) {
    if (!isDragging || !draggedCanvas) return;
    
    // Throttle updates for performance
    const now = Date.now();
    if (now - lastUpdate < UPDATE_THROTTLE) return;
    lastUpdate = now;
    
    const currentPos = { x: event.clientX, y: event.clientY };
    const deltaX = currentPos.x - dragStartPos.x;
    const deltaY = currentPos.y - dragStartPos.y;
    
    let newX = canvasStartPos.x + deltaX;
    let newY = canvasStartPos.y + deltaY;
    
    // Apply constraints
    if (config.enableConstraints && dragBounds) {
      newX = Math.max(dragBounds.minX, Math.min(dragBounds.maxX, newX));
      newY = Math.max(dragBounds.minY, Math.min(dragBounds.maxY, newY));
    }
    
    // Apply grid snapping
    if (config.enableGridSnap && gridComponent) {
      const snapResult = gridComponent.snapPosition(draggedCanvas, newX, newY);
      if (snapResult.snapInfo.snapped) {
        newX = snapResult.x;
        newY = snapResult.y;
        updateSnapIndicator(snapResult.snapInfo);
      } else {
        clearSnapIndicator();
      }
    }
    
    // Update dragged canvas position
    const finalPosition = { x: newX, y: newY };
    workspaceStore.updateCanvas(draggedCanvas.id, {
      position: finalPosition
    });
    
    // Update multi-selected canvases
    if (selectedCanvases.length > 1) {
      updateSelectedCanvasesPosition(deltaX, deltaY);
    }
    
    // Update drag preview
    if (config.enableDragPreview && dragPreview) {
      updateDragPreview(finalPosition);
    }
    
    // Check drop zones
    if (config.enableDropZones) {
      updateDropZones(currentPos);
    }
    
    // Auto-scroll if needed
    if (config.enableAutoScroll) {
      handleAutoScroll(event);
    }
    
    dispatch('dragMove', {
      canvas: draggedCanvas,
      position: finalPosition,
      deltaX,
      deltaY
    });
  }
  
  function endDrag(event) {
    if (!isDragging || !draggedCanvas) return;
    
    const finalPosition = draggedCanvas.position;
    
    // Check for valid drop zone
    if (config.enableDropZones && validDropZone) {
      handleDropZone(validDropZone);
    }
    
    // Clean up drag styles
    draggedCanvas.element.classList.remove('dragging');
    document.body.classList.remove('dragging');
    
    // Clean up drag preview
    if (config.enableDragPreview && dragPreview) {
      removeDragPreview();
    }
    
    // Clean up snap indicator
    clearSnapIndicator();
    
    // Clean up drop zones
    clearDropZones();
    
    dispatch('dragEnd', {
      canvas: draggedCanvas,
      position: finalPosition,
      selectedCanvases: [...selectedCanvases],
      dropZone: validDropZone
    });
    
    // Reset state
    isDragging = false;
    draggedCanvas = null;
    dragConstraints = null;
    dragBounds = null;
    validDropZone = null;
    
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  
  function cancelDrag() {
    if (!isDragging || !draggedCanvas) return;
    
    // Restore original position
    workspaceStore.updateCanvas(draggedCanvas.id, {
      position: canvasStartPos
    });
    
    // Restore selected canvases positions
    if (selectedCanvases.length > 1) {
      restoreSelectedCanvasesPosition();
    }
    
    endDrag({ clientX: dragStartPos.x, clientY: dragStartPos.y });
  }
  
  // Multi-selection functionality
  function selectCanvas(canvas, addToSelection = false) {
    if (!canvas) return;
    
    if (!addToSelection) {
      clearSelection();
    }
    
    if (!selectedCanvases.includes(canvas)) {
      selectedCanvases.push(canvas);
      canvas.element.classList.add('selected');
      
      dispatch('canvasSelected', {
        canvas,
        selectedCanvases: [...selectedCanvases]
      });
    }
  }
  
  function deselectCanvas(canvas) {
    if (!canvas) return;
    
    const index = selectedCanvases.indexOf(canvas);
    if (index > -1) {
      selectedCanvases.splice(index, 1);
      canvas.element.classList.remove('selected');
      
      dispatch('canvasDeselected', {
        canvas,
        selectedCanvases: [...selectedCanvases]
      });
    }
  }
  
  function toggleCanvasSelection(canvas) {
    if (selectedCanvases.includes(canvas)) {
      deselectCanvas(canvas);
    } else {
      selectCanvas(canvas, true);
    }
  }
  
  function selectCanvasRange(targetCanvas) {
    if (selectedCanvases.length === 0) return;
    
    const workspace = workspaceStore.get();
    const allCanvases = workspace.layout.canvases;
    
    const lastIndex = allCanvases.findIndex(c => 
      selectedCanvases[selectedCanvases.length - 1].id === c.id
    );
    const targetIndex = allCanvases.findIndex(c => c.id === targetCanvas.id);
    
    if (lastIndex !== -1 && targetIndex !== -1) {
      const start = Math.min(lastIndex, targetIndex);
      const end = Math.max(lastIndex, targetIndex);
      
      clearSelection();
      
      for (let i = start; i <= end; i++) {
        const canvas = allCanvases[i];
        if (canvas) {
          selectCanvas(canvas, true);
        }
      }
    }
  }
  
  function selectAllCanvases() {
    const workspace = workspaceStore.get();
    clearSelection();
    
    workspace.layout.canvases.forEach(canvas => {
      selectCanvas(canvas, true);
    });
  }
  
  function clearSelection() {
    selectedCanvases.forEach(canvas => {
      canvas.element.classList.remove('selected');
    });
    selectedCanvases = [];
    
    dispatch('selectionCleared');
  }
  
  function deleteSelectedCanvases() {
    if (selectedCanvases.length === 0) return;
    
    const canvasIds = selectedCanvases.map(canvas => canvas.id);
    
    canvasIds.forEach(id => {
      workspaceStore.removeCanvas(id);
    });
    
    dispatch('canvasesDeleted', { canvasIds });
    clearSelection();
  }
  
  // Selection box functionality
  function startSelectionBox(event) {
    isSelecting = true;
    selectionStart = { x: event.clientX, y: event.clientY };
    
    selectionBox = {
      start: selectionStart,
      end: selectionStart,
      element: createSelectionBoxElement()
    };
  }
  
  function updateSelectionBox(event) {
    if (!isSelecting || !selectionBox) return;
    
    selectionBox.end = { x: event.clientX, y: event.clientY };
    updateSelectionBoxElement(selectionBox);
    
    // Check for canvases within selection box
    const canvasesInBox = getCanvasesInSelectionBox(selectionBox);
    highlightCanvasesInSelection(canvasesInBox);
  }
  
  function endSelectionBox(event) {
    if (!isSelecting || !selectionBox) return;
    
    const canvasesInBox = getCanvasesInSelectionBox(selectionBox);
    
    if (canvasesInBox.length > 0) {
      clearSelection();
      canvasesInBox.forEach(canvas => selectCanvas(canvas, true));
    }
    
    removeSelectionBoxElement(selectionBox);
    selectionBox = null;
    isSelecting = false;
  }
  
  // Visual feedback functions
  function createDragPreview(canvas) {
    dragPreview = {
      element: canvas.element.cloneNode(true),
      offset: dragOffset
    };
    
    dragPreview.element.classList.add('drag-preview');
    dragPreview.element.style.position = 'fixed';
    dragPreview.element.style.pointerEvents = 'none';
    dragPreview.element.style.zIndex = '9999';
    dragPreview.element.style.opacity = '0.7';
    
    document.body.appendChild(dragPreview.element);
  }
  
  function updateDragPreview(position) {
    if (!dragPreview || !dragPreview.element) return;
    
    dragPreview.element.style.left = `${position.x}px`;
    dragPreview.element.style.top = `${position.y}px`;
  }
  
  function removeDragPreview() {
    if (dragPreview && dragPreview.element) {
      dragPreview.element.remove();
      dragPreview = null;
    }
  }
  
  function updateSnapIndicator(snapInfo) {
    if (snapInfo.snapped) {
      snapIndicator = {
        show: true,
        point: snapInfo.snapPoint || { 
          x: draggedCanvas.position.x, 
          y: draggedCanvas.position.y,
          type: snapInfo.gridSnap ? 'grid' : 'canvas'
        }
      };
    } else {
      clearSnapIndicator();
    }
  }
  
  function clearSnapIndicator() {
    snapIndicator = { show: false, point: null };
  }
  
  // Constraint and boundary functions
  function setupDragConstraints(canvas) {
    if (!config.enableConstraints) return;
    
    const workspace = workspaceStore.get();
    const container = document.querySelector('.workspace-container');
    
    if (container) {
      const rect = container.getBoundingClientRect();
      dragBounds = {
        minX: 0,
        minY: 0,
        maxX: rect.width - canvas.size.width,
        maxY: rect.height - canvas.size.height
      };
    }
  }
  
  // Drop zone functions
  function identifyDropZones() {
    // Implement drop zone identification logic
    dropZones = [];
    
    // Example: identify panel areas as drop zones
    const panels = document.querySelectorAll('.drop-zone');
    panels.forEach(panel => {
      const rect = panel.getBoundingClientRect();
      dropZones.push({
        element: panel,
        rect,
        type: 'panel',
        valid: true
      });
    });
  }
  
  function updateDropZones(mousePos) {
    validDropZone = null;
    
    dropZones.forEach(zone => {
      const isValid = isPointInRect(mousePos, zone.rect);
      zone.element.classList.toggle('valid-drop', isValid);
      
      if (isValid && !validDropZone) {
        validDropZone = zone;
      }
    });
  }
  
  function clearDropZones() {
    dropZones.forEach(zone => {
      zone.element.classList.remove('valid-drop');
    });
    dropZones = [];
    validDropZone = null;
  }
  
  function handleDropZone(dropZone) {
    dispatch('canvasDropped', {
      canvas: draggedCanvas,
      dropZone,
      selectedCanvases: [...selectedCanvases]
    });
  }
  
  // Auto-scroll functionality
  function handleAutoScroll(event) {
    if (!config.enableAutoScroll) return;
    
    const container = document.querySelector('.workspace-container');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const scrollSpeed = config.autoScrollSpeed;
    const margin = config.autoScrollMargin;
    
    let scrollX = 0;
    let scrollY = 0;
    
    if (event.clientX < rect.left + margin) {
      scrollX = -scrollSpeed;
    } else if (event.clientX > rect.right - margin) {
      scrollX = scrollSpeed;
    }
    
    if (event.clientY < rect.top + margin) {
      scrollY = -scrollSpeed;
    } else if (event.clientY > rect.bottom - margin) {
      scrollY = scrollSpeed;
    }
    
    if (scrollX !== 0 || scrollY !== 0) {
      container.scrollBy(scrollX, scrollY);
    }
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
  
  function isPointInRect(point, rect) {
    return point.x >= rect.left && 
           point.x <= rect.right && 
           point.y >= rect.top && 
           point.y <= rect.bottom;
  }
  
  function createSelectionBoxElement() {
    const element = document.createElement('div');
    element.className = 'selection-box';
    element.style.position = 'fixed';
    element.style.border = '2px dashed var(--color-primary)';
    element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    element.style.pointerEvents = 'none';
    element.style.zIndex = '9998';
    document.body.appendChild(element);
    return element;
  }
  
  function updateSelectionBoxElement(box) {
    if (!box.element) return;
    
    const left = Math.min(box.start.x, box.end.x);
    const top = Math.min(box.start.y, box.end.y);
    const width = Math.abs(box.end.x - box.start.x);
    const height = Math.abs(box.end.y - box.start.y);
    
    box.element.style.left = `${left}px`;
    box.element.style.top = `${top}px`;
    box.element.style.width = `${width}px`;
    box.element.style.height = `${height}px`;
  }
  
  function removeSelectionBoxElement(box) {
    if (box && box.element) {
      box.element.remove();
    }
  }
  
  function getCanvasesInSelectionBox(box) {
    const workspace = workspaceStore.get();
    const canvasesInBox = [];
    
    workspace.layout.canvases.forEach(canvas => {
      const element = document.querySelector(`[data-canvas-id="${canvas.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        const canvasCenter = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
        
        if (isPointInRect(canvasCenter, {
          left: Math.min(box.start.x, box.end.x),
          right: Math.max(box.start.x, box.end.x),
          top: Math.min(box.start.y, box.end.y),
          bottom: Math.max(box.start.y, box.end.y)
        })) {
          canvasesInBox.push(canvas);
        }
      }
    });
    
    return canvasesInBox;
  }
  
  function highlightCanvasesInSelection(canvases) {
    // Clear previous highlights
    document.querySelectorAll('.canvas-selection-highlight').forEach(el => {
      el.classList.remove('canvas-selection-highlight');
    });
    
    // Add highlights
    canvases.forEach(canvas => {
      const element = document.querySelector(`[data-canvas-id="${canvas.id}"]`);
      if (element && !selectedCanvases.includes(canvas)) {
        element.classList.add('canvas-selection-highlight');
      }
    });
  }
  
  function updateSelectedCanvasesPosition(deltaX, deltaY) {
    selectedCanvases.forEach(canvas => {
      if (canvas.id !== draggedCanvas.id) {
        const newPos = {
          x: canvas.position.x + deltaX,
          y: canvas.position.y + deltaY
        };
        
        // Apply constraints
        if (config.enableConstraints && dragBounds) {
          newPos.x = Math.max(dragBounds.minX, Math.min(dragBounds.maxX, newPos.x));
          newPos.y = Math.max(dragBounds.minY, Math.min(dragBounds.maxY, newPos.y));
        }
        
        workspaceStore.updateCanvas(canvas.id, { position: newPos });
      }
    });
  }
  
  function restoreSelectedCanvasesPosition() {
    selectedCanvases.forEach(canvas => {
      if (canvas.id !== draggedCanvas.id) {
        // Restore to original relative position
        const deltaX = canvas.position.x - draggedCanvas.position.x;
        const deltaY = canvas.position.y - draggedCanvas.position.y;
        const newPos = {
          x: canvasStartPos.x + deltaX,
          y: canvasStartPos.y + deltaY
        };
        workspaceStore.updateCanvas(canvas.id, { position: newPos });
      }
    });
  }
  
  // Public API
  export function setGridComponent(grid) {
    gridComponent = grid;
  }
  
  export function updateConfiguration(newConfig) {
    config = { ...config, ...newConfig };
  }
  
  export function getConfiguration() {
    return { ...config };
  }
  
  export function getDragState() {
    return {
      isDragging,
      draggedCanvas,
      selectedCanvases: [...selectedCanvases],
      dragPosition: draggedCanvas?.position
    };
  }
</script>

<!-- Grid Snap Indicator -->
<GridSnapIndicator
  snapPoint={snapIndicator.point}
  showIndicator={snapIndicator.show}
/>

<!-- Global styles for drag/drop -->
<style>
  :global(.dragging) {
    cursor: grabbing !important;
    user-select: none;
  }
  
  :global(.canvas-container.dragging) {
    opacity: 0.8;
    z-index: 9999;
    cursor: grabbing;
  }
  
  :global(.canvas-container.selected) {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  
  :global(.canvas-selection-highlight) {
    outline: 2px dashed var(--color-primary);
    outline-offset: 2px;
  }
  
  :global(.drag-preview) {
    transform: rotate(2deg);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  }
  
  :global(.drop-zone) {
    transition: all 0.2s ease;
  }
  
  :global(.drop-zone.valid-drop) {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: var(--color-success);
  }
  
  :global(.selection-box) {
    animation: selectionPulse 1s ease-in-out infinite;
  }
  
  @keyframes selectionPulse {
    0%, 100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }
</style>
