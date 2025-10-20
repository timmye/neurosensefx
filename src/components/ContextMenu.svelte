<script>
  import { floatingStore, actions, contextMenu, displays, panels } from '../stores/floatingStore.js';
  
  // Close on click outside
  function handleClickOutside() {
    actions.hideContextMenu();
  }
  
  function handleAction(action) {
    const { targetId, targetType } = $contextMenu;
    
    switch(action) {
      case 'close':
        if (targetType === 'display') {
          actions.removeDisplay(targetId);
        } else if (targetType === 'panel') {
          actions.removePanel(targetId);
        }
        break;
        
      case 'duplicate':
        if (targetType === 'display') {
          const display = $displays.get(targetId);
          if (display) {
            actions.addDisplay(display.symbol, { 
              x: display.position.x + 20, 
              y: display.position.y + 20 
            });
          }
        }
        break;
        
      case 'bringToFront':
        if (targetType === 'display') {
          actions.setActiveDisplay(targetId);
        } else if (targetType === 'panel') {
          actions.setActivePanel(targetId);
        }
        break;
        
      case 'addDisplay':
        actions.addDisplay('EURUSD', { x: 100, y: 100 });
        break;
    }
    
    actions.hideContextMenu();
  }
  
  function stopPropagation(e) {
    e.stopPropagation();
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if $contextMenu.open}
  <div 
    class="context-menu"
    style="left: {$contextMenu.x}px; top: {$contextMenu.y}px;"
    on:click={stopPropagation}
  >
    {#if $contextMenu.targetType === 'display'}
      <div class="menu-section">
        <div class="menu-item" on:click={() => handleAction('bringToFront')}>
          Bring to Front
        </div>
        <div class="menu-item" on:click={() => handleAction('duplicate')}>
          Duplicate Display
        </div>
      </div>
      
      <div class="menu-divider"></div>
      
      <div class="menu-section">
        <div class="menu-item danger" on:click={() => handleAction('close')}>
          Close Display
        </div>
      </div>
    {:else if $contextMenu.targetType === 'panel'}
      <div class="menu-section">
        <div class="menu-item" on:click={() => handleAction('bringToFront')}>
          Bring to Front
        </div>
      </div>
      
      <div class="menu-divider"></div>
      
      <div class="menu-section">
        <div class="menu-item danger" on:click={() => handleAction('close')}>
          Close Panel
        </div>
      </div>
    {:else}
      <!-- Workspace context menu -->
      <div class="menu-section">
        <div class="menu-item" on:click={() => handleAction('addDisplay')}>
          Add Display
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 6px;
    padding: 4px 0;
    min-width: 160px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  .menu-section {
    padding: 2px 0;
  }
  
  .menu-item {
    padding: 8px 16px;
    color: #d1d5db;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s ease;
  }
  
  .menu-item:hover {
    background: #374151;
  }
  
  .menu-item.danger {
    color: #ef4444;
  }
  
  .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  
  .menu-divider {
    height: 1px;
    background: #374151;
    margin: 4px 0;
  }
</style>
