<script>
  import { onDestroy } from 'svelte';
  import { recalcRulerData } from '../lib/chart/rulerData.js';
  import { getPixelOffset, computeDataWindowStyle } from '../lib/chart/rulerPosition.js';
  import {
    LINE_COLOR,
    createRulerOverlays,
    updateCursorOverlay,
    removeRulerOverlays,
  } from '../lib/chart/rulerOverlays.js';

  export let chart = null;
  export let chartContainer = null;
  export let currentSymbol = '';
  let active = false;
  let origin = { x: 0, y: 0 };
  let cursor = { x: 0, y: 0 };
  let rulerData = null;
  let overlayIds = [null, null];

  function recalcData() {
    rulerData = recalcRulerData(chart, active, currentSymbol, origin, cursor);
  }

  $: showDataWindow = active && rulerData !== null;

  $: dataWindowStyle = computeDataWindowStyle(active, chartContainer, cursor, LINE_COLOR);

  function onContextmenu(e) { e.preventDefault(); }

  function onMousedown(e) {
    if (!chart || e.button !== 2) return;
    e.preventDefault();
    origin = getPixelOffset(chartContainer, e);
    cursor = { ...origin };
    active = true;
    rulerData = null;
    chart.setStyles({ crosshair: { show: false } });
    overlayIds = createRulerOverlays(chart, origin, cursor);
  }

  function onMousemove(e) {
    if (!chart || !active) return;
    cursor = getPixelOffset(chartContainer, e);
    recalcData();
    updateCursorOverlay(chart, overlayIds[1], cursor);
  }

  function onMouseup(e) {
    if (!chart || e.button !== 2 || !active) return;
    active = false;
    rulerData = null;
    removeRulerOverlays(chart, overlayIds);
    overlayIds = [null, null];
    chart.setStyles({ crosshair: { show: true } });
  }

  const containerEvents = [
    ['contextmenu', onContextmenu],
    ['mousedown', onMousedown],
    ['mousemove', onMousemove],
    ['mouseup', onMouseup],
  ];

  let bound = false;

  function bindListeners() {
    if (!chartContainer || bound) return;
    bound = true;
    for (const [type, handler] of containerEvents) {
      chartContainer.addEventListener(type, handler);
    }
    window.addEventListener('mouseup', onMouseup);
  }

  function unbindListeners() {
    if (!bound) return;
    bound = false;
    if (chartContainer) {
      for (const [type, handler] of containerEvents) {
        chartContainer.removeEventListener(type, handler);
      }
    }
    window.removeEventListener('mouseup', onMouseup);
  }

  $: if (chartContainer) bindListeners();

  onDestroy(() => {
    unbindListeners();
    if (chart) {
      removeRulerOverlays(chart, overlayIds);
      if (active) chart.setStyles({ crosshair: { show: true } });
    }
  });
</script>

{#if active}
  <svg
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;"
  >
    <line x1={origin.x} y1={origin.y} x2={cursor.x} y2={cursor.y} stroke={LINE_COLOR} stroke-width="1" />
    <line x1={origin.x} y1={origin.y} x2={cursor.x} y2={origin.y} stroke={LINE_COLOR} stroke-width="1" />
    <line x1={cursor.x} y1={origin.y} x2={cursor.x} y2={cursor.y} stroke={LINE_COLOR} stroke-width="1" />
    <line x1={origin.x} y1={cursor.y} x2={cursor.x} y2={cursor.y} stroke={LINE_COLOR} stroke-width="1" />
    <line x1={origin.x} y1={origin.y} x2={origin.x} y2={cursor.y} stroke={LINE_COLOR} stroke-width="1" />
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
