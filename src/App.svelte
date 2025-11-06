<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayStore, displayActions, displays, icons, panels, defaultConfig, contextMenu } from './stores/displayStore.js';
  import { subscribe, unsubscribe } from './data/wsClient.js';
  import FloatingDisplay from './components/FloatingDisplay.svelte';
  import FloatingIcon from './components/FloatingIcon.svelte';
  import UnifiedContextMenu from './components/UnifiedContextMenu.svelte';
  import SymbolPalette from './components/SymbolPalette.svelte';
  import symbolService from './services/symbolService.js';
  
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
      if ($contextMenu.open) {
        displayActions.hideContextMenu();
      } else {
        // Collapse expanded icon if any
        const expandedIcon = Array.from($icons.values()).find(icon => icon.isExpanded);
        if (expandedIcon) {
          displayActions.collapseIcon(expandedIcon.id);
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
      try {
        const symbols = symbolService.getSymbols();
        const firstSymbol = symbolService.getFirstSymbol();
        
        if (firstSymbol) {
          const displayId = displayActions.addDisplay(firstSymbol, {
            x: 100 + Math.random() * 200,
            y: 100 + Math.random() * 100
          });
          
          console.log(`[APP] Created new display for ${firstSymbol}: ${displayId}`);
        } else {
          console.warn('[APP] No symbols available for display creation');
        }
      } catch (error) {
        console.error('[APP] Failed to create display:', error);
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
      displayActions.expandIcon(iconId);
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
        displayActions.collapseIcon(iconId);
      } else {
        displayActions.expandIcon(iconId);
      }
    }
  }
  
  // Initialize displays on mount
  onMount(async () => {
    try {
      // Initialize workspace from persisted data first
      console.log('[APP] Initializing workspace from persistence...');
      await displayActions.initializeWorkspace();
      
      // Initialize symbol service
      await symbolService.initialize();
      const symbols = symbolService.getSymbols();
      const firstSymbol = symbolService.getFirstSymbol();
      
      // Register symbol palette panel
      console.log('[APP] About to add symbol palette panel');
      displayActions.addPanel('symbol-palette', { x: 50, y: 50 }, {
        title: 'Symbol Palette'
      });
      console.log('[APP] Symbol palette panel add call completed');
      
      // Create symbol palette floating icon
      displayActions.addIcon('symbol-palette-icon', 'symbol-palette', { x: 20, y: 20 }, {
        title: 'Symbol Palette',
        status: 'online'
      });
      
      console.log('[APP] Startup complete - workspace restored from persistence');
    } catch (error) {
      console.error('[APP] Initialization failed:', error);
      // Fallback: try to create display with default symbol
      try {
        const fallbackSymbol = 'EURUSD';
        const validation = symbolService.validateSymbol(fallbackSymbol);
        if (validation.valid) {
          const displayId = displayActions.addDisplay(validation.symbol, { x: 100, y: 100 });
          console.log(`[APP] Created fallback display for ${validation.symbol}: ${displayId}`);
        }
      } catch (fallbackError) {
        console.error('[APP] Fallback display creation also failed:', fallbackError);
      }
    }
  });
  
  
  // Handle workspace right-click
  function handleWorkspaceContextMenu(e) {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      
      // Use unified context menu system
      const context = {
        type: 'workspace',
        targetId: null,
        targetType: 'workspace'
      };
      
      displayActions.showContextMenu(e.clientX, e.clientY, null, 'workspace', context);
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
          displayActions.expandIcon(id);
        } else {
          displayActions.collapseIcon(id);
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
  {#each panelList as panel (panel.id)}
    {#if panel.id === 'symbol-palette'}
      <SymbolPalette bind:this={symbolPaletteRef} />
    {/if}
  {/each}
  
  <!-- Unified Context Menu (Layer 4) -->
  <UnifiedContextMenu />
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
