<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { ConnectionIndicator, StatusBadge } from '../../molecules/index.js';
  import { Button } from '../../atoms/index.js';
  
  // Component props
  export let compact = false;
  export let showDetails = true;
  export let showHistory = false;
  export let autoRefresh = true;
  export let refreshInterval = 1000; // 1 second
  
  const dispatch = createEventDispatcher();
  
  // Connection state
  let connectionStatus = 'disconnected';
  let connectionQuality = null;
  let latency = null;
  let lastConnected = null;
  let connectionHistory = [];
  let errorDetails = null;
  let isReconnecting = false;
  
  // Service health metrics
  let serviceHealth = {
    websocket: 'unknown',
    dataProcessor: 'unknown',
    cacheManager: 'unknown',
    subscriptionManager: 'unknown'
  };
  
  let performanceMetrics = {
    ticksPerSecond: 0,
    errorsPerSecond: 0,
    memoryUsage: 0,
    uptime: 0
  };
  
  let subscriptionStatus = {
    active: 0,
    total: 0,
    failed: 0
  };
  
  // Refresh interval
  let refreshTimer = null;
  
  // Simulated connection data (in real implementation, this would come from stores)
  function simulateConnectionData() {
    // Simulate connection status changes
    const random = Math.random();
    if (random > 0.8) {
      connectionStatus = 'connected';
      connectionQuality = ['excellent', 'good', 'fair'][Math.floor(Math.random() * 3)];
      latency = Math.floor(Math.random() * 150) + 20;
      lastConnected = new Date();
    } else if (random > 0.6) {
      connectionStatus = 'connecting';
      connectionQuality = null;
      latency = null;
    } else if (random > 0.95) {
      connectionStatus = 'error';
      connectionQuality = 'poor';
      latency = 999;
      errorDetails = 'Connection timeout - unable to reach server';
    } else {
      connectionStatus = 'disconnected';
      connectionQuality = null;
      latency = null;
    }
    
    // Simulate service health
    serviceHealth = {
      websocket: connectionStatus === 'connected' ? 'healthy' : 'unhealthy',
      dataProcessor: Math.random() > 0.1 ? 'healthy' : 'warning',
      cacheManager: Math.random() > 0.05 ? 'healthy' : 'warning',
      subscriptionManager: Math.random() > 0.2 ? 'healthy' : 'warning'
    };
    
    // Simulate performance metrics
    performanceMetrics = {
      ticksPerSecond: Math.floor(Math.random() * 1000) + 100,
      errorsPerSecond: Math.floor(Math.random() * 5),
      memoryUsage: Math.floor(Math.random() * 50) + 20,
      uptime: Math.floor(Math.random() * 86400) // seconds
    };
    
    // Simulate subscription status
    subscriptionStatus = {
      active: Math.floor(Math.random() * 10) + 1,
      total: Math.floor(Math.random() * 5) + 10,
      failed: Math.floor(Math.random() * 3)
    };
    
    // Update connection history
    if (showHistory) {
      connectionHistory = [
        {
          timestamp: new Date(),
          status: connectionStatus,
          quality: connectionQuality,
          latency: latency
        },
        ...connectionHistory.slice(0, 9) // Keep last 10 entries
      ];
    }
  }
  
  // Handle manual reconnect
  function handleReconnect() {
    isReconnecting = true;
    connectionStatus = 'connecting';
    
    // Simulate reconnection process
    setTimeout(() => {
      simulateConnectionData();
      isReconnecting = false;
      dispatch('reconnect', { success: connectionStatus === 'connected' });
    }, 2000);
  }
  
  // Handle connection indicator click
  function handleConnectionClick(event) {
    dispatch('connectionClick', event.detail);
  }
  
  // Handle service status click
  function handleServiceClick(service, status) {
    dispatch('serviceClick', { service, status });
  }
  
  // Format time duration
  function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }
  
  // Format timestamp
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
  }
  
  // Get health status color
  function getHealthStatusColor(status) {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      default: return 'neutral';
    }
  }
  
  // Calculate overall connection quality
  $: overallQuality = connectionStatus === 'connected' 
    ? (latency < 50 ? 'excellent' : latency < 100 ? 'good' : latency < 200 ? 'fair' : 'poor')
    : null;
  
  // Setup auto-refresh
  onMount(() => {
    if (autoRefresh) {
      refreshTimer = setInterval(simulateConnectionData, refreshInterval);
      simulateConnectionData(); // Initial data
    }
  });
  
  onDestroy(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  });
</script>

<div class="connection-status-panel" class:compact>
  <!-- Header -->
  <div class="connection-status-panel__header">
    <h2 class="connection-status-panel__title">
      Connection Status
    </h2>
    
    <!-- Main connection indicator -->
    <ConnectionIndicator
      status={connectionStatus}
      connectionQuality={overallQuality}
      latency={latency}
      lastConnected={lastConnected}
      clickable={true}
      on:click={handleConnectionClick}
      size={compact ? 'sm' : 'md'}
    />
  </div>
  
  <!-- Connection details -->
  {#if showDetails && !compact}
    <div class="connection-status-panel__details">
      <!-- Service Health -->
      <div class="connection-status-panel__section">
        <h3 class="connection-status-panel__section-title">Service Health</h3>
        <div class="service-health-grid">
          {#each Object.entries(serviceHealth) as [service, status]}
            <div 
              class="service-health-item"
              class:clickable={true}
              role="button"
              tabindex="0"
              on:click={() => handleServiceClick(service, status)}
              on:keydown={(e) => e.key === 'Enter' && handleServiceClick(service, status)}
            >
              <StatusBadge
                status={getHealthStatusColor(status)}
                label={service.replace(/([A-Z])/g, ' $1').trim()}
                size="sm"
                variant="subtle"
              />
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Performance Metrics -->
      <div class="connection-status-panel__section">
        <h3 class="connection-status-panel__section-title">Performance</h3>
        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">Ticks/Sec</span>
            <span class="metric-value">{performanceMetrics.ticksPerSecond}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Errors/Sec</span>
            <span class="metric-value">{performanceMetrics.errorsPerSecond}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Memory</span>
            <span class="metric-value">{performanceMetrics.memoryUsage}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Uptime</span>
            <span class="metric-value">{formatDuration(performanceMetrics.uptime)}</span>
          </div>
        </div>
      </div>
      
      <!-- Subscription Status -->
      <div class="connection-status-panel__section">
        <h3 class="connection-status-panel__section-title">Subscriptions</h3>
        <div class="subscription-status">
          <div class="subscription-item">
            <StatusBadge
              status="success"
              label={`Active: ${subscriptionStatus.active}`}
              count={subscriptionStatus.active}
              size="sm"
              variant="subtle"
            />
          </div>
          <div class="subscription-item">
            <StatusBadge
              status="info"
              label={`Total: ${subscriptionStatus.total}`}
              count={subscriptionStatus.total}
              size="sm"
              variant="subtle"
            />
          </div>
          {#if subscriptionStatus.failed > 0}
            <div class="subscription-item">
              <StatusBadge
                status="danger"
                label={`Failed: ${subscriptionStatus.failed}`}
                count={subscriptionStatus.failed}
                size="sm"
                variant="outline"
                animated={true}
              />
            </div>
          {/if}
        </div>
      </div>
      
      <!-- Error Details -->
      {#if errorDetails}
        <div class="connection-status-panel__section">
          <h3 class="connection-status-panel__section-title">Error Details</h3>
          <div class="error-details">
            <StatusBadge
              status="danger"
              label="Error"
              variant="outline"
              animated={true}
            />
            <p class="error-message">{errorDetails}</p>
          </div>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Connection History -->
  {#if showHistory && !compact}
    <div class="connection-status-panel__section">
      <h3 class="connection-status-panel__section-title">Connection History</h3>
      <div class="connection-history">
        {#each connectionHistory as entry}
          <div class="history-item">
            <span class="history-time">{formatTime(entry.timestamp)}</span>
            <ConnectionIndicator
              status={entry.status}
              connectionQuality={entry.quality}
              latency={entry.latency}
              size="sm"
              showLabel={false}
            />
          </div>
        {/each}
        {#if connectionHistory.length === 0}
          <p class="no-history">No connection history available</p>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Actions -->
  <div class="connection-status-panel__actions">
    {#if connectionStatus !== 'connected' && !isReconnecting}
      <Button
        variant="primary"
        size="sm"
        onClick={handleReconnect}
        loading={isReconnecting}
      >
        Reconnect
      </Button>
    {/if}
    
    {#if compact}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => dispatch('toggleDetails')}
      >
        Details
      </Button>
    {/if}
    
    <Button
      variant="ghost"
      size="sm"
      onClick={() => dispatch('refresh')}
    >
      Refresh
    </Button>
  </div>
</div>

<style>
  .connection-status-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    font-family: var(--font-sans);
    max-width: 400px;
  }
  
  .connection-status-panel.compact {
    gap: var(--space-2);
    padding: var(--space-3);
    max-width: 300px;
  }
  
  .connection-status-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  
  .connection-status-panel__title {
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin: 0;
  }
  
  .connection-status-panel.compact .connection-status-panel__title {
    font-size: var(--text-base);
  }
  
  .connection-status-panel__details {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .connection-status-panel__section {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .connection-status-panel__section-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }
  
  /* Service Health Grid */
  .service-health-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-2);
  }
  
  .service-health-item {
    display: flex;
    align-items: center;
    padding: var(--space-1);
    border-radius: var(--radius-md);
    transition: background-color var(--motion-fast) var(--ease-snappy);
  }
  
  .service-health-item.clickable:hover {
    background: var(--bg-tertiary);
  }
  
  .service-health-item.clickable:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  
  .metric-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .metric-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
  }
  
  .metric-value {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
  
  /* Subscription Status */
  .subscription-status {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  
  .subscription-item {
    display: flex;
  }
  
  /* Error Details */
  .error-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-danger-subtle);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-md);
  }
  
  .error-message {
    font-size: var(--text-sm);
    color: var(--color-danger);
    margin: 0;
    font-family: var(--font-mono);
  }
  
  /* Connection History */
  .connection-history {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-height: 200px;
    overflow-y: auto;
  }
  
  .history-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }
  
  .history-item:nth-child(odd) {
    background: var(--bg-tertiary);
  }
  
  .history-time {
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }
  
  .no-history {
    color: var(--text-tertiary);
    font-style: italic;
    text-align: center;
    margin: 0;
  }
  
  /* Actions */
  .connection-status-panel__actions {
    display: flex;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-default);
  }
  
  /* Responsive Design */
  @media (max-width: 480px) {
    .connection-status-panel {
      max-width: 100%;
    }
    
    .service-health-grid {
      grid-template-columns: 1fr;
    }
    
    .metrics-grid {
      grid-template-columns: 1fr;
    }
    
    .connection-status-panel__actions {
      flex-direction: column;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .connection-status-panel {
      border-width: 2px;
    }
    
    .metric-item {
      border: 1px solid var(--border-default);
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .service-health-item,
    .connection-status-panel,
    .status-badge {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .connection-status-panel {
      background: white !important;
      border: 1px solid black !important;
      color: black !important;
    }
    
    .connection-status-panel__actions {
      display: none !important;
    }
  }
</style>
