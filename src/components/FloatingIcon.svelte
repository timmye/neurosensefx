<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { floatingStore, actions, icons } from '../stores/floatingStore.js';
  
  export let id;
  export let type = 'default';
  export let position = { x: 20, y: 20 };
  export let config = {};
  export let title = '';
  
  let element;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  const dispatch = createEventDispatcher();
  
  // Store subscriptions
  $: icon = $icons.get(id);
  $: isActive = icon?.isActive || false;
  $: isExpanded = icon?.isExpanded || false;
  $: currentZIndex = icon?.zIndex || 10000;
  $: isVisible = icon?.isVisible !== false;
  
  // Icon SVG definitions
  const iconSVGs = {
    'symbol-palette': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>`,
    'debug': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>`,
    'default': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="9" y1="9" x2="15" y2="9"/>
        <line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>`
  };
  
  // Handle mouse down for dragging
  function handleMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    
    const rect = element.getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    isDragging = true;
    actions.startDrag('icon', id, dragOffset);
    actions.setActiveIcon(id);
    
    // Global mouse events for dragging
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    
    e.preventDefault();
  }
  
  function handleGlobalMouseMove(e) {
    if (!isDragging) return;
    
    const newPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    };
    
    // Keep icon within viewport bounds
    newPosition.x = Math.max(0, Math.min(newPosition.x, window.innerWidth - 48));
    newPosition.y = Math.max(0, Math.min(newPosition.y, window.innerHeight - 48));
    
    actions.updateDrag(newPosition);
  }
  
  function handleGlobalMouseUp() {
    isDragging = false;
    actions.endDrag();
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  }
  
  // Handle click to toggle expand/collapse
  function handleClick(e) {
    if (isDragging) return; // Don't toggle if just finished dragging
    
    e.stopPropagation();
    dispatch('toggleExpansion', { id, isExpanded });
    
    if (isExpanded) {
      actions.collapseIcon(id);
    } else {
      actions.expandIcon(id);
    }
  }
  
  // Handle double click for quick actions
  function handleDoubleClick(e) {
    e.stopPropagation();
    dispatch('doubleClick', { id, type });
  }
  
  // Handle context menu
  function handleContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('contextMenu', { 
      id, 
      type, 
      position: { x: e.clientX, y: e.clientY }
    });
  }
  
  // Keyboard accessibility
  function handleKeydown(e) {
    switch(e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleClick(e);
        break;
      case 'Escape':
        e.preventDefault();
        if (isExpanded) {
          actions.collapseIcon(id);
        }
        break;
    }
  }
  
  // Auto-focus management
  export function focus() {
    element?.focus();
  }
  
  export function blur() {
    element?.blur();
  }
  
  // Cleanup on destroy
  onDestroy(() => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
  });
</script>

{#if isVisible}
  <div 
    bind:this={element}
    class="floating-icon"
    class:active={isActive}
    class:expanded={isExpanded}
    class:dragging={isDragging}
    style="left: {icon?.position.x || position.x}px; top: {icon?.position.y || position.y}px; z-index: {currentZIndex};"
    on:mousedown={handleMouseDown}
    on:click={handleClick}
    on:dblclick={handleDoubleClick}
    on:contextmenu={handleContextMenu}
    on:keydown={handleKeydown}
    tabindex="0"
    role="button"
    aria-label="{title || type} icon"
    aria-expanded={isExpanded}
    data-icon-id={id}
    data-icon-type={type}
  >
    <!-- Icon SVG -->
    <div class="icon-visual">
      {@html iconSVGs[type] || iconSVGs.default}
    </div>
    
    <!-- Status indicator (future) -->
    {#if config.status}
      <div class="status-indicator" class:status-online={config.status === 'online'} class:status-offline={config.status === 'offline'} class:status-busy={config.status === 'busy'}></div>
    {/if}
    
    <!-- Badge (future) -->
    {#if config.badge}
      <div class="badge">{config.badge}</div>
    {/if}
    
    <!-- Tooltip -->
    {#if title}
      <div class="tooltip">{title}</div>
    {/if}
  </div>
{/if}

<style>
  .floating-icon {
    position: fixed;
    width: 48px;
    height: 48px;
    background: #1f2937;
    border: 2px solid #4b5563;
    border-radius: 12px;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 10000;
  }
  
  .floating-icon:hover {
    background: #374151;
    border-color: #6b7280;
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
  }
  
  .floating-icon.active {
    border-color: #4f46e5;
    background: rgba(79, 70, 229, 0.1);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3), 0 6px 20px rgba(0, 0, 0, 0.6);
  }
  
  .floating-icon.expanded {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }
  
  .floating-icon.dragging {
    cursor: grabbing;
    transform: scale(0.95);
    opacity: 0.8;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
  }
  
  .floating-icon:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.5);
  }
  
  .icon-visual {
    width: 24px;
    height: 24px;
    color: #d1d5db;
    transition: color 0.2s ease;
  }
  
  .floating-icon:hover .icon-visual {
    color: #f3f4f6;
  }
  
  .floating-icon.active .icon-visual {
    color: #4f46e5;
  }
  
  .floating-icon.expanded .icon-visual {
    color: #10b981;
  }
  
  .status-indicator {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 2px solid #1f2937;
  }
  
  .status-indicator.status-online {
    background: #10b981;
  }
  
  .status-indicator.status-offline {
    background: #ef4444;
  }
  
  .status-indicator.status-busy {
    background: #f59e0b;
  }
  
  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
    border: 2px solid #1f2937;
  }
  
  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #111827;
    color: #f3f4f6;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    margin-bottom: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 10001;
  }
  
  .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #111827;
  }
  
  .floating-icon:hover .tooltip {
    opacity: 1;
    visibility: visible;
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .floating-icon {
      transition: none;
    }
    
    .floating-icon:hover {
      transform: none;
    }
    
    .floating-icon.dragging {
      transform: none;
    }
    
    .tooltip {
      transition: none;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .floating-icon {
      border-width: 3px;
      background: #000;
      color: #fff;
    }
    
    .floating-icon:hover {
      background: #fff;
      color: #000;
    }
    
    .icon-visual {
      color: #fff;
    }
    
    .floating-icon:hover .icon-visual {
      color: #000;
    }
  }
</style>
