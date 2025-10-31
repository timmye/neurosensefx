<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions, panels, icons } from '../stores/floatingStore.js';
  
  export let id;
  export let type;
  export let position = { x: 50, y: 50 };
  export let config = {};
  export let alwaysOnTop = true;
  export let title = '';
  
  // Local state
  let element;
  let isAnimating = false;
  
  // Store subscriptions
  $: panel = $panels.get(id);
  $: isActive = panel?.isActive || false;
  $: isVisible = panel?.isVisible !== false;
  $: currentZIndex = panel?.zIndex || 1000;
  
  // Check if this panel is linked to an expanded icon
  $: linkedIcon = Array.from($icons.values()).find(icon => icon.panelId === id && icon.isExpanded);
  $: isExpanded = linkedIcon?.isExpanded || false;
  
  // Direct event handlers
  function handleMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    
    const rect = element.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    actions.startDrag('panel', id, offset);
    actions.setActivePanel(id);
    
    // Global mouse events for dragging
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
  }
  
  function handleGlobalMouseMove(e) {
    // ✅ FIX: Check if draggedItem exists and has offset before accessing
    const draggedItem = $floatingStore.draggedItem;
    if (!draggedItem || !draggedItem.offset) {
      console.warn('[FLOATING_PANEL] No valid draggedItem or offset found, skipping move');
      return;
    }
    
    const newPosition = {
      x: e.clientX - draggedItem.offset.x,
      y: e.clientY - draggedItem.offset.y
    };
    
    // Simple bounds checking
    newPosition.x = Math.max(0, Math.min(newPosition.x, window.innerWidth - 300));
    newPosition.y = Math.max(0, Math.min(newPosition.y, window.innerHeight - 200));
    
    actions.updateDrag(newPosition);
  }
  
  function handleGlobalMouseUp() {
    actions.endDrag();
    // ✅ FIX: Ensure proper cleanup of global event listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  }
  
  // ✅ FIX: Add onDestroy cleanup to prevent memory leaks and event conflicts
  onDestroy(() => {
    // Clean up any remaining global event listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  });
  
  function handleClose() {
    actions.removePanel(id);
  }
  
  function handleCollapse() {
    // Find linked icon and collapse it
    const icon = Array.from($icons.values()).find(icon => icon.panelId === id);
    if (icon) {
      actions.collapseIcon(icon.id);
    } else {
      // Fallback: just hide the panel
      floatingStore.update(store => {
        const newPanels = new Map(store.panels);
        const panel = newPanels.get(id);
        if (panel) {
          newPanels.set(id, { ...panel, isVisible: false });
        }
        return { ...store, panels: newPanels };
      });
    }
  }
  
  function handleMinimize() {
    // Legacy minimize - just collapse to icon
    handleCollapse();
  }
</script>

{#if isVisible}
  <div 
    bind:this={element}
    class="floating-panel"
    class:active={isActive}
    class:always-on-top={alwaysOnTop}
    style="left: {panel?.position.x || position.x}px; top: {panel?.position.y || position.y}px; z-index: {currentZIndex};"
    on:mousedown={handleMouseDown}
    data-panel-id={id}
  >
    <!-- Header -->
    <div class="panel-header">
      <span class="panel-title">{title || type}</span>
      <div class="panel-controls">
        <button class="panel-btn minimize-btn" on:click={handleMinimize}>_</button>
        <button class="panel-btn close-btn" on:click={handleClose}>×</button>
      </div>
    </div>
    
    <!-- Content -->
    <div class="panel-content">
      <slot />
    </div>
  </div>
{/if}

<style>
  .floating-panel {
    position: fixed;
    background: #1f2937;
    border: 1px solid #4b5563;
    border-radius: 6px;
    cursor: move;
    user-select: none;
    min-width: 280px;
    min-height: 200px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  
  .floating-panel.always-on-top {
    z-index: 1000 !important;
  }
  
  .floating-panel.active {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3), 0 8px 32px rgba(0, 0, 0, 0.8);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    cursor: move;
    border-radius: 6px 6px 0 0;
  }
  
  .panel-title {
    color: #d1d5db;
    font-size: 14px;
    font-weight: 500;
  }
  
  .panel-controls {
    display: flex;
    gap: 4px;
  }
  
  .panel-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  
  .panel-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }
  
  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  
  .panel-content {
    padding: 12px;
    background: #111827;
    border-radius: 0 0 6px 6px;
    overflow: auto;
    max-height: 400px;
  }
</style>
