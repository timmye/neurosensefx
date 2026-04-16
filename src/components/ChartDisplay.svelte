<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { init, dispose as disposeChart } from 'klinecharts';
  import { unsubscribeFromCandles } from '../stores/chartDataStore.js';
  import { getMarketDataStore } from '../stores/marketDataStore.js';
  import { get } from 'svelte/store';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import ChartHeader from './displays/ChartHeader.svelte';
  import ChartToolbar from './ChartToolbar.svelte';
  import QuickRuler from './QuickRuler.svelte';
  import { DEFAULT_RESOLUTION_WINDOW, RESOLUTION_LABELS } from '../lib/chart/chartConfig.js';
  import { setAxisChart, setAxisWindow } from '../lib/chart/xAxisCustom.js';
  import { LIGHT_THEME } from '../lib/chart/chartThemeLight.js';
  import '../lib/chart/overlaysIndicators.js';
  import '../lib/chart/overlaysPriceLines.js';
  import '../lib/chart/overlaysShapes.js';
  import '../lib/chart/overlaysAnnotations.js';
  import '../lib/chart/overlaysChannels.js';
  import { DrawingCommandStack } from '../lib/chart/drawingCommands.js';
  import OverlayContextMenu from './OverlayContextMenu.svelte';
  import { unsubscribeAll as unsubscribeAllActions } from '../lib/chart/chartSubscriptions.js';
  import { scheduleResize, cancelScheduledResize } from '../lib/chart/chartResize.js';
  import { createOverlayMeta } from '../lib/chart/overlayMeta.js';
  import { createReloadChart } from '../lib/chart/reloadChart.js';
  import { createBarSpace } from '../lib/chart/chartBarSpace.js';
  import { createChartDataLoader } from '../lib/chart/chartDataLoader.js';
  import { createOverlayRestore } from '../lib/chart/chartOverlayRestore.js';
  import { createAxisFormatter } from '../lib/chart/chartAxisFormatter.js';
  import { createDrawingHandlers } from '../lib/chart/chartDrawingHandlers.js';
  import {
    initChart, setupResizeObserver, setupIndicators,
    setupChartActions, setupInteract, setupWheelHandler,
  } from '../lib/chart/chartLifecycle.js';

  export let display;

  const RIGHT_OFFSET_PX = 10;

  let element, interactable, chartContainer;
  let chart = null;
  let currentSymbol = display.symbol;
  let currentResolution = display.resolution || '4h';
  let currentWindow = display.window || DEFAULT_RESOLUTION_WINDOW[currentResolution] || '3M';
  let currentSource = display.source || 'tradingview';
  const sourceMemory = new Map();
  let isMinimized = display.isMinimized ?? false;

  let commandStack = new DrawingCommandStack();
  let canUndo = false, canRedo = false;
  const unsubUndo = commandStack.canUndo.subscribe(v => canUndo = v);
  const unsubRedo = commandStack.canRedo.subscribe(v => canRedo = v);
  let selectedOverlayId = null;
  let overlayMeta = createOverlayMeta();
  let contextMenu = { visible: false, x: 0, y: 0, overlayId: null };
  let isOverlayLocked = false, isOverlayPinned = false;
  let activeDrawingTool = null, magnetMode = true;
  let resizeObserver = null, wheelHandler = null, mousedownHandler = null;
  let pendingDataApply = null;
  const pendingDataApplyRef = {
    get value() { return pendingDataApply; },
    set value(v) { pendingDataApply = v; },
  };
  let isLoadingMore = false;
  let currentRangeFrom = 0;
  let barStoreUnsubscribe = null, tickUnsubscribe = null;

  // --- Axis formatter ---
  const formatAxisLabel = createAxisFormatter(() => currentWindow);

  // --- Price precision ---
  function applyPricePrecision(symbol) {
    if (!chart) return;
    const store = getMarketDataStore(symbol);
    const data = get(store);
    chart.setPriceVolumePrecision(data.digits ?? (data.pipPosition ?? 4) + 1, 0);
  }

  // --- Watermark ---
  function getWatermarkData() {
    return { symbol: currentSymbol, resolution: RESOLUTION_LABELS[currentResolution], window: currentWindow };
  }
  function createWatermarkIndicator() {
    if (!chart) return;
    chart.createIndicator({ name: 'symbolWatermark', extendData: getWatermarkData() }, true, { id: 'candle_pane' });
  }
  function updateWatermark() {
    if (!chart) return;
    chart.overrideIndicator({ name: 'symbolWatermark', extendData: getWatermarkData() }, 'candle_pane');
  }

  // --- Overlay helpers ---
  function getDbIdForOverlay(overlayId) {
    const dbId = overlayMeta.getDbId(overlayId);
    if (dbId != null) return dbId;
    return chart?.getOverlayById(overlayId)?.extendData?._dbId ?? null;
  }

  function getOverlayCallbacks() {
    return {
      onSelected: (e) => { selectedOverlayId = e.overlay.id; },
      onDeselected: () => { selectedOverlayId = null; },
      onRightClick: (e) => {
        const o = e.overlay;
        isOverlayLocked = o.lock;
        isOverlayPinned = overlayMeta.getPinned(o.id);
        contextMenu = { visible: true, x: e.pageX || e.x, y: e.pageY || e.y, overlayId: o.id };
        return true;
      },
    };
  }

  // --- Bar space ---
  const barSpace = createBarSpace({
    get chart() { return chart; },
    get chartContainer() { return chartContainer; },
    rightOffsetPx: RIGHT_OFFSET_PX,
    get resolution() { return currentResolution; },
    get window() { return currentWindow; },
    get currentRangeFrom() { return currentRangeFrom; },
  });

  // --- Data loader ---
  const dataLoader = createChartDataLoader({
    get chart() { return chart; },
    get chartContainer() { return chartContainer; },
    applyBarSpace: barSpace.applyBarSpace,
    setPending: (v) => { pendingDataApply = v; },
  });

  // --- Overlay restore ---
  const overlayRestore = createOverlayRestore({
    get chart() { return chart; },
    overlayMeta,
    getOverlayCallbacks,
  });

  // --- Drawing handlers ---
  const drawingHandlers = createDrawingHandlers({
    get chart() { return chart; },
    commandStack,
    get currentSymbol() { return currentSymbol; },
    get currentResolution() { return currentResolution; },
    overlayMeta,
    getDbIdForOverlay,
    getOverlayCallbacks,
  });

  // --- Data loading wrapper (manages unsubscribe refs) ---
  function loadChartData(symbol, resolution, window, onDataReady) {
    barStoreUnsubscribe?.(); tickUnsubscribe?.();
    const result = dataLoader.loadChartData(symbol, resolution, window, currentSource, onDataReady);
    barStoreUnsubscribe = result.barUnsub;
    tickUnsubscribe = result.tickUnsub;
    currentRangeFrom = result.rangeFrom;
  }

  function teardownSubscriptions() {
    barStoreUnsubscribe?.(); barStoreUnsubscribe = null;
    tickUnsubscribe?.(); tickUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution, currentSource);
  }

  // --- Reload helper ---
  const { reload } = createReloadChart({
    get chart() { return chart; },
    teardownSubscriptions,
    get loadChartData() { return loadChartData; },
    get restoreDrawings() { return overlayRestore.restoreDrawings; },
    overlayMeta,
    commandStack,
    applyPricePrecision,
    getWatermarkData,
    createWatermarkIndicator,
  });

  // --- Context menu handlers (thin wrappers updating local state) ---
  function handleContextMenuDelete() {
    if (contextMenu.overlayId) {
      drawingHandlers.handleOverlayDelete(contextMenu.overlayId);
      if (selectedOverlayId === contextMenu.overlayId) selectedOverlayId = null;
    }
    contextMenu.visible = false;
  }
  function handleContextMenuToggleLock() {
    if (contextMenu.overlayId) {
      drawingHandlers.handleOverlayToggleLock(contextMenu.overlayId).then(newLock => { isOverlayLocked = newLock; });
    }
    contextMenu.visible = false;
  }
  async function handleContextMenuTogglePin() {
    if (!contextMenu.overlayId) return;
    const newPinned = await drawingHandlers.handleContextMenuTogglePin(contextMenu.overlayId, isOverlayPinned);
    isOverlayPinned = newPinned;
    contextMenu.visible = false;
  }
  function handleContextMenuClose() { contextMenu.visible = false; }

  // --- Display change handlers ---
  function handleSymbolChange(newSymbol) {
    if (newSymbol === currentSymbol) return;
    const remembered = sourceMemory.get(newSymbol);
    if (remembered && remembered !== currentSource) currentSource = remembered;
    currentSymbol = newSymbol;
    reload(currentSymbol, currentResolution, currentWindow, { applyPrecision: true, removeWatermark: true });
  }
  function handleSourceChange(newSource) {
    if (newSource === currentSource) return;
    currentSource = newSource;
    sourceMemory.set(currentSymbol, newSource);
    reload(currentSymbol, currentResolution, currentWindow);
  }
  function handleResolutionChange(newResolution) {
    if (newResolution === currentResolution) return;
    teardownSubscriptions();
    currentResolution = newResolution;
    currentWindow = DEFAULT_RESOLUTION_WINDOW[newResolution] || currentWindow;
    setAxisWindow(currentWindow);
    updateWatermark();
    workspaceActions.updateDisplay(display.id, { resolution: newResolution, window: currentWindow });
    if (chart) chart.removeOverlay();
    overlayMeta.clear(); commandStack.clear();
    loadChartData(currentSymbol, currentResolution, currentWindow, () => overlayRestore.restoreDrawings(currentSymbol, currentResolution));
  }
  function handleWindowChange(newWindow) {
    if (newWindow === currentWindow) return;
    teardownSubscriptions();
    currentWindow = newWindow;
    setAxisWindow(currentWindow);
    updateWatermark();
    loadChartData(currentSymbol, currentResolution, currentWindow);
    workspaceActions.updateDisplay(display.id, { window: newWindow });
  }

  // --- Window-level handlers ---
  const handlers = {
    close: () => workspaceActions.removeDisplay(display.id),
    focus: () => workspaceActions.bringToFront(display.id),
    refresh: () => reload(currentSymbol, currentResolution, currentWindow),
    keydown: (e) => {
      if (e.key === 'Escape') { e.preventDefault(); handlers.close(); }
      if (!chart || document.hidden) return;
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); commandStack.undo(); }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); drawingHandlers.redoCreateCommand(commandStack.redo()); }
    },
    minimize: () => { isMinimized = !isMinimized; workspaceActions.updateDisplay(display.id, { isMinimized }); },
  };

  function handleDocumentKeydown(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedOverlayId && chart) {
      e.preventDefault(); e.stopPropagation();
      drawingHandlers.handleOverlayDelete(selectedOverlayId);
      selectedOverlayId = null;
    }
  }

  // --- Reactive statements ---
  $: currentDisplay = $workspaceStore.displays.get(display.id) || {};
  $: if (display.symbol && display.symbol !== currentSymbol) handleSymbolChange(display.symbol);
  $: if (currentDisplay.isMinimized !== undefined && currentDisplay.isMinimized !== isMinimized) {
    isMinimized = currentDisplay.isMinimized;
    if (!isMinimized && chart) tick().then(() => scheduleResize(chart, barSpace.applyBarSpace, pendingDataApplyRef));
  }

  // --- Lifecycle ---
  onMount(async () => {
    await tick();
    chart = initChart(chartContainer, { init, LIGHT_THEME, formatAxisLabel, setAxisChart, setAxisWindow, currentWindow });
    if (chart) {
      chart.setZoomEnabled(false);
      chart.setScrollEnabled(true);
      barSpace.applyBarSpace();
      applyPricePrecision(currentSymbol);
      setupIndicators(chart, createWatermarkIndicator);
      setupChartActions(chart, {
        applyBarSpace: barSpace.applyBarSpace, currentSymbol, currentResolution, currentSource,
        get isLoadingMore() { return isLoadingMore; }, set isLoadingMore(v) { isLoadingMore = v; },
      });
      loadChartData(currentSymbol, currentResolution, currentWindow, () => {
        overlayRestore.restoreDrawings(currentSymbol, currentResolution);
      });
    }
    if (chartContainer) resizeObserver = setupResizeObserver(chartContainer, chart, barSpace.applyBarSpace, pendingDataApplyRef);
    interactable = setupInteract(element, display, workspaceActions, createInteractConfig);
    wheelHandler = setupWheelHandler(chartContainer, chart);
    mousedownHandler = () => element.focus();
    chartContainer?.addEventListener('mousedown', mousedownHandler);
    document.addEventListener('keydown', handleDocumentKeydown);
  });

  onDestroy(() => {
    barStoreUnsubscribe?.(); barStoreUnsubscribe = null;
    tickUnsubscribe?.(); tickUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution, currentSource);
    unsubscribeAllActions();
    if (mousedownHandler && chartContainer) { chartContainer.removeEventListener('mousedown', mousedownHandler); mousedownHandler = null; }
    cancelScheduledResize();
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (wheelHandler && chartContainer) { chartContainer.removeEventListener('wheel', wheelHandler); wheelHandler = null; }
    document.removeEventListener('keydown', handleDocumentKeydown);
    pendingDataApply = null;
    if (chart) { disposeChart(chartContainer); chart = null; }
    if (interactable) { interactable.unset(); interactable = null; }
    commandStack.clear(); overlayMeta.clear();
    unsubUndo(); unsubRedo();
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
    <ChartToolbar {currentResolution} {currentWindow} {chart} {commandStack} {canUndo} {canRedo}
      source={currentSource}
      bind:activeDrawingTool bind:magnetMode
      on:resolution={e => handleResolutionChange(e.detail)}
      on:window={e => handleWindowChange(e.detail)}
      on:sourceChange={e => handleSourceChange(e.detail)}
      on:drawingCreated={drawingHandlers.handleDrawingCreated}
      on:redo={e => drawingHandlers.redoCreateCommand(e.detail)}
      on:clearDrawings={drawingHandlers.handleClearDrawings} />

    <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column;">
      <div class="chart-canvas-container" bind:this={chartContainer}></div>
      <QuickRuler {chart} {chartContainer} {currentSymbol} />
    </div>
  {/if}

  <div class="resize-handle"></div>
  <OverlayContextMenu
    visible={contextMenu.visible}
    x={contextMenu.x}
    y={contextMenu.y}
    isLocked={isOverlayLocked}
    isPinned={isOverlayPinned}
    on:delete={handleContextMenuDelete}
    on:toggleLock={handleContextMenuToggleLock}
    on:togglePin={handleContextMenuTogglePin}
    on:close={handleContextMenuClose} />
</div>

<style>
  .chart-window {
    position: absolute;
    background: #FAFAFA;
    border: 1px solid #D0D0D0;
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
    border-color: #48752c;
    box-shadow: 0 0 8px rgba(72, 117, 44, 0.3);
  }

  .chart-window:focus-visible {
    border-color: #48752c;
    box-shadow: 0 0 12px rgba(72, 117, 44, 0.4);
    outline: 2px solid rgba(72, 117, 44, 0.3);
    outline-offset: 2px;
  }

  .chart-canvas-container {
    flex: 1;
    width: 100%;
    background: #FFFFFF;
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
