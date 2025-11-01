<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions } from '../stores/floatingStore.js';
  
  // ✅ INTERACT.JS: Import interact.js for drag
  import interact from 'interactjs';
  
  // Component props
  export let id;
  export let type;
  export let position = { x: 20, y: 20 };
  export let config = {};
  export let title = config?.title || type; // Add title prop with fallback
  
  // Local state
  let element;
  let isVisible = true;
  let iconPosition = position; // Declare iconPosition
  let isActive = false;
  let zIndex = 10000;
  
  // ✅ ULTRA-MINIMAL: Simple store binding
  $: icon = $floatingStore.icons?.get(id);
  $: {
    iconPosition = icon?.position || position;
    isActive = icon?.isActive || false;
    zIndex = icon?.zIndex || 10000;
  }
  
  // Event handlers
  function handleContextMenu(e) {
    e.preventDefault();
    actions.setActiveIcon(id);
    
    const context = {
      type: 'icon',
      targetId: id,
      targetType: 'icon'
    };
    
    actions.showUnifiedContextMenu(e.clientX, e.clientY, context);
  }
  
  function handleClick() {
    // Toggle expansion/collapse
    actions.toggleIconExpansion(id);
  }
  
  // ✅ ULTRA-MINIMAL: Simple interact.js setup
  onMount(() => {
    console.log(`[FLOATING_ICON] Mounting icon ${id} of type ${type}`);
    
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
            actions.moveIcon(id, {
              x: event.rect.left,
              y: event.rect.top
            });
          },
          onend: () => {
            console.log(`[INTERACT_JS] Drag ended for icon ${id}`);
          }
        });
      
      // Click to activate and toggle
      interact(element).on('tap', (event) => {
        actions.setActiveIcon(id);
        actions.toggleIconExpansion(id);
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
    on:contextmenu={handleContextMenu}
    on:click={handleClick}
    data-icon-id={id}
  >
    <div class="icon-content">
      {#if type === 'symbol-palette'}
        <div class="symbol-icon">📊</div>
      {:else if type === 'debug'}
        <div class="debug-icon">🐛</div>
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
    background: #1f2937;
    border: 2px solid #374151;
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
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    transform: scale(1.1);
  }
  
  .enhanced-floating-icon.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .enhanced-floating-icon.expanded {
    background: #4f46e5;
    border-color: #6366f1;
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
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  }
  
  .debug-icon {
    background: linear-gradient(135deg, #ef4444, #dc2626);
  }
  
  .default-icon {
    background: linear-gradient(135deg, #6b7280, #4b5563);
  }
</style>
