<script>
  import { createEventDispatcher } from 'svelte';
  import { StatusIndicator, Badge, Icon } from '../atoms/index.js';
  
  export let service = {
    name: 'Unknown Service',
    status: 'unknown', // healthy, degraded, unhealthy, unknown
    lastUpdate: new Date(),
    metrics: {},
    errors: []
  };
  export let showDetails = false;
  export let compact = false;
  
  const dispatch = createEventDispatcher();
  
  $: statusVariant = getStatusVariant(service.status);
  $: statusIcon = getStatusIcon(service.status);
  $: hasErrors = service.errors && service.errors.length > 0;
  $: isHealthy = service.status === 'healthy';
  $: isDegraded = service.status === 'degraded';
  $: isUnhealthy = service.status === 'unhealthy';
  
  function getStatusVariant(status) {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'danger';
      default: return 'muted';
    }
  }
  
  function getStatusIcon(status) {
    switch (status) {
      case 'healthy': return 'check-circle';
      case 'degraded': return 'alert-triangle';
      case 'unhealthy': return 'x-circle';
      default: return 'help-circle';
    }
  }
  
  function formatLastUpdate(date) {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }
  
  function handleClick() {
    dispatch('serviceClick', { service });
    showDetails = !showDetails;
  }
  
  function handleRefresh() {
    dispatch('refresh', { service: service.name });
  }
</script>

<div 
  class="service-health-indicator" 
  class:compact
  class:has-errors={hasErrors}
  role="button"
  tabindex="0"
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
>
  <!-- Compact View -->
  {#if compact}
    <div class="compact-layout">
      <StatusIndicator 
        status={service.status}
        size="sm"
        variant={statusVariant}
      />
      <span class="service-name">{service.name}</span>
      {#if hasErrors}
        <Badge variant="danger" size="xs">{service.errors.length}</Badge>
      {/if}
    </div>
  {:else}
    <!-- Full View -->
    <div class="full-layout">
      <div class="service-header">
        <div class="service-info">
          <Icon 
            name={statusIcon} 
            variant={statusVariant}
            size="md"
          />
          <div class="service-details">
            <h4 class="service-name">{service.name}</h4>
            <p class="service-status">{service.status}</p>
          </div>
        </div>
        
        <div class="service-actions">
          <Badge 
            variant={statusVariant}
            size="sm"
          >
            {service.status.toUpperCase()}
          </Badge>
          
          <button 
            class="refresh-button"
            on:click|stopPropagation={handleRefresh}
            title="Refresh service status"
          >
            <Icon name="refresh-cw" size="sm" />
          </button>
        </div>
      </div>
      
      <div class="service-meta">
        <span class="last-update">
          Last updated: {formatLastUpdate(service.lastUpdate)}
        </span>
        
        {#if hasErrors}
          <Badge variant="danger" size="sm">
            {service.errors.length} {service.errors.length === 1 ? 'Error' : 'Errors'}
          </Badge>
        {/if}
      </div>
      
      <!-- Metrics Display -->
      {#if service.metrics && Object.keys(service.metrics).length > 0}
        <div class="service-metrics">
          {#each Object.entries(service.metrics) as [key, value]}
            <div class="metric">
              <span class="metric-label">{key}:</span>
              <span class="metric-value">{value}</span>
            </div>
          {/each}
        </div>
      {/if}
      
      <!-- Error Details -->
      {#if showDetails && hasErrors}
        <div class="error-details">
          <h5>Recent Errors</h5>
          <div class="error-list">
            {#each service.errors.slice(0, 3) as error}
              <div class="error-item">
                <span class="error-time">{formatLastUpdate(error.timestamp)}</span>
                <span class="error-message">{error.message}</span>
              </div>
            {/each}
            {#if service.errors.length > 3}
              <div class="more-errors">
                +{service.errors.length - 3} more errors
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .service-health-indicator {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    transition: all var(--motion-fast) var(--ease-snappy);
    cursor: pointer;
    user-select: none;
  }
  
  .service-health-indicator:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  
  .service-health-indicator:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .service-health-indicator.has-errors {
    border-color: var(--color-danger);
    background: var(--bg-danger-subtle);
  }
  
  .service-health-indicator.has-errors:hover {
    background: var(--bg-danger);
  }
  
  /* Compact Layout */
  .compact-layout {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .compact-layout .service-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  /* Full Layout */
  .full-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .service-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .service-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .service-details h4 {
    margin: 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .service-details p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .service-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .refresh-button {
    background: transparent;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    padding: var(--space-1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .refresh-button:hover {
    background: var(--bg-tertiary);
    border-color: var(--border-hover);
  }
  
  .service-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }
  
  .service-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: var(--space-2);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--border-subtle);
  }
  
  .metric {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .metric-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .metric-value {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
  }
  
  .error-details {
    padding: var(--space-2) 0;
    border-top: 1px solid var(--border-subtle);
  }
  
  .error-details h5 {
    margin: 0 0 var(--space-2) 0;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .error-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .error-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    border-left: 3px solid var(--color-danger);
  }
  
  .error-time {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }
  
  .error-message {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
  
  .more-errors {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    text-align: center;
    padding: var(--space-2);
    font-style: italic;
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .service-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
    
    .service-actions {
      align-self: stretch;
      justify-content: space-between;
    }
    
    .service-metrics {
      grid-template-columns: 1fr;
    }
  }
</style>
