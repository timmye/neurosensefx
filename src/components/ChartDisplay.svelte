<script>
  import { onMount, onDestroy } from 'svelte';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { ConnectionManager } from '../lib/connectionManager.js';
  import { getWebSocketUrl, formatSymbol } from '../lib/displayDataProcessor.js';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import ChartHeader from './displays/ChartHeader.svelte';
  import ChartToolbar from './ChartToolbar.svelte';
  import { getChartStore, subscribeToSymbol, getConnectionStatus } from '../stores/chartDataStore.js';

  export let display;
  let element, interactable, connectionManager, chartContainer;
  let lastSymbol = null;
  let unsubscribeSymbol;
  let isChartInitialized = false;
  let chartInstance = null;

  // Chart state
  let currentSymbol = null;
  let currentResolution = '4h';
  let currentWindow = '3M';
  let isMinimized = false;

  const handlers = {
    close: () => workspaceActions.removeDisplay(display.id),
    focus: () => workspaceActions.bringToFront(display.id),
    refresh: () => {
      // Refresh chart data
      if (chartInstance) {
        chartInstance.updateData();
      }
    },
    keydown: (e) => {
      // Chart-specific keyboard shortcuts
      if (e.key === 'Escape') {
        e.preventDefault();
        handlers.close();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        // Handle undo
        console.log('[Chart] Undo action');
      }
      if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        // Handle redo
        console.log('[Chart] Redo action');
      }
    }
  };

  // Compute formatted symbol
  $: formattedSymbol = formatSymbol(display.symbol);

  // Reactive store subscription
  $: chartData = getChartStore(formattedSymbol);
  $: connectionStatusStore = getConnectionStatus();
  $: status = $connectionStatusStore;

  $: ({ currentDisplay, isChartOpen } =
    (() => {
      const d = $workspaceStore.displays.get(display.id) || {};
      return {
        currentDisplay: d,
        isChartOpen: d?.isMinimized !== true
      };
    })()
  );

  // Subscribe to symbol data
  $: if (formattedSymbol && formattedSymbol !== lastSymbol) {
    // Unsubscribe from old symbol
    unsubscribeSymbol?.();

    // Subscribe to new symbol
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, 'ctrader', { resolution: currentResolution, window: currentWindow });

    lastSymbol = formattedSymbol;
  }

  onMount(() => {
    connectionManager = ConnectionManager.getInstance(getWebSocketUrl());
    connectionManager.connect();

    // Setup interact for drag/resize
    interactable = createInteractConfig(element, {
      onDragMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
      onResizeMove: (event) => workspaceActions.updateSize(display.id, { width: event.rect.width, height: event.rect.height }),
      onTap: () => workspaceActions.bringToFront(display.id)
    });

    // Initialize chart when display becomes visible
    if (isChartOpen) {
      initializeChart();
    }

    return () => {
      unsubscribeSymbol?.();
      if (chartInstance) {
        chartInstance.dispose();
        chartInstance = null;
      }
    };
  });

  function initializeChart() {
    if (isChartInitialized || !chartContainer) return;

    // Initialize KLineChart here
    // This will be implemented when we add KLineChart dependency
    console.log('[ChartDisplay] Initializing chart for', formattedSymbol, 'at', currentResolution, currentWindow);

    isChartInitialized = true;
  }

  function handleResolutionChange(resolution) {
    currentResolution = resolution;
    // Re-subscribe with new resolution
    unsubscribeSymbol?.();
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, 'ctrader', { resolution, window: currentWindow });

    // Update chart with new resolution
    if (chartInstance) {
      chartInstance.setResolution(resolution);
    }
  }

  function handleWindowChange(window) {
    currentWindow = window;
    // Re-subscribe with new window
    unsubscribeSymbol?.();
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, 'ctrader', { resolution: currentResolution, window });

    // Update chart with new window
    if (chartInstance) {
      chartInstance.setWindow(window);
    }
  }

  function handleSymbolChange(newSymbol) {
    // Save current state before switching
    if (currentSymbol && chartInstance) {
      // Save drawings for current symbol
      workspaceActions.saveChartDrawings(currentSymbol, currentResolution, chartInstance.getDrawings());
    }

    currentSymbol = newSymbol;
    formattedSymbol = formatSymbol(newSymbol);

    // Load drawings for new symbol if available
    if (chartInstance && newSymbol) {
      const drawings = workspaceActions.loadChartDrawings(newSymbol, currentResolution);
      if (drawings) {
        chartInstance.setDrawings(drawings);
      }
    }

    // Update chart data
    unsubscribeSymbol?.();
    unsubscribeSymbol = subscribeToSymbol(formattedSymbol, 'ctrader', { resolution: currentResolution, window: currentWindow });
  }

  function handleMinimize() {
    isMinimized = !isMinimized;
    workspaceActions.updateDisplay(display.id, { isMinimized });

    if (isMinimized && chartInstance) {
      chartInstance.minimize();
    } else if (!isMinimized && chartInstance) {
      chartInstance.restore();
    }
  }

  onDestroy(() => {
    if (unsubscribeSymbol) unsubscribeSymbol();
    if (interactable) interactable.unset();
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
  });
</script>

<div class="chart-display" bind:this={element} data-display-id={display.id}
     class:minimized={isMinimized}
     tabindex="0" role="region" aria-label="{display.symbol} chart display"
     on:focus={handlers?.focus} on:keydown={handlers?.keydown}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px;">

  <ChartHeader symbol={display.symbol} {connectionStatus} {isMinimized}
    onClose={handlers?.close} onFocus={handlers?.focus} onRefresh={handlers?.refresh}
    onMinimize={handleMinimize} />

  {#if !isMinimized}
    <ChartToolbar {currentResolution} {currentWindow}
      onResolutionChange={handleResolutionChange}
      onWindowChange={handleWindowChange} />

    <div class="chart-container" bind:this={chartContainer}>
      <!-- KLineChart will be mounted here -->
      <div class="chart-placeholder">
        KLineChart will be rendered here
      </div>
    </div>
  {/if}

  <div class="resize-handle"></div>
</div>

<style>
  .chart-display {
    position: absolute;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    overflow: hidden;
    user-select: none;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .chart-display:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 8px rgba(74, 158, 255, 0.4);
  }

  .chart-display:focus-visible {
    border-color: #4a9eff;
    box-shadow: 0 0 12px rgba(74, 158, 255, 0.6);
    outline: 2px solid rgba(74, 158, 255, 0.3);
    outline-offset: 2px;
  }

  .chart-container {
    width: 100%;
    height: calc(100% - 40px - 60px); /* Header + Toolbar */
    position: relative;
    background: #0a0a0a;
  }

  .chart-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 14px;
  }

  .resize-handle {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, transparent 50%, #555 50%);
    cursor: se-resize;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }

  .resize-handle:hover {
    opacity: 1;
  }

  .chart-display.minimized .chart-container,
  .chart-display.minimized .resize-handle {
    display: none;
  }
</style>