<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import interact from 'interactjs';
  import { createLogger } from '../../utils/debugLogger.js';
  import { PositionPersistence } from '../../utils/positionPersistence.js';
  
  const logger = createLogger('InteractWrapper');
  const dispatch = createEventDispatcher();
  
  // Props
  export let position = { x: 100, y: 100 };
  export let defaultPosition = { x: 100, y: 100 };
  export let positionKey = 'interact-wrapper-position';
  export let onPositionChange = null;
  export let bounds = null; // Optional boundary constraints
  export let isDraggable = true;
  export let isResizable = false;
  export let snap = null; // Optional snap configuration
  export let inertia = true; // Enable inertia for smooth dragging
  export let autoScroll = false; // Enable auto-scroll during drag
  export let boundaryPadding = 10;
  
  // Internal state
  let element;
  let interactInstance = null;
  let isDragging = false;
  let isMinimized = false;
  
  // Load saved position from localStorage
  const loadSavedPosition = () => {
    position = PositionPersistence.loadPosition(positionKey, defaultPosition);
  };
  
  // Save position to localStorage
  const savePosition = (newPosition) => {
    position = { ...newPosition };
    PositionPersistence.savePosition(positionKey, position);
    
    if (onPositionChange) {
      onPositionChange(position);
    }
    
    dispatch('positionChange', { position });
  };
  
  // Ensure element stays within viewport or custom bounds
  const ensureInBounds = (pos) => {
    if (!element) return pos;
    
    const rect = element.getBoundingClientRect();
    let { x, y } = pos;
    
    // Determine bounds
    let minX, minY, maxX, maxY;
    
    if (bounds) {
      // Use custom bounds
      minX = bounds.left || 0;
      minY = bounds.top || 0;
      maxX = bounds.right || window.innerWidth - rect.width;
      maxY = bounds.bottom || window.innerHeight - rect.height;
    } else {
      // Use viewport bounds
      minX = boundaryPadding;
      minY = boundaryPadding;
      maxX = window.innerWidth - rect.width - boundaryPadding;
      maxY = window.innerHeight - rect.height - boundaryPadding;
    }
    
    // Apply bounds with consideration for minimized state
    const elementWidth = isMinimized ? 200 : rect.width;
    const elementHeight = isMinimized ? 40 : rect.height;
    
    // Adjust horizontal position
    if (x + elementWidth > maxX + boundaryPadding) {
      x = maxX - elementWidth + boundaryPadding;
    }
    if (x < minX) {
      x = minX;
    }
    
    // Adjust vertical position
    if (y + elementHeight > maxY + boundaryPadding) {
      y = maxY - elementHeight + boundaryPadding;
    }
    if (y < minY) {
      y = minY;
    }
    
    return { x, y };
  };
  
  // Handle window resize to adjust bounds
  const handleWindowResize = () => {
    if (element && position) {
      const adjustedPosition = ensureInBounds(position);
      if (adjustedPosition.x !== position.x || adjustedPosition.y !== position.y) {
        savePosition(adjustedPosition);
      }
    }
  };
  
  // Initialize interact.js
  const initializeInteract = () => {
    if (!element || !isDraggable) return;
    
    logger.debug('Initializing interact.js', { element, isDraggable });
    
    // Create interact instance
    interactInstance = interact(element);
    
    // Configure draggable
    interactInstance.draggable({
      inertia: inertia ? {
        resistance: 10,
        minSpeed: 200,
        endSpeed: 100
      } : false,
      
      modifiers: [
        // Snap modifier if snap configuration is provided
        ...(snap ? [
          interact.modifiers.snap({
            targets: snap.targets || [],
            relativePoints: snap.relativePoints || [{ x: 0, y: 0 }],
            offset: snap.offset || { x: 0, y: 0 }
          })
        ] : []),
        
        // Restrict modifier for bounds
        interact.modifiers.restrict({
          restriction: bounds || 'parent',
          elementRect: { left: 0, right: 0, top: 0, bottom: 0 },
          endOnly: false
        })
      ],
      
      autoScroll: autoScroll,
      
      // Event listeners
      onstart: (event) => {
        isDragging = true;
        logger.debug('Drag start', { position, target: event.target });
        dispatch('dragStart', { event, position });
      },
      
      onmove: (event) => {
        const target = event.target;
        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
        
        // Apply bounds
        const boundedPosition = ensureInBounds({ x, y });
        
        // Translate the element
        target.style.transform = `translate(${boundedPosition.x}px, ${boundedPosition.y}px)`;
        
        // Store position as data attributes
        target.setAttribute('data-x', boundedPosition.x);
        target.setAttribute('data-y', boundedPosition.y);
        
        // Update position state
        savePosition(boundedPosition);
        
        dispatch('dragMove', { 
          event, 
          position: boundedPosition,
          dx: event.dx,
          dy: event.dy
        });
      },
      
      onend: (event) => {
        isDragging = false;
        const x = parseFloat(event.target.getAttribute('data-x')) || 0;
        const y = parseFloat(event.target.getAttribute('data-y')) || 0;
        const finalPosition = { x, y };
        
        logger.debug('Drag end', { finalPosition });
        dispatch('dragEnd', { event, position: finalPosition });
      }
    });
    
    // Configure resizable if enabled
    if (isResizable) {
      interactInstance.resizable({
        edges: { left: false, right: true, bottom: true, top: false },
        listeners: {
          move: (event) => {
            let { x, y } = event.target.dataset;
            
            x = (parseFloat(x) || 0) + event.deltaRect.left;
            y = (parseFloat(y) || 0) + event.deltaRect.top;
            
            Object.assign(event.target.style, {
              width: `${event.rect.width}px`,
              height: `${event.rect.height}px`,
              transform: `translate(${x}px, ${y}px)`
            });
            
            Object.assign(event.target.dataset, { x, y });
            
            dispatch('resize', { 
              event,
              width: event.rect.width,
              height: event.rect.height,
              position: { x, y }
            });
          }
        },
        modifiers: [
          interact.modifiers.restrictEdges({
            outer: 'parent'
          }),
          interact.modifiers.restrictSize({
            min: { width: 150, height: 100 }
          })
        ],
        inertia: true
      });
      
      logger.debug('Resizable configured');
    }
  };
  
  // Cleanup interact instance
  const cleanupInteract = () => {
    if (interactInstance) {
      interactInstance.unset();
      interactInstance = null;
      logger.debug('Interact instance cleaned up');
    }
  };
  
  // Initialize on mount
  onMount(() => {
    logger.debug('Component mounting', { positionKey, position, isDraggable });
    loadSavedPosition();
    loadMinimizedState();
    
    // Apply initial position
    if (element) {
      const boundedPosition = ensureInBounds(position);
      
      // Apply initial transform positioning
      element.style.transform = `translate(${boundedPosition.x}px, ${boundedPosition.y}px)`;
      element.setAttribute('data-x', boundedPosition.x);
      element.setAttribute('data-y', boundedPosition.y);
      
      if (boundedPosition.x !== position.x || boundedPosition.y !== position.y) {
        savePosition(boundedPosition);
      }
    }
    
    // Initialize interact.js
    initializeInteract();
    
    // Add window resize listener
    window.addEventListener('resize', handleWindowResize);
    
    logger.debug('Component mounted', { position, isDraggable, isResizable, isMinimized });
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    cleanupInteract();
    window.removeEventListener('resize', handleWindowResize);
    logger.debug('Component destroyed');
  });
  
  // Update interact configuration when props change
  $: if (interactInstance && element) {
    if (isDraggable) {
      interactInstance.draggable({ enabled: true });
    } else {
      interactInstance.draggable({ enabled: false });
    }
    
    if (isResizable) {
      interactInstance.resizable({ enabled: true });
    } else {
      interactInstance.resizable({ enabled: false });
    }
  }
  
  // Expose methods to parent components
  export function updatePosition(newPosition) {
    if (element) {
      const boundedPosition = ensureInBounds(newPosition);
      element.style.transform = `translate(${boundedPosition.x}px, ${boundedPosition.y}px)`;
      element.setAttribute('data-x', boundedPosition.x);
      element.setAttribute('data-y', boundedPosition.y);
      savePosition(boundedPosition);
    }
  }
  
  export function getPosition() {
    return { ...position };
  }
  
  export function getElement() {
    return element;
  }
  
  export function setMinimized(minimized) {
    isMinimized = minimized;
    // Save minimized state
    PositionPersistence.saveState(`${positionKey}-minimized`, { isMinimized });
    
    // Re-check bounds when minimized state changes
    if (element) {
      const adjustedPosition = ensureInBounds(position);
      if (adjustedPosition.x !== position.x || adjustedPosition.y !== position.y) {
        updatePosition(adjustedPosition);
      }
    }
    dispatch('minimizeChange', { isMinimized: minimized });
  }
  
  // Load minimized state on mount
  const loadMinimizedState = () => {
    const savedState = PositionPersistence.loadState(`${positionKey}-minimized`, { isMinimized: false });
    isMinimized = savedState.isMinimized;
  };
</script>

<div 
  bind:this={element}
  class="interact-wrapper {isDragging ? 'dragging' : ''} {isMinimized ? 'minimized' : ''}"
  data-position-key={positionKey}
>
  <slot />
</div>

<style>
  .interact-wrapper {
    position: fixed;
    left: 0;
    top: 0;
    touch-action: none;
    user-select: none;
    z-index: 1000; /* Add base z-index */
  }
  
  .interact-wrapper.dragging {
    cursor: grabbing;
    z-index: 9999;
  }
  
  .interact-wrapper.minimized {
    /* Minimized styles can be overridden by parent components */
  }
</style>