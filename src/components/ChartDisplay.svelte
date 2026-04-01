<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { init, dispose as disposeChart } from 'klinecharts';
  import { getChartBarStore, loadHistoricalBars, unsubscribeFromCandles } from '../stores/chartDataStore.js';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import ChartHeader from './displays/ChartHeader.svelte';
  import ChartToolbar from './ChartToolbar.svelte';
  import { TIMEFRAME_BAR_SPACE, windowToMs } from '../lib/chart/chartConfig.js';
  import { drawingStore } from '../lib/chart/drawingStore.js';
  import {
    DrawingCommandStack,
    CreateDrawingCommand,
  } from '../lib/chart/drawingCommands.js';

  export let display;

  let element;
  let interactable;
  let chartContainer;
  let chart = null;
  let currentSymbol = display.symbol;
  let currentResolution = display.resolution || '4h';
  let currentWindow = display.window || '3M';
  let barStoreUnsubscribe = null;
  let isMinimized = display.isMinimized ?? false;

  let commandStack = new DrawingCommandStack();
  let activeDrawingTool = null;
  let magnetMode = false;
  let resizeObserver = null;
  let pendingDataApply = null;

  const handlers = {
    close: () => workspaceActions.removeDisplay(display.id),
    focus: () => workspaceActions.bringToFront(display.id),
    refresh: () => {
      unsubscribeFromCandles(currentSymbol, currentResolution);
      if (chart) chart.clearData();
      loadChartData(currentSymbol, currentResolution, currentWindow);
    },
    keydown: (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handlers.close();
      }
      if (!chart || document.hidden) return;
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        commandStack.undo();
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        commandStack.redo();
      }
    },
    minimize: () => {
      isMinimized = !isMinimized;
      workspaceActions.updateDisplay(display.id, { isMinimized });
    }
  };

  $: currentDisplay = (() => {
    const d = $workspaceStore.displays.get(display.id) || {};
    return d;
  })();

  // Watch for symbol changes from workspace
  $: if (display.symbol && display.symbol !== currentSymbol) {
    handleSymbolChange(display.symbol);
  }

  // Watch for minimize state changes - resize chart after restore
  $: if (currentDisplay.isMinimized !== undefined && currentDisplay.isMinimized !== isMinimized) {
    isMinimized = currentDisplay.isMinimized;
    if (!isMinimized && chart) {
      tick().then(() => chart.resize());
    }
  }

  async function restoreDrawings(symbol, resolution) {
    const drawings = await drawingStore.load(symbol, resolution);
    for (const drawing of drawings) {
      chart.createOverlay({
        id: drawing.overlayId,
        name: drawing.overlayType,
        points: drawing.points,
        styles: drawing.styles,
      });
    }
  }

  function handleDrawingCreated(event) {
    const { overlayId, overlayType, points, styles } = event.detail;
    const command = new CreateDrawingCommand(
      chart, drawingStore, currentSymbol, currentResolution,
      overlayType, points, styles
    );
    command.overlayId = overlayId;
    commandStack.execute(command);
    command.persist();
  }

  async function handleClearDrawings() {
    await drawingStore.clearAll(currentSymbol, currentResolution);
    commandStack.clear();
  }

  function handleSymbolChange(newSymbol) {
    if (newSymbol === currentSymbol) return;

    // Unsubscribe from old symbol's candles
    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution);

    currentSymbol = newSymbol;

    // Clear chart overlays and command stack
    if (chart) {
      chart.removeOverlay();
      chart.clearData();
    }
    commandStack.clear();

    // Load new symbol data
    loadChartData(currentSymbol, currentResolution, currentWindow);

    // Restore drawings for new symbol after data loads
    restoreDrawings(currentSymbol, currentResolution);
  }

  function handleResolutionChange(newResolution) {
    if (newResolution === currentResolution) return;

    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution);

    currentResolution = newResolution;

    if (chart) {
      chart.setBarSpace(TIMEFRAME_BAR_SPACE[currentResolution] || 20);
    }

    loadChartData(currentSymbol, currentResolution, currentWindow);
    workspaceActions.updateDisplay(display.id, { resolution: newResolution });

    // Clear overlays and restore for new resolution
    if (chart) {
      chart.removeOverlay();
    }
    commandStack.clear();
    restoreDrawings(currentSymbol, currentResolution);
  }

  function handleWindowChange(newWindow) {
    if (newWindow === currentWindow) return;

    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;

    currentWindow = newWindow;
    loadChartData(currentSymbol, currentResolution, currentWindow);
    workspaceActions.updateDisplay(display.id, { window: newWindow });
  }

  function applyDataToChart(klineData) {
    if (!chart) return;
    chart.applyNewData(klineData);
    requestAnimationFrame(() => {
      if (chart) chart.resize();
    });
  }

  function tryApplyData(klineData) {
    if (chartContainer.clientWidth > 0 && chartContainer.clientHeight > 0) {
      applyDataToChart(klineData);
    } else {
      pendingDataApply = klineData;
    }
  }

  function loadChartData(symbol, resolution, window) {
    const store = getChartBarStore(symbol, resolution);

    barStoreUnsubscribe?.();
    barStoreUnsubscribe = store.subscribe(data => {
      if (data.state === 'ready' && data.bars.length > 0) {
        const klineData = data.bars.map(bar => ({
          timestamp: bar.timestamp,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume || 0
        }));

        tryApplyData(klineData);
      }
    });

    // Calculate time range: window * 2 for scroll buffer
    const windowMs = windowToMs(window);
    const to = Date.now();
    const from = to - windowMs * 2;

    loadHistoricalBars(symbol, resolution, from, to);
  }

  onMount(async () => {
    // Wait for DOM to be ready
    await tick();

    // Initialize KLineChart
    chart = init(chartContainer);

    // Ensure the browser has completed layout before KLineChart reads dimensions
    requestAnimationFrame(() => {
      if (chart) chart.resize();
    });

    // Observe container resizes: initial layout, parent changes, interact.js resize
    if (chartContainer) {
      resizeObserver = new ResizeObserver(() => {
        if (chart) {
          chart.resize();
          if (pendingDataApply) {
            const data = pendingDataApply;
            pendingDataApply = null;
            applyDataToChart(data);
          }
        }
      });
      resizeObserver.observe(chartContainer);
    }

    if (chart) {
      // Lock zoom - fixed resolution
      chart.setZoomEnabled(false);
      chart.setScrollEnabled(true);

      // Set barSpace for resolution
      chart.setBarSpace(TIMEFRAME_BAR_SPACE[currentResolution] || 20);

      // Re-lock on zoom attempt
      chart.subscribeAction('onZoom', () => {
        chart.setBarSpace(TIMEFRAME_BAR_SPACE[currentResolution] || 20);
      });

      // Load data
      loadChartData(currentSymbol, currentResolution, currentWindow);

      // Restore persisted drawings
      await restoreDrawings(currentSymbol, currentResolution);
    }

    // Set up interact.js for drag/resize
    interactable = createInteractConfig(element, {
      onDragMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
      onResizeMove: (event) => {
        workspaceActions.updateSize(display.id, { width: event.rect.width, height: event.rect.height });
        if (chart) chart.resize();
      },
      onTap: () => workspaceActions.bringToFront(display.id)
    });
  });

  onDestroy(() => {
    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    pendingDataApply = null;

    if (chart) {
      disposeChart(chartContainer);
      chart = null;
    }

    if (interactable) {
      interactable.unset();
      interactable = null;
    }

    commandStack.clear();
  });
</script>

<div class="chart-window" bind:this={element} data-display-id={display.id}
     class:minimized={isMinimized}
     tabindex="0" role="region" aria-label="{display.symbol} chart"
     on:focus={handlers?.focus} on:keydown={handlers?.keydown}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px;">

  <ChartHeader symbol={display.symbol} isMinimized={isMinimized}
    onClose={handlers?.close} onFocus={handlers?.focus} onRefresh={handlers?.refresh}
    onMinimize={handlers?.minimize} />

  {#if !isMinimized}
    <ChartToolbar {currentResolution} {currentWindow} {chart} {commandStack}
      bind:activeDrawingTool bind:magnetMode
      on:resolution={e => handleResolutionChange(e.detail)}
      on:window={e => handleWindowChange(e.detail)}
      on:drawingCreated={handleDrawingCreated}
      on:clearDrawings={handleClearDrawings} />

    <div class="chart-canvas-container" bind:this={chartContainer}></div>
  {/if}

  <div class="resize-handle"></div>
</div>

<style>
  .chart-window {
    position: absolute;
    background: #1a1a2e;
    border: 1px solid #2a2a4a;
    border-radius: 4px;
    overflow: hidden;
    user-select: none;
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .chart-window:focus {
    border-color: #4a9eff;
    box-shadow: 0 0 8px rgba(74, 158, 255, 0.4);
  }

  .chart-window:focus-visible {
    border-color: #4a9eff;
    box-shadow: 0 0 12px rgba(74, 158, 255, 0.6);
    outline: 2px solid rgba(74, 158, 255, 0.3);
    outline-offset: 2px;
  }

  .chart-canvas-container {
    flex: 1;
    width: 100%;
    background: #0d0d1a;
    position: relative;
    overflow: hidden;
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

  .chart-window.minimized .chart-canvas-container,
  .chart-window.minimized .resize-handle {
    display: none;
  }
</style>
