<script>
  import { workspaceStore, workspaceActions, workspacePersistence } from '../stores/workspace.js';
  import FloatingDisplay from './FloatingDisplay.svelte';
  import FxBasketDisplay from './FxBasketDisplay.svelte';
  import PriceTicker from './PriceTicker.svelte';
  import ChartDisplay from './ChartDisplay.svelte';
  import BackgroundShader from './BackgroundShader.svelte';
  import WorkspaceModal from './WorkspaceModal.svelte';
  import KeyboardShortcutsHelp from './KeyboardShortcutsHelp.svelte';
  import HeadlinesWidget from './HeadlinesWidget.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { keyManager } from '../lib/keyManager.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
  import './Workspace.css';

  let fileInput;
  let connectionManager;
  let systemUnsub;
  let unsubscribePersistence;
  let keyboardCleanup;

  $: selectedTicker = (() => {
    if (!$workspaceStore.selectedDisplayId) return null;
    const display = $workspaceStore.displays.get($workspaceStore.selectedDisplayId);
    return display?.symbol || null;
  })();

  // Update chart symbol when a different ticker is selected
  $: if (selectedTicker) {
    const chartDisplay = Array.from($workspaceStore.displays.values()).find(d => d.type === 'chart');
    if (chartDisplay && chartDisplay.symbol !== selectedTicker) {
      workspaceActions.updateChartDisplay(chartDisplay.id, { symbol: selectedTicker });
    }
  }

  async function exportWorkspace() {
    try {
      await workspaceActions.exportWorkspace();
      console.log('✅ Workspace export initiated');
    } catch (error) {
      console.error('❌ Workspace export failed:', error);
      alert('Export failed. Please try again.');
    }
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

  function toggleChart() {
    // Find chart display (should be single instance)
    const chartDisplay = Array.from($workspaceStore.displays.values()).find(d => d.type === 'chart');

    if (chartDisplay) {
      // Chart exists - close it
      workspaceActions.removeDisplay(chartDisplay.id);
    } else {
      // No chart - create new one for selected ticker
      // Fallback: if no ticker selected, use first priceTicker symbol
      const symbol = selectedTicker || (() => {
        const ticker = Array.from($workspaceStore.displays.values()).find(d => d.type === 'priceTicker');
        return ticker?.symbol || null;
      })();
      if (symbol) {
        createChartDisplay(symbol);
      }
    }
  }

  function createChartDisplay(symbol) {
    // Check if there's already a chart display
    const existingChart = Array.from($workspaceStore.displays.values()).find(d => d.type === 'chart');
    if (existingChart) {
      // Update existing chart with new symbol
      workspaceActions.updateChartDisplay(existingChart.id, { symbol });
      return;
    }

    // Delegate to workspace action
    workspaceActions.addChartDisplay(symbol);
  }

  onMount(async () => {
    if (import.meta.env.DEV) {
      console.log('[Workspace] onMount fired');
    }
    // Expose workspace actions and store to window for testing/debugging
    window.workspaceActions = workspaceActions;
    window.workspaceStore = workspaceStore;

    // Load workspace persistence first
    // Async: server API load may take time, so await before proceeding (ref: DL-007)
    await workspacePersistence.loadFromStorage();
    unsubscribePersistence = workspacePersistence.initPersistence();

    // Initialize KeyManager
    keyManager.init();

    // Register global shortcuts
    const unsubs = [];

    // ? / / : hold to show keyboard shortcuts help
    unsubs.push(keyManager.register(
      { key: '?' }, () => { showKeyboardHelp = true; return true; }, { priority: 0 }
    ));
    unsubs.push(keyManager.register(
      { key: '/' }, () => { showKeyboardHelp = true; return true; }, { priority: 0 }
    ));

    // Alt+W: workspace modal
    unsubs.push(keyManager.register(
      { key: 'w', alt: true }, () => { showWorkspaceDialog(); return true; }, { priority: 0 }
    ));

    // Alt+R: reinit all connections
    unsubs.push(keyManager.register(
      { key: 'r', alt: true }, () => { reinitAll(); return true; }, { priority: 0 }
    ));

    // c: toggle chart (only without ctrl/alt)
    unsubs.push(keyManager.register(
      { key: 'c', ctrl: false, alt: false, meta: false }, () => { toggleChart(); return true; }, { priority: 10 }
    ));

    // Alt+A: create cTrader display
    unsubs.push(keyManager.register(
      { key: 'a', alt: true }, () => {
        const symbol = prompt('Enter symbol:');
        if (symbol) workspaceActions.addDisplay(formatSymbol(symbol, 'ctrader'), null, 'ctrader');
        return true;
      }, { priority: 0 }
    ));

    // Alt+B: create FX Basket display
    unsubs.push(keyManager.register(
      { key: 'b', alt: true }, () => {
        workspaceActions.addDisplay('FX_BASKET', null, 'ctrader');
        return true;
      }, { priority: 0 }
    ));

    // Alt+T: create TradingView display
    unsubs.push(keyManager.register(
      { key: 't', alt: true }, () => {
        const symbol = prompt('Enter symbol (TradingView):');
        if (symbol) workspaceActions.addDisplay(formatSymbol(symbol, 'tradingview'), null, 'tradingview');
        return true;
      }, { priority: 0 }
    ));

    // Alt+I: create Price Ticker
    unsubs.push(keyManager.register(
      { key: 'i', alt: true }, () => {
        const symbol = prompt('Enter symbol for Price Ticker:');
        if (symbol) workspaceActions.addPriceTicker(formatSymbol(symbol, 'tradingview'), null, 'tradingview');
        return true;
      }, { priority: 0 }
    ));

    // Arrow keys: navigate between displays
    unsubs.push(keyManager.register(
      { key: 'ArrowUp' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowUp'); return true; }, { priority: 0 }
    ));
    unsubs.push(keyManager.register(
      { key: 'ArrowDown' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowDown'); return true; }, { priority: 0 }
    ));
    unsubs.push(keyManager.register(
      { key: 'ArrowLeft' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowLeft'); return true; }, { priority: 0 }
    ));
    unsubs.push(keyManager.register(
      { key: 'ArrowRight' }, (e) => { e.preventDefault(); workspaceActions.selectNextDisplay('ArrowRight'); return true; }, { priority: 0 }
    ));

    // h: toggle headlines widget (no modifier keys)
    unsubs.push(keyManager.register(
      { key: 'h', ctrl: false, alt: false, meta: false }, () => {
        workspaceActions.toggleHeadlines();
        return true;
      }, { priority: 10 }
    ));

    // Keyup for ? / / to hide help
    const handleHelpKeyup = (e) => {
      if (e.key === '?' || e.key === '/') showKeyboardHelp = false;
    };
    document.addEventListener('keyup', handleHelpKeyup);
    unsubs.push(() => document.removeEventListener('keyup', handleHelpKeyup));

    // Store cleanup function
    keyboardCleanup = () => {
      unsubs.forEach(fn => fn());
      keyManager.destroy();
    };

    // Setup connection
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
    keyboardCleanup?.();
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

<div class="workspace-container" role="application" on:contextmenu|preventDefault>
  <BackgroundShader />
  <div class="workspace" role="region" tabindex="0" aria-label="Workspace">
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
    {#if $workspaceStore.headlinesVisible}
      <HeadlinesWidget />
    {/if}
  </div>
</div>

<WorkspaceModal
  bind:show={showWorkspaceModal}
  on:export={handleExportClick}
  on:import={handleImportClick}
  on:cancel={handleModalCancel}
/>

<KeyboardShortcutsHelp bind:show={showKeyboardHelp} />

