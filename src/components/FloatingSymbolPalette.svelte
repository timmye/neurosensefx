<script>
  import { createEventDispatcher } from 'svelte';
  import { uiState, uiActions } from '../stores/uiState.js';
  import { workspaceActions, createCanvasData } from '../stores/workspaceState.js';
  import { registryActions } from '../stores/canvasRegistry.js';
  import { symbolStore } from '../data/symbolStore.js';
  import { defaultConfig } from '../stores/configStore.js';
  import { dataSourceMode, wsStatus } from '../data/wsClient.js';
  import FXSymbolSelector from './FXSymbolSelector.svelte';
  import FloatingPanel from './shared/FloatingPanel.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Component state
  let symbols = [];
  let selectedSymbol = null;
  let palettePosition = { x: 20, y: 20 };
  let isMinimized = false;
  
  // Subscribe to symbol store
  const unsubSymbolStore = symbolStore.subscribe(value => {
    symbols = Object.keys(value);
    // Auto-select first symbol if none selected
    if (!selectedSymbol && symbols.length > 0) {
      selectedSymbol = symbols[0];
    }
  });
  
  const unsubSymbolStoreCleanup = () => {
    unsubSymbolStore();
  };
  
  function handleSymbolSelect(event) {
    selectedSymbol = event.detail.symbol;
  }
  
  function handleCreateCanvas() {
    if (!selectedSymbol) return;
    
    // Create canvas at position near the palette
    const canvasPosition = {
      x: Math.max(50, palettePosition.x + 50), // Position canvas to the right of palette
      y: Math.max(50, palettePosition.y + 50)
    };
    
    // Create canvas data
    const canvasData = createCanvasData(selectedSymbol, canvasPosition);
    
    // Get symbol data from existing system
    const symbolData = $symbolStore[selectedSymbol];
    if (symbolData) {
      canvasData.config = { ...symbolData.config };
      canvasData.state = { ...symbolData.state };
    } else {
      canvasData.config = { ...defaultConfig };
      canvasData.state = { ready: false };
    }
    
    // Register and add canvas
    registryActions.registerCanvas(canvasData.id, {
      symbol: selectedSymbol,
      type: 'floating'
    });
    
    workspaceActions.addCanvas(canvasData);
    
    // Dispatch event for parent components
    dispatch('canvasCreated', {
      canvasId: canvasData.id,
      symbol: selectedSymbol,
      position: canvasPosition
    });
  }
  
  function handleClose() {
    uiActions.hideFloatingSymbolPalette();
    unsubSymbolStoreCleanup();
  }
  
  function handlePositionChange(newPosition) {
    palettePosition = newPosition;
  }
</script>

<FloatingPanel
  title="Symbol Palette"
  panelId="symbol-palette"
  position={palettePosition}
  on:close={handleClose}
  on:positionChange={handlePositionChange}
  defaultMinimized={false}
  on:minimizeChange={(e) => { isMinimized = e.detail.isMinimized; }}
>
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
          class:disabled={!selectedSymbol}
          on:click={handleCreateCanvas}
          disabled={!selectedSymbol}
        >
          Create Canvas
        </button>
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
                on:click={() => selectedSymbol = symbol}
              >
                {symbol}
              </button>
            {/each}
          </div>
        </div>
      </div>
  </div>
</FloatingPanel>

<style>
  
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
</style>
