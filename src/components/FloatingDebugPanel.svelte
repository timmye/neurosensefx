<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { symbolStore } from '../data/symbolStore.js';
  import { uiActions } from '../stores/uiState.js';
  import FloatingPanel from './shared/FloatingPanel.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Component state
  let debugPosition = { x: 500, y: 100 };
  let isMinimized = false;
  let symbols = [];
  let currentSymbolData = null;
  
  // Subscribe to symbol store
  const unsubSymbolStore = symbolStore.subscribe(value => {
    symbols = Object.keys(value);
    // No longer tracking selected symbol as it's been removed
  });
  
  // No longer subscribing to selected symbol as it's been removed
  
  onDestroy(() => {
    unsubSymbolStore();
  });
  
  function handleClose() {
    uiActions.hideFloatingDebugPanel();
  }
  
  // Get current state for display
  $: state = currentSymbolData?.state;
  $: digits = state?.digits || 5;
  $: hasData = state && Object.keys(state).length > 0;
</script>

<FloatingPanel
  title="Debug Info"
  panelId="debug-panel"
  position={debugPosition}
  on:close={handleClose}
  defaultMinimized={false}
>
  <div class="debug-content">
    <div class="debug-symbol-header">
      <span class="symbol-label">Symbol Selection:</span>
      <span class="symbol-value">Use FloatingSymbolPalette</span>
    </div>
    
    {#if hasData}
      <div class="debug-section">
        <h4>Market Profile</h4>
        <div class="info-grid">
          <span>Profile Levels:</span>
          <span>{state.marketProfile?.levels?.length || 0}</span>
          <span>Profile Ticks:</span>
          <span>{state.marketProfile?.tickCount || 0}</span>
        </div>
      </div>
      
      <div class="debug-section">
        <h4>Price Range</h4>
        <div class="info-grid">
          <span>ADR High:</span>
          <span>{state.projectedAdrHigh?.toFixed(5) || 'N/A'}</span>
          <span>ADR Low:</span>
          <span>{state.projectedAdrLow?.toFixed(5) || 'N/A'}</span>
          <span>Visual High:</span>
          <span>{state.visualHigh?.toFixed(5) || 'N/A'}</span>
          <span>Visual Low:</span>
          <span>{state.visualLow?.toFixed(5) || 'N/A'}</span>
        </div>
      </div>
      
      <div class="debug-section">
        <h4>Current State</h4>
        <div class="info-grid">
          <span>Current Price:</span>
          <span>{state.currentPrice?.toFixed(digits) || 'N/A'}</span>
          <span>Digits:</span>
          <span>{state.digits || 'N/A'}</span>
          <span>Tick Direction:</span>
          <span>{state.lastTickDirection || 'N/A'}</span>
          <span>Volatility:</span>
          <span>{state.volatility?.toFixed(4) || 'N/A'}</span>
        </div>
      </div>
    {:else}
      <div class="no-data">
        <p>No debug data available.</p>
        <p>Select a symbol with active data to see debug information.</p>
      </div>
    {/if}
    
    <div class="debug-section">
      <h4>System Status</h4>
      <div class="info-grid">
        <span>Active Symbols:</span>
        <span>{symbols.length}</span>
        <span>Selected:</span>
        <span>Use FloatingSymbolPalette</span>
      </div>
    </div>
  </div>
</FloatingPanel>

<style>
  .debug-content {
    pointer-events: none;
    font-family: monospace;
  }
  
  .debug-content * {
    pointer-events: auto;
  }
  
  .debug-symbol-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    background: #374151;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  
  .symbol-label {
    color: #9ca3af;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .symbol-value {
    color: #4f46e5;
    font-weight: bold;
    font-size: 12px;
  }
  
  .debug-section {
    margin-bottom: 16px;
  }
  
  .debug-section:last-child {
    margin-bottom: 0;
  }
  
  .debug-section h4 {
    margin: 0 0 8px 0;
    color: #d1d5db;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #374151;
    padding-bottom: 4px;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 8px;
    font-size: 11px;
  }
  
  .info-grid span:nth-child(odd) {
    color: #9ca3af;
    font-weight: 500;
  }
  
  .info-grid span:nth-child(even) {
    color: #e5e7eb;
    text-align: right;
  }
  
  .no-data {
    text-align: center;
    padding: 20px 0;
    color: #6b7280;
  }
  
  .no-data p {
    margin: 4px 0;
    font-size: 11px;
  }
</style>