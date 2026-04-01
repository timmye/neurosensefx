<script>
  export let currentResolution = '4h';
  export let currentWindow = '3M';
  export onResolutionChange;
  export onWindowChange;

  // Resolution groups
  const minuteResolutions = ['1m', '5m', '10m', '15m', '30m'];
  const hourResolutions = ['1h', '2h', '3h', '4h', '6h', '8h', '12h'];
  const dayResolutions = ['D', 'W', 'M', 'Q'];

  // Window groups
  const dayWindows = ['1d', '2d'];
  const weekWindows = ['1W', '2W'];
  const monthWindows = ['1M', '3M', '6M'];
  const yearWindows = ['1Y', '2Y', '5Y', '10Y'];

  let showDrawingTools = false;

  function handleResolutionClick(resolution) {
    currentResolution = resolution;
    onResolutionChange?.(resolution);
  }

  function handleWindowClick(window) {
    currentWindow = window;
    onWindowChange?.(window);
  }

  function handleDrawingToolClick(tool) {
    console.log('[ChartToolbar] Drawing tool clicked:', tool);
    // Implementation will be added when KLineChart is integrated
  }

  function handleUndo() {
    console.log('[ChartToolbar] Undo clicked');
    // Implementation will be added when KLineChart is integrated
  }

  function handleRedo() {
    console.log('[ChartToolbar] Redo clicked');
    // Implementation will be added when KLineChart is integrated
  }

  function handleClear() {
    if (confirm('Clear all drawings? This action cannot be undone.')) {
      console.log('[ChartToolbar] Clear drawings');
      // Implementation will be added when KLineChart is integrated
    }
  }

  function toggleMagnetMode() {
    console.log('[ChartToolbar] Magnet mode toggled');
    // Implementation will be added when KLineChart is integrated
  }
</script>

<div class="chart-toolbar">
  <!-- Resolution buttons -->
  <div class="toolbar-section">
    <span class="section-label">Time:</span>
    {#each minuteResolutions as resolution}
      <button
        class="resolution-btn"
        class:active={currentResolution === resolution}
        on:click={() => handleResolutionClick(resolution)}
      >
        {resolution}
      </button>
    {/each}
    <span class="separator"></span>
    {#each hourResolutions as resolution}
      <button
        class="resolution-btn"
        class:active={currentResolution === resolution}
        on:click={() => handleResolutionClick(resolution)}
      >
        {resolution}
      </button>
    {/each}
    <span class="separator"></span>
    {#each dayResolutions as resolution}
      <button
        class="resolution-btn"
        class:active={currentResolution === resolution}
        on:click={() => handleResolutionClick(resolution)}
      >
        {resolution}
      </button>
    {/each}
  </div>

  <!-- Window buttons -->
  <div class="toolbar-section">
    <span class="section-label">Range:</span>
    {#each dayWindows as window}
      <button
        class="window-btn"
        class:active={currentWindow === window}
        on:click={() => handleWindowClick(window)}
      >
        {window}
      </button>
    {/each}
    <span class="separator"></span>
    {#each weekWindows as window}
      <button
        class="window-btn"
        class:active={currentWindow === window}
        on:click={() => handleWindowClick(window)}
      >
        {window}
      </button>
    {/each}
    <span class="separator"></span>
    {#each monthWindows as window}
      <button
        class="window-btn"
        class:active={currentWindow === window}
        on:click={() => handleWindowClick(window)}
      >
        {window}
      </button>
    {/each}
    <span class="separator"></span>
    {#each yearWindows as window}
      <button
        class="window-btn"
        class:active={currentWindow === window}
        on:click={() => handleWindowClick(window)}
      >
        {window}
      </button>
    {/each}
  </div>

  <!-- Drawing tools -->
  <div class="toolbar-section">
    <button
      class="tool-btn"
      on:click={() => showDrawingTools = !showDrawingTools}
      title="Drawing tools"
    >
      ⚡
    </button>

    {#if showDrawingTools}
      <div class="drawing-tools">
        <div class="drawing-tool-row">
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('line')} title="Trendline">/</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('horizontal')} title="Horizontal line">─</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('vertical')} title="Vertical line">│</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('ray')} title="Ray line">⎯</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('channel')} title="Parallel channel">∥</button>
        </div>
        <div class="drawing-tool-row">
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('fibonacci')} title="Fibonacci">Fib</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('rectangle')} title="Rectangle">▭</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('circle')} title="Circle">○</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('triangle')} title="Triangle">△</button>
          <button class="drawing-btn" on:click={() => handleDrawingToolClick('arc')} title="Arc">⌒</button>
        </div>
        <div class="drawing-tool-row">
          <button class="drawing-btn" on:click={toggleMagnetMode} class:magnet={/* magnet mode state */} title="Magnet mode">
            {Magnet mode active ? '🧲' : '🧲'}
          </button>
          <button class="drawing-btn" on:click={handleUndo} title="Undo">↶</button>
          <button class="drawing-btn" on:click={handleRedo} title="Redo">↷</button>
          <button class="drawing-btn clear" on:click={handleClear} title="Clear all">✕</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .chart-toolbar {
    height: 60px;
    background: rgba(30, 30, 30, 0.95);
    border-bottom: 1px solid #333;
    display: flex;
    flex-direction: column;
    padding: 4px 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    padding: 0 8px;
    margin-bottom: 2px;
  }

  .section-label {
    color: #888;
    font-size: 11px;
    font-weight: 600;
    margin-right: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .resolution-btn,
  .window-btn {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #ccc;
    padding: 4px 8px;
    margin: 0 2px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .resolution-btn:hover,
  .window-btn:hover {
    background: #3a3a3a;
    border-color: #555;
    color: #fff;
  }

  .resolution-btn.active,
  .window-btn.active {
    background: #4a9eff;
    border-color: #4a9eff;
    color: #000;
    font-weight: 600;
  }

  .separator {
    width: 1px;
    height: 16px;
    background: #444;
    margin: 0 8px;
  }

  .tool-btn {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #ccc;
    padding: 6px 8px;
    margin-left: auto;
    border-radius: 3px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .tool-btn:hover {
    background: #3a3a3a;
    border-color: #555;
    color: #fff;
  }

  .drawing-tools {
    position: absolute;
    bottom: 60px;
    right: 8px;
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid #444;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 100;
  }

  .drawing-tool-row {
    display: flex;
    margin-bottom: 6px;
  }

  .drawing-tool-row:last-child {
    margin-bottom: 0;
  }

  .drawing-btn {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #ccc;
    padding: 6px 8px;
    margin: 0 2px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease;
    min-width: 32px;
    text-align: center;
  }

  .drawing-btn:hover {
    background: #3a3a3a;
    border-color: #555;
    color: #fff;
  }

  .drawing-btn.clear {
    color: #f44336;
  }

  .drawing-btn.clear:hover {
    color: #ff6b6b;
    border-color: #f44336;
  }

  .drawing-btn.magnet {
    background: #4a9eff;
    border-color: #4a9eff;
    color: #000;
  }
</style>