<script>
  import { onMount, onDestroy } from 'svelte';
  import { workspaceGrid, enableGrid, disableGrid, toggleGrid, setGridSize, toggleGridLines, getGridSettings } from '../utils/workspaceGrid.js';

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Consistent export pattern
  export let config = {};  // Configuration from displayStore.defaultConfig
  export let state = {};   // Reactive state from dataProcessor
  export let id = '';      // Unique identifier for tracking

  // Local state for UI
  let gridSettings = {
    enabled: true,
    gridSize: 20,
    showGridLines: false,
    gridOpacity: 0.2,
    showGridOnlyOnDrag: true
  };

  // Grid size presets
  const GRID_SIZE_PRESETS = [8, 10, 16, 20, 32, 40, 64];

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Initialize component with proper setup
  function initializeComponent() {
    console.log(`[GRID_CONTROLS:${id}] Initializing component`);
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Setup store subscriptions if needed
  function setupStoreSubscriptions() {
    // Grid controls use workspace grid utilities, no store subscriptions needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Performance monitoring integration
  function startPerformanceMonitoring() {
    // Grid controls performance monitoring would go here if needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Cleanup component resources
  function cleanupComponent() {
    console.log(`[GRID_CONTROLS:${id}] Cleaning up component`);
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Unsubscribe from stores
  function unsubscribeStores() {
    // Grid controls use workspace grid utilities, no store subscriptions needed
  }

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Stop performance monitoring
  function stopPerformanceMonitoring() {
    // Grid controls performance monitoring cleanup would go here if needed
  }

  // Load current settings on mount
  onMount(() => {
    initializeComponent();
    setupStoreSubscriptions();
    startPerformanceMonitoring();
    updateLocalSettings();
  });

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Destroy lifecycle
  onDestroy(() => {
    cleanupComponent();
    unsubscribeStores();
    stopPerformanceMonitoring();
  });
  
  /**
   * Update local settings from workspace grid
   */
  function updateLocalSettings() {
    gridSettings = getGridSettings();
  }
  
  /**
   * Toggle grid snapping
   */
  function handleToggleGrid() {
    const newState = toggleGrid();
    gridSettings.enabled = newState;
  }
  
  /**
   * Toggle grid lines visibility
   */
  function handleToggleGridLines() {
    const newState = toggleGridLines();
    gridSettings.showGridLines = newState;
  }
  
  /**
   * Handle grid size change
   */
  function handleGridSizeChange(event) {
    const newSize = parseInt(event.target.value);
    setGridSize(newSize);
    gridSettings.gridSize = newSize;
  }
  
  /**
   * Handle grid opacity change
   */
  function handleGridOpacityChange(event) {
    const newOpacity = parseFloat(event.target.value);
    workspaceGrid.updateSettings({ gridOpacity: newOpacity });
    gridSettings.gridOpacity = newOpacity;
  }
  
  /**
   * Handle show grid only on drag change
   */
  function handleShowGridOnlyOnDragChange(event) {
    const newValue = event.target.checked;
    workspaceGrid.updateSettings({ showGridOnlyOnDrag: newValue });
    gridSettings.showGridOnlyOnDrag = newValue;
  }
  
  /**
   * Apply grid size preset
   */
  function applyGridPreset(size) {
    setGridSize(size);
    gridSettings.gridSize = size;
  }
</script>

<div class="grid-controls">
  <div class="control-group">
    <h3 class="control-title">Grid Snapping</h3>
    
    <!-- Grid Toggle -->
    <div class="control-item">
      <label class="control-label">
        <input 
          type="checkbox" 
          checked={gridSettings.enabled}
          on:change={handleToggleGrid}
          class="control-checkbox"
        />
        <span class="control-text">Enable Grid Snapping</span>
      </label>
      <div class="control-description">
        Snap displays to grid lines for organized layouts
      </div>
    </div>
    
    <!-- Grid Lines Toggle -->
    <div class="control-item">
      <label class="control-label">
        <input 
          type="checkbox" 
          checked={gridSettings.showGridLines}
          on:change={handleToggleGridLines}
          class="control-checkbox"
        />
        <span class="control-text">Show Grid Lines</span>
      </label>
      <div class="control-description">
        Display visual grid overlay for guidance
      </div>
    </div>
  </div>
  
  <div class="control-group">
    <h3 class="control-title">Grid Configuration</h3>
    
    <!-- Grid Size -->
    <div class="control-item">
      <label class="control-label">
        <span class="control-text">Grid Size</span>
        <select 
          value={gridSettings.gridSize}
          on:change={handleGridSizeChange}
          class="control-select"
          disabled={!gridSettings.enabled}
        >
          {#each GRID_SIZE_PRESETS as size}
            <option value={size}>{size}px</option>
          {/each}
        </select>
      </label>
      <div class="control-description">
        Size of grid squares in pixels
      </div>
      
      <!-- Quick Presets -->
      <div class="grid-presets">
        <span class="presets-label">Quick:</span>
        {#each [8, 16, 20, 32, 40] as preset}
          <button 
            class="preset-button"
            class:active={gridSettings.gridSize === preset}
            on:click={() => applyGridPreset(preset)}
            disabled={!gridSettings.enabled}
          >
            {preset}
          </button>
        {/each}
      </div>
    </div>
    
    <!-- Grid Opacity -->
    <div class="control-item">
      <label class="control-label">
        <span class="control-text">Grid Lines Opacity</span>
        <input 
          type="range" 
          min="0.1" 
          max="0.5" 
          step="0.1"
          value={gridSettings.gridOpacity}
          on:input={handleGridOpacityChange}
          class="control-range"
          disabled={!gridSettings.showGridLines}
        />
        <span class="range-value">{gridSettings.gridOpacity.toFixed(1)}</span>
      </label>
      <div class="control-description">
        Transparency of grid lines overlay
      </div>
    </div>
    
    <!-- Show Grid Only On Drag -->
    <div class="control-item">
      <label class="control-label">
        <input 
          type="checkbox" 
          checked={gridSettings.showGridOnlyOnDrag}
          on:change={handleShowGridOnlyOnDragChange}
          class="control-checkbox"
          disabled={!gridSettings.showGridLines}
        />
        <span class="control-text">Show Grid Only During Drag</span>
      </label>
      <div class="control-description">
        Hide grid lines when not dragging for performance
      </div>
    </div>
  </div>
  
  <div class="control-group">
    <h3 class="control-title">Keyboard Shortcuts</h3>
    
    <div class="shortcut-list">
      <div class="shortcut-item">
        <kbd class="shortcut-key">Ctrl</kbd>
        <span>+</span>
        <kbd class="shortcut-key">G</kbd>
        <span class="shortcut-description">Toggle grid snapping</span>
      </div>
      
      <div class="shortcut-item">
        <kbd class="shortcut-key">Ctrl</kbd>
        <span>+</span>
        <kbd class="shortcut-key">L</kbd>
        <span class="shortcut-description">Toggle grid lines</span>
      </div>
    </div>
  </div>
  
  <!-- Status Display -->
  <div class="control-group status-group">
    <h3 class="control-title">Grid Status</h3>
    
    <div class="status-grid">
      <div class="status-item">
        <span class="status-label">Snapping:</span>
        <span class="status-value" class:enabled={gridSettings.enabled}>
          {gridSettings.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>
      
      <div class="status-item">
        <span class="status-label">Grid Size:</span>
        <span class="status-value">{gridSettings.gridSize}px</span>
      </div>
      
      <div class="status-item">
        <span class="status-label">Grid Lines:</span>
        <span class="status-value" class:enabled={gridSettings.showGridLines}>
          {gridSettings.showGridLines ? 'Visible' : 'Hidden'}
        </span>
      </div>
    </div>
  </div>
</div>

<style>
  .grid-controls {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 16px;
    color: #f3f4f6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  }
  
  .control-group {
    margin-bottom: 20px;
  }
  
  .control-group:last-child {
    margin-bottom: 0;
  }
  
  .control-title {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #e5e7eb;
    border-bottom: 1px solid #374151;
    padding-bottom: 8px;
  }
  
  .control-item {
    margin-bottom: 16px;
  }
  
  .control-item:last-child {
    margin-bottom: 0;
  }
  
  .control-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    cursor: pointer;
  }
  
  .control-checkbox {
    width: 16px;
    height: 16px;
    accent-color: #4f46e5;
  }
  
  .control-text {
    font-weight: 500;
    color: #d1d5db;
  }
  
  .control-description {
    font-size: 12px;
    color: #9ca3af;
    margin-left: 24px;
    line-height: 1.3;
  }
  
  .control-select {
    padding: 6px 8px;
    border: 1px solid #374151;
    border-radius: 4px;
    background: #374151;
    color: #f3f4f6;
    font-size: 13px;
    min-width: 80px;
  }
  
  .control-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .grid-presets {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-top: 8px;
    margin-left: 24px;
  }
  
  .presets-label {
    font-size: 12px;
    color: #9ca3af;
    margin-right: 4px;
  }
  
  .preset-button {
    padding: 4px 8px;
    border: 1px solid #374151;
    border-radius: 3px;
    background: #374151;
    color: #9ca3af;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .preset-button:hover:not(:disabled) {
    background: #4b5563;
    color: #f3f4f6;
  }
  
  .preset-button.active {
    background: #4f46e5;
    color: #ffffff;
    border-color: #4f46e5;
  }
  
  .preset-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .control-range {
    flex: 1;
    max-width: 120px;
  }
  
  .range-value {
    min-width: 40px;
    text-align: center;
    font-weight: 500;
    color: #4f46e5;
  }
  
  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .shortcut-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  
  .shortcut-key {
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 3px;
    padding: 2px 6px;
    font-family: monospace;
    font-size: 11px;
    color: #e5e7eb;
  }
  
  .shortcut-description {
    color: #9ca3af;
    font-size: 12px;
  }
  
  .status-group {
    background: #111827;
    border-radius: 6px;
    padding: 12px;
  }
  
  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .status-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .status-label {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 500;
  }
  
  .status-value {
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
  }
  
  .status-value.enabled {
    color: #10b981;
  }
  
  /* Responsive adjustments */
  @media (max-width: 400px) {
    .grid-controls {
      padding: 12px;
    }
    
    .grid-presets {
      flex-wrap: wrap;
    }
    
    .status-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
