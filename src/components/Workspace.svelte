<script>
  console.log('[DEBUGGER:Workspace.svelte:1] Starting imports');
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  console.log('[DEBUGGER:Workspace.svelte:2] workspace store imported');
  import FloatingDisplay from './FloatingDisplay.svelte';
  console.log('[DEBUGGER:Workspace.svelte:3] FloatingDisplay imported');
  import FxBasketDisplay from './FxBasketDisplay.svelte';
  console.log('[DEBUGGER:Workspace.svelte:4] FxBasketDisplay imported');
  import PriceTicker from './PriceTicker.svelte';
  console.log('[DEBUGGER:Workspace.svelte:5] PriceTicker imported');
  import BackgroundShader from './BackgroundShader.svelte';
  console.log('[DEBUGGER:Workspace.svelte:6] BackgroundShader imported');
  import WorkspaceModal from './WorkspaceModal.svelte';
  console.log('[DEBUGGER:Workspace.svelte:7] WorkspaceModal imported');
  import KeyboardShortcutsHelp from './KeyboardShortcutsHelp.svelte';
  console.log('[DEBUGGER:Workspace.svelte:8] KeyboardShortcutsHelp imported');
  import { onMount, onDestroy } from 'svelte';
  import { createKeyboardHandler } from '../lib/keyboardHandler.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
  import './Workspace.css';
  console.log('[DEBUGGER:Workspace.svelte:9] All imports done');

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
  let showKeyboardHelp = false;

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
    if (connectionManager?.status === 'connected') {
      connectionManager.connectionHandler.getWebSocket().send(JSON.stringify({ type: 'reinit', source: 'all' }));
      console.log('[Workspace] Reinit requested for: all (cTrader + TradingView)');
    } else {
      console.warn('[Workspace] Cannot reinit: WebSocket not connected. Status:', connectionManager?.status || 'unknown');
      alert('Cannot reinit: Backend not connected. Please wait for connection.');
    }
  }

  function handleKeydown(event) {
    // Hold ? to show keyboard shortcuts
    if (event.key === '?' || event.key === '/') {
      showKeyboardHelp = true;
      return;
    }
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

  function handleKeyup(event) {
    // Release ? to hide keyboard shortcuts
    if (event.key === '?' || event.key === '/') {
      showKeyboardHelp = false;
    }
  }

  onMount(() => {
    console.log('[DEBUGGER:Workspace.svelte:onMount:1] onMount fired');
    // Expose workspace actions and store to window for testing/debugging
    window.workspaceActions = workspaceActions;
    window.workspaceStore = workspaceStore;

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
    connectionManager.subscriptionManager.subscriptions.set('__SYSTEM__', new Set([systemCallback]));

    const workspaceEl = document.querySelector('.workspace');
    if (workspaceEl) workspaceEl.focus();
    console.log('[WORKSPACE] Ready - Alt+A (cTrader), Alt+T (TV), Alt+I (Ticker), Alt+R (reinit all)');
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
  <div class="workspace" role="region" tabindex="0" aria-label="Workspace" on:keydown={handleKeydown} on:keyup={handleKeyup}>
    {#each Array.from($workspaceStore.displays.values()) as display (display.id)}
      {#if display.type === 'priceTicker'}
        <PriceTicker ticker={display} />
      {:else if display.symbol === 'FX_BASKET'}
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

<KeyboardShortcutsHelp bind:show={showKeyboardHelp} />
