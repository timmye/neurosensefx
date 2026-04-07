<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { init, dispose as disposeChart } from 'klinecharts';
  import { getChartBarStore, loadHistoricalBars, loadMoreHistory, unsubscribeFromCandles } from '../stores/chartDataStore.js';
  import { getMarketDataStore } from '../stores/marketDataStore.js';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import ChartHeader from './displays/ChartHeader.svelte';
  import ChartToolbar from './ChartToolbar.svelte';
  import QuickRuler from './QuickRuler.svelte';
  import { TIMEFRAME_BAR_SPACE, DEFAULT_RESOLUTION_WINDOW, calcBarSpace, windowToMs, getCalendarAlignedRange, getWindowTier, RESOLUTION_LABELS } from '../lib/chart/chartConfig.js';
  import { setAxisChart, setAxisWindow } from '../lib/chart/xAxisCustom.js';
  import { LIGHT_THEME } from '../lib/chart/chartThemeLight.js';
  import '../lib/chart/customOverlays.js';
  import { drawingStore } from '../lib/chart/drawingStore.js';
  import {
    DrawingCommandStack,
    CreateDrawingCommand,
    DeleteDrawingCommand,
  } from '../lib/chart/drawingCommands.js';
  import OverlayContextMenu from './OverlayContextMenu.svelte';
  import { getFadedStyles, withOriginBadge, isPriceOnlyOverlay } from '../lib/chart/styleUtils.js';

  export let display;

  const RIGHT_OFFSET_PX = 10;

  let element;
  let interactable;
  let chartContainer;
  let chart = null;
  let currentSymbol = display.symbol;
  let currentResolution = display.resolution || '4h';
  let currentWindow = display.window || DEFAULT_RESOLUTION_WINDOW[currentResolution] || '3M';
  let barStoreUnsubscribe = null;
  let tickUnsubscribe = null;
  let isMinimized = display.isMinimized ?? false;

  let commandStack = new DrawingCommandStack();
  let canUndo = false;
  let canRedo = false;
  const unsubUndo = commandStack.canUndo.subscribe(v => canUndo = v);
  const unsubRedo = commandStack.canRedo.subscribe(v => canRedo = v);
  let selectedOverlayId = null;
  let overlayDbIdMap = new Map(); // overlayId → dbId for delete command lookups
  let pinnedOverlayMap = new Map(); // compound overlayId → { dbId, resolution } for pinned foreign overlays
  let overlayPinnedMap = new Map(); // overlayId → boolean (pinned state)
  let contextMenu = { visible: false, x: 0, y: 0, overlayId: null };
  let isOverlayLocked = false;
  let isOverlayPinned = false;
  let activeDrawingTool = null;
  let magnetMode = true;
  let resizeObserver = null;
  let resizeRAF = null;
  let pendingDataApply = null;
  let wheelHandler = null;
  let isLoadingMore = false;
  let currentRangeFrom = 0;       // calendar-aligned window start (for barSpace)
  let currentFetchFrom = 0;       // window start + buffer (for data fetch)
  /** ISO 8601 helper: zero-pad to 2 digits. */
  function pad2(n) { return String(n).padStart(2, '0'); }

  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /**
   * KLineChart formatDate override for smart time axis labels.
   *
   * KLineChart's _optimalTickLabel compares adjacent displayed ticks at three
   * levels to detect transitions.  It calls formatDate with these format strings:
   *
   *   'YYYY'            — year level.  If year differs between ticks, this value is shown.
   *   'YYYY-MM'         — month level.  If month differs (same year), this value is shown.
   *   'MM-DD'           — day level.  If only day differs (same year+month), this value is shown.
   *   'YYYY-MM-DD HH:mm' — full datetime level.
   *
   * The primary call uses 'HH:mm' format for within-period labels.
   */
  function formatAxisLabel(dateTimeFormat, timestamp, format, type) {
    const d = new Date(timestamp);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();

    // Crosshair/tooltip (type !== 2): always ISO format
    if (type !== 2) return `${year}-${pad2(month + 1)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;

    // Transition detection — pure date components that change when date changes
    // KLineChart compares these strings between adjacent ticks to detect transitions
    if (format === 'YYYY')              return `${year}`;
    if (format === 'YYYY-MM')           return `${year}-${pad2(month + 1)}`;
    if (format === 'MM-DD')             return `${pad2(day)}-${pad2(month + 1)}`;
    if (format === 'YYYY-MM-DD HH:mm')  return `${year}-${pad2(month + 1)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;

    // Primary display (format === 'HH:mm') — tier-based formatting
    const tier = getWindowTier(currentWindow);
    switch (tier) {
      case 'INTRADAY':  return `${pad2(hour)}:${pad2(minute)}`;
      case 'DAILY':     return `${pad2(day)}-${pad2(month + 1)}`;
      case 'WEEKLY':    return `${pad2(day)}-${pad2(month + 1)}`;
      case 'MONTHLY':   return shortMonths[month];
      case 'QUARTERLY': return `${shortMonths[month]} ${year}`;
      case 'YEARLY':    return `${year}`;
      default:          return `${year}-${pad2(month + 1)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;
    }
  }

  function getBarSpace() {
    // Use chart's main pane width (excludes y-axis/price axis area)
    const chartArea = chart?.getSize?.('candle_pane', 'main');
    const width = chartArea?.width || chartContainer?.clientWidth || 0;
    if (width <= 0) return TIMEFRAME_BAR_SPACE[currentResolution] || 10;

    // Data-aware: count actual candles in the target time window.
    // Accounts for weekend gaps — 540 4H candles ≠ 3 calendar months.
    if (chart) {
      const dataList = chart.getDataList();
      if (dataList && dataList.length >= 2) {
        const lastTs = dataList[dataList.length - 1].timestamp;
        const fromTs = currentRangeFrom || (lastTs - windowToMs(currentWindow));

        // Binary search for first candle at or after fromTs
        let lo = 0, hi = dataList.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (dataList[mid].timestamp < fromTs) lo = mid + 1;
          else hi = mid;
        }

        const candleCount = dataList.length - lo;
        if (candleCount > 0) {
          return Math.max(1, Math.min(50, (width - RIGHT_OFFSET_PX) / candleCount));
        }
      }
    }

    // Fallback before data is available
    return calcBarSpace(currentResolution, currentWindow, width - RIGHT_OFFSET_PX);
  }

  function applyBarSpace() {
    if (!chart) return;
    const bs = getBarSpace();
    chart.setBarSpace(bs);
    chart.setOffsetRightDistance(RIGHT_OFFSET_PX, true);
    console.log('[applyBarSpace]',
      'barSpace:', bs.toFixed(3),
      'offsetPx:', chart.getOffsetRightDistance?.()?.toFixed(1),
      'visibleRange:', JSON.stringify(chart.getVisibleRange?.()),
      'dataLen:', chart.getDataList?.()?.length,
      'containerW:', chartContainer?.clientWidth
    );
  }

  function applyPricePrecision(symbol) {
    if (!chart) return;
    const store = getMarketDataStore(symbol);
    let pricePrecision = 5; // default for FX
    const unsub = store.subscribe(data => {
      pricePrecision = data.digits ?? (data.pipPosition ?? 4) + 1;
    });
    unsub();
    chart.setPriceVolumePrecision(pricePrecision, 0);
  }

  const handlers = {
    close: () => workspaceActions.removeDisplay(display.id),
    focus: () => workspaceActions.bringToFront(display.id),
    refresh: () => {
      tickUnsubscribe?.();
      tickUnsubscribe = null;
      unsubscribeFromCandles(currentSymbol, currentResolution);
      if (chart) {
        chart.removeOverlay();
        chart.clearData();
      }
      commandStack.clear();
      overlayDbIdMap.clear();
      pinnedOverlayMap.clear();
      overlayPinnedMap.clear();
      loadChartData(currentSymbol, currentResolution, currentWindow, () => {
        restoreDrawings(currentSymbol, currentResolution);
      });
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

  function handleDocumentKeydown(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedOverlayId && chart) {
        e.preventDefault();
        e.stopPropagation();
        handleOverlayDelete(selectedOverlayId);
      }
    }
  }

  function getOverlayCallbacks() {
    return {
      onSelected: (event) => {
        selectedOverlayId = event.overlay.id;
      },
      onDeselected: () => {
        selectedOverlayId = null;
      },
      onRightClick: (event) => {
        const overlay = event.overlay;
        isOverlayLocked = overlay.lock;
        isOverlayPinned = overlayPinnedMap.get(overlay.id) || false;
        contextMenu = {
          visible: true,
          x: event.pageX || event.x,
          y: event.pageY || event.y,
          overlayId: overlay.id,
        };
        return true; // prevent KLineChart default right-click behavior
      },
    };
  }

  async function restoreDrawings(symbol, resolution) {
    if (!chart) return;
    pinnedOverlayMap.clear();

    // 1. Load local drawings for this symbol+resolution
    const localDrawings = await drawingStore.load(symbol, resolution);

    // 2. Load all pinned drawings for this symbol (across all resolutions)
    const pinnedDrawings = await drawingStore.loadPinned(symbol);

    // 3. Separate pinned into local (same resolution) and foreign (different resolution)
    const pinnedLocal = new Map();
    const pinnedForeign = [];
    for (const d of pinnedDrawings) {
      if (d.resolution === resolution) {
        pinnedLocal.set(d.id, d);
      } else {
        pinnedForeign.push(d);
      }
    }

    // 4. Merge local + pinnedLocal (dedup by dbId)
    const mergedLocal = [];
    const seenIds = new Set();
    for (const d of localDrawings) {
      mergedLocal.push(d);
      seenIds.add(d.id);
    }
    for (const [, d] of pinnedLocal) {
      if (!seenIds.has(d.id)) {
        mergedLocal.push(d);
        seenIds.add(d.id);
      }
    }

    // 5. Render merged-local at full opacity with callbacks (existing logic)
    const callbacks = getOverlayCallbacks();
    for (const drawing of mergedLocal) {
      const opts = {
        id: drawing.overlayId,
        name: drawing.overlayType,
        points: drawing.points,
        styles: drawing.styles,
        ...callbacks,
      };
      if (drawing.extendData != null) opts.extendData = drawing.extendData;
      chart.createOverlay(opts);
      overlayDbIdMap.set(drawing.overlayId, drawing.id);
      overlayPinnedMap.set(drawing.overlayId, drawing.pinned || false);
      if (drawing.locked) {
        chart.overrideOverlay({ id: drawing.overlayId, lock: true });
      }
    }

    // 6. Render pinned foreign drawings: faded, locked, with origin badge
    const visibleRange = chart.getVisibleRange();
    for (const drawing of pinnedForeign) {
      const compoundId = `${drawing.overlayId}_pinned_${drawing.resolution}`;
      const opts = {
        id: compoundId,
        name: drawing.overlayType,
        points: drawing.points.map(p => {
          if (isPriceOnlyOverlay(drawing.overlayType) && visibleRange) {
            return { ...p, timestamp: visibleRange.from };
          }
          return p;
        }),
        styles: getFadedStyles(drawing.styles, 0.5),
        lock: true,
      };
      if (drawing.extendData != null) {
        opts.extendData = withOriginBadge(drawing.extendData, drawing.resolution);
      }
      chart.createOverlay(opts);
      pinnedOverlayMap.set(compoundId, { dbId: drawing.id, resolution: drawing.resolution });
    }
  }

  function handleDrawingCreated(event) {
    const { overlayId, overlayType, points, styles, extendData } = event.detail;
    const command = new CreateDrawingCommand(
      chart, drawingStore, currentSymbol, currentResolution,
      overlayType, points, styles, extendData
    );
    command.overlayId = overlayId;
    commandStack.execute(command);
    command.persist().then(dbId => {
      overlayDbIdMap.set(overlayId, dbId);
    });
    // Attach interaction callbacks to the newly created overlay
    chart.overrideOverlay({ id: overlayId, ...getOverlayCallbacks() });
  }

  async function handleOverlayDelete(overlayId) {
    const overlay = chart.getOverlayById(overlayId);
    if (!overlay) return;
    const dbId = overlayDbIdMap.get(overlayId) || null;
    const serialized = {
      overlayId: overlay.id,
      overlayType: overlay.name,
      points: overlay.points,
      styles: overlay.styles,
      extendData: overlay.extendData,
    };
    const command = new DeleteDrawingCommand(chart, drawingStore, overlayId, dbId, serialized);
    commandStack.execute(command);
    overlayDbIdMap.delete(overlayId);
    if (selectedOverlayId === overlayId) selectedOverlayId = null;
  }

  async function handleOverlayToggleLock(overlayId) {
    const overlay = chart.getOverlayById(overlayId);
    if (!overlay) return;
    const newLock = !overlay.lock;
    chart.overrideOverlay({ id: overlayId, lock: newLock });
    // Persist lock state
    const dbId = overlayDbIdMap.get(overlayId);
    if (dbId) {
      drawingStore.update(dbId, { locked: newLock });
    }
    isOverlayLocked = newLock;
  }

  function handleContextMenuDelete() {
    if (contextMenu.overlayId) {
      handleOverlayDelete(contextMenu.overlayId);
    }
    contextMenu.visible = false;
  }

  function handleContextMenuToggleLock() {
    if (contextMenu.overlayId) {
      handleOverlayToggleLock(contextMenu.overlayId);
    }
    contextMenu.visible = false;
  }

  async function handleContextMenuTogglePin() {
    const overlayId = contextMenu.overlayId;
    if (!overlayId) return;
    const dbId = overlayDbIdMap.get(overlayId);
    if (dbId) {
      const newPinned = !isOverlayPinned;
      await drawingStore.update(dbId, { pinned: newPinned });
      overlayPinnedMap.set(overlayId, newPinned);
    }
    contextMenu.visible = false;
  }

  function handleContextMenuClose() {
    contextMenu.visible = false;
  }

  async function handleClearDrawings() {
    await drawingStore.clearAll(currentSymbol, currentResolution);
    commandStack.clear();
  }

  function getWatermarkData() {
    return { symbol: currentSymbol, resolution: RESOLUTION_LABELS[currentResolution], window: currentWindow };
  }

  function updateWatermark() {
    if (!chart) return;
    chart.overrideIndicator({ name: 'symbolWatermark', extendData: getWatermarkData() }, 'candle_pane');
  }

  function teardownSubscriptions() {
    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    tickUnsubscribe?.();
    tickUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution);
  }

  function handleSymbolChange(newSymbol) {
    if (newSymbol === currentSymbol) return;

    teardownSubscriptions();

    currentSymbol = newSymbol;

    // Clear chart overlays and command stack
    if (chart) {
      chart.removeOverlay();
      chart.removeIndicator('candle_pane', 'symbolWatermark');
      chart.clearData();
      applyPricePrecision(newSymbol);
    }
    commandStack.clear();
    overlayDbIdMap.clear();
    pinnedOverlayMap.clear();
    overlayPinnedMap.clear();

    // Load new symbol data, restore drawings after data is applied
    loadChartData(currentSymbol, currentResolution, currentWindow, () => {
      restoreDrawings(currentSymbol, currentResolution);
      chart.createIndicator({ name: 'symbolWatermark', extendData: getWatermarkData() }, true, { id: 'candle_pane' });
    });
  }

  function handleResolutionChange(newResolution) {
    if (newResolution === currentResolution) return;

    teardownSubscriptions();

    currentResolution = newResolution;
    currentWindow = DEFAULT_RESOLUTION_WINDOW[newResolution] || currentWindow;

    setAxisWindow(currentWindow);
    updateWatermark();

    workspaceActions.updateDisplay(display.id, { resolution: newResolution, window: currentWindow });

    if (chart) {
      chart.removeOverlay();
    }
    overlayDbIdMap.clear();
    pinnedOverlayMap.clear();
    overlayPinnedMap.clear();
    commandStack.clear();
    loadChartData(currentSymbol, currentResolution, currentWindow, () => {
      restoreDrawings(currentSymbol, currentResolution);
    });
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

  function applyDataToChart(klineData) {
    if (!chart) return;
    chart.applyNewData(klineData);
    requestAnimationFrame(() => {
      if (chart) {
        chart.resize();
        applyBarSpace();
        chart.scrollToRealTime();
      }
    });
  }

  function tryApplyData(klineData) {
    if (chartContainer.clientWidth > 0 && chartContainer.clientHeight > 0) {
      applyDataToChart(klineData);
    } else {
      pendingDataApply = klineData;
    }
  }

  function loadChartData(symbol, resolution, window, onDataReady) {
    const store = getChartBarStore(symbol, resolution);

    // Reset store BEFORE subscribing to prevent stale cached data from
    // flashing on the chart when switching back to a previously-viewed symbol.
    // Without this, the subscription fires immediately with old data.
    store.set({ bars: [], state: 'loading', error: null });

    barStoreUnsubscribe?.();
    let initialFullReceived = false;
    barStoreUnsubscribe = store.subscribe(data => {
      if (data.state === 'ready' && data.bars.length > 0) {
        if (data.updateType === 'full') {
          // Full replace — map entire array
          initialFullReceived = true;
          const klineData = data.bars.map(bar => ({
            timestamp: bar.timestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume || 0
          }));
          tryApplyData(klineData);
          if (onDataReady) { onDataReady(); onDataReady = null; }
        } else if (initialFullReceived) {
          // Incremental — only after first full load to avoid
          // applying mismatched bars on stale chart data
          if (chart) {
            const bar = data.bars[data.bars.length - 1];
            chart.updateData({
              timestamp: bar.timestamp,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume || 0
            });
          }
        }
      }
    });

    // Subscribe to per-tick price updates for live last-bar close.
    // M1 trendbar data only arrives when bars close (~every 60s).
    // Using the current market price gives real-time close updates.
    tickUnsubscribe?.();
    const marketStore = getMarketDataStore(symbol);
    tickUnsubscribe = marketStore.subscribe(mdata => {
      if (!chart || mdata.current == null) return;
      const dataList = chart.getDataList();
      if (!dataList || dataList.length === 0) return;
      const lastBar = dataList[dataList.length - 1];
      chart.updateData({
        timestamp: lastBar.timestamp,
        open: lastBar.open,
        high: Math.max(lastBar.high, mdata.current),
        low: Math.min(lastBar.low, mdata.current),
        close: mdata.current,
        volume: lastBar.volume || 0
      });
    });

    // Calendar-aligned time range with scroll buffer
    const exact = getCalendarAlignedRange(window, 0);
    const buffered = getCalendarAlignedRange(window, 1);
    currentRangeFrom = exact.from;
    currentFetchFrom = buffered.from;

    loadHistoricalBars(symbol, resolution, buffered.from, buffered.to);
  }

  onMount(async () => {
    // Wait for DOM to be ready
    await tick();

    // Initialize KLineChart
    chart = init(chartContainer, { styles: LIGHT_THEME });

    // Smart time axis labels adapted to window tier
    chart.setCustomApi({ formatDate: formatAxisLabel });
    chart.setTimezone('UTC');

    // Custom calendar-aware x-axis — activate via setPaneOptions (not setStyles)
    setAxisChart(chart);
    setAxisWindow(currentWindow);
    chart.setPaneOptions({ id: 'x_axis_pane', axisOptions: { name: 'calendar' } });

    // Ensure the browser has completed layout before KLineChart reads dimensions
    requestAnimationFrame(() => {
      if (chart) chart.resize();
    });

    // Observe container resizes: initial layout, parent changes, interact.js resize
    if (chartContainer) {
      resizeObserver = new ResizeObserver(() => {
        if (resizeRAF) return;
        resizeRAF = requestAnimationFrame(() => {
          resizeRAF = null;
          if (chart) {
            // resize() updates the canvas buffer (DPR-aware) first.
            // setBarSpace() recalculates from new dimensions after buffer is correct.
            // Reversing this order causes setBarSpace's redraw rAF to block
            // KLineChart's DPR buffer update, producing fuzzy rendering.
            chart.resize();
            applyBarSpace();
            chart.scrollToRealTime();
            if (pendingDataApply) {
              const data = pendingDataApply;
              pendingDataApply = null;
              applyDataToChart(data);
            }
          }
        });
      });
      resizeObserver.observe(chartContainer);
    }

    if (chart) {
      // Lock zoom - barSpace derived from resolution + window
      chart.setZoomEnabled(false);
      chart.setScrollEnabled(true);

      applyBarSpace();
      applyPricePrecision(currentSymbol);

      // Add Bollinger Bands (20 period) on candle pane
      chart.createIndicator('BOLL', false, { id: 'candle_pane' });

      // Symbol watermark background text (stacked so it doesn't replace BOLL)
      chart.createIndicator({ name: 'symbolWatermark', extendData: getWatermarkData() }, true, { id: 'candle_pane' });

      // Re-lock on zoom attempt
      chart.subscribeAction('onZoom', () => {
        applyBarSpace();
        chart.scrollToRealTime();
      });

      // Progressive loading: fetch more history when scrolled near left edge
      chart.subscribeAction('onVisibleRangeChange', () => {
        if (isLoadingMore) return;
        const dataList = chart.getDataList();
        if (!dataList || dataList.length === 0) return;

        const range = chart.getVisibleRange();
        const edgeThreshold = Math.max(10, Math.floor(dataList.length * 0.15));

        if (range.from <= edgeThreshold) {
          isLoadingMore = true;
          loadMoreHistory(currentSymbol, currentResolution).finally(() => {
            isLoadingMore = false;
          });
        }
      });

      // Load data, restore persisted drawings after data is applied
      loadChartData(currentSymbol, currentResolution, currentWindow, () => {
        restoreDrawings(currentSymbol, currentResolution);
      });
    }

    // Set up interact.js for drag/resize
    interactable = createInteractConfig(element, {
      ignoreFrom: '.chart-canvas-container, .chart-toolbar button, .chart-toolbar span',
      onDragMove: (e) => workspaceActions.updatePosition(display.id, { x: e.rect.left, y: e.rect.top }),
      onResizeMove: (event) => {
        workspaceActions.updateSize(display.id, { width: event.rect.width, height: event.rect.height });
      },
      onTap: () => workspaceActions.bringToFront(display.id)
    });

    // Vertical wheel → horizontal time scroll (KLineChart maps deltaY to zoom, which is locked)
    wheelHandler = (e) => {
      if (!chart) return;
      e.preventDefault();
      const distance = e.deltaX || e.deltaY;
      if (distance !== 0) {
        chart.scrollByDistance(distance);
      }
    };
    chartContainer?.addEventListener('wheel', wheelHandler, { passive: false });

    // Focus chart-window on any canvas interaction so keyboard shortcuts work
    chartContainer?.addEventListener('mousedown', () => element.focus());

    // Document-level keydown for Delete key — div-level keydown is unreliable
    // because KLineChart canvas doesn't propagate focus to the parent div
    document.addEventListener('keydown', handleDocumentKeydown);
  });

  onDestroy(() => {
    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    tickUnsubscribe?.();
    tickUnsubscribe = null;

    unsubscribeFromCandles(currentSymbol, currentResolution);

    if (resizeRAF) {
      cancelAnimationFrame(resizeRAF);
      resizeRAF = null;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (wheelHandler && chartContainer) {
      chartContainer.removeEventListener('wheel', wheelHandler);
      wheelHandler = null;
    }
    document.removeEventListener('keydown', handleDocumentKeydown);
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
    overlayDbIdMap.clear();
    pinnedOverlayMap.clear();
    overlayPinnedMap.clear();
    unsubUndo();
    unsubRedo();
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
      bind:activeDrawingTool bind:magnetMode
      on:resolution={e => handleResolutionChange(e.detail)}
      on:window={e => handleWindowChange(e.detail)}
      on:drawingCreated={handleDrawingCreated}
      on:clearDrawings={handleClearDrawings} />

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
