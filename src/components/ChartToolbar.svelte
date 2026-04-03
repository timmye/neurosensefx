<script>
  import { createEventDispatcher } from 'svelte';
  import { RESOLUTION_GROUPS, TIME_WINDOW_GROUPS, RESOLUTION_LABELS } from '../lib/chart/chartConfig.js';

  export let currentResolution = '4h';
  export let currentWindow = '3M';
  export let chart = null;
  export let commandStack = null;
  export let activeDrawingTool = null;
  export let magnetMode = false;

  const dispatch = createEventDispatcher();

  const resolutionGroups = RESOLUTION_GROUPS;
  const windowGroups = TIME_WINDOW_GROUPS;

  const DRAWING_TOOLS = [
    { id: 'segment', label: '/', title: 'Trendline' },
    { id: 'horizontalStraightLine', label: '\u2500', title: 'Horizontal Line' },
    { id: 'horizontalRayLine', label: '\u2500\u25B6', title: 'Horizontal Ray' },
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
      text: { color: '#FFFFFF', backgroundColor: '#bb2719' }
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
      commandStack.undo();
    }
  }

  function handleRedo() {
    if (commandStack) {
      commandStack.redo();
    }
  }

  function handleClearDrawings() {
    if (!chart) return;
    chart.removeOverlay();
    if (commandStack) {
      commandStack.clear();
    }
    dispatch('clearDrawings', {});
  }
</script>

<div class="chart-toolbar" style="position: relative; z-index: 15;">
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
      disabled={!commandStack?.canUndo}
      on:click={handleUndo}
    >
      Undo
    </button>
    <button
      class="action-btn"
      title="Redo (Ctrl+Y)"
      disabled={!commandStack?.canRedo}
      on:click={handleRedo}
    >
      Redo
    </button>
    <button
      class="action-btn clear-btn"
      title="Clear All Drawings"
      on:click={handleClearDrawings}
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

  .clear-btn:hover:not(:disabled) {
    background: #fce4e4;
    border-color: #bb2719;
    color: #bb2719;
  }
</style>
