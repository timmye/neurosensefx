<script>
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { RESOLUTION_GROUPS, TIME_WINDOW_GROUPS, RESOLUTION_LABELS } from '../lib/chart/chartConfig.js';
  import { timezoneStore, TIMEZONE_PRESETS, resolvedTimezone } from '../stores/timezoneStore.js';
  import { themeStore, toggleTheme } from '../stores/themeStore.js';

  export let currentResolution = '4h';
  export let currentWindow = '3M';
  export let chart = null;
  export let commandStack = null;
  export let canUndo = false;
  export let canRedo = false;
  export let activeDrawingTool = null;
  export let magnetMode = false;
  export let source = 'tradingview';

  const dispatch = createEventDispatcher();

  const SOURCE_LABELS = { ctrader: 'cTrader', tradingview: 'TradingView' };

  function handleSourceClick() {
    const next = source === 'ctrader' ? 'tradingview' : 'ctrader';
    dispatch('sourceChange', next);
  }

  function handleTimezoneChange(e) {
    timezoneStore.set(e.target.value);
  }

  function timezoneLabel(id) {
    const p = TIMEZONE_PRESETS.find(t => t.id === id);
    if (!p) return id;
    if (id === 'LOCAL') {
      try { return `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ')})`; }
      catch { return 'Local'; }
    }
    return p.label;
  }

  const resolutionGroups = RESOLUTION_GROUPS;
  const windowGroups = TIME_WINDOW_GROUPS;

  const DRAWING_TOOLS = [
    { id: 'segment', label: '/', title: 'Trendline' },
    { id: 'horizontalRayLine', label: '\u2500', title: 'Horizontal Line' },
    { id: 'horizontalStraightLine', label: '\u2500\u25C0\u2500', title: 'Horizontal Full' },
    { id: 'horizontalSegment', label: '\u2500\u25A0', title: 'Horizontal Segment' },
    { id: 'verticalStraightLine', label: '|', title: 'Vertical Line' },
    { id: 'verticalRayLine', label: '|\u25B2', title: 'Vertical Ray' },
    { id: 'verticalSegment', label: '|\u25A0', title: 'Vertical Segment' },
    { id: 'rayLine', label: '\u2571', title: 'Ray Line' },
    { id: 'straightLine', label: '\u2500/', title: 'Straight Line' },
    { id: 'parallelStraightLine', label: '\u25B1', title: 'Parallel Channel' },
    { id: 'priceChannelLine', label: '\u2551', title: 'Price Channel' },
    { id: 'fibonacciLine', label: 'Fib', title: 'Fibonacci' },
    { id: 'rectOverlay', label: '\u25AD', title: 'Rectangle' },
    { id: 'circleOverlay', label: '\u25CB', title: 'Circle' },
    { id: 'polygonOverlay', label: '\u25B3', title: 'Triangle' },
    { id: 'arcOverlay', label: '\u23DB', title: 'Arc' },
    { id: 'arrowOverlay', label: '\u2192', title: 'Arrow' },
    { id: 'priceLine', label: 'Pl', title: 'Price Line' },
    { id: 'simpleAnnotation', label: '\u270E', title: 'Annotation' },
    { id: 'simpleTag', label: 'Tag', title: 'Tag' },
  ];

  function handleResolutionClick(resolution) {
    dispatch('resolution', resolution);
  }

  function handleWindowClick(window) {
    dispatch('window', window);
  }

  function handleDrawingToolClick(tool) {
    if (!chart) return;
    if (activeDrawingTool === tool.id) {
      activeDrawingTool = null;
      return;
    }
    activeDrawingTool = tool.id;

    // Fibonacci lines use dark red, everything else uses default (dk green)
    const fibStyles = tool.id === 'fibonacciLine' ? {
      line: { color: '#bb2719' },
      text: { color: $themeStore === 'dark' ? '#f87171' : '#bb2719', backgroundColor: 'transparent' }
    } : undefined;

    const overlayCreate = {
      name: tool.id,
      mode: magnetMode ? 'weak_magnet' : 'normal',
      styles: fibStyles,
      extendData: tool.id === 'simpleAnnotation' ? prompt('Annotation text:') || '' : undefined,
      onDrawEnd: (event) => {
        if (event.overlay) {
          dispatch('drawingCreated', {
            overlayId: event.overlay.id,
            overlayType: event.overlay.name,
            points: event.overlay.points,
            styles: event.overlay.styles,
            extendData: event.overlay.extendData,
          });
        }
        activeDrawingTool = null;
      },
    };
    chart.createOverlay(overlayCreate);
  }

  function toggleMagnet() {
    if (!chart) return;
    magnetMode = !magnetMode;
  }

  function handleUndo() {
    if (commandStack) {
      commandStack.undo().catch(() => {});
    }
  }

  function handleRedo() {
    if (commandStack) {
      commandStack.redo().then(cmd => {
        if (cmd) dispatch('redo', cmd);
      }).catch(() => {});
    }
  }

  let clearHoldTimer = null;
  let clearHolding = false;

  function handleClearDown() {
    clearHolding = true;
    clearHoldTimer = setTimeout(() => {
      clearHolding = false;
      handleClearDrawings();
    }, 800);
  }

  function handleClearUp() {
    clearHolding = false;
    if (clearHoldTimer) {
      clearTimeout(clearHoldTimer);
      clearHoldTimer = null;
    }
  }

  onDestroy(() => {
    if (clearHoldTimer) {
      clearTimeout(clearHoldTimer);
      clearHoldTimer = null;
    }
  });

  function handleClearDrawings() {
    if (!chart) return;
    chart.removeOverlay();
    if (commandStack) {
      commandStack.clear();
    }
    dispatch('clearDrawings', {});
  }
</script>

<div class="chart-toolbar" class:dark={$themeStore === 'dark'} style="position: relative; z-index: 15;">
  <div class="toolbar-row">
    {#each resolutionGroups as group, gi}
      {#if gi > 0}<span class="separator">|</span>{/if}
      {#each group as res}
        <button
          class="resolution-btn"
          class:active={res === currentResolution}
          on:click={() => handleResolutionClick(res)}
        >
          {RESOLUTION_LABELS[res] || res}
        </button>
      {/each}
    {/each}
  </div>
  <div class="toolbar-row">
    {#each windowGroups as group, gi}
      {#if gi > 0}<span class="separator">|</span>{/if}
      {#each group as win}
        <button
          class="window-btn"
          class:active={win === currentWindow}
          on:click={() => handleWindowClick(win)}
        >
          {win}
        </button>
      {/each}
    {/each}
    <span class="separator">|</span>
    <button
      class="source-btn"
      on:click={handleSourceClick}
      title="Data source: {SOURCE_LABELS[source]} (click to switch)"
    >
      {SOURCE_LABELS[source]}
    </button>
    <span class="separator">|</span>
    <select class="tz-select" value={$timezoneStore} on:change={handleTimezoneChange} title="Chart timezone">
      {#each TIMEZONE_PRESETS as preset}
        <option value={preset.id}>{timezoneLabel(preset.id)}</option>
      {/each}
    </select>
    <button
      class="action-btn theme-toggle-btn"
      on:click={toggleTheme}
      title="Toggle dark mode"
    >
      {#if $themeStore === 'dark'}☾{:else}☀{/if}
    </button>
  </div>
  <div class="toolbar-row drawing-row">
    {#each DRAWING_TOOLS as tool}
      <button
        class="drawing-btn"
        class:active={activeDrawingTool === tool.id}
        title={tool.title}
        on:click={() => handleDrawingToolClick(tool)}
      >
        {tool.label}
      </button>
    {/each}
    <span class="separator"></span>
    <button
      class="action-btn"
      class:active={magnetMode}
      title="Magnet Mode"
      on:click={toggleMagnet}
    >
      Mag
    </button>
    <button
      class="action-btn"
      title="Undo (Ctrl+Z)"
      disabled={!canUndo}
      on:click={handleUndo}
    >
      Undo
    </button>
    <button
      class="action-btn"
      title="Redo (Ctrl+Y)"
      disabled={!canRedo}
      on:click={handleRedo}
    >
      Redo
    </button>
    <button
      class="action-btn clear-btn"
      class:clear-holding={clearHolding}
      title="Hold to Clear All Drawings"
      on:pointerdown={handleClearDown}
      on:pointerup={handleClearUp}
      on:pointerleave={handleClearUp}
    >
      Clear
    </button>
  </div>
</div>

<style>
  .chart-toolbar {
    background: rgba(250, 250, 250, 0.97);
    border-bottom: 1px solid #D0D0D0;
    display: flex;
    flex-direction: column;
    padding: 3px 8px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    flex-shrink: 0;
    position: relative;
    z-index: 15;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    padding: 2px 0;
  }

  .separator {
    width: 1px;
    height: 16px;
    background: #D0D0D0;
    margin: 0 6px;
  }

  .resolution-btn,
  .window-btn {
    background: #FFFFFF;
    border: 1px solid #CCCCCC;
    color: #555555;
    padding: 2px 7px;
    margin: 0 1px;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    line-height: 1.4;
  }

  .resolution-btn:hover,
  .window-btn:hover {
    background: #F0F0F0;
    border-color: #999999;
    color: #333333;
  }

  .resolution-btn.active,
  .window-btn.active {
    background: #48752c;
    border-color: #48752c;
    color: #FFFFFF;
    font-weight: 600;
  }

  .drawing-row {
    gap: 1px;
  }

  .drawing-btn {
    background: #FFFFFF;
    border: 1px solid #CCCCCC;
    color: #555555;
    padding: 2px 6px;
    margin: 0;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    line-height: 1.4;
    min-width: 24px;
    text-align: center;
  }

  .drawing-btn:hover {
    background: #F0F0F0;
    border-color: #999999;
    color: #333333;
  }

  .drawing-btn.active {
    background: #48752c;
    border-color: #48752c;
    color: #FFFFFF;
    font-weight: 600;
  }

  .action-btn {
    background-color: #FFFFFF;
    border: 1px solid #CCCCCC;
    color: #555555;
    padding: 2px 7px;
    margin: 0 1px;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    line-height: 1.4;
  }

  .action-btn:hover:not(:disabled) {
    background: #F0F0F0;
    border-color: #999999;
    color: #333333;
  }

  .action-btn.active {
    background: #48752c;
    border-color: #48752c;
    color: #FFFFFF;
    font-weight: 600;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .clear-btn {
    transition: background-color 800ms linear, border-color 0.15s ease, color 0.15s ease;
  }

  .clear-btn.clear-holding {
    background-color: #bb2719;
    border-color: #bb2719;
    color: #FFFFFF;
  }

  .clear-btn:hover:not(:disabled):not(.clear-holding) {
    background-color: #fce4e4;
    border-color: #bb2719;
    color: #bb2719;
  }

  .source-btn {
    background: #FFFFFF;
    border: 1px solid #CCCCCC;
    color: #555555;
    padding: 2px 7px;
    margin: 0 1px;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    line-height: 1.4;
  }

  .source-btn:hover {
    background: #F0F0F0;
    border-color: #999999;
    color: #333333;
  }

  .tz-select {
    background: #FFFFFF;
    border: 1px solid #CCCCCC;
    color: #555555;
    padding: 2px 4px;
    margin: 0 1px;
    border-radius: 3px;
    font-size: 11px;
    cursor: pointer;
    font-family: inherit;
    line-height: 1.4;
  }

  .tz-select:hover {
    border-color: #999999;
  }

  .tz-select:focus {
    outline: none;
    border-color: #48752c;
  }

  .chart-toolbar.dark { background: rgba(30, 41, 59, 0.3); border-bottom-color: rgba(51, 65, 85, 0.5); }
  .chart-toolbar.dark .separator { background: rgba(51, 65, 85, 0.5); }
  .chart-toolbar.dark .resolution-btn,
  .chart-toolbar.dark .window-btn,
  .chart-toolbar.dark .drawing-btn,
  .chart-toolbar.dark .action-btn,
  .chart-toolbar.dark .source-btn { background: rgba(30, 41, 59, 0.3); border-color: rgba(51, 65, 85, 0.5); color: #94a3b8; }
  .chart-toolbar.dark .resolution-btn:hover,
  .chart-toolbar.dark .window-btn:hover,
  .chart-toolbar.dark .drawing-btn:hover,
  .chart-toolbar.dark .action-btn:hover:not(:disabled),
  .chart-toolbar.dark .source-btn:hover { background: rgba(51, 65, 85, 0.5); border-color: rgba(71, 85, 105, 0.6); color: #cbd5e1; }
  .chart-toolbar.dark .resolution-btn.active,
  .chart-toolbar.dark .window-btn.active,
  .chart-toolbar.dark .drawing-btn.active,
  .chart-toolbar.dark .action-btn.active { background: #475569; border-color: #475569; color: #e2e8f0; }
  .chart-toolbar.dark .tz-select { background: rgba(30, 41, 59, 0.3); border-color: rgba(51, 65, 85, 0.5); color: #94a3b8; }
  .chart-toolbar.dark .tz-select:focus { border-color: #34d399; }
  .chart-toolbar.dark .tz-select option { background: #131722; color: #e2e8f0; }
  .chart-toolbar.dark .clear-btn:hover:not(:disabled):not(.clear-holding) {
    background-color: rgba(239, 83, 80, 0.15);
    border-color: #ef5350;
    color: #ef5350;
  }
</style>
