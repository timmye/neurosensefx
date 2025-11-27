<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayStore, displayActions, panels } from '../stores/displayStore.js';

  // ✅ INTERACT.JS: Import interact.js for drag
  import interact from 'interactjs';

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Consistent export pattern
  export let config = {};  // Configuration from displayStore.defaultConfig
  export let state = {};   // Reactive state from dataProcessor
  export let id = '';      // Unique identifier for tracking

  // Legacy props for backward compatibility
  export let type;
  export let position = { x: 50, y: 50 };
  export let title = type; // Add title prop with fallback to type
  
  // Local state
  let element;
  let isVisible = true;
  let panelPosition = position; // Declare panelPosition
  let isActive = false;
  let zIndex = 1000;
  
  // ✅ ULTRA-MINIMAL: Simple store binding
  $: panel = $panels?.get(id);
  $: {
    panelPosition = panel?.position || position;
    isActive = panel?.isActive || false;
    zIndex = panel?.zIndex || 1000;
  }
  
    
  function handleClose(e) {
    e?.stopPropagation();
    e?.preventDefault();
    console.log(`[DEBUGGER:FloatingPanel:handleClose:34] Close button clicked for panel ${id}, panelType=${type}`);

    // DEBUGGER: Check if this is a symbol palette and use correct method
    if (id === 'symbol-palette' || type === 'symbol-palette') {
      console.log(`[DEBUGGER:FloatingPanel:handleClose:38] FIX APPLIED: Using collapseIcon for symbol palette`);
      console.log(`[DEBUGGER:FloatingPanel:handleClose:39] Calling: displayActions.collapseIcon('symbol-palette-icon')`);

      displayActions.collapseIcon('symbol-palette-icon');
      console.log(`[DEBUGGER:FloatingPanel:handleClose:42] FIXED: Symbol palette closed with collapseIcon`);
    } else {
      console.log(`[DEBUGGER:FloatingPanel:handleClose:45] Regular panel - using removePanel(${id})`);
      displayActions.removePanel(id);
    }
  }

  function handleContextMenu(e) {
    console.log('🎨 [FLOATING_PANEL] Panel context menu triggered');
    e.preventDefault();
    e.stopPropagation();

    displayActions.setActivePanel(id);

    const context = {
      type: 'panel',
      targetId: id,
      targetType: 'panel'
    };

    displayActions.showContextMenu(e.clientX, e.clientY, id, 'panel', context);
  }
  
  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Initialize component with proper setup
  function initializeComponent() {
    console.log(`[FLOATING_PANEL] Initializing panel ${id} of type ${type}`);
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Setup store subscriptions if needed
  function setupStoreSubscriptions() {
    // Panel-specific store subscriptions would go here if needed
    // Currently using reactive store bindings ($panels)
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Performance monitoring integration
  function startPerformanceMonitoring() {
    // Panel-specific performance monitoring would go here if needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Cleanup component resources
  function cleanupComponent() {
    console.log(`[FLOATING_PANEL] Cleaning up panel ${id}`);
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Unsubscribe from stores
  function unsubscribeStores() {
    // Panel-specific store unsubscriptions would go here if needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Stop performance monitoring
  function stopPerformanceMonitoring() {
    // Panel-specific performance monitoring cleanup would go here if needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Mount lifecycle
  onMount(() => {
    initializeComponent();
    setupStoreSubscriptions();
    startPerformanceMonitoring();

    // ✅ INTERACT.JS: Keep for drag and resize functionality only
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
            console.log(`[INTERACT_JS] Drag started for panel ${id}`);
          },
          onmove: (event) => {
            // ✅ DIRECT: Use interact.js rect directly
            displayActions.movePanel(id, {
              x: event.rect.left,
              y: event.rect.top
            });
          },
          onend: () => {
            console.log(`[INTERACT_JS] Drag ended for panel ${id}`);
          }
        });
    }

    return () => {
      // ✅ CLEANUP: interact.js cleanup
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
  $: if (panel) {
    isVisible = panel.isVisible !== false;
  }
</script>

{#if isVisible}
  <div
    bind:this={element}
    class="enhanced-floating-panel"
    class:active={isActive}
    style="left: {panelPosition.x}px; top: {panelPosition.y}px; z-index: {zIndex};"
    on:contextmenu|preventDefault|stopPropagation={handleContextMenu}
    data-panel-id={id}
  >
    <div class="panel-header">
      <div class="panel-title">{title}</div>
      <button class="close-btn" on:click={handleClose}>×</button>
    </div>
    
    <div class="panel-content">
      <slot></slot>
    </div>
  </div>
{/if}

<style>
  .enhanced-floating-panel {
    position: fixed;
    background: #1f2937;
    border: 2px solid #374151;
    border-radius: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    min-width: 250px;
    min-height: 300px;
  }
  
  .enhanced-floating-panel:hover {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .enhanced-floating-panel.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    cursor: grab;
    border-radius: 6px 6px 0 0;
  }
  
  .panel-title {
    font-weight: bold;
    color: #d1d5db;
    font-size: 14px;
    font-family: 'Courier New', monospace;
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
  
  .panel-content {
    padding: 12px;
    background: #111827;
    border-radius: 0 0 6px 6px;
    min-height: 250px;
  }
</style>
