<script>
  import { onDestroy } from 'svelte';
  import { formatRulerData } from '../lib/chart/quickRulerUtils.js';
  import { getMarketDataStore } from '../stores/marketDataStore.js';

  export let chart = null;
  export let chartContainer = null;
  export let currentSymbol = '';

  let active = false;
  let origin = { x: 0, y: 0 };
  let cursor = { x: 0, y: 0 };
  let rulerData = null;
  let originOverlayId = null;
  let cursorOverlayId = null;

  const LINE_COLOR = '#958f00';

  function removeOverlays() {
    if (originOverlayId != null) {
      chart.removeOverlay({ id: originOverlayId });
      originOverlayId = null;
    }
    if (cursorOverlayId != null) {
      chart.removeOverlay({ id: cursorOverlayId });
      cursorOverlayId = null;
    }
  }

  function createOverlays() {
    const originPt = chart.convertFromPixel(
      [{ x: origin.x, y: origin.y }],
      { paneId: 'candle_pane' }
    );
    const cursorPt = chart.convertFromPixel(
      [{ x: cursor.x, y: cursor.y }],
      { paneId: 'candle_pane' }
    );
    if (originPt[0] == null || cursorPt[0] == null) return;

    originOverlayId = chart.createOverlay({
      name: 'rulerPriceLine',
      points: [{ value: originPt[0].value }],
      styles: { line: { color: LINE_COLOR } },
      lock: true,
    });
    cursorOverlayId = chart.createOverlay({
      name: 'rulerPriceLine',
      points: [{ value: cursorPt[0].value }],
      styles: { line: { color: LINE_COLOR } },
      lock: true,
    });
  }

  function updateCursorOverlay() {
    if (cursorOverlayId == null) return;
    const cursorPt = chart.convertFromPixel(
      [{ x: cursor.x, y: cursor.y }],
      { paneId: 'candle_pane' }
    );
    if (cursorPt[0] == null) return;
    chart.overrideOverlay({
      id: cursorOverlayId,
      points: [{ value: cursorPt[0].value }],
    });
  }

  function getPixelOffset(e) {
    const rect = chartContainer.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function getMarketData() {
    if (!currentSymbol) return null;
    const store = getMarketDataStore(currentSymbol);
    let data;
    const unsub = store.subscribe(v => { data = v; });
    unsub();
    return data;
  }

  function recalcData() {
    if (!chart || !active) return;
    const marketData = getMarketData();
    if (!marketData) { rulerData = null; return; }
    rulerData = formatRulerData(chart, marketData, origin, cursor);
  }

  $: showDataWindow = active && rulerData !== null;

  $: dataWindowStyle = (() => {
    if (!active) return 'display: none;';
    const rect = chartContainer?.getBoundingClientRect();
    if (!rect) return 'display: none;';

    let left = cursor.x;
    let top = cursor.y;

    if (left + 160 > rect.width) {
      left = cursor.x - 160;
    }
    if (top + 120 > rect.height) {
      top = cursor.y - 120;
    }

    return `position: absolute; left: ${left}px; top: ${top}px; background: ${LINE_COLOR}; color: #fff; font-size: 12px; padding: 4px 8px; border-radius: 3px; pointer-events: none; white-space: nowrap; opacity: 0.92; z-index: 5;`;
  })();

  function onContextmenu(e) {
    e.preventDefault();
  }

  function onMousedown(e) {
    if (!chart || e.button !== 2) return;
    e.preventDefault();

    origin = getPixelOffset(e);
    cursor = { ...origin };
    active = true;
    rulerData = null;

    chart.setStyles({ crosshair: { show: false } });
    createOverlays();
  }

  function onMousemove(e) {
    if (!chart || !active) return;
    cursor = getPixelOffset(e);
    recalcData();
    updateCursorOverlay();
  }

  function onMouseup(e) {
    if (!chart || e.button !== 2 || !active) return;
    active = false;
    rulerData = null;
    removeOverlays();

    chart.setStyles({ crosshair: { show: true } });
  }

  let bound = false;

  function bindListeners() {
    if (!chartContainer || bound) return;
    bound = true;
    chartContainer.addEventListener('contextmenu', onContextmenu);
    chartContainer.addEventListener('mousedown', onMousedown);
    chartContainer.addEventListener('mousemove', onMousemove);
    chartContainer.addEventListener('mouseup', onMouseup);
    window.addEventListener('mouseup', onMouseup);
  }

  function unbindListeners() {
    if (!bound) return;
    bound = false;
    if (chartContainer) {
      chartContainer.removeEventListener('contextmenu', onContextmenu);
      chartContainer.removeEventListener('mousedown', onMousedown);
      chartContainer.removeEventListener('mousemove', onMousemove);
      chartContainer.removeEventListener('mouseup', onMouseup);
    }
    window.removeEventListener('mouseup', onMouseup);
  }

  $: if (chartContainer) bindListeners();

  onDestroy(() => {
    unbindListeners();
    if (chart) {
      removeOverlays();
      if (active) {
        chart.setStyles({ crosshair: { show: true } });
      }
    }
  });
</script>

{#if active}
  <svg
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;"
  >
    <!-- Diagonal line -->
    <line
      x1={origin.x} y1={origin.y}
      x2={cursor.x} y2={cursor.y}
      stroke={LINE_COLOR} stroke-width="1"
    />
    <!-- Horizontal line from origin to cursor at origin.y -->
    <line
      x1={origin.x} y1={origin.y}
      x2={cursor.x} y2={origin.y}
      stroke={LINE_COLOR} stroke-width="1"
    />
    <!-- Vertical line from origin.y to cursor.y at cursor.x -->
    <line
      x1={cursor.x} y1={origin.y}
      x2={cursor.x} y2={cursor.y}
      stroke={LINE_COLOR} stroke-width="1"
    />
    <!-- Bottom horizontal: origin.x to cursor.x at cursor.y -->
    <line
      x1={origin.x} y1={cursor.y}
      x2={cursor.x} y2={cursor.y}
      stroke={LINE_COLOR} stroke-width="1"
    />
    <!-- Left vertical: origin.x from origin.y to cursor.y -->
    <line
      x1={origin.x} y1={origin.y}
      x2={origin.x} y2={cursor.y}
      stroke={LINE_COLOR} stroke-width="1"
    />
    <!-- Origin dot -->
    <circle cx={origin.x} cy={origin.y} r="2" fill={LINE_COLOR} />
  </svg>

  {#if showDataWindow}
    <div style={dataWindowStyle}>
      {#if rulerData.bars !== 'N/A'}<div>bars {rulerData.bars}</div>{/if}
      {#if rulerData.time !== 'N/A'}<div>time {rulerData.time}</div>{/if}
      {#if rulerData.price !== 'N/A'}<div>price {rulerData.price}</div>{/if}
      {#if rulerData.percent !== 'N/A'}<div>% {rulerData.percent}</div>{/if}
      {#if rulerData.range !== 'N/A'}<div>range {rulerData.range}</div>{/if}
    </div>
  {/if}
{/if}
