<script>
  import { createEventDispatcher } from 'svelte';
  import { Badge, Icon, Button } from '../atoms/index.js';
  
  export let metrics = {
    cpu: 0,
    memory: 0,
    network: 0,
    latency: 0,
    throughput: 0,
    errors: 0
  };
  export let thresholds = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    network: { warning: 1000, critical: 5000 }, // ms
    latency: { warning: 100, critical: 500 }, // ms
    throughput: { warning: 100, critical: 50 }, // per second
    errors: { warning: 5, critical: 20 }
  };
  export let compact = false;
  export let showCharts = false;
  export let refreshInterval = 5000; // 5 seconds
  
  const dispatch = createEventDispatcher();
  
  let history = {};
  let maxHistoryLength = 20;
  
  // Initialize history arrays
  $: if (metrics) {
    Object.keys(metrics).forEach(key => {
      if (!history[key]) history[key] = [];
      history[key].push(metrics[key]);
      if (history[key].length > maxHistoryLength) {
        history[key].shift();
      }
    });
  }
  
  function getMetricStatus(metric, value) {
    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';
    
    if (value >= threshold.critical) return 'critical';
    if (value >= threshold.warning) return 'warning';
    return 'healthy';
  }
  
  function getMetricVariant(status) {
    switch (status) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'healthy': return 'success';
      default: return 'muted';
    }
  }
  
  function getMetricIcon(status) {
    switch (status) {
      case 'critical': return 'alert-circle';
      case 'warning': return 'alert-triangle';
      case 'healthy': return 'check-circle';
      default: return 'help-circle';
    }
  }
  
  function formatMetricValue(metric, value) {
    switch (metric) {
      case 'cpu':
      case 'memory':
        return `${value}%`;
      case 'network':
      case 'latency':
        return `${value}ms`;
      case 'throughput':
        return `${value}/s`;
      case 'errors':
        return value.toString();
      default:
        return value.toString();
    }
  }
  
  function getMetricLabel(metric) {
    switch (metric) {
      case 'cpu': return 'CPU Usage';
      case 'memory': return 'Memory Usage';
      case 'network': return 'Network Latency';
      case 'latency': return 'Response Time';
      case 'throughput': return 'Throughput';
      case 'errors': return 'Error Rate';
      default: return metric.charAt(0).toUpperCase() + metric.slice(1);
    }
  }
  
  function getProgressWidth(metric, value) {
    const threshold = thresholds[metric];
    if (!threshold) return 0;
    
    // Scale to 0-100% for progress bar
    if (metric === 'cpu' || metric === 'memory') {
      return Math.min(value, 100);
    }
    
    // For other metrics, scale based on critical threshold
    return Math.min((value / threshold.critical) * 100, 100);
  }
  
  function handleRefresh() {
    dispatch('refresh');
  }
  
  function handleMetricClick(metric) {
    dispatch('metricClick', { metric, value: metrics[metric] });
  }
</script>

<div class="performance-metrics" class:compact>
  <!-- Header -->
  <div class="metrics-header">
    <div class="header-info">
      <Icon name="activity" size="md" />
      <h3>Performance Metrics</h3>
    </div>
    
    <div class="header-actions">
      {#if !compact}
        <Button 
          variant="ghost" 
          size="sm"
          on:click={handleRefresh}
        >
          <Icon name="refresh-cw" size="sm" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          on:click={() => showCharts = !showCharts}
        >
          <Icon name={showCharts ? 'bar-chart-2' : 'line-chart'} size="sm" />
        </Button>
      {/if}
    </div>
  </div>
  
  <!-- Metrics Grid -->
  <div class="metrics-grid" class:compact>
    {#each Object.entries(metrics) as [metric, value]}
      {@const status = getMetricStatus(metric, value)}
      {@const variant = getMetricVariant(status)}
      {@const icon = getMetricIcon(status)}
      
      <div 
        class="metric-item"
        class:compact
        on:click={() => handleMetricClick(metric)}
        role="button"
        tabindex="0"
      >
        <div class="metric-header">
          <span class="metric-label">{getMetricLabel(metric)}</span>
          <Icon name={icon} size="xs" variant={variant} />
        </div>
        
        <div class="metric-value">
          <span class="value">{formatMetricValue(metric, value)}</span>
          <Badge variant={variant} size="xs">{status}</Badge>
        </div>
        
        {#if !compact}
          <div class="metric-progress">
            <div 
              class="progress-bar"
              class:status-warning={status === 'warning'}
              class:status-critical={status === 'critical'}
              style="width: {getProgressWidth(metric, value)}%"
            ></div>
          </div>
          
          <!-- Mini Chart -->
          {#if showCharts && history[metric] && history[metric].length > 1}
            <div class="mini-chart">
              <svg width="100%" height="40" viewBox="0 0 100 40">
                <polyline
                  points={history[metric].map((val, i) => {
                    const x = (i / (history[metric].length - 1)) * 100;
                    const y = 40 - (val / 100) * 40;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
  
  <!-- Summary -->
  {#if !compact}
    {@const criticalCount = Object.entries(metrics).filter(([m, v]) => getMetricStatus(m, v) === 'critical').length}
    {@const warningCount = Object.entries(metrics).filter(([m, v]) => getMetricStatus(m, v) === 'warning').length}
    
    <div class="metrics-summary">
      <div class="summary-item">
        <span class="summary-label">Overall Status:</span>
        
        {#if criticalCount > 0}
          <Badge variant="danger">{criticalCount} Critical</Badge>
        {:else if warningCount > 0}
          <Badge variant="warning">{warningCount} Warnings</Badge>
        {:else}
          <Badge variant="success">All Healthy</Badge>
        {/if}
      </div>
      
      <div class="summary-item">
        <span class="summary-label">Last Update:</span>
        <span class="update-time">{new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .performance-metrics {
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .performance-metrics.compact {
    padding: var(--space-2);
    gap: var(--space-2);
  }
  
  .metrics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .header-info h3 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .header-actions {
    display: flex;
    gap: var(--space-1);
  }
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  
  .metrics-grid.compact {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-2);
  }
  
  .metric-item {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .metric-item:hover {
    background: var(--bg-primary);
    border-color: var(--border-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
  
  .metric-item:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .metric-item.compact {
    padding: var(--space-2);
    gap: var(--space-1);
  }
  
  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .metric-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
  }
  
  .metric-value {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .metric-value .value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
  }
  
  .metric-progress {
    width: 100%;
    height: 4px;
    background: var(--bg-primary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  
  .progress-bar {
    height: 100%;
    background: var(--color-success);
    transition: width var(--motion-normal) var(--ease-snappy);
    border-radius: var(--radius-full);
  }
  
  .progress-bar.status-warning {
    background: var(--color-warning);
  }
  
  .progress-bar.status-critical {
    background: var(--color-danger);
  }
  
  .mini-chart {
    margin-top: var(--space-2);
    height: 40px;
    background: var(--bg-primary);
    border-radius: var(--radius-sm);
    padding: var(--space-1);
  }
  
  .mini-chart svg {
    color: var(--color-primary);
  }
  
  .metrics-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-subtle);
    font-size: var(--font-size-sm);
  }
  
  .summary-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .summary-label {
    color: var(--text-secondary);
    font-weight: var(--font-weight-medium);
  }
  
  .update-time {
    color: var(--text-tertiary);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }
    
    .metrics-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
    
    .metrics-summary {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
  }
  
  /* Compact Mode Responsive */
  @media (max-width: 480px) {
    .performance-metrics.compact {
      padding: var(--space-1);
    }
    
    .metrics-grid.compact {
      grid-template-columns: 1fr;
      gap: var(--space-1);
    }
    
    .metric-item.compact {
      padding: var(--space-1);
    }
    
    .metric-value .value {
      font-size: var(--font-size-base);
    }
  }
</style>
