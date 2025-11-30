<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    workspacePersistence.loadFromStorage();
    workspacePersistence.saveToStorage();

    // Auto-create a test display for debugging if none exist
    workspaceStore.update(state => {
      if (state.displays.size === 0) {
        console.log('[SYSTEM] No displays found, creating default EURUSD display for testing');
        const symbol = 'EURUSD';
        const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const display = {
          id,
          symbol,
          position: { x: 150, y: 150 },
          size: { width: 300, height: 180 },
          zIndex: state.nextZIndex,
          created: Date.now()
        };

        const newDisplays = new Map(state.displays);
        newDisplays.set(id, display);

        return {
          ...state,
          displays: newDisplays,
          nextZIndex: state.nextZIndex + 1
        };
      }
      return state;
    });
  });

  
  function handleKeydown(event) {
    if (event.altKey && event.key === 'a') {
      event.preventDefault();
      const symbol = prompt('Enter symbol (e.g., EURUSD, XAUUSD, BTCUSD):');
      if (symbol) {
        // Normalize symbol to uppercase for backend compatibility
        const normalizedSymbol = symbol.replace('/', '').trim().toUpperCase();
        console.log('[SYSTEM] Adding display for symbol:', normalizedSymbol);
        workspaceActions.addDisplay(normalizedSymbol);
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="workspace">
  {#each Array.from($workspaceStore.displays.values()) as display (display.id)}
    <FloatingDisplay {display} />
  {/each}
</div>

<style>
  .workspace {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: rgb(80, 20, 120);
    background: linear-gradient(135deg, rgb(80, 20, 120) 0%, rgb(60, 15, 90) 100%);
  }
</style>