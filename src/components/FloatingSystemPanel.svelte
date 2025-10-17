<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { dataSourceMode, wsStatus } from '../data/wsClient.js';
  import { symbolStore } from '../data/symbolStore.js';
  import { uiActions } from '../stores/uiState.js';
  import FloatingPanel from './shared/FloatingPanel.svelte';
  
  const dispatch = createEventDispatcher();
  
  // Component state
  let systemPosition = { x: 300, y: 100 };
  let isMinimized = false;
  let subscribedSymbols = [];
  
  // Subscribe to symbol store
  const unsubSymbolStore = symbolStore.subscribe(value => {
    subscribedSymbols = Object.keys(value);
  });
  
  onDestroy(() => {
    unsubSymbolStore();
  });
  
  function handleClose() {
    uiActions.hideFloatingSystemPanel();
  }
  
  function handleDataSourceChange(event) {
    const mode = event.detail.mode;
    dispatch('dataSourceChange', { mode });
  }
</script>

<FloatingPanel
  title="System Controls"
  panelId="system-panel"
  position={systemPosition}
  on:close={handleClose}
  defaultMinimized={false}
>
  <div class="system-content">
    <!-- Data Source Section -->
    <div class="system-section">
      <h4>Data Source</h4>
      <div class="control-group">
        <select bind:value={$dataSourceMode} on:change={handleDataSourceChange}>
          <option value="simulated">Simulated Data</option>
          <option value="live">Live Data (cTrader)</option>
        </select>
      </div>
    </div>
    
    <!-- Live Connection Section -->
    {#if $dataSourceMode === 'live'}
      <div class="system-section">
        <h4>Live Connection</h4>
        <div class="status-box">
          <span class="status-indicator status-{$wsStatus}"></span>
          <span class="status-text">{$wsStatus}</span>
        </div>
        
        {#if subscribedSymbols.length > 0}
          <div class="subscribed-list">
            <h5>Active Subscriptions:</h5>
            <ul>
              {#each subscribedSymbols as symbol}
                <li>
                  <span>{symbol}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- System Status Section -->
    <div class="system-section">
      <h4>System Status</h4>
      <div class="info-grid">
        <span>Active Symbols:</span>
        <span>{subscribedSymbols.length}</span>
        <span>Data Source:</span>
        <span>{$dataSourceMode}</span>
        <span>Connection:</span>
        <span>{$wsStatus}</span>
      </div>
    </div>
    
    <!-- Quick Actions Section -->
    <div class="system-section">
      <h4>Quick Actions</h4>
      <div class="action-buttons">
        <button
          class="action-btn"
          on:click={() => uiActions.toggleFloatingSymbolPalette()}
        >
          📊 Symbol Palette
        </button>
        <div class="info-note">
          Use Symbol Palette to subscribe to symbols and create canvases
        </div>
        <button 
          class="action-btn"
          on:click={() => uiActions.toggleFloatingDebugPanel()}
        >
          🐛 Debug Panel
        </button>
      </div>
    </div>
  </div>
</FloatingPanel>

<style>
  .system-content {
    /* No additional styles needed, using FloatingPanel styles */
  }
  
  .system-section {
    margin-bottom: 16px;
  }
  
  .system-section:last-child {
    margin-bottom: 0;
  }
  
  .system-section h4 {
    margin: 0 0 8px 0;
    color: #d1d5db;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #374151;
    padding-bottom: 4px;
  }
  
  .system-section h5 {
    margin: 8px 0 4px 0;
    color: #9ca3af;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .control-group {
    margin-bottom: 8px;
  }
  
  select {
    width: 100%;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #4b5563;
    background-color: #1f2937;
    color: #e5e7eb;
    font-size: 12px;
  }
  
  .status-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background-color: #111827;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  
  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .status-disconnected { background-color: #ef4444; }
  .status-ws-connecting, .status-ws-open { background-color: #f59e0b; }
  .status-connected { background-color: #22c55e; }
  .status-ready { background-color: #22c55e; }
  .status-error { background-color: #ef4444; }
  
  .status-text {
    font-weight: 500;
    color: #e5e7eb;
    font-size: 12px;
  }
  
  .subscription-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .subscribed-list {
    margin-top: 8px;
  }
  
  .subscribed-list ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .subscribed-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 6px;
    background-color: #111827;
    border-radius: 4px;
    margin-bottom: 4px;
    font-size: 11px;
  }
  
  .info-note {
    margin-top: 8px;
    padding: 6px 8px;
    background-color: rgba(79, 70, 229, 0.1);
    border: 1px solid rgba(79, 70, 229, 0.3);
    border-radius: 4px;
    font-size: 10px;
    color: #9ca3af;
    text-align: center;
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
  
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .action-btn {
    padding: 6px 8px;
    border: 1px solid #4b5563;
    border-radius: 4px;
    background-color: #374151;
    color: #d1d5db;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }
  
  .action-btn:hover {
    background-color: #4b5563;
    border-color: #6b7280;
  }
</style>