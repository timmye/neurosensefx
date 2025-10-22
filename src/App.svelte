<script>
  import { onMount, onDestroy } from 'svelte';
  import { floatingStore, actions, displays, icons, panels } from './stores/floatingStore.js';
  import { symbolStore } from './data/symbolStore.js';
  import { connectionManager } from './data/ConnectionManager.js';
  import FloatingDisplay from './components/FloatingDisplay.svelte';
  import FloatingIcon from './components/FloatingIcon.svelte';
  import ContextMenu from './components/ContextMenu.svelte';
  import SymbolPalette from './components/SymbolPalette.svelte';
  
  // Store subscriptions
  $: displayList = Array.from($displays.values());
  $: iconList = Array.from($icons.values());
  $: panelList = Array.from($panels.values());
  
  let symbolPaletteRef;
  
  // Enhanced keyboard shortcuts
  function handleKeyDown(e) {
    // Ignore if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Still handle Ctrl+K even when typing
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusSymbolPalette();
      }
      return;
    }
    
    // Escape - close context menu or collapse panels
    if (e.key === 'Escape') {
      if ($floatingStore.contextMenu.open) {
        actions.hideContextMenu();
      } else {
        // Collapse expanded icon if any
        const expandedIcon = Array.from($icons.values()).find(icon => icon.isExpanded);
        if (expandedIcon) {
          actions.collapseIcon(expandedIcon.id);
        }
      }
    }
    
    // Ctrl+K / Cmd+K - Focus symbol palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      focusSymbolPalette();
    }
    
    // Ctrl+N - Create new display
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      const symbols = Object.keys($symbolStore);
      if (symbols.length > 0) {
        actions.addDisplay(symbols[0], {
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 100
        });
      }
    }
    
    // Ctrl+Shift+K - Toggle symbol palette
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      toggleSymbolPalette();
    }
  }
  
  // Focus symbol palette (expand if collapsed)
  function focusSymbolPalette() {
    const iconId = 'symbol-palette-icon';
    const icon = $icons.get(iconId);
    
    // Expand icon if collapsed
    if (icon && !icon.isExpanded) {
      actions.expandIcon(iconId);
    }
    
    // Focus search input with delay for animation
    setTimeout(() => {
      if (symbolPaletteRef && symbolPaletteRef.focusSearch) {
        symbolPaletteRef.focusSearch();
      } else {
        // Fallback: find search input directly
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }, 300);
  }
  
  // Toggle symbol palette visibility
  function toggleSymbolPalette() {
    const iconId = 'symbol-palette-icon';
    const icon = $icons.get(iconId);
    
    if (icon) {
      if (icon.isExpanded) {
        actions.collapseIcon(iconId);
      } else {
        actions.expandIcon(iconId);
      }
    }
  }
  
  // Initialize displays on mount
  onMount(async () => {
    const symbols = Object.keys($symbolStore);
    
    // Register symbol palette panel
    actions.addPanel('symbol-palette', 'symbol-palette', { x: 50, y: 50 }, {
      title: 'Symbol Palette'
    });
    
    // Create symbol palette floating icon
    actions.addIcon('symbol-palette-icon', 'symbol-palette', { x: 20, y: 20 }, {
      title: 'Symbol Palette',
      status: 'online'
    });
    
    // Link icon to panel
    actions.linkIconToPanel('symbol-palette-icon', 'symbol-palette');
    
    // Add one display if none exist
    if (displayList.length === 0 && symbols.length > 0) {
      const displayId = actions.addDisplay(symbols[0], { x: 100, y: 100 });
      
      // Subscribe to data
      try {
        await connectionManager.subscribeCanvas(displayId, symbols[0]);
      } catch (error) {
        console.error('Failed to subscribe display to data:', error);
      }
    }
  });
  
  
  // Handle workspace right-click
  function handleWorkspaceContextMenu(e) {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      actions.showContextMenu(e.clientX, e.clientY, null, 'workspace');
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<main>
  <!-- Workspace Background -->
  <div 
    class="workspace"
    on:contextmenu={handleWorkspaceContextMenu}
  ></div>
  
  <!-- Floating Icons (Layer 3) -->
  {#each iconList as icon (icon.id)}
    <FloatingIcon 
      id={icon.id}
      type={icon.type}
      position={icon.position}
      config={icon.config}
      title={icon.config?.title}
      on:toggleExpansion={(e) => {
        const { id, isExpanded } = e.detail;
        if (isExpanded) {
          actions.expandIcon(id);
        } else {
          actions.collapseIcon(id);
        }
      }}
    />
  {/each}
  
  <!-- Floating Displays (Layer 1) -->
  {#each displayList as display (display.id)}
    <FloatingDisplay 
      id={display.id}
      symbol={display.symbol}
      position={display.position}
    />
  {/each}
  
  <!-- Symbol Palette (Layer 2) -->
  <SymbolPalette bind:this={symbolPaletteRef} />
  
  <!-- Context Menu (Layer 4) -->
  <ContextMenu />
</main>

<style>
  :global(body) {
    background-color: #111827;
    margin: 0;
    overflow: hidden;
  }
  
  main {
    width: 100vw;
    height: 100vh;
    position: relative;
  }
  
  .workspace {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #111827;
    background-image:
      radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%);
  }
</style>
