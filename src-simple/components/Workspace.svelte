<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    workspacePersistence.loadFromStorage();
    workspacePersistence.saveToStorage();
  });

  function handleKeydown(event) {
    if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      const symbol = prompt('Enter symbol:');
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
  }
</style>