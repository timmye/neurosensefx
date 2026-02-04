<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import FxBasketDisplay from './FxBasketDisplay.svelte';
  import BackgroundShader from './BackgroundShader.svelte';
  import WorkspaceModal from './WorkspaceModal.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { createKeyboardHandler } from '../lib/keyboardHandler.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
  import './Workspace.css';

  let keyboardHandler;
  let fileInput;
  let connectionManager;
  let unsubscribePersistence;

  function exportWorkspace() {
    workspaceActions.exportWorkspace();
    console.log('✅ Workspace export initiated');
  }

  function importWorkspace() {
    fileInput.click();
  }

  async function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
      await workspaceActions.importWorkspace(file);
      event.target.value = '';
    }
  }

  let showWorkspaceModal = false;

  function showWorkspaceDialog() {
    showWorkspaceModal = true;
  }

  function handleExportClick() {
    showWorkspaceModal = false;
    exportWorkspace();
  }

  function handleImportClick() {
    showWorkspaceModal = false;
    fileInput.click();
  }

  function handleModalCancel() {
    showWorkspaceModal = false;
  }

  function reinitAll() {
    if (connectionManager?.ws?.readyState === WebSocket.OPEN) {
      connectionManager.ws.send(JSON.stringify({ type: 'reinit', source: 'all' }));
      console.log('[Workspace] Reinit requested for: all (cTrader + TradingView)');
    } else {
      console.warn('[Workspace] Cannot reinit: WebSocket not connected. Status:', connectionManager?.status || 'unknown');
      alert('Cannot reinit: Backend not connected. Please wait for connection.');
    }
  }

  function handleKeydown(event) {
    if (event.altKey && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      showWorkspaceDialog();
      return;
    }
    if (event.altKey && event.key.toLowerCase() === 'r') {
      event.preventDefault();
      reinitAll();
      return;
    }
    keyboardHandler?.handleKeydown(event);
  }

  onMount(() => {
    // Persistence must load before connection: WebSocket messages would overwrite restored state with empty workspace
    workspacePersistence.loadFromStorage();
    unsubscribePersistence = workspacePersistence.initPersistence();

    // Then setup keyboard and connection
    keyboardHandler = createKeyboardHandler(workspaceActions);
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    connectionManager.connect();

    // Listen for reinit confirmation from backend
    const systemCallback = (d) => {
      if (d.type === 'reinit_started') {
        console.log(`[Workspace] ✅ Backend acknowledged reinit for: ${d.source}`);
      }
    };
    // Add callback for system messages (no backend subscription needed)
    connectionManager.subscriptions.set('__SYSTEM__', new Set([systemCallback]));

    const workspaceEl = document.querySelector('.workspace');
    if (workspaceEl) workspaceEl.focus();
    console.log('[WORKSPACE] Ready - Alt+A (cTrader), Alt+T (TV), Alt+R (reinit all)');
  });

  onDestroy(() => {
    keyboardHandler?.cleanup();
    unsubscribePersistence?.();
  });
</script>

<input
  type="file"
  accept=".json"
  bind:this={fileInput}
  on:change={handleFileChange}
  style="display: none"
/>

<div class="workspace-container" role="application">
  <BackgroundShader />
  <div class="workspace" role="region" tabindex="0" aria-label="Workspace" on:keydown={handleKeydown}>
    {#each Array.from($workspaceStore.displays.values()) as display (display.id)}
      {#if display.symbol === 'FX_BASKET'}
        <FxBasketDisplay {display} />
      {:else}
        <FloatingDisplay {display} />
      {/if}
    {/each}
  </div>
</div>

<WorkspaceModal
  bind:show={showWorkspaceModal}
  on:export={handleExportClick}
  on:import={handleImportClick}
  on:cancel={handleModalCancel}
/>
