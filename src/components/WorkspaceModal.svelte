<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { keyManager } from '../lib/keyManager.js';
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

  let escapePop;
  let modalKeyUnsubs = [];

  // Reactive: push escape handler and register modal navigation when shown
  $: if (show) {
    escapePop = keyManager.pushEscape(handleCancel);

    // Modal navigation (priority 20, only active while modal is open)
    const navHandler = (e) => {
      const buttons = getFocusableElements();
      if (buttons.length === 0) return false;
      const currentIndex = buttons.indexOf(document.activeElement);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusElement((currentIndex + 1) % buttons.length);
        return true;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusElement((currentIndex - 1 + buttons.length) % buttons.length);
        return true;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          focusElement((currentIndex - 1 + buttons.length) % buttons.length);
        } else {
          focusElement((currentIndex + 1) % buttons.length);
        }
        return true;
      }
      return false;
    };

    modalKeyUnsubs.push(keyManager.register({ key: 'ArrowRight' }, navHandler, { priority: 20, allowInput: true }));
    modalKeyUnsubs.push(keyManager.register({ key: 'ArrowDown' }, navHandler, { priority: 20, allowInput: true }));
    modalKeyUnsubs.push(keyManager.register({ key: 'ArrowLeft' }, navHandler, { priority: 20, allowInput: true }));
    modalKeyUnsubs.push(keyManager.register({ key: 'ArrowUp' }, navHandler, { priority: 20, allowInput: true }));
    modalKeyUnsubs.push(keyManager.register({ key: 'Tab' }, navHandler, { priority: 20, allowInput: true }));
    modalKeyUnsubs.push(keyManager.register({ key: 'Tab', shift: true }, navHandler, { priority: 20, allowInput: true }));

    tick().then(() => focusElement(0));
  } else {
    escapePop?.();
    escapePop = null;
    modalKeyUnsubs.forEach(fn => fn());
    modalKeyUnsubs = [];
  }
</script>

{#if show}
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" on:click={handleOverlayClick}>
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
    z-index: var(--z-modal);
    backdrop-filter: blur(4px);
    font-family: var(--font-ui);
  }

  .workspace-modal {
    background: var(--bg-frame);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--sp-6);
    min-width: 300px;
  }

  .workspace-modal h2 {
    margin: 0 0 20px 0;
    color: var(--text-primary);
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
    border-radius: var(--r-md);
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: filter 0.2s ease;
  }

  .export-btn {
    background: var(--accent);
    color: var(--text-primary);
  }

  .export-btn:hover,
  .export-btn:focus-visible {
    filter: brightness(0.9);
  }

  .import-btn {
    background: transparent;
    border: 1px solid var(--accent);
    color: var(--accent);
  }

  .import-btn:hover,
  .import-btn:focus-visible {
    background: var(--bg-frame);
  }

  .cancel-btn {
    width: 100%;
    padding: 10px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-btn:hover,
  .cancel-btn:focus-visible {
    background: var(--bg-frame);
    color: var(--text-primary);
    outline: 2px solid var(--border);
    outline-offset: 2px;
  }
</style>
