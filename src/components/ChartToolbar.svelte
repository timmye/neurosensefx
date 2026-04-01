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
    { id: 'verticalStraightLine', label: '|', title: 'Vertical Line' },
    { id: 'rayLine', label: '\u2571', title: 'Ray Line' },
    { id: 'parallelStraightLine', label: '\u25B1', title: 'Parallel Channel' },
    { id: 'rect', label: '\u25AD', title: 'Rectangle' },
    { id: 'circle', label: '\u25CB', title: 'Circle' },
    { id: 'triangle', label: '\u25B3', title: 'Triangle' },
    { id: 'arc', label: '\u23DB', title: 'Arc' },
    { id: 'fibonacciLine', label: 'Fib', title: 'Fibonacci' },
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
    const overlayCreate = {
      name: tool.id,
      mode: magnetMode ? 'weak_magnet' : 'normal',
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
    background: rgba(26, 26, 46, 0.95);
    border-bottom: 1px solid #2a2a4a;
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
    background: #3a3a5a;
    margin: 0 6px;
  }

  .resolution-btn,
  .window-btn {
    background: #1e1e38;
    border: 1px solid #3a3a5a;
    color: #999;
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
    background: #2a2a4a;
    border-color: #4a4a6a;
    color: #ddd;
  }

  .resolution-btn.active,
  .window-btn.active {
    background: #4a9eff;
    border-color: #4a9eff;
    color: #000;
    font-weight: 600;
  }

  .drawing-row {
    gap: 1px;
  }

  .drawing-btn {
    background: #1e1e38;
    border: 1px solid #3a3a5a;
    color: #999;
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
    background: #2a2a4a;
    border-color: #4a4a6a;
    color: #ddd;
  }

  .drawing-btn.active {
    background: #4a9eff;
    border-color: #4a9eff;
    color: #000;
    font-weight: 600;
  }

  .action-btn {
    background: #1e1e38;
    border: 1px solid #3a3a5a;
    color: #999;
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
    background: #2a2a4a;
    border-color: #4a4a6a;
    color: #ddd;
  }

  .action-btn.active {
    background: #e8a020;
    border-color: #e8a020;
    color: #000;
    font-weight: 600;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .clear-btn:hover:not(:disabled) {
    background: #5a2020;
    border-color: #8a3030;
    color: #ff6666;
  }
</style>
