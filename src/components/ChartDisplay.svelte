<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import { init, dispose as disposeChart } from 'klinecharts';
  import { getChartBarStore, loadHistoricalBars, loadMoreHistory, unsubscribeFromCandles } from '../stores/chartDataStore.js';
  import { getMarketDataStore } from '../stores/marketDataStore.js';
  import { workspaceActions, workspaceStore } from '../stores/workspace.js';
  import { createInteractConfig } from '../lib/interactSetup.js';
  import ChartHeader from './displays/ChartHeader.svelte';
  import ChartToolbar from './ChartToolbar.svelte';
  import { TIMEFRAME_BAR_SPACE, DEFAULT_RESOLUTION_WINDOW, calcBarSpace, windowToMs, getCalendarAlignedRange, getWindowTier, getCalendarBoundaryTimestamps } from '../lib/chart/chartConfig.js';
  import { LIGHT_THEME } from '../lib/chart/chartThemeLight.js';
  import '../lib/chart/customOverlays.js';
  import { drawingStore } from '../lib/chart/drawingStore.js';
  import {
    DrawingCommandStack,
    CreateDrawingCommand,
  } from '../lib/chart/drawingCommands.js';

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
  let activeDrawingTool = null;
  let magnetMode = true;
  let resizeObserver = null;
  let resizeRAF = null;
  let pendingDataApply = null;
  let wheelHandler = null;
  let isLoadingMore = false;
  let currentRangeFrom = 0;       // calendar-aligned window start (for barSpace)
  let currentFetchFrom = 0;       // window start + buffer (for data fetch)
  let boundaryOverlayIds = [];    // calendar boundary vertical line overlay IDs

  /** ISO 8601 helper: zero-pad to 2 digits. */
  function pad2(n) { return String(n).padStart(2, '0'); }

  /**
   * KLineChart formatDate override for smart time axis labels.
   *
   * KLineChart's _optimalTickLabel compares adjacent displayed ticks at three
   * levels to detect transitions.  It calls formatDate with these format strings:
   *
   *   'YYYY'    — year level.  If year differs between ticks, this value is shown.
   *   'YYYY-MM' — month level.  If month differs (same year), this value is shown.
   *               THIS is the month-start label.  No day===1 checks needed —
   *               KLineChart detects month change regardless of weekend gaps.
   *   'MM-DD'   — day level.  If only day differs (same year+month), this value is shown.
   *
   * The primary call uses 'HH:mm' format for within-period labels.
   * All dates use ISO 8601 ordering.
   */
  function formatAxisLabel(dateTimeFormat, timestamp, format, type) {
    if (type !== 2) {
      return dateTimeFormat.format(new Date(timestamp));
    }

    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const tier = getWindowTier(currentWindow);

    // --- Year-level transition label ---
    if (format === 'YYYY') {
      return String(year);
    }

    // --- Month-level transition label ---
    // Fires when month changes between adjacent ticks (= month boundary).
    // KLineChart detects this correctly even when the 1st falls on a weekend
    // and the first trading bar is day 2 or 3.
    if (format === 'YYYY-MM') {
      if (tier === 'YEARLY') return String(year);
      if (tier === 'QUARTERLY') return `Q${Math.floor(month / 3) + 1} ${year}`;
      return `${year}-${pad2(month + 1)}`;                               // "2026-04"
    }

    // --- Day-level transition label ---
    // Only fires when year AND month are the same but day differs.
    // This can NEVER be a month start — those are caught by YYYY-MM above.
    if (format === 'MM-DD') {
      if (tier === 'YEARLY') return String(year);
      if (tier === 'QUARTERLY') return `Q${Math.floor(month / 3) + 1} ${year}`;
      if (tier === 'MONTHLY') return `${year}-${pad2(month + 1)}`;
      return `${pad2(month + 1)}-${pad2(day)}`;                          // "04-03"
    }

    // --- Primary axis label (format === 'HH:mm' or similar) ---
    // Shown for non-transition ticks within the same period.
    switch (tier) {
      case 'INTRADAY':
        return `${pad2(hour)}:${pad2(minute)}`;

      case 'DAILY':
        return `${pad2(month + 1)}-${pad2(day)}`;                       // "04-03"

      case 'WEEKLY':
        return `${pad2(month + 1)}-${pad2(day)}`;                       // "04-03"

      case 'MONTHLY':
        // MM-DD format so KLineChart's first-tick regex matches and
        // calls MM-DD override → shows "2026-04" month context.
        return `${pad2(month + 1)}-${pad2(day)}`;                       // "04-15"

      case 'QUARTERLY':
        return `${year}-${pad2(month + 1)}`;                            // "2026-04"

      case 'YEARLY':
        return `${year}-${pad2(month + 1)}`;                            // "2026-04"

      default:
        return dateTimeFormat.format(date);
    }
  }

  /**
   * Find the first bar at or after the target timestamp.
   * Returns the bar's actual timestamp, or null if past the data range.
   */
  function findFirstBarAtOrAfter(dataList, targetTs) {
    if (!dataList || dataList.length === 0) return null;
    let lo = 0, hi = dataList.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (dataList[mid].timestamp < targetTs) lo = mid + 1;
      else hi = mid;
    }
    return dataList[lo].timestamp >= targetTs ? dataList[lo].timestamp : null;
  }

  function updateBoundaryOverlays() {
    if (!chart) return;
    removeBoundaryOverlays();

    const dataList = chart.getDataList();
    if (!dataList || dataList.length < 2) return;

    // Use actual data range — avoids future boundaries stacking on last bar
    const firstTs = dataList[0].timestamp;
    const lastTs = dataList[dataList.length - 1].timestamp;

    const boundaries = getCalendarBoundaryTimestamps(firstTs, lastTs, currentWindow);

    const usedTimestamps = new Set();
    for (const ts of boundaries) {
      // Snap to first bar at or after the calendar boundary
      const barTs = findFirstBarAtOrAfter(dataList, ts);
      if (barTs === null || barTs > lastTs) continue;
      if (usedTimestamps.has(barTs)) continue; // dedup snapped boundaries
      usedTimestamps.add(barTs);

      const id = `cal-boundary-${barTs}`;
      chart.createOverlay({
        name: 'calendarBoundary',
        id,
        points: [{ timestamp: barTs }],
        styles: { style: 'dashed', color: 'rgba(0, 0, 0, 0.08)' }
      });
      boundaryOverlayIds.push(id);
    }
  }

  function removeBoundaryOverlays() {
    if (!chart) return;
    for (const id of boundaryOverlayIds) {
      chart.removeOverlay(id);
    }
    boundaryOverlayIds = [];
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
      pricePrecision = (data.pipPosition ?? 4) + 1;
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
      removeBoundaryOverlays();
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

    removeBoundaryOverlays();

    // Unsubscribe from old symbol's candles
    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    tickUnsubscribe?.();
    tickUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution);

    currentSymbol = newSymbol;

    // Clear chart overlays and command stack
    if (chart) {
      chart.removeOverlay();
      chart.clearData();
      applyPricePrecision(newSymbol);
    }
    commandStack.clear();

    // Load new symbol data
    loadChartData(currentSymbol, currentResolution, currentWindow);

    // Restore drawings for new symbol after data loads
    restoreDrawings(currentSymbol, currentResolution);
  }

  function handleResolutionChange(newResolution) {
    if (newResolution === currentResolution) return;

    removeBoundaryOverlays();

    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    tickUnsubscribe?.();
    tickUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution);

    currentResolution = newResolution;
    currentWindow = DEFAULT_RESOLUTION_WINDOW[newResolution] || currentWindow;

    loadChartData(currentSymbol, currentResolution, currentWindow);
    workspaceActions.updateDisplay(display.id, { resolution: newResolution, window: currentWindow });

    // Clear overlays and restore for new resolution
    if (chart) {
      chart.removeOverlay();
    }
    commandStack.clear();
    restoreDrawings(currentSymbol, currentResolution);
  }

  function handleWindowChange(newWindow) {
    if (newWindow === currentWindow) return;

    removeBoundaryOverlays();

    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    tickUnsubscribe?.();
    tickUnsubscribe = null;
    unsubscribeFromCandles(currentSymbol, currentResolution);

    currentWindow = newWindow;

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
        updateBoundaryOverlays();
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

  function loadChartData(symbol, resolution, window) {
    const store = getChartBarStore(symbol, resolution);

    // Reset store BEFORE subscribing to prevent stale cached data from
    // flashing on the chart when switching back to a previously-viewed symbol.
    // Without this, the subscription fires immediately with old data.
    store.set({ bars: [], state: 'loading', error: null });

    barStoreUnsubscribe?.();
    barStoreUnsubscribe = store.subscribe(data => {
      if (data.state === 'ready' && data.bars.length > 0) {
        if (data.updateType === 'full') {
          // Full replace — map entire array
          const klineData = data.bars.map(bar => ({
            timestamp: bar.timestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume || 0
          }));
          tryApplyData(klineData);
        } else {
          // Incremental — only the last bar, no array map
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

      // Load data
      loadChartData(currentSymbol, currentResolution, currentWindow);

      // Restore persisted drawings
      await restoreDrawings(currentSymbol, currentResolution);
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
  });

  onDestroy(() => {
    barStoreUnsubscribe?.();
    barStoreUnsubscribe = null;
    tickUnsubscribe?.();
    tickUnsubscribe = null;
    boundaryOverlayIds = [];

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
