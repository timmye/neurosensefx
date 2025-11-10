<script>
  import { onMount, onDestroy } from 'svelte';
  import { connectivityStore, systemHealth, connectivityMonitor } from './ConnectivityMonitor.js';
  import FloatingPanel from '../FloatingPanel.svelte';
  import StatusMetrics from './StatusMetrics.svelte';
  import { displayStore, displayActions } from '../../stores/displayStore.js';

  // Panel configuration
  export let position = { x: window.innerWidth - 300, y: 20 };
  export let isVisible = true;
  export let isMinimized = false;
  export let isFromIconExpansion = false; // NEW: Track if opened from icon
  export let config = {
    showLabels: true,
    showDetails: false,
    refreshInterval: 1000,
    showLatency: true
  };

  // Debug: Log panel initialization
  console.log('[StatusPanel] Initializing with position:', position);
  console.log('[StatusPanel] isVisible:', isVisible, 'isMinimized:', isMinimized);
  console.log('[StatusPanel] config:', config);

  // Local state
  let panelElement;
  let showDetails = false;
  let size = 'small';
  let lastResize = Date.now();

  // NEW: Auto-show details when opened from icon expansion
  $: if (isFromIconExpansion && !showDetails) {
    showDetails = true;
    config.showDetails = true;
  }

  // Reactive bindings to connectivity store
  $: internetStatus = $connectivityStore.internet;
  $: serverStatus = $connectivityStore.server;
  $: symbolDataStatus = $connectivityStore.symbolData;
  $: latencyData = $connectivityStore.latency;
  $: overallHealth = $systemHealth;

  // Handle window resize with debouncing
  function handleResize() {
    const now = Date.now();
    if (now - lastResize > 250) { // Debounce to 250ms
      lastResize = now;
    }
  }

  // Toggle details view
  function toggleDetails() {
    showDetails = !showDetails;
    config.showDetails = showDetails;
  }

  // Toggle minimize state
  function toggleMinimize() {
    isMinimized = !isMinimized;
  }

  
  onMount(() => {
    // Listen for window resize
    window.addEventListener('resize', handleResize);

    // Start connectivity monitoring if not already running
    connectivityMonitor.start();
  });

  onDestroy(() => {
    window.removeEventListener('resize', handleResize);
  });

  </script>

<FloatingPanel
  id="status-panel"
  type="status-panel"
  title="System Status"
  {position}
  config={{
    isClosable: false,
    isMinimizable: true,
    showMinimizeButton: true,
    onMinimize: toggleMinimize
  }}
>

  <div class="status-panel-content" class:minimized={isMinimized}>
    <!-- Main Status Indicators Row -->
    <div class="status-row">
      <div class="status-indicators">
        <!-- Internet Status -->
        <StatusMetrics
          type="status"
          status={internetStatus.status}
          label={config.showLabels ? "Internet" : ""}
          details={internetStatus.details}
          lastUpdate={internetStatus.lastUpdate}
          showDetails={showDetails}
          {size}
        />

        <!-- Server Status -->
        <StatusMetrics
          type="status"
          status={serverStatus.status}
          label={config.showLabels ? "Server" : ""}
          details={serverStatus.details}
          lastUpdate={serverStatus.lastUpdate}
          showDetails={showDetails}
          {size}
        />

        <!-- Symbol Data Status -->
        <StatusMetrics
          type="status"
          status={symbolDataStatus.status}
          label={config.showLabels ? "Data" : ""}
          details={symbolDataStatus.details}
          lastUpdate={symbolDataStatus.lastUpdate}
          showDetails={showDetails}
          {size}
        />
      </div>

      <!-- Data Freshness Display -->
      {#if config.showLatency && !isMinimized}
        <div class="latency-section">
          <StatusMetrics
            type="latency"
            status={latencyData.status}
            value={latencyData.value}
            label={config.showLabels ? "Data Delay" : ""}
            lastUpdate={latencyData.lastUpdate}
            showDetails={showDetails}
            {size}
          />
        </div>
      {/if}
    </div>

    <!-- Expanded Details Section -->
    {#if !isMinimized && showDetails}
      <div class="status-details-section">
        <div class="details-header">
          <h4>System Health: {overallHealth}</h4>
        </div>

        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Internet:</span>
            <span class="detail-value" class:status-good={internetStatus.status === 'good'} class:status-warning={internetStatus.status === 'warning'} class:status-error={internetStatus.status === 'error'} class:status-unknown={internetStatus.status === 'unknown'}>
              {internetStatus.details}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Server:</span>
            <span class="detail-value" class:status-good={serverStatus.status === 'good'} class:status-warning={serverStatus.status === 'warning'} class:status-error={serverStatus.status === 'error'} class:status-unknown={serverStatus.status === 'unknown'}>
              {serverStatus.details}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Symbols:</span>
            <span class="detail-value" class:status-good={symbolDataStatus.status === 'good'} class:status-warning={symbolDataStatus.status === 'warning'} class:status-error={symbolDataStatus.status === 'error'} class:status-unknown={symbolDataStatus.status === 'unknown'}>
              {symbolDataStatus.details}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Data Delay:</span>
            <span class="detail-value" class:status-good={latencyData.status === 'good'} class:status-warning={latencyData.status === 'warning'} class:status-error={latencyData.status === 'error'} class:status-unknown={latencyData.status === 'unknown'}>
              {latencyData.details || `${latencyData.value}s ago`}
            </span>
          </div>
        </div>

        {#if latencyData.details}
          <div class="data-delay-info">
            <span class="delay-label">Trading Data Status:</span>
            <span class="delay-status">
              {latencyData.details}
            </span>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Minimized View -->
    {#if isMinimized}
      <div class="minimized-content">
        <div class="overall-status" class:status-good={overallHealth === 'good'} class:status-warning={overallHealth === 'warning'} class:status-error={overallHealth === 'error'} class:status-unknown={overallHealth === 'unknown'}>
          <div class="status-dot"></div>
          <span>{overallHealth}</span>
        </div>
      </div>
    {/if}

    <!-- Control Buttons (when not minimized and not from icon expansion) -->
    {#if !isMinimized && !isFromIconExpansion}
      <div class="control-buttons">
        <button
          class="control-btn"
          class:active={showDetails}
          on:click={toggleDetails}
          title="Toggle detailed view"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </button>
      </div>
    {/if}
  </div>

</FloatingPanel>

<style>
  .status-panel-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    min-width: 320px;
    min-height: 140px;
    transition: all 0.3s ease;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
  }

  .status-panel-content.minimized {
    min-width: 120px;
    min-height: 60px;
    padding: 8px;
    gap: 6px;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .status-indicators {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .latency-section {
    display: flex;
    align-items: center;
    min-width: 60px;
  }

  .status-details-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(51, 65, 85, 0.3);
    border-radius: 6px;
  }

  .details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .details-header h4 {
    margin: 0;
    color: #d1d5db;
    font-size: 16px;
    font-weight: 600;
  }

  
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .detail-label {
    color: #9ca3af;
    font-weight: 500;
  }

  .detail-value {
    color: #d1d5db;
    font-weight: 500;
  }

  .detail-value.status-good {
    color: #0891b2;
  }

  .detail-value.status-warning {
    color: #a855f7;
  }

  .detail-value.status-error {
    color: #ef4444;
  }

  .detail-value.status-unknown {
    color: #6b7280;
  }

  .latency-history {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 10px;
    margin-top: 4px;
  }

  /* Data Freshness Info */
  .data-delay-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 10px;
    margin-top: 4px;
  }

  .delay-label {
    color: #9ca3af;
    font-weight: 500;
  }

  .delay-status {
    color: #d1d5db;
    font-family: 'Courier New', monospace;
  }

  /* Minimized Content */
  .minimized-content {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .overall-status {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(51, 65, 85, 0.5);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .overall-status.status-good {
    color: #0891b2;
  }

  .overall-status.status-warning {
    color: #a855f7;
  }

  .overall-status.status-error {
    color: #ef4444;
  }

  .overall-status.status-unknown {
    color: #6b7280;
  }

  /* Control Buttons */
  .control-buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
  }

  .control-btn {
    background: rgba(51, 65, 85, 0.5);
    color: #d1d5db;
    border: 1px solid rgba(75, 85, 99, 0.5);
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .control-btn:hover {
    background: rgba(75, 85, 99, 0.7);
    border-color: rgba(107, 114, 128, 0.7);
  }

  .control-btn.active {
    background: #0891b2;
    border-color: #0891b2;
    color: white;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .status-panel-content {
      min-width: 240px;
    }

    .status-indicators {
      gap: 6px;
    }

    .details-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Accessibility support */
  @media (prefers-reduced-motion: reduce) {
    .status-panel-content,
    .test-button,
    .control-btn {
      transition: none;
    }
  }

  /* High contrast support */
  @media (prefers-contrast: high) {
    .status-details-section {
      border-width: 2px;
      background: #000;
    }

    .overall-status {
      border-width: 2px;
      background: #000;
    }
  }
</style>