<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    workspacePersistence.loadFromStorage();
    workspacePersistence.saveToStorage();
  });

  
  function handleKeydown(event) {
    if (event.altKey && event.key === 'a') {
      event.preventDefault();
      const symbol = prompt('Enter symbol (e.g., EURUSD, XAUUSD, BTCUSD):');
      if (symbol) {
        workspaceActions.addDisplay(symbol);
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