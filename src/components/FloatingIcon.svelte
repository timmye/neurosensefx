<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayStore, displayActions, icons } from '../stores/displayStore.js';
  
  // ✅ INTERACT.JS: Import interact.js for drag
  import interact from 'interactjs';
  
  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Consistent export pattern
  export let config = {};  // Configuration from displayStore.defaultConfig
  export let state = {};   // Reactive state from dataProcessor
  export let id = '';      // Unique identifier for tracking

  // Legacy props for backward compatibility
  export let type;
  export let position = { x: 20, y: 20 };
  export let title = config?.title || type; // Add title prop with fallback
  
  // Local state
  let element;
  let isVisible = true;
  let iconPosition = position; // Declare iconPosition
  let isActive = false;
  let zIndex = 10000;
  
  // ✅ ULTRA-MINIMAL: Simple store binding
  $: icon = $icons?.get(id);
  $: {
    iconPosition = icon?.position || position;
    isActive = icon?.isActive || false;
    zIndex = icon?.zIndex || 10000;
  }
  
    
  let isDragging = false;
  let dragStartTime = 0;

  function handleMouseDown(e) {
    isDragging = false;
    dragStartTime = Date.now();
  }

  function handleMouseUp(e) {
    const dragDuration = Date.now() - dragStartTime;
    // Only consider it a click if the mouse was released quickly and no significant movement occurred
    if (!isDragging && dragDuration < 200) {
      displayActions.setActiveIcon(id);
      displayActions.toggleIconExpansion(id);
    }
  }

  function handleClick(e) {
    // Prevent Svelte click from firing when we've already handled it as a drag
    if (isDragging) {
      e.preventDefault();
    }
  }

  function handleContextMenu(e) {
    console.log('🎨 [FLOATING_ICON] Icon context menu triggered');
    e.preventDefault();
    e.stopPropagation();

    displayActions.setActiveIcon(id);

    const context = {
      type: 'icon',
      targetId: id,
      targetType: 'icon'
    };

    displayActions.showContextMenu(e.clientX, e.clientY, id, 'icon', context);
  }
  
  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Initialize component with proper setup
  function initializeComponent() {
    console.log(`[FLOATING_ICON] Initializing icon ${id} of type ${type}`);
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Setup store subscriptions if needed
  function setupStoreSubscriptions() {
    // Icon-specific store subscriptions would go here if needed
    // Currently using reactive store bindings ($icons)
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Performance monitoring integration
  function startPerformanceMonitoring() {
    // Icon-specific performance monitoring would go here if needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Cleanup component resources
  function cleanupComponent() {
    console.log(`[FLOATING_ICON] Cleaning up icon ${id}`);
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Unsubscribe from stores
  function unsubscribeStores() {
    // Icon-specific store unsubscriptions would go here if needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Stop performance monitoring
  function stopPerformanceMonitoring() {
    // Icon-specific performance monitoring cleanup would go here if needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Mount lifecycle
  onMount(() => {
    initializeComponent();
    setupStoreSubscriptions();
    startPerformanceMonitoring();

    console.log(`[FLOATING_ICON] Mounting icon ${id} of type ${type}`);

    // ✅ INTERACT.JS: Ultra-minimal setup with proper drag tracking
    if (element) {
      interact(element)
        .draggable({
          inertia: true,
          modifiers: [
            interact.modifiers.restrictEdges({
              outer: {
                left: 0,
                top: 0,
                right: window.innerWidth - element.offsetWidth,
                bottom: window.innerHeight - element.offsetHeight
              }
            })
          ],
          onstart: () => {
            isDragging = true;
          },
          onmove: (event) => {
            // ✅ DIRECT: Use interact.js rect directly
            displayActions.moveIcon(id, {
              x: event.rect.left,
              y: event.rect.top
            });
          },
          onend: () => {
            console.log(`[INTERACT_JS] Drag ended for icon ${id}`);
            // Reset dragging state after a short delay to allow click detection
            setTimeout(() => {
              isDragging = false;
            }, 50);
          }
        });

      // Remove the conflicting tap event - we'll handle clicks with native mouse events
    }

    return () => {
      // ✅ CLEANUP: Simple interact.js cleanup
      if (element) {
        interact(element).unset();
      }
    };
  });

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Destroy lifecycle
  onDestroy(() => {
    cleanupComponent();
    unsubscribeStores();
    stopPerformanceMonitoring();
  });
  
  // Show/hide based on visibility
  $: if (icon) {
    isVisible = icon.isVisible !== false;
  }
</script>

{#if isVisible}
  <div
    bind:this={element}
    class="enhanced-floating-icon"
    class:active={isActive}
    class:expanded={icon?.isExpanded}
    style="left: {iconPosition.x}px; top: {iconPosition.y}px; z-index: {zIndex};"
    on:mousedown={handleMouseDown}
    on:mouseup={handleMouseUp}
    on:click={handleClick}
    on:contextmenu|preventDefault|stopPropagation={handleContextMenu}
    data-icon-id={id}
  >
    <div class="icon-content">
      {#if type === 'symbol-palette'}
        <div class="symbol-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3v18h18V3H3zm16 16H5V5h14v14z" fill="currentColor"/>
            <path d="M7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z" fill="currentColor"/>
            <circle cx="17" cy="17" r="2" fill="currentColor" opacity="0.7"/>
          </svg>
        </div>
      {:else if type === 'debug'}
        <div class="debug-icon">🐛</div>
      {:else if type === 'status-icon'}
        <!-- Custom content via slot -->
        <slot />
      {:else}
        <div class="default-icon">⚙️</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .enhanced-floating-icon {
    position: fixed;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border: 2px solid #334155;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .enhanced-floating-icon:hover {
    border-color: #0891b2;
    box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
    transform: scale(1.05);
  }

  .enhanced-floating-icon.active {
    border-color: #0891b2;
    box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.2), 0 4px 12px rgba(8, 145, 178, 0.3);
  }

  .enhanced-floating-icon.expanded {
    background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
    border-color: #06b6d4;
  }
  
  .icon-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 20px;
  }
  
  .symbol-icon, .debug-icon, .default-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 4px;
  }
  
  .symbol-icon {
    color: #0891b2;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .symbol-icon svg {
    width: 20px;
    height: 20px;
    color: #0891b2;
  }

  .enhanced-floating-icon.expanded .symbol-icon svg {
    color: #ffffff;
  }

  .debug-icon {
    background: linear-gradient(135deg, #ef4444, #dc2626);
  }

  .default-icon {
    background: linear-gradient(135deg, #6b7280, #4b5563);
  }
</style>
