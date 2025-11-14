<script>
  import { displayStore, displayActions, contextMenu, displays, panels } from '../stores/displayStore.js';
  import { getZIndex } from '../constants/zIndex.js';
  
  // Import context-specific components
  import CanvasTabbedInterface from './UnifiedContextMenu/CanvasTabbedInterface.svelte';
  import WorkspaceQuickActions from './UnifiedContextMenu/WorkspaceQuickActions.svelte';
  import PanelQuickActions from './UnifiedContextMenu/PanelQuickActions.svelte';
  
  let menuElement = null;
  let adjustedPosition = { x: 0, y: 0 };
  
  // Context configurations
  const CONTEXT_CONFIGURATIONS = {
    canvas: {
      title: 'Canvas Controls',
      width: 500,
      height: 700,
      showTabs: true,
      showSearch: true,
      showReset: true
    },
    workspace: {
      title: 'Workspace',
      width: 250,
      height: 200,
      showTabs: false,
      showSearch: false,
      showReset: false
    },
    panel: {
      title: 'Panel Options',
      width: 200,
      height: 150,
      showTabs: false,
      showSearch: false,
      showReset: true
    }
  };
  
  // Context detection engine
  function detectContextMenuContext(event) {
    const target = event.target;

    // Canvas click → Full 85+ parameter controls
    if (target.classList.contains('canvas-element') || target.closest('canvas')) {
      const displayElement = target.closest('[data-display-id]');
      const displayId = displayElement?.dataset.displayId;
      return {
        type: 'canvas',
        targetId: displayId,
        targetType: 'display'
      };
    }

    // Panel click → Panel controls
    if (target.classList.contains('floating-panel') || target.closest('.floating-panel')) {
      const panelElement = target.closest('[data-panel-id]');
      const panelId = panelElement?.dataset.panelId;
      return {
        type: 'panel',
        targetId: panelId,
        targetType: 'panel'
      };
    }

    // Workspace click → Workspace operations
    return {
      type: 'workspace',
      targetId: null,
      targetType: 'workspace'
    };
  }
  
  // Position adjustment for viewport constraints
  function adjustPositionForViewport() {
    if (!menuElement || !$contextMenu.open) return;
    
    const config = CONTEXT_CONFIGURATIONS[$contextMenu.context?.type] || CONTEXT_CONFIGURATIONS.workspace;
    const rect = menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let { x, y } = { x: $contextMenu.x, y: $contextMenu.y };
    
    // Adjust horizontal position
    if (x + config.width > viewportWidth) {
      x = viewportWidth - config.width - 10;
    }
    
    // Adjust vertical position
    if (y + config.height > viewportHeight) {
      y = viewportHeight - config.height - 10;
    }
    
    // Ensure minimum position
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    adjustedPosition = { x, y };
  }
  
  // Handle click outside to close
  function handleClickOutside(event) {
    if (menuElement && !menuElement.contains(event.target)) {
      displayActions.hideContextMenu();
    }
  }
  
  // Handle keyboard shortcuts
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      displayActions.hideContextMenu();
    }
  }
  
  // Stop propagation to prevent conflicts
  function stopPropagation(event) {
    event.stopPropagation();
  }
  
  // Lifecycle
  $: if ($contextMenu.open) {
    // Adjust position after render
    setTimeout(() => {
      adjustPositionForViewport();
    }, 0);
    
    // Add event listeners
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
  } else {
    // Remove event listeners
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
  }
  
  // Get current context configuration
  $: currentConfig = ($contextMenu.context?.type && CONTEXT_CONFIGURATIONS[$contextMenu.context.type]) ? 
    CONTEXT_CONFIGURATIONS[$contextMenu.context.type] : 
    CONTEXT_CONFIGURATIONS.workspace;
  
  // Handle context menu trigger from external components
  export function showContextMenu(event) {
    const context = detectContextMenuContext(event);
    displayActions.showContextMenu(event.clientX, event.clientY, context.targetId, context.targetType, context);
  }
</script>

<svelte:window on:contextmenu|preventDefault />

{#if $contextMenu.open && $contextMenu.context}
  <div 
    bind:this={menuElement}
    class="unified-context-menu"
    class:canvas-context={$contextMenu.context.type === 'canvas'}
    class:workspace-context={$contextMenu.context.type === 'workspace'}
    class:panel-context={$contextMenu.context.type === 'panel'}
    style="left: {adjustedPosition.x}px; top: {adjustedPosition.y}px; width: {currentConfig.width}px; max-height: {currentConfig.height}px; z-index: {getZIndex('CONTEXT_MENU')};"
    on:click={stopPropagation}
    on:contextmenu={stopPropagation}
  >
    <!-- Menu Header -->
    <div class="menu-header">
      <h3>{currentConfig.title}</h3>
      {#if $contextMenu.context.targetId}
        <span class="target-id">ID: {$contextMenu.context.targetId}</span>
      {/if}
    </div>
    
    <!-- Dynamic Content Based on Context -->
    <div class="menu-content">
      {#if $contextMenu.context.type === 'canvas'}
        <CanvasTabbedInterface
          displayId={$contextMenu.context.targetId}
          onParameterChange={(parameter, value) => {
            // Update global config when canvas parameters change
            displayActions.updateGlobalConfig(parameter, value);
          }}
          onMultipleParameterChange={(configUpdates) => {
            // Apply multiple config updates to global
            Object.entries(configUpdates).forEach(([param, value]) => {
              displayActions.updateGlobalConfig(param, value);
            });
          }}
          onReset={() => displayActions.resetToFactoryDefaults()}
        />
      {:else if $contextMenu.context.type === 'workspace'}
        <WorkspaceQuickActions
          onAction={(action) => {
            // Handle workspace-specific actions
            switch(action) {
              case 'showSymbolPalette':
                // Show symbol palette logic
                break;
              case 'resetDefaults':
                // Reset to factory defaults
                displayActions.resetToFactoryDefaults();
                break;
            }
            displayActions.hideContextMenu();
          }}
        />
      {:else if $contextMenu.context.type === 'panel'}
        <PanelQuickActions
          panelId={$contextMenu.context.targetId}
          onAction={(action) => {
            // Handle panel-specific actions
            switch(action) {
              case 'bringToFront':
                displayActions.setActivePanel($contextMenu.context.targetId);
                break;
              case 'close':
                displayActions.removePanel($contextMenu.context.targetId);
                break;
              case 'reset':
                // Reset panel logic
                break;
            }
            displayActions.hideContextMenu();
          }}
        />
      {/if}
    </div>
    
    <!-- Menu Footer -->
    {#if currentConfig.showReset}
      <div class="menu-footer">
        <button class="reset-btn" on:click={() => {
          displayActions.resetToFactoryDefaults();
          displayActions.hideContextMenu();
        }}>
          Reset to Defaults
        </button>
        <button class="close-btn" on:click={() => displayActions.hideContextMenu()}>
          Close (Esc)
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .unified-context-menu {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 0;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    animation: menuAppear 0.15s ease-out;
    display: flex;
    flex-direction: column;
  }
  
  @keyframes menuAppear {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  .menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    border-radius: 8px 8px 0 0;
    gap: 16px;
  }
  
  .menu-header h3 {
    margin: 0;
    color: #d1d5db;
    font-size: 14px;
    font-weight: 600;
  }
  
  .target-id {
    color: #9ca3af;
    font-size: 11px;
    font-family: 'Courier New', monospace;
  }
  
  .menu-content {
    flex: 1;
    overflow-y: auto;
    background: #1f2937;
  }
  
  .menu-footer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: #111827;
    border-top: 1px solid #374151;
  }
  
  .reset-btn, .close-btn {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .reset-btn {
    background: #374151;
    color: #e5e7eb;
  }
  
  .reset-btn:hover {
    background: #4b5563;
    color: #d1d5db;
  }
  
  .close-btn {
    background: #4f46e5;
    color: white;
  }
  
  .close-btn:hover {
    background: #6366f1;
  }
  
  /* Context-specific styling */
  .canvas-context {
    min-width: 500px;
    max-width: 700px;
  }
  
  .panel-context {
    min-width: 200px;
    max-width: 250px;
  }
  
  .workspace-context {
    min-width: 250px;
    max-width: 300px;
  }
  
  /* Scrollbar styling */
  .menu-content::-webkit-scrollbar {
    width: 6px;
  }
  
  .menu-content::-webkit-scrollbar-track {
    background: #111827;
  }
  
  .menu-content::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }
  
  .menu-content::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
  
  /* Responsive adjustments */
  @media (max-width: 600px) {
    .unified-context-menu {
      min-width: 280px;
      max-width: 90vw;
    }
    
    .canvas-context {
      min-width: 320px;
    }
  }
</style>
