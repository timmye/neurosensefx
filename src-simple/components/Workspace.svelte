<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import { onMount, onDestroy } from 'svelte';

  let keyboardHandler;
  let escPressCount = 0;
  let escTimer = null;

  function handleKeydown(event) {
    // Alt+A: Create display
    if (event.altKey && event.key === 'a') {
      event.preventDefault();
      const symbol = prompt('Enter symbol:');
      if (symbol) workspaceActions.addDisplay(symbol.replace('/', '').trim().toUpperCase());
      return;
    }

    // ESC: Progressive escape pattern
    if (event.key === 'Escape') {
      event.preventDefault();
      escPressCount++;

      // Reset timer for progressive pattern
      clearTimeout(escTimer);
      escTimer = setTimeout(() => { escPressCount = 0; }, 1000);

      if (escPressCount === 1) {
        // First ESC: Close overlays/modals
        document.querySelectorAll('.modal, .overlay, .dropdown').forEach(el => {
          el.close ? el.close() : el.remove();
        });
      } else if (escPressCount === 2) {
        // Second ESC: Clear display focus
        document.querySelectorAll('.focused').forEach(el =>
          el.classList.remove('focused'));
        escPressCount = 0;
      }
    }
  }

  onMount(() => {
    // Simplified initialization for debugging
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

    console.log('[WORKSPACE] Workspace initialized with original code');
  });

  onDestroy(() => {
    clearTimeout(escTimer);
    console.log('[WORKSPACE] Workspace cleaned up');
  });
</script>

<div class="workspace" on:keydown={handleKeydown} tabindex="0">
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