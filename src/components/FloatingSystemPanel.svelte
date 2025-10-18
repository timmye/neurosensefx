<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { dataSourceMode, wsStatus } from '../data/wsClient.js';
  import { symbolStore } from '../data/symbolStore.js';
  import { uiActions } from '../stores/uiState.js';
  import InteractWrapper from './shared/InteractWrapper.svelte';
  import InfoGrid from './shared/InfoGrid.svelte';
  import SectionHeader from './shared/SectionHeader.svelte';
  import StatusDisplay from './shared/StatusDisplay.svelte';
  import { getZIndex } from '../constants/zIndex.js';
  import { createLogger } from '../utils/debugLogger.js';
  
  const logger = createLogger('FloatingSystemPanel');
  const dispatch = createEventDispatcher();
  
  // Component state
  let systemPosition = { x: 680, y: 20 }; // Top right position
  let isMinimized = false;
  let subscribedSymbols = [];
  let interactWrapperRef;
  
  // Subscribe to symbol store
  const unsubSymbolStore = symbolStore.subscribe(value => {
    subscribedSymbols = Object.keys(value);
  });
  
  onDestroy(() => {
    unsubSymbolStore();
  });
  
  function handleClose() {
    logger.debug('System panel closed');
    uiActions.hideFloatingSystemPanel();
    dispatch('close');
  }
  
  function handlePositionChange(event) {
    systemPosition = event.detail.position;
    logger.debug('Position changed', { position: systemPosition });
  }
  
  function handleMinimize() {
    isMinimized = !isMinimized;
    if (interactWrapperRef) {
      interactWrapperRef.setMinimized(isMinimized);
    }
    logger.debug('Minimize toggled', { isMinimized });
    dispatch('minimizeChange', { isMinimized });
  }
  
  function handleDataSourceChange(event) {
    const mode = event.target.value;
    logger.debug('Data source changed', { mode });
    dispatch('dataSourceChange', { mode });
  }
</script>

<InteractWrapper
  bind:this={interactWrapperRef}
  position={systemPosition}
  defaultPosition={systemPosition}
  positionKey="floating-system-panel-position"
  on:positionChange={handlePositionChange}
  isDraggable={true}
  isResizable={false}
  inertia={true}
  boundaryPadding={10}
>
  <div class="draggable-panel {isMinimized ? 'minimized' : ''}" style="z-index: {getZIndex('SYSTEM_PANEL')};">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="drag-indicator">⋮⋮</div>
      <div class="panel-title">System Controls</div>
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
  <div class="system-content">
    <!-- Data Source Section -->
    <div class="system-section">
      <SectionHeader title="Data Source" />
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
        <SectionHeader title="Live Connection" />
        <StatusDisplay status={$wsStatus} />
        
        {#if subscribedSymbols.length > 0}
          <div class="subscribed-list">
            <SectionHeader title="Active Subscriptions:" level={5} />
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
      <SectionHeader title="System Status" />
      <InfoGrid
        data={[
          { label: "Active Symbols:", value: subscribedSymbols.length },
          { label: "Data Source:", value: $dataSourceMode },
          { label: "Connection:", value: $wsStatus }
        ]}
      />
    </div>
    
    <!-- Quick Actions Section -->
    <div class="system-section">
      <SectionHeader title="Quick Actions" />
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
  
  .system-section {
    margin-bottom: 16px;
  }
  
  .system-section:last-child {
    margin-bottom: 0;
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
