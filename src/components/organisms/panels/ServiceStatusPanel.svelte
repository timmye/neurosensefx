<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { ServiceHealthIndicator } from '../../molecules/index.js';
  import { PerformanceMetrics } from '../../molecules/index.js';
  import { Button, Badge, Icon, Tabs } from '../../atoms/index.js';
  import { connectionStore, performanceStore } from '../../../stores/index.js';
  
  const dispatch = createEventDispatcher();
  
  let services = [];
  let systemMetrics = {};
  let selectedTab = 'services';
  let autoRefresh = true;
  let refreshInterval;
  let lastRefresh = new Date();
  let isRefreshing = false;
  
  // Tab configuration
  const tabs = [
    { id: 'services', label: 'Services', icon: 'server' },
    { id: 'performance', label: 'Performance', icon: 'activity' },
    { id: 'system', label: 'System', icon: 'cpu' }
  ];
  
  // Subscribe to stores
  let unsubscribeConnection = () => {};
  let unsubscribePerformance = () => {};
  
  onMount(() => {
    // Subscribe to connection store
    unsubscribeConnection = connectionStore.subscribe($connection => {
      updateServicesFromConnection($connection);
    });
    
    // Subscribe to performance store
    unsubscribePerformance = performanceStore.subscribe($performance => {
      systemMetrics = $performance.metrics || {};
    });
    
    // Start auto-refresh
    if (autoRefresh) {
      startAutoRefresh();
    }
    
    // Initial data load
    refreshServices();
  });
  
  onDestroy(() => {
    unsubscribeConnection();
    unsubscribePerformance();
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  function updateServicesFromConnection(connection) {
    services = [
      {
        name: 'WebSocket Connection',
        status: connection.status === 'connected' ? 'healthy' : 
               connection.status === 'connecting' ? 'degraded' : 'unhealthy',
        lastUpdate: connection.lastConnected || new Date(),
        metrics: {
          'Reconnects': connection.reconnectAttempts || 0,
          'Uptime': connection.uptime ? `${Math.floor(connection.uptime / 1000)}s` : '0s'
        },
        errors: connection.errors || []
      },
      {
        name: 'Symbol Subscriptions',
        status: connection.subscribedSymbols && connection.subscribedSymbols.length > 0 ? 'healthy' : 'degraded',
        lastUpdate: new Date(),
        metrics: {
          'Active': connection.subscribedSymbols?.length || 0,
          'Errors': connection.subscriptionErrors || 0
        },
        errors: []
      },
      {
        name: 'Data Cache',
        status: 'healthy', // TODO: Implement cache health check
        lastUpdate: new Date(),
        metrics: {
          'Size': 'N/A',
          'Hit Rate': 'N/A'
        },
        errors: []
      },
      {
        name: 'Price Processor',
        status: 'healthy', // TODO: Implement processor health check
        lastUpdate: new Date(),
        metrics: {
          'TPS': 'N/A',
          'Latency': 'N/A'
        },
        errors: []
      }
    ];
    
    lastRefresh = new Date();
  }
  
  function startAutoRefresh() {
    refreshInterval = setInterval(() => {
      if (autoRefresh && !isRefreshing) {
        refreshServices();
      }
    }, 5000); // Refresh every 5 seconds
  }
  
  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
  
  async function refreshServices() {
    if (isRefreshing) return;
    
    isRefreshing = true;
    
    try {
      // Trigger refresh in stores
      connectionStore.refresh();
      performanceStore.refresh();
      
      lastRefresh = new Date();
    } catch (error) {
      console.error('Failed to refresh services:', error);
    } finally {
      isRefreshing = false;
    }
  }
  
  function handleServiceClick(event) {
    const { service } = event.detail;
    dispatch('serviceSelected', { service });
  }
  
  function handleServiceRefresh(event) {
    const { service } = event.detail;
    dispatch('serviceRefresh', { service });
    refreshServices();
  }
  
  function handleMetricClick(event) {
    const { metric, value } = event.detail;
    dispatch('metricSelected', { metric, value });
  }
  
  function handleRefresh() {
    refreshServices();
  }
  
  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }
  
  function getSystemHealthStatus() {
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const totalCount = services.length;
    
    if (healthyCount === totalCount) return 'healthy';
    if (healthyCount > 0) return 'degraded';
    return 'unhealthy';
  }
  
  function getSystemHealthVariant() {
    const status = getSystemHealthStatus();
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'danger';
      default: return 'muted';
    }
  }
</script>

<div class="service-status-panel">
  <!-- Panel Header -->
  <div class="panel-header">
    <div class="header-content">
      <div class="header-info">
        <Icon name="activity" size="lg" />
        <div>
          <h2>Service Status</h2>
          <p>Monitor system health and performance</p>
        </div>
      </div>
      
      <div class="header-status">
        <Badge variant={getSystemHealthVariant()} size="md">
          {getSystemHealthStatus().toUpperCase()}
        </Badge>
      </div>
    </div>
    
    <div class="header-actions">
      <Button 
        variant="ghost" 
        size="sm"
        on:click={handleRefresh}
        disabled={isRefreshing}
      >
        <Icon name="refresh-cw" size="sm" class={isRefreshing ? 'spinning' : ''} />
        Refresh
      </Button>
      
      <Button 
        variant={autoRefresh ? 'primary' : 'ghost'} 
        size="sm"
        on:click={toggleAutoRefresh}
      >
        <Icon name="clock" size="sm" />
        Auto
      </Button>
    </div>
  </div>
  
  <!-- Panel Body -->
  <div class="panel-body">
    <!-- Tabs -->
    <Tabs 
      tabs={tabs}
      selected={selectedTab}
      on:select={(e) => selectedTab = e.detail.tabId}
    />
    
    <!-- Tab Content -->
    <div class="tab-content">
      {#if selectedTab === 'services'}
        <div class="services-tab">
          <div class="services-list">
            {#each services as service (service.name)}
              <ServiceHealthIndicator
                service={service}
                on:serviceClick={handleServiceClick}
                on:refresh={handleServiceRefresh}
              />
            {/each}
          </div>
        </div>
      {:else if selectedTab === 'performance'}
        <div class="performance-tab">
          <PerformanceMetrics
            metrics={systemMetrics}
            showCharts={true}
            on:metricClick={handleMetricClick}
            on:refresh={handleRefresh}
          />
        </div>
      {:else if selectedTab === 'system'}
        <div class="system-tab">
          <div class="system-info">
            <div class="info-section">
              <h4>System Information</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Last Refresh:</span>
                  <span class="info-value">{lastRefresh.toLocaleTimeString()}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Auto Refresh:</span>
                  <Badge variant={autoRefresh ? 'success' : 'muted'} size="sm">
                    {autoRefresh ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div class="info-item">
                  <span class="info-label">Total Services:</span>
                  <span class="info-value">{services.length}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Healthy Services:</span>
                  <span class="info-value">{services.filter(s => s.status === 'healthy').length}</span>
                </div>
              </div>
            </div>
            
            <div class="info-section">
              <h4>Quick Actions</h4>
              <div class="action-grid">
                <Button variant="outline" size="sm" on:click={handleRefresh}>
                  <Icon name="refresh-cw" size="sm" />
                  Refresh All
                </Button>
                
                <Button variant="outline" size="sm" on:click={toggleAutoRefresh}>
                  <Icon name="clock" size="sm" />
                  Toggle Auto Refresh
                </Button>
                
                <Button variant="outline" size="sm" on:click={() => dispatch('exportLogs')}>
                  <Icon name="download" size="sm" />
                  Export Logs
                </Button>
                
                <Button variant="outline" size="sm" on:click={() => dispatch('viewDetails')}>
                  <Icon name="external-link" size="sm" />
                  View Details
                </Button>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Panel Footer -->
  <div class="panel-footer">
    <div class="footer-info">
      <span class="last-update">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </span>
      
      {#if isRefreshing}
        <span class="refreshing">
          <Icon name="loader-2" size="xs" class="spinning" />
          Refreshing...
        </span>
      {/if}
    </div>
    
    <div class="footer-actions">
      <Button variant="ghost" size="xs" on:click={() => dispatch('viewFullStatus')}>
        View Full Status
      </Button>
    </div>
  </div>
</div>

<style>
  .service-status-panel {
    background: var(--bg-primary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 500px;
  }
  
  .panel-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
    flex: 1;
  }
  
  .header-info {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .header-info h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
  }
  
  .header-info p {
    margin: var(--space-1) 0 0 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .header-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  .panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .tab-content {
    flex: 1;
    padding: var(--space-4);
    overflow-y: auto;
  }
  
  .services-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .services-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .performance-tab {
    display: flex;
    flex-direction: column;
  }
  
  .system-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .system-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .info-section h4 {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  
  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }
  
  .info-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-weight: var(--font-weight-medium);
  }
  
  .info-value {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-semibold);
  }
  
  .action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-2);
  }
  
  .panel-footer {
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .footer-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }
  
  .refreshing {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-secondary);
  }
  
  .footer-actions {
    display: flex;
    gap: var(--space-2);
  }
  
  /* Animations */
  .spinning {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .panel-header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
    
    .header-actions {
      align-self: stretch;
      justify-content: space-between;
    }
    
    .info-grid {
      grid-template-columns: 1fr;
    }
    
    .action-grid {
      grid-template-columns: 1fr;
    }
    
    .panel-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
  }
</style>
