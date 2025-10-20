<script>
  import { onMount } from 'svelte';
  import { floatingStore, actions, displays } from './stores/floatingStore.js';
  import { symbolStore } from './data/symbolStore.js';
  import { connectionManager } from './data/ConnectionManager.js';
  import FloatingDisplay from './components/FloatingDisplay.svelte';
  import ContextMenu from './components/ContextMenu.svelte';
  import SymbolPalette from './components/SymbolPalette.svelte';
  
  // Store subscriptions
  $: displayList = Array.from($displays.values());
  
  // Simple keyboard shortcuts
  function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.key === 'Escape') {
      actions.hideContextMenu();
    }
    
    if (e.key === 'n' && e.ctrlKey) {
      e.preventDefault();
      const symbols = Object.keys($symbolStore);
      if (symbols.length > 0) {
        actions.addDisplay(symbols[0], {
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 100
        });
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
  
  <!-- Floating Displays -->
  {#each displayList as display (display.id)}
    <FloatingDisplay 
      id={display.id}
      symbol={display.symbol}
      position={display.position}
    />
  {/each}
  
  <!-- Symbol Palette -->
  <SymbolPalette />
  
  <!-- Context Menu -->
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
