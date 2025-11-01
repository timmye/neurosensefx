<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions } from '../stores/floatingStore.js';
  
  // ✅ INTERACT.JS: Import interact.js for drag
  import interact from 'interactjs';
  
  // Component props
  export let id;
  export let type;
  export let position = { x: 50, y: 50 };
  export let config = {};
  export let title = type; // Add title prop with fallback to type
  
  // Local state
  let element;
  let isVisible = true;
  let panelPosition = position; // Declare panelPosition
  let isActive = false;
  let zIndex = 1000;
  
  // ✅ ULTRA-MINIMAL: Simple store binding
  $: panel = $floatingStore.panels?.get(id);
  $: {
    panelPosition = panel?.position || position;
    isActive = panel?.isActive || false;
    zIndex = panel?.zIndex || 1000;
  }
  
  // Event handlers
  function handleContextMenu(e) {
    e.preventDefault();
    actions.setActivePanel(id);
    
    const context = {
      type: 'panel',
      targetId: id,
      targetType: 'panel'
    };
    
    actions.showUnifiedContextMenu(e.clientX, e.clientY, context);
  }
  
  function handleClose() {
    actions.removePanel(id);
  }
  
  // ✅ ULTRA-MINIMAL: Simple interact.js setup
  onMount(() => {
    console.log(`[FLOATING_PANEL] Mounting panel ${id} of type ${type}`);
    
    // ✅ INTERACT.JS: Ultra-minimal setup
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
          onmove: (event) => {
            // ✅ DIRECT: Use interact.js rect directly
            actions.movePanel(id, {
              x: event.rect.left,
              y: event.rect.top
            });
          },
          onend: () => {
            console.log(`[INTERACT_JS] Drag ended for panel ${id}`);
          }
        });
      
      // Click to activate
      interact(element).on('tap', (event) => {
        actions.setActivePanel(id);
      });
    }
    
    return () => {
      // ✅ CLEANUP: Simple interact.js cleanup
      if (element) {
        interact(element).unset();
      }
    };
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
    on:contextmenu={handleContextMenu}
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
