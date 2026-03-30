<script>
  import { createEventDispatcher, tick } from 'svelte';
  export let show = false;
  const dispatch = createEventDispatcher();

  const handleExport = () => dispatch('export');
  const handleImport = () => dispatch('import');
  const handleCancel = () => dispatch('cancel');
  const handleOverlayClick = () => dispatch('cancel');
  const handleModalClick = (e) => e.stopPropagation();

  function getFocusableElements() {
    const modal = document.querySelector('.workspace-modal');
    if (!modal) return [];
    return Array.from(modal.querySelectorAll('button:not([disabled])'));
  }

  function focusElement(index) {
    const buttons = getFocusableElements();
    if (buttons[index]) buttons[index].focus();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      handleCancel();
      return;
    }

    const buttons = getFocusableElements();
    if (buttons.length === 0) return;
    const currentIndex = buttons.indexOf(document.activeElement);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusElement((currentIndex + 1) % buttons.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusElement((currentIndex - 1 + buttons.length) % buttons.length);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        focusElement((currentIndex - 1 + buttons.length) % buttons.length);
      } else {
        focusElement((currentIndex + 1) % buttons.length);
      }
    }
  }

  // Reactive: focus first button whenever modal opens
  $: if (show) {
    tick().then(() => focusElement(0));
  }
</script>

{#if show}
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" on:click={handleOverlayClick} on:keydown={handleKeydown}>
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="workspace-modal" role="document" on:click={handleModalClick}>
    <h2 id="modal-title">Workspace Controls</h2>
    <div class="modal-buttons">
      <button class="export-btn" on:click={handleExport}>Export</button>
      <button class="import-btn" on:click={handleImport}>Import</button>
    </div>
    <button class="cancel-btn" on:click={handleCancel}>Cancel</button>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .workspace-modal {
    background: rgb(26, 26, 46);
    border: 1px solid rgb(79, 70, 229);
    border-radius: 8px;
    padding: 24px;
    min-width: 300px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }

  .workspace-modal h2 {
    margin: 0 0 20px 0;
    color: white;
    font-size: 20px;
    text-align: center;
  }

  .modal-buttons {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  .export-btn,
  .import-btn {
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .export-btn {
    background: rgb(79, 70, 229);
    color: white;
  }

  .export-btn:hover,
  .export-btn:focus-visible {
    background: rgb(67, 56, 202);
    outline: 2px solid rgb(129, 140, 248);
    outline-offset: 2px;
  }

  .import-btn {
    background: rgb(59, 130, 246);
    color: white;
  }

  .import-btn:hover,
  .import-btn:focus-visible {
    background: rgb(37, 99, 235);
    outline: 2px solid rgb(96, 165, 250);
    outline-offset: 2px;
  }

  .cancel-btn {
    width: 100%;
    padding: 10px;
    background: transparent;
    border: 1px solid rgb(107, 114, 128);
    border-radius: 6px;
    color: rgb(156, 163, 175);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover,
  .cancel-btn:focus-visible {
    background: rgba(107, 114, 128, 0.1);
    color: white;
    outline: 2px solid rgb(107, 114, 128);
    outline-offset: 2px;
  }
</style>
