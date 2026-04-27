<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { init, dispose as disposeChart } from 'klinecharts';
  import { unsubscribeFromCandles } from '../stores/chartDataStore.js';
  import { getMarketDataStore } from '../stores/marketDataStore.js';
  import { get } from 'svelte/store';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { createInteractConfig } from '../lib/interactSetup.js';

  import ChartToolbar from './ChartToolbar.svelte';
  import QuickRuler from './QuickRuler.svelte';
  import { DEFAULT_RESOLUTION_WINDOW, RESOLUTION_LABELS } from '../lib/chart/chartConfig.js';
  import { setAxisChart, setAxisWindow, removeAxisChart } from '../lib/chart/xAxisCustom.js';
  import { LIGHT_THEME } from '../lib/chart/chartThemeLight.js';
  import { DARK_THEME } from '../lib/chart/chartThemeDark.js';
  import { themeStore } from '../stores/themeStore.js';
  import '../lib/chart/overlaysIndicators.js';
  import '../lib/chart/overlaysPriceLines.js';
  import '../lib/chart/overlaysShapes.js';
  import '../lib/chart/overlaysAnnotations.js';
  import '../lib/chart/overlaysChannels.js';
  import { DrawingCommandStack } from '../lib/chart/drawingCommands.js';
  import OverlayContextMenu from './OverlayContextMenu.svelte';
  import { createChartSubscriptions } from '../lib/chart/chartSubscriptions.js';
  import { createResizeState, scheduleResize, cancelScheduledResize, forceCanvasDPRRefresh } from '../lib/chart/chartResize.js';
  import { createOverlayMeta } from '../lib/chart/overlayMeta.js';
  import { createReloadChart } from '../lib/chart/reloadChart.js';
  import { createBarSpace } from '../lib/chart/chartBarSpace.js';
  import { createChartDataLoader } from '../lib/chart/chartDataLoader.js';
  import { createOverlayRestore } from '../lib/chart/chartOverlayRestore.js';
  import { createAxisFormatter } from '../lib/chart/chartAxisFormatter.js';
  import { keyManager } from '../lib/keyManager.js';
  import { timezoneStore, resolvedTimezone } from '../stores/timezoneStore.js';
  import { setAxisTimezone } from '../lib/chart/xAxisCustom.js';
  import { createDrawingHandlers } from '../lib/chart/chartDrawingHandlers.js';
  import { drawingStore } from '../lib/chart/drawingStore.js';
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
  let currentWindowMode = display.windowMode || 'developing';
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
  const resizeState = createResizeState();
  const chartSubs = createChartSubscriptions(() => chart);
  let currentRangeFrom = 0;
  let barStoreUnsubscribe = null;

  // --- Axis formatter ---
  const formatAxisLabel = createAxisFormatter(() => currentWindow, () => $resolvedTimezone);

  // --- Price precision ---
  let precisionUnsubscribe = null;
  function applyPricePrecision(symbol) {
    if (!chart) return;
    precisionUnsubscribe?.();
    const store = getMarketDataStore(symbol);
    const data = get(store);
    chart.setPriceVolumePrecision(data.digits ?? (data.pipPosition ?? 4) + 1, 0);
    // If digits not yet loaded, self-unsubscribe once real data arrives
    if (data.digits == null) {
      precisionUnsubscribe = store.subscribe(value => {
        if (!chart) return;
        if (value.digits != null) {
          precisionUnsubscribe?.(); precisionUnsubscribe = null;
        }
        chart.setPriceVolumePrecision(value.digits ?? (value.pipPosition ?? 4) + 1, 0);
      });
    }
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
  function getOverlayCallbacks() {
    return {
      onSelected: (e) => { selectedOverlayId = e.overlay.id; },
      onDeselected: () => { selectedOverlayId = null; },
      onPressedMoveEnd: (e) => {
        const o = e.overlay;
        drawingStore.update(o.id, { points: o.points });
      },
      onRightClick: (e) => {
        const o = e.overlay;
        isOverlayLocked = o.lock;
        isOverlayPinned = overlayMeta.getPinned(o.id);
        contextMenu = { visible: true, x: e.pageX || e.x, y: e.pageY || e.y, overlayId: o.id };
        return true;
      },
      onMouseEnter: (e) => {
        const o = e.overlay;
        if (o.name !== 'simpleAnnotation') return false;
        let data = o.extendData;
        if (typeof data === 'string' || data == null) {
          data = { text: data || '', hovered: false };
        }
        if (!data.hovered) {
          chart.overrideOverlay({ id: o.id, extendData: { ...data, hovered: true } });
        }
        return false;
      },
      onMouseLeave: (e) => {
        const o = e.overlay;
        if (o.name !== 'simpleAnnotation') return false;
        let data = o.extendData;
        if (typeof data === 'string' || data == null) return false;
        if (data.hovered) {
          chart.overrideOverlay({ id: o.id, extendData: { ...data, hovered: false } });
        }
        return false;
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
    chartSubs,
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
    getOverlayCallbacks,
    get restorePinnedDrawings() {
      return () => overlayRestore.restorePinnedDrawings(currentSymbol, currentResolution);
    },
  });

  // --- Data loading wrapper (manages unsubscribe refs) ---
  function loadChartData(symbol, resolution, window, onDataReady) {
    barStoreUnsubscribe?.();
    const result = dataLoader.loadChartData(symbol, resolution, window, currentSource, onDataReady, currentWindowMode);
    barStoreUnsubscribe = result.barUnsub;
    currentRangeFrom = result.rangeFrom;
  }

  function teardownSubscriptions() {
    barStoreUnsubscribe?.(); barStoreUnsubscribe = null;
    precisionUnsubscribe?.(); precisionUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution, currentSource);
  }

  // --- Reload helper ---
  const { reload } = createReloadChart({
    get chart() { return chart; },
    get chartContainer() { return chartContainer; },
    teardownSubscriptions,
    get loadChartData() { return loadChartData; },
    get restoreDrawings() { return overlayRestore.restoreDrawings; },
    overlayMeta,
    commandStack,
    applyPricePrecision,
    getWatermarkData,
    createWatermarkIndicator,
  });

  // --- Shared deps for setupChartActions (used in onMount + un-minimize) ---
  function getChartActionDeps() {
    return {
      applyBarSpace: barSpace.applyBarSpace, currentSymbol, currentResolution, currentSource,
      get isLoadingMore() { return isLoadingMore; }, set isLoadingMore(v) { isLoadingMore = v; },
    };
  }

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
    drawingStore.cancelPendingSync(currentSymbol, currentResolution);
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
    drawingStore.cancelPendingSync(currentSymbol, currentResolution);
    teardownSubscriptions();
    currentResolution = newResolution;
    currentWindow = DEFAULT_RESOLUTION_WINDOW[newResolution] || currentWindow;
    setAxisWindow(currentWindow, chart);
    updateWatermark();
    workspaceActions.updateDisplay(display.id, { resolution: newResolution, window: currentWindow });
    if (chart) { chart.removeOverlay(); chart.clearData(); chart.resize(); }
    overlayMeta.clear(); commandStack.clear();
    loadChartData(currentSymbol, currentResolution, currentWindow, () => {
      overlayRestore.restoreDrawings(currentSymbol, currentResolution).then(() => forceCanvasDPRRefresh(chartContainer)).catch(err => console.error('[ChartDisplay] restoreDrawings failed:', err));
    });
  }
  function reloadChartSetting(updateFn, persistProps) {
    drawingStore.cancelPendingSync(currentSymbol, currentResolution);
    teardownSubscriptions();
    updateFn();
    setAxisWindow(currentWindow, chart);
    updateWatermark();
    if (chart) { chart.removeOverlay(); chart.clearData(); chart.resize(); }
    overlayMeta.clear(); commandStack.clear();
    loadChartData(currentSymbol, currentResolution, currentWindow, () => {
      overlayRestore.restoreDrawings(currentSymbol, currentResolution).then(() => forceCanvasDPRRefresh(chartContainer)).catch(err => console.error('[ChartDisplay] restoreDrawings failed:', err));
    });
    workspaceActions.updateDisplay(display.id, persistProps);
  }
  function handleWindowChange(newWindow) {
    if (newWindow === currentWindow) return;
    reloadChartSetting(() => { currentWindow = newWindow; }, { window: newWindow });
  }
  function handleWindowModeChange(newMode) {
    if (newMode === currentWindowMode) return;
    reloadChartSetting(() => { currentWindowMode = newMode; }, { windowMode: newMode });
  }

  // --- Window-level handlers ---
  const handlers = {
    close: () => workspaceActions.removeDisplay(display.id),
    focus: () => workspaceActions.bringToFront(display.id),
    refresh: () => reload(currentSymbol, currentResolution, currentWindow),
    minimize: () => { isMinimized = !isMinimized; workspaceActions.updateDisplay(display.id, { isMinimized }); },
  };

  // KeyManager registrations — set up in onMount, torn down in onDestroy
  let keyUnsubs = [];

  function registerChartKeys() {
    const chartEl = element;

    // Escape: deselect overlay first, then close chart
    keyUnsubs.push(keyManager.register(
      { key: 'Escape' },
      (e) => {
        // Only act when this chart element has focus or contains focus
        if (!chartEl || !chartEl.contains(document.activeElement)) return false;
        e.preventDefault();
        if (selectedOverlayId) {
          selectedOverlayId = null;
          return true;
        }
        handlers.close();
        return true;
      },
      { priority: 40 }
    ));

    // Ctrl+Z: undo
    keyUnsubs.push(keyManager.register(
      { key: 'z', ctrl: true, shift: false },
      (e) => {
        if (!chart || document.hidden) return false;
        if (!chartEl || !chartEl.contains(document.activeElement)) return false;
        e.preventDefault();
        commandStack.undo().catch(() => {});
        return true;
      },
      { priority: 40, allowInput: true }
    ));

    // Ctrl+Y: redo
    keyUnsubs.push(keyManager.register(
      { key: 'y', ctrl: true },
      (e) => {
        if (!chart || document.hidden) return false;
        if (!chartEl || !chartEl.contains(document.activeElement)) return false;
        e.preventDefault();
        commandStack.redo().then(cmd => drawingHandlers.redoCreateCommand(cmd)).catch(() => {});
        return true;
      },
      { priority: 40, allowInput: true }
    ));

    // Ctrl+Shift+Z: redo
    keyUnsubs.push(keyManager.register(
      { key: 'z', ctrl: true, shift: true },
      (e) => {
        if (!chart || document.hidden) return false;
        if (!chartEl || !chartEl.contains(document.activeElement)) return false;
        e.preventDefault();
        commandStack.redo().then(cmd => drawingHandlers.redoCreateCommand(cmd)).catch(() => {});
        return true;
      },
      { priority: 40, allowInput: true }
    ));

    // Delete/Backspace: delete selected overlay (input-safe via KeyManager)
    keyUnsubs.push(keyManager.register(
      { key: 'Delete' },
      (e) => {
        if (!selectedOverlayId || !chart) return false;
        e.preventDefault();
        drawingHandlers.handleOverlayDelete(selectedOverlayId);
        selectedOverlayId = null;
        return true;
      },
      { priority: 40 }
    ));

    keyUnsubs.push(keyManager.register(
      { key: 'Backspace' },
      (e) => {
        if (!selectedOverlayId || !chart) return false;
        e.preventDefault();
        drawingHandlers.handleOverlayDelete(selectedOverlayId);
        selectedOverlayId = null;
        return true;
      },
      { priority: 40 }
    ));
  }

  // --- Reactive statements ---
  $: currentDisplay = $workspaceStore.displays.get(display.id) || {};
  $: if (display.symbol && display.symbol !== currentSymbol) handleSymbolChange(display.symbol);
  $: if (chart && $resolvedTimezone) {
    chart.setTimezone($resolvedTimezone);
    setAxisTimezone($resolvedTimezone, chart);
  }
  function applyTheme() {
    if (!chart) return;
    chart.setStyles($themeStore === 'dark' ? DARK_THEME : LIGHT_THEME);
  }
  $: if (chart) applyTheme(), $themeStore;
  $: if (currentDisplay.isMinimized !== undefined && currentDisplay.isMinimized !== isMinimized) {
    isMinimized = currentDisplay.isMinimized;
    if (!isMinimized) {
      if (chart) {
        tick().then(() => scheduleResize(chart, barSpace.applyBarSpace, pendingDataApplyRef, resizeState));
      } else {
        // Chart was never created (minimized on mount) — create it now
        setTimeout(() => {
          chart = initChart(chartContainer, { init, theme: $themeStore === 'dark' ? DARK_THEME : LIGHT_THEME, formatAxisLabel, setAxisChart, setAxisWindow, currentWindow, timezone: $resolvedTimezone });
          if (chart) {
            chart.setZoomEnabled(false);
            chart.setScrollEnabled(true);
            requestAnimationFrame(() => {
              if (!chart) return;
              setupIndicators(chart, createWatermarkIndicator);
              applyPricePrecision(currentSymbol);
              setupChartActions(chart, chartSubs, getChartActionDeps());
              loadChartData(currentSymbol, currentResolution, currentWindow, () => {
                overlayRestore.restoreDrawings(currentSymbol, currentResolution).then(() => {
                  forceCanvasDPRRefresh(chartContainer);
                }).catch(err => console.error('[ChartDisplay] restoreDrawings failed:', err));
              });
            });
          }
          if (chartContainer) resizeObserver = setupResizeObserver(chartContainer, chart, barSpace.applyBarSpace, pendingDataApplyRef, resizeState);
        }, 0);
      }
    }
  }

  // --- Lifecycle ---
  onMount(() => {
    registerChartKeys();

    // Guard: don't init chart if minimized (container won't exist in DOM)
    if (isMinimized) {
      interactable = setupInteract(element, display, workspaceActions, createInteractConfig);
      return;
    }

    // Use setTimeout(0) instead of tick() — yields to browser layout engine
    // so clientWidth/clientHeight are correct when initChart reads them.
    const initTimer = setTimeout(() => {
      chart = initChart(chartContainer, { init, theme: $themeStore === 'dark' ? DARK_THEME : LIGHT_THEME, formatAxisLabel, setAxisChart, setAxisWindow, currentWindow, timezone: $resolvedTimezone });
      if (chart) {
        chart.setZoomEnabled(false);
        chart.setScrollEnabled(true);

        // Defer post-init layout work to after first paint.
        // This lets klinecharts' constructor rAF (Canvas._resetPixelRatio) fire
        // and set DPR correctly before we trigger additional Canvas.update calls
        // that would race with the internal rAF coalescing guard.
        requestAnimationFrame(() => {
          if (!chart) return;
          setupIndicators(chart, createWatermarkIndicator);
          applyPricePrecision(currentSymbol);
          setupChartActions(chart, chartSubs, getChartActionDeps());
          loadChartData(currentSymbol, currentResolution, currentWindow, () => {
            overlayRestore.restoreDrawings(currentSymbol, currentResolution).then(() => {
              forceCanvasDPRRefresh(chartContainer);
            }).catch(err => console.error('[ChartDisplay] restoreDrawings failed:', err));
          });
        });
      }
      if (chartContainer) resizeObserver = setupResizeObserver(chartContainer, chart, barSpace.applyBarSpace, pendingDataApplyRef, resizeState);
    }, 0);

    interactable = setupInteract(element, display, workspaceActions, createInteractConfig);
    wheelHandler = setupWheelHandler(chartContainer, chart);
    mousedownHandler = () => element.focus();
    chartContainer?.addEventListener('mousedown', mousedownHandler);

    return () => clearTimeout(initTimer);
  });

  onDestroy(() => {
    keyUnsubs.forEach(fn => fn()); keyUnsubs = [];
    barStoreUnsubscribe?.(); barStoreUnsubscribe = null;
    precisionUnsubscribe?.(); precisionUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution, currentSource);
    chartSubs.unsubscribeAll();
    if (mousedownHandler && chartContainer) { chartContainer.removeEventListener('mousedown', mousedownHandler); mousedownHandler = null; }
    cancelScheduledResize(resizeState);
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (wheelHandler && chartContainer) { chartContainer.removeEventListener('wheel', wheelHandler); wheelHandler = null; }
    pendingDataApply = null;
    if (chart) { removeAxisChart(chart); disposeChart(chartContainer); chart = null; }
    if (interactable) { interactable.unset(); interactable = null; }
    commandStack.clear(); overlayMeta.clear();
    unsubUndo(); unsubRedo();
  });
</script>

<div class="chart-window" bind:this={element} data-display-id={display.id}
     class:minimized={isMinimized}
     class:dark={$themeStore === 'dark'}
     tabindex="0" role="region" aria-label="{display.symbol} chart"
     on:focus={handlers?.focus}
     style="left: {display.position.x}px; top: {display.position.y}px; z-index: {display.zIndex};
            width: {display.size.width}px; height: {display.size.height}px;">

  {#if !isMinimized}
    <ChartToolbar {currentResolution} {currentWindow} {chart} {commandStack} {canUndo} {canRedo}
      source={currentSource} windowMode={currentWindowMode}
      bind:activeDrawingTool bind:magnetMode
      on:resolution={e => handleResolutionChange(e.detail)}
      on:window={e => handleWindowChange(e.detail)}
      on:windowModeChange={e => handleWindowModeChange(e.detail)}
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

  .chart-window.dark { background: #0b0e14; border-color: rgba(51, 65, 85, 0.5); }
  .chart-window.dark:focus { border-color: #34d399; box-shadow: 0 0 8px rgba(0, 0, 0, 0.5); }
  .chart-window.dark:focus-visible { border-color: #34d399; box-shadow: 0 0 12px rgba(0, 0, 0, 0.5); outline: 2px solid rgba(0, 0, 0, 0.5); outline-offset: 2px; }
  .chart-window.dark .chart-canvas-container { background: #131722; }
  .chart-window.dark .resize-handle { background: linear-gradient(135deg, transparent 50%, #64748b 50%); }
</style>
