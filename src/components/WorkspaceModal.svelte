<script>
  import { createEventDispatcher } from 'svelte';
  export let show = false;
  const dispatch = createEventDispatcher();

  const handleExport = () => dispatch('export');
  const handleImport = () => dispatch('import');
  const handleCancel = () => dispatch('cancel');
  const handleOverlayClick = () => dispatch('cancel');
  const handleModalClick = (e) => e.stopPropagation();
</script>

{#if show}
<div class="modal-overlay" on:click={handleOverlayClick}>
  <div class="workspace-modal" on:click={handleModalClick}>
    <h2>Workspace Controls</h2>
    <div class="modal-buttons">
      <button class="export-btn" on:click={handleExport}>📤 Export</button>
      <button class="import-btn" on:click={handleImport}>📥 Import</button>
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

  .export-btn:hover {
    background: rgb(67, 56, 202);
  }

  .import-btn {
    background: rgb(59, 130, 246);
    color: white;
  }

  .import-btn:hover {
    background: rgb(37, 99, 235);
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

  .cancel-btn:hover {
    background: rgba(107, 114, 128, 0.1);
    color: white;
  }
</style>