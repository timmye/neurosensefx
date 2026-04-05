<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let visible = false;
  export let x = 0;
  export let y = 0;
  export let isLocked = false;

  const dispatch = createEventDispatcher();

  function handleDelete() {
    dispatch('delete');
    dispatch('close');
  }

  function handleToggleLock() {
    dispatch('toggleLock');
    dispatch('close');
  }

  function handleClickOutside() {
    dispatch('close');
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="context-menu-backdrop" on:click|self={handleClickOutside}>
    <div class="context-menu" style="left: {x}px; top: {y}px;">
      <button class="menu-item delete" on:click={handleDelete}>Delete</button>
      <button class="menu-item" on:click={handleToggleLock}>{isLocked ? 'Unlock' : 'Lock'}</button>
    </div>
  </div>
{/if}

<style>
  .context-menu-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
  }

  .context-menu {
    position: fixed;
    background: #FFFFFF;
    border: 1px solid #D0D0D0;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 100px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    z-index: 1001;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 6px 14px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    color: #333333;
    line-height: 1.4;
  }

  .menu-item:hover {
    background: #F0F0F0;
  }

  .menu-item.delete {
    color: #bb2719;
  }

  .menu-item.delete:hover {
    background: #fce4e4;
  }
</style>
