/**
 * Draggable composable for floating panels
 * Consolidates drag functionality, viewport boundary checking, and position persistence
 */

import { onMount, onDestroy } from 'svelte';

/**
 * Creates a draggable element with viewport boundary checking and position persistence
 * @param {Object} options - Configuration options
 * @returns {Object} - Drag state and handlers
 */
export function useDraggable(options = {}) {
  const {
    positionKey = 'draggable-position',
    minimizedKey = 'draggable-minimized',
    defaultPosition = { x: 100, y: 100 },
    defaultMinimized = false,
    onPositionChange = null,
    onMinimizeChange = null,
    onClose = null,
    boundaryPadding = 10
  } = options;

  // State
  let position = { ...defaultPosition };
  let isDragging = false;
  let isMinimized = defaultMinimized;
  let dragOffset = { x: 0, y: 0 };
  let element;
  let dragHandle;

  // Load saved position from localStorage
  const loadSavedState = () => {
    const savedPosition = localStorage.getItem(positionKey);
    if (savedPosition) {
      try {
        position = JSON.parse(savedPosition);
      } catch (e) {
        console.warn(`Failed to parse saved position for ${positionKey}`);
      }
    }
    
    const savedMinimized = localStorage.getItem(minimizedKey);
    if (savedMinimized) {
      isMinimized = savedMinimized === 'true';
    }
  };

  // Save position to localStorage
  const savePosition = () => {
    localStorage.setItem(positionKey, JSON.stringify(position));
    if (onPositionChange) {
      onPositionChange(position);
    }
  };

  // Save minimized state to localStorage
  const saveMinimized = () => {
    localStorage.setItem(minimizedKey, isMinimized.toString());
    if (onMinimizeChange) {
      onMinimizeChange(isMinimized);
    }
  };

  // Ensure element stays within viewport
  const ensureInViewport = () => {
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get element dimensions (account for minimized state)
    const elementWidth = isMinimized ? 200 : rect.width;
    const elementHeight = isMinimized ? 40 : rect.height;
    
    // Adjust horizontal position if needed
    if (position.x + elementWidth > viewportWidth) {
      position.x = viewportWidth - elementWidth - boundaryPadding;
    }
    if (position.x < boundaryPadding) {
      position.x = boundaryPadding;
    }
    
    // Adjust vertical position if needed
    if (position.y + elementHeight > viewportHeight) {
      position.y = viewportHeight - elementHeight - boundaryPadding;
    }
    if (position.y < boundaryPadding) {
      position.y = boundaryPadding;
    }
  };

  // Handle drag start
  const handleDragStart = (event) => {
    isDragging = true;
    
    const clientX = event.type.includes('touch') ? event.touches[0].clientX : event.clientX;
    const clientY = event.type.includes('touch') ? event.touches[0].clientY : event.clientY;
    
    dragOffset.x = clientX - position.x;
    dragOffset.y = clientY - position.y;
    
    // Add global event listeners
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('touchend', handleDragEnd);
    
    event.preventDefault();
  };

  // Handle drag move
  const handleDragMove = (event) => {
    if (!isDragging) return;
    
    const clientX = event.type.includes('touch') ? event.touches[0].clientX : event.clientX;
    const clientY = event.type.includes('touch') ? event.touches[0].clientY : event.clientY;
    
    position.x = clientX - dragOffset.x;
    position.y = clientY - dragOffset.y;
    
    ensureInViewport();
    savePosition();
  };

  // Handle drag end
  const handleDragEnd = () => {
    isDragging = false;
    
    // Save final position
    savePosition();
    
    // Remove global event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
  };

  // Handle minimize toggle
  const handleMinimize = () => {
    isMinimized = !isMinimized;
    saveMinimized();
    ensureInViewport();
  };

  // Handle close
  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  // Handle keyboard events
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  // Initialize on mount
  onMount(() => {
    loadSavedState();
    ensureInViewport();
    
    // Add keyboard listener
    window.addEventListener('keydown', handleKeyDown);
  });

  // Cleanup on destroy
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
    
    // Remove any remaining global event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
  });

  // Return reactive state and handlers
  return {
    // State
    position,
    isDragging,
    isMinimized,
    
    // Element refs
    element,
    dragHandle,
    
    // Handlers
    handleDragStart,
    handleMinimize,
    handleClose,
    
    // Utilities
    ensureInViewport,
    savePosition,
    saveMinimized
  };
}

/**
 * Creates a draggable panel with common UI elements
 * @param {Object} options - Configuration options
 * @returns {Object} - Extended drag state with UI helpers
 */
export function useDraggablePanel(options = {}) {
  const {
    title = 'Panel',
    showMinimize = true,
    showClose = true,
    zIndex = 1000,
    ...draggableOptions
  } = options;

  const draggable = useDraggable(draggableOptions);
  
  // Additional panel-specific functionality
  const getPanelClasses = () => ({
    'draggable-panel': true,
    'minimized': draggable.isMinimized,
    'dragging': draggable.isDragging
  });
  
  const getDragHandleClasses = () => ({
    'drag-handle': true,
    'grabbing': draggable.isDragging
  });
  
  const getPanelStyles = () => ({
    left: `${draggable.position.x}px`,
    top: `${draggable.position.y}px`,
    'z-index': zIndex
  });
  
  return {
    ...draggable,
    
    // Panel helpers
    getPanelClasses,
    getDragHandleClasses,
    getPanelStyles,
    title,
    showMinimize,
    showClose
  };
}