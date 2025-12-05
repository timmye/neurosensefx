<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import { onMount, onDestroy } from 'svelte';

  let keyboardHandler;
  let escPressCount = 0;
  let escTimer = null;

  function handleKeydown(event) {
    // Alt+A: Create display (Crystal Clarity compliant - single entry point)
    if (event.altKey && event.key.toLowerCase() === 'a') {
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
    // Initialize workspace (no automatic display creation)
    workspacePersistence.loadFromStorage();
    workspacePersistence.saveToStorage();

    // Ensure workspace can receive keyboard events
    const workspaceEl = document.querySelector('.workspace');
    if (workspaceEl) {
      workspaceEl.focus();
      console.log('[WORKSPACE] Workspace focused and ready for keyboard shortcuts');
    }

    console.log('[WORKSPACE] Workspace initialized - use Alt+A to create displays');
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