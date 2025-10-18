<script>
  import { createEventDispatcher } from 'svelte';
  import { uiState, uiActions } from '../stores/uiState.js';
  import { workspaceActions, createCanvasData } from '../stores/workspaceState.js';
  import { registryActions } from '../stores/canvasRegistry.js';
  import { symbolStore } from '../data/symbolStore.js';
  import { defaultConfig } from '../stores/configStore.js';
  import { dataSourceMode, wsStatus, availableSymbols } from '../data/wsClient.js';
  import FXSymbolSelector from './FXSymbolSelector.svelte';
  import InteractWrapper from './shared/InteractWrapper.svelte';
  import { getZIndex } from '../constants/zIndex.js';
  import { createLogger } from '../utils/debugLogger.js';
  
  const logger = createLogger('FloatingSymbolPalette');
  const dispatch = createEventDispatcher();
  
  // Props
  export let zIndex = null; // Will use standardized z-index
  
  // Component state
  let symbols = [];
  let selectedSymbol = null;
  let palettePosition = { x: 20, y: 20 }; // Top-left position for better visibility
  let isMinimized = false;
  let interactWrapperRef;
  
  // Subscribe to available symbols store for symbol selector
  const unsubAvailableSymbols = availableSymbols.subscribe(value => {
    symbols = value;
  });
  
  // Subscribe to symbol store to track active subscriptions
  const unsubSymbolStore = symbolStore.subscribe(value => {
    // Auto-select first symbol if none selected
    if (!selectedSymbol && symbols.length > 0) {
      selectedSymbol = symbols[0];
    }
  });
  
  const unsubStoresCleanup = () => {
    unsubAvailableSymbols();
    unsubSymbolStore();
  };
  
  function handleSymbolSelect(event) {
    selectedSymbol = event.detail.symbol;
    
    // If shouldSubscribe is true, automatically create canvas
    if (event.detail.shouldSubscribe) {
      handleCreateCanvas();
    }
  }
  
  // Add a new function for symbol selection with automatic canvas creation
  function handleSymbolSelectAndCreate(symbol) {
    selectedSymbol = symbol;
    handleCreateCanvas();
  }
  
  // Add loading state
  let isCreatingCanvas = false;
  let createError = null;
  
  async function handleCreateCanvas() {
    if (!selectedSymbol || isCreatingCanvas) return;
    
    isCreatingCanvas = true;
    createError = null;
    
    try {
      // Create canvas at position near the palette
      const canvasPosition = {
        x: Math.max(50, palettePosition.x + 50), // Position canvas to the right of palette
        y: Math.max(50, palettePosition.y + 50)
      };
      
      // Create canvas data
      const canvasData = createCanvasData(selectedSymbol, canvasPosition);
      
      // Register canvas
      registryActions.registerCanvas(canvasData.id, {
        symbol: selectedSymbol,
        type: 'floating'
      });
      
      // Dispatch event for parent components to handle canvas creation
      // Pass the symbol and position, let App.svelte handle the creation with ConnectionManager
      dispatch('canvasCreated', {
        canvasId: canvasData.id,
        symbol: selectedSymbol,
        position: canvasPosition,
        canvasData // Pass the basic canvas data
      });
      
      // Clear selection after successful creation
      selectedSymbol = null;
    } catch (error) {
      logger.error('Failed to create canvas', { symbol: selectedSymbol, error });
      createError = error;
    } finally {
      isCreatingCanvas = false;
    }
  }
  
  function handleClose() {
    logger.debug('Palette closed');
    uiActions.hideFloatingSymbolPalette();
    unsubStoresCleanup();
    dispatch('close');
  }
  
  function handlePositionChange(event) {
    palettePosition = event.detail.position;
    logger.debug('Position changed', { position: palettePosition });
  }
  
  function handleMinimize() {
    isMinimized = !isMinimized;
    if (interactWrapperRef) {
      interactWrapperRef.setMinimized(isMinimized);
    }
    logger.debug('Minimize toggled', { isMinimized });
    dispatch('minimizeChange', { isMinimized });
  }
</script>

<InteractWrapper
  bind:this={interactWrapperRef}
  position={palettePosition}
  defaultPosition={palettePosition}
  positionKey="interact-symbol-palette-position"
  on:positionChange={handlePositionChange}
  isDraggable={true}
  isResizable={false}
  inertia={true}
  boundaryPadding={10}
>
  <div class="draggable-panel {isMinimized ? 'minimized' : ''}" style="z-index: {zIndex || getZIndex('SYMBOL_PALETTE')};">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="drag-indicator">⋮⋮</div>
      <div class="panel-title">Symbol Palette</div>
      <div class="panel-controls">
        <button
          class="control-btn minimize-btn"
          on:click={handleMinimize}
          title={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? '□' : '−'}
        </button>
        
        <button
          class="control-btn close-btn"
          on:click={handleClose}
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
    
    <!-- Panel Content -->
    {#if !isMinimized}
      <div class="panel-content">
        <div class="palette-content">
          <div class="symbol-selection">
            <label for="symbol-selector">Select Symbol:</label>
            <FXSymbolSelector
              id="symbol-selector"
              availableSymbols={symbols}
              bind:selectedSymbol={selectedSymbol}
              placeholder="Search for a symbol..."
              on:select={handleSymbolSelect}
            />
          </div>
          
          <div class="selected-symbol-display" class:has-selection={selectedSymbol}>
            {#if selectedSymbol}
              <span>Will create canvas for: <strong>{selectedSymbol}</strong></span>
            {:else}
              <span>Please select a symbol</span>
            {/if}
          </div>
          
          <div class="palette-actions">
            <button
              class="create-btn"
              class:disabled={!selectedSymbol || isCreatingCanvas}
              on:click={handleCreateCanvas}
              disabled={!selectedSymbol || isCreatingCanvas}
            >
              {isCreatingCanvas ? 'Creating...' : 'Create Canvas'}
            </button>
            
            {#if createError}
              <div class="error-message">
                <span class="error-icon">⚠️</span>
                <span>Failed to create canvas: {createError.message}</span>
                <button class="error-dismiss" on:click={() => createError = null}>×</button>
              </div>
            {/if}
          </div>
          
          <!-- System Status Section -->
          <div class="palette-sections">
            <div class="palette-section">
              <h4>System Status</h4>
              <div class="status-grid">
                <span>Data Source:</span>
                <span class="status-value">{$dataSourceMode}</span>
                <span>Connection:</span>
                <span class="status-value status-{$wsStatus}">{$wsStatus}</span>
                <span>Active Symbols:</span>
                <span class="status-value">{symbols.length}</span>
              </div>
            </div>
            
            <div class="palette-section">
              <h4>Recent Symbols</h4>
              <div class="recent-symbols">
                {#each symbols.slice(0, 3) as symbol}
                  <button
                    class="recent-symbol-btn"
                    class:selected={selectedSymbol === symbol}
                    on:click={() => handleSymbolSelectAndCreate(symbol)}
                  >
                    {symbol}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</InteractWrapper>

<style>
  .draggable-panel {
    position: relative;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    min-width: 200px;
    max-width: 320px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    transition: box-shadow 0.2s ease;
    pointer-events: auto;
    z-index: inherit; /* Use the z-index from the style attribute */
  }
  
  .draggable-panel.minimized {
    min-width: 200px;
    max-width: 200px;
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    border-radius: 8px 8px 0 0;
    cursor: grab;
    user-select: none;
    pointer-events: auto;
    position: relative;
    z-index: 1;
  }
  
  .drag-indicator {
    color: #9ca3af;
    font-size: 12px;
    margin-right: 8px;
  }
  
  .panel-title {
    color: #d1d5db;
    font-size: 12px;
    font-weight: 600;
    flex: 1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .panel-controls {
    display: flex;
    gap: 4px;
  }
  
  .control-btn {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    pointer-events: auto;
    position: relative;
    z-index: 2;
  }
  
  .control-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }
  
  .panel-content {
    padding: 12px;
  }
  
  .symbol-selection {
    margin-bottom: 12px;
  }
  
  .symbol-selection label {
    display: block;
    color: #d1d5db;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .selected-symbol-display {
    padding: 6px 8px;
    background: #374151;
    border-radius: 6px;
    color: #9ca3af;
    font-size: 11px;
    text-align: center;
    transition: all 0.2s ease;
    margin-bottom: 12px;
  }
  
  .selected-symbol-display.has-selection {
    background: rgba(79, 70, 229, 0.1);
    border: 1px solid rgba(79, 70, 229, 0.3);
    color: #d1d5db;
  }
  
  .selected-symbol-display strong {
    color: #4f46e5;
  }
  
  .palette-actions {
    margin-bottom: 16px;
  }
  
  .create-btn {
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    background: #4f46e5;
    color: white;
  }
  
  .create-btn:hover:not(.disabled) {
    background: #6366f1;
  }
  
  .create-btn.disabled {
    background: #374151;
    color: #6b7280;
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .palette-sections {
    border-top: 1px solid #374151;
    padding-top: 12px;
  }
  
  .palette-section {
    margin-bottom: 12px;
  }
  
  .palette-section:last-child {
    margin-bottom: 0;
  }
  
  .palette-section h4 {
    margin: 0 0 6px 0;
    color: #9ca3af;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .recent-symbols {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  
  .recent-symbol-btn {
    padding: 4px 6px;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #d1d5db;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .recent-symbol-btn:hover {
    background: #4b5563;
  }
  
  .recent-symbol-btn.selected {
    background: rgba(79, 70, 229, 0.2);
    border-color: #4f46e5;
    color: #4f46e5;
  }
  
  .status-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 8px;
    font-size: 10px;
    margin-bottom: 8px;
  }
  
  .status-grid span:nth-child(odd) {
    color: #9ca3af;
    font-weight: 500;
  }
  
  .status-value {
    color: #e5e7eb;
    text-align: right;
  }
  
  .status-value.status-connected {
    color: #22c55e;
  }
  
  .status-value.status-disconnected {
    color: #ef4444;
  }
  
  .status-value.status-error {
    color: #ef4444;
  }
  
  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #ef4444;
    font-size: 11px;
    margin-top: 8px;
  }
  
  .error-icon {
    font-size: 12px;
  }
  
  .error-dismiss {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    margin-left: auto;
  }
  
  .error-dismiss:hover {
    background: rgba(239, 68, 68, 0.2);
  }
</style>
