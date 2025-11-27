<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { displays, subscriptions } from '../stores/displayStore.js';
  import { availableSymbols } from '../data/wsClient.js';
  import InteractWrapper from './shared/InteractWrapper.svelte';
  import InfoGrid from './shared/InfoGrid.svelte';
  import SectionHeader from './shared/SectionHeader.svelte';
  import { getZIndex } from '../constants/zIndex.js';
  import { createLogger } from '../utils/debugLogger.js';

  // ✅ STANDARDIZED COMPONENT LIFECYCLE: Consistent export pattern
  export let config = {};  // Configuration from displayStore.defaultConfig
  export let state = {};   // Reactive state from dataProcessor
  export let id = '';      // Unique identifier for tracking

  const logger = createLogger('FloatingDebugPanel');
  const dispatch = createEventDispatcher();

  // Component state
  let debugPosition = { x: 680, y: 200 }; // Middle right position
  let isMinimized = false;
  let symbols = [];
  let available = [];
  let currentSymbolData = null;
  let interactWrapperRef;

  // Store subscriptions for cleanup
  let unsubscribeDisplays = null;
  let unsubscribeSubscriptions = null;
  let unsubscribeAvailable = null;
  
  // Subscribe to display store (active subscriptions)
  const unsubSymbolStore = subscriptions.subscribe(value => {
    symbols = Array.from(value);
  });
  
  // Subscribe to available symbols store
  const unsubAvailableSymbols = availableSymbols.subscribe(value => {
    available = value;
  });
  
  // No longer subscribing to selected symbol as it's been removed
  
  onDestroy(() => {
    unsubSymbolStore();
    unsubAvailableSymbols();
  });
  
  function handleClose() {
    logger.debug('Debug panel closed');
    dispatch('close');
  }
  
  function handlePositionChange(event) {
    debugPosition = event.detail.position;
    logger.debug('Position changed', { position: debugPosition });
  }
  
  function handleMinimize() {
    isMinimized = !isMinimized;
    if (interactWrapperRef) {
      interactWrapperRef.setMinimized(isMinimized);
    }
    logger.debug('Minimize toggled', { isMinimized });
    dispatch('minimizeChange', { isMinimized });
  }
  
  // Get current state for display
  $: state = currentSymbolData?.state;
  $: digits = state?.digits || 5;
  $: hasData = state && Object.keys(state).length > 0;
</script>

<InteractWrapper
  bind:this={interactWrapperRef}
  position={debugPosition}
  defaultPosition={debugPosition}
  positionKey="floating-debug-panel-position"
  on:positionChange={handlePositionChange}
  isDraggable={true}
  isResizable={false}
  inertia={true}
  boundaryPadding={10}
>
  <div class="draggable-panel {isMinimized ? 'minimized' : ''}" style="z-index: {getZIndex('DEBUG_PANEL')};">
    <!-- Panel Header -->
    <div class="panel-header">
      <div class="drag-indicator">⋮⋮</div>
      <div class="panel-title">Debug Info</div>
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
  <div class="debug-content">
    <div class="debug-symbol-header">
      <span class="symbol-label">Symbol Selection:</span>
      <span class="symbol-value">Use FloatingSymbolPalette</span>
    </div>
    
    {#if hasData}
      <div class="debug-section">
        <SectionHeader title="Market Profile" />
        <InfoGrid
          data={[
            { label: "Profile Levels:", value: state.marketProfile?.levels?.length || 0 },
            { label: "Profile Ticks:", value: state.marketProfile?.tickCount || 0 }
          ]}
        />
      </div>
      
      <div class="debug-section">
        <SectionHeader title="Price Range" />
        <InfoGrid
          data={[
            { label: "ADR High:", value: (state?.projectedAdrHigh !== undefined && state?.projectedAdrHigh !== null) ? state.projectedAdrHigh.toFixed(5) : 'N/A' },
            { label: "ADR Low:", value: (state?.projectedAdrLow !== undefined && state?.projectedAdrLow !== null) ? state.projectedAdrLow.toFixed(5) : 'N/A' },
            { label: "Visual High:", value: (state?.visualHigh !== undefined && state?.visualHigh !== null) ? state.visualHigh.toFixed(5) : 'N/A' },
            { label: "Visual Low:", value: (state?.visualLow !== undefined && state?.visualLow !== null) ? state.visualLow.toFixed(5) : 'N/A' }
          ]}
        />
      </div>
      
      <div class="debug-section">
        <SectionHeader title="Current State" />
        <InfoGrid
          data={[
            { label: "Current Price:", value: (state?.currentPrice !== undefined && state?.currentPrice !== null) ? state.currentPrice.toFixed(digits) : 'N/A' },
            { label: "Digits:", value: state.digits || 'N/A' },
            { label: "Tick Direction:", value: state.lastTickDirection || 'N/A' },
            { label: "Volatility:", value: (state?.volatility !== undefined && state?.volatility !== null) ? state.volatility.toFixed(4) : 'N/A' }
          ]}
        />
      </div>
    {:else}
      <div class="no-data">
        <p>No debug data available.</p>
        <p>Select a symbol with active data to see debug information.</p>
      </div>
    {/if}
    
    <div class="debug-section">
      <SectionHeader title="System Status" />
      <InfoGrid
        data={[
          { label: "Active Subscriptions:", value: symbols.length },
          { label: "Available Symbols:", value: available.length },
          { label: "Selected:", value: "Use FloatingSymbolPalette" }
        ]}
      />
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
  
  .debug-content {
    font-family: monospace;
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
