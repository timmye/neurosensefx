<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import FxBasketDisplay from './FxBasketDisplay.svelte';
  import PriceTicker from './PriceTicker.svelte';
  import ChartDisplay from './ChartDisplay.svelte';
  import BackgroundShader from './BackgroundShader.svelte';
  import WorkspaceModal from './WorkspaceModal.svelte';
  import KeyboardShortcutsHelp from './KeyboardShortcutsHelp.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { createKeyboardHandler } from '../lib/keyboardHandler.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl } from '../lib/displayDataProcessor.js';
  import './Workspace.css';

  let keyboardHandler;
  let fileInput;
  let connectionManager;
  let systemUnsub;
  let unsubscribePersistence;
  let selectedTicker = null;

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
    // Re-focus workspace after file dialog closes so keyboard shortcuts work
    const workspaceEl = document.querySelector('.workspace');
    if (workspaceEl) workspaceEl.focus();
  }

  let showWorkspaceModal = false;
  let showKeyboardHelp = false;

  function showWorkspaceDialog() {
    showWorkspaceModal = true;
  }

  function handleExportClick() {
    showWorkspaceModal = false;
    exportWorkspace();
    restoreWorkspaceFocus();
  }

  function handleImportClick() {
    showWorkspaceModal = false;
    fileInput.click();
  }

  function handleModalCancel() {
    showWorkspaceModal = false;
    restoreWorkspaceFocus();
  }

  function restoreWorkspaceFocus() {
    // Defer to let modal overlay unmount first
    setTimeout(() => {
      const workspaceEl = document.querySelector('.workspace');
      if (workspaceEl) workspaceEl.focus();
    }, 0);
  }

  function reinitAll() {
    if (connectionManager?.status === 'connected') {
      connectionManager.sendRaw({ type: 'reinit', source: 'all' });
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

    // 'c' key to toggle chart for selected symbol
    if (event.key === 'c' && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      toggleChart();
      return;
    }

    // Chart-specific shortcuts when chart is focused
    if (event.ctrlKey && event.key.toLowerCase() === 'z') {
      // Chart undo - could be implemented later
      return;
    }
    if (event.ctrlKey && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) {
      // Chart redo - could be implemented later
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

  function toggleChart() {
    // Find chart display (should be single instance)
    const chartDisplay = Array.from($workspaceStore.displays.values()).find(d => d.type === 'chart');

    if (chartDisplay) {
      // Chart exists - toggle minimize
      const isCurrentlyMinimized = chartDisplay.isMinimized !== false;
      workspaceActions.updateDisplay(chartDisplay.id, { isMinimized: !isCurrentlyMinimized });
    } else if (selectedTicker) {
      // No chart - create new one for selected ticker
      createChartDisplay(selectedTicker);
    }
  }

  function createChartDisplay(symbol) {
    // Default position and size for chart
    const defaultPosition = { x: 100, y: 100 };
    const defaultSize = { width: 800, height: 500 };

    // Check if there's already a chart display
    const existingChart = Array.from($workspaceStore.displays.values()).find(d => d.type === 'chart');
    if (existingChart) {
      // Update existing chart with new symbol
      workspaceActions.updateDisplay(existingChart.id, { symbol });
      selectedTicker = symbol;
      return;
    }

    // Create new chart display
    const chartDisplay = {
      id: `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'chart',
      symbol,
      source: 'ctrader',
      created: Date.now(),
      position: defaultPosition,
      size: defaultSize,
      zIndex: workspaceStore.getState().nextZIndex,
      resolution: '4h',
      window: '3M',
      isMinimized: false,
      showHeader: true
    };

    // Add to workspace
    workspaceStore.update(state => ({
      ...state,
      displays: new Map(state.displays).set(chartDisplay.id, chartDisplay),
      nextZIndex: state.nextZIndex + 1
    }));

    selectedTicker = symbol;
  }

  function updateSelectedTicker(symbol) {
    selectedTicker = symbol;

    // If chart is open, update its symbol
    const chartDisplay = Array.from($workspaceStore.displays.values()).find(d => d.type === 'chart');
    if (chartDisplay) {
      workspaceActions.updateDisplay(chartDisplay.id, { symbol });
      selectedTicker = symbol;
    }
  }

  function handleKeyup(event) {
    // Release ? to hide keyboard shortcuts
    if (event.key === '?' || event.key === '/') {
      showKeyboardHelp = false;
    }
  }

  onMount(() => {
    if (import.meta.env.DEV) {
      console.log('[Workspace] onMount fired');
    }
    // Expose workspace actions and store to window for testing/debugging
    window.workspaceActions = workspaceActions;
    window.workspaceStore = workspaceStore;

    // Load workspace persistence first
    workspacePersistence.loadFromStorage();
    unsubscribePersistence = workspacePersistence.initPersistence();

    // Initialize keyboard handler
    keyboardHandler = createKeyboardHandler({
      ...workspaceActions,
      toggleChart,
      createChartDisplay: createChartDisplay // Pass chart creation function
    });

    // Set keyboard handler symbol tracking
    keyboardHandler.setSelectedSymbol = (symbol) => {
      selectedTicker = symbol;
      keyboardHandler.setSelectedSymbol(symbol);
    };

    // Then setup keyboard and connection
    keyboardHandler = createKeyboardHandler(workspaceActions);
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    connectionManager.connect();

    // Listen for reinit confirmation from backend
    const systemCallback = (d) => {
      if (d.type === 'reinit_started') {
        console.log(`[Workspace] Backend acknowledged reinit for: ${d.source}`);
      }
    };
    // Add callback for system messages (no backend subscription needed)
    systemUnsub = connectionManager.addSystemSubscription(systemCallback);

    const workspaceEl = document.querySelector('.workspace');
    if (workspaceEl) workspaceEl.focus();
    console.log('[WORKSPACE] Ready - Alt+A (cTrader), Alt+T (TV), Alt+I (Ticker), Alt+R (reinit all)');
  });

  onDestroy(() => {
    systemUnsub?.();
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
        <PriceTicker ticker={display} rapidFlashEnabled={true} />
      {:else if display.symbol === 'FX_BASKET'}
        <FxBasketDisplay {display} />
      {:else if display.type === 'chart'}
        <ChartDisplay {display} />
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
