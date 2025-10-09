<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { workspaceStore } from '../../stores/workspaceStore.js';
  import { performanceStore } from '../../stores/performanceStore.js';
  import { Button } from '../atoms/Button.svelte';
  import { Badge } from '../atoms/Badge.svelte';
  import { Icon } from '../atoms/Icon.svelte';
  import { Select } from '../atoms/Select.svelte';
  import { Input } from '../atoms/Input.svelte';
  import { Toggle } from '../atoms/Toggle.svelte';
  
  const dispatch = createEventDispatcher();
  
  let analyticsData = {
    workspace: {},
    performance: {},
    usage: {},
    insights: []
  };
  
  let selectedTimeRange = '7d';
  let selectedMetric = 'all';
  let showDetailedView = false;
  let autoRefresh = true;
  let refreshInterval = null;
  
  // Time range options
  const timeRanges = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'all', label: 'All Time' }
  ];
  
  // Metric categories
  const metricCategories = [
    { value: 'all', label: 'All Metrics' },
    { value: 'performance', label: 'Performance' },
    { value: 'usage', label: 'Usage Patterns' },
    { value: 'workspace', label: 'Workspace Stats' }
  ];
  
  onMount(() => {
    loadAnalyticsData();
    if (autoRefresh) {
      startAutoRefresh();
    }
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  function loadAnalyticsData() {
    analyticsData.workspace = calculateWorkspaceAnalytics();
    analyticsData.performance = calculatePerformanceAnalytics();
    analyticsData.usage = calculateUsageAnalytics();
    analyticsData.insights = generateInsights();
  }
  
  function calculateWorkspaceAnalytics() {
    let workspace;
    workspaceStore.subscribe(w => workspace = w)();
    
    if (!workspace) return {};
    
    const canvases = workspace.layout?.canvases || [];
    const symbols = canvases.map(c => c.symbol);
    const uniqueSymbols = [...new Set(symbols)];
    
    // Symbol distribution
    const symbolDistribution = {};
    symbols.forEach(symbol => {
      symbolDistribution[symbol] = (symbolDistribution[symbol] || 0) + 1;
    });
    
    // Indicator usage
    const indicatorUsage = {};
    canvases.forEach(canvas => {
      (canvas.indicators || []).forEach(indicator => {
        indicatorUsage[indicator] = (indicatorUsage[indicator] || 0) + 1;
      });
    });
    
    // Canvas size distribution
    const sizeDistribution = canvases.map(canvas => ({
      width: canvas.size?.width || 0,
      height: canvas.size?.height || 0,
      area: (canvas.size?.width || 0) * (canvas.size?.height || 0)
    }));
    
    return {
      totalCanvases: canvases.length,
      uniqueSymbols: uniqueSymbols.length,
      symbolDistribution,
      indicatorUsage,
      sizeDistribution,
      averageCanvasSize: sizeDistribution.length > 0 
        ? sizeDistribution.reduce((sum, s) => sum + s.area, 0) / sizeDistribution.length 
        : 0,
      workspaceAge: calculateWorkspaceAge(workspace.createdAt),
      lastModified: workspace.updatedAt
    };
  }
  
  function calculatePerformanceAnalytics() {
    let performance;
    performanceStore.subscribe(p => performance = p)();
    
    if (!performance) return {};
    
    const now = Date.now();
    const timeRangeMs = getTimeRangeMs(selectedTimeRange);
    
    // Filter performance data by time range
    const filteredMetrics = performance.metrics?.filter(metric => 
      (now - metric.timestamp) <= timeRangeMs
    ) || [];
    
    // Calculate averages
    const avgFPS = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + m.fps, 0) / filteredMetrics.length
      : 0;
    
    const avgRenderTime = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + m.renderTime, 0) / filteredMetrics.length
      : 0;
    
    const avgMemoryUsage = filteredMetrics.length > 0
      ? filteredMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / filteredMetrics.length
      : 0;
    
    // Performance trends
    const trends = calculatePerformanceTrends(filteredMetrics);
    
    return {
      averageFPS: avgFPS.toFixed(1),
      averageRenderTime: avgRenderTime.toFixed(2),
      averageMemoryUsage: (avgMemoryUsage / 1024 / 1024).toFixed(1), // MB
      totalDataPoints: filteredMetrics.length,
      trends,
      performanceScore: calculatePerformanceScore(avgFPS, avgRenderTime, avgMemoryUsage)
    };
  }
  
  function calculateUsageAnalytics() {
    // Get usage data from localStorage
    const usageData = JSON.parse(localStorage.getItem('neurosense_usage_analytics') || '{}');
    
    const timeRangeMs = getTimeRangeMs(selectedTimeRange);
    const now = Date.now();
    
    // Filter by time range
    const filteredSessions = Object.values(usageData).filter(session =>
      (now - session.startTime) <= timeRangeMs
    );
    
    if (filteredSessions.length === 0) {
      return {
        totalSessions: 0,
        totalDuration: 0,
        averageSessionDuration: 0,
        mostActiveHour: null,
        canvasInteractions: 0,
        indicatorChanges: 0
      };
    }
    
    const totalDuration = filteredSessions.reduce((sum, session) => 
      sum + (session.duration || 0), 0
    );
    
    // Hourly activity
    const hourlyActivity = Array(24).fill(0);
    filteredSessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      hourlyActivity[hour]++;
    });
    
    const mostActiveHour = hourlyActivity.indexOf(Math.max(...hourlyActivity));
    
    // Interaction counts
    const canvasInteractions = filteredSessions.reduce((sum, session) => 
      sum + (session.interactions?.canvas || 0), 0
    );
    
    const indicatorChanges = filteredSessions.reduce((sum, session) => 
      sum + (session.interactions?.indicators || 0), 0
    );
    
    return {
      totalSessions: filteredSessions.length,
      totalDuration: totalDuration,
      averageSessionDuration: totalDuration / filteredSessions.length,
      mostActiveHour,
      canvasInteractions,
      indicatorChanges,
      hourlyActivity
    };
  }
  
  function generateInsights() {
    const insights = [];
    const workspace = analyticsData.workspace;
    const performance = analyticsData.performance;
    const usage = analyticsData.usage;
    
    // Workspace insights
    if (workspace.totalCanvases > 10) {
      insights.push({
        type: 'warning',
        title: 'High Canvas Count',
        description: `You have ${workspace.totalCanvases} canvases. Consider organizing them into multiple workspaces for better performance.`,
        action: 'Organize Workspaces'
      });
    }
    
    if (workspace.uniqueSymbols < workspace.totalCanvases / 2) {
      insights.push({
        type: 'info',
        title: 'Symbol Duplication',
        description: 'Multiple canvases are tracking the same symbols. Consider consolidating or using different timeframes.',
        action: 'Review Canvases'
      });
    }
    
    // Performance insights
    if (performance.averageFPS < 30) {
      insights.push({
        type: 'error',
        title: 'Low Performance',
        description: `Average FPS is ${performance.averageFPS}. Consider reducing canvas count or disabling complex indicators.`,
        action: 'Optimize Performance'
      });
    }
    
    if (performance.averageMemoryUsage > 100) {
      insights.push({
        type: 'warning',
        title: 'High Memory Usage',
        description: `Average memory usage is ${performance.averageMemoryUsage}MB. Monitor for memory leaks.`,
        action: 'Check Memory'
      });
    }
    
    // Usage insights
    if (usage.mostActiveHour !== null) {
      insights.push({
        type: 'success',
        title: 'Peak Activity',
        description: `You're most active at ${usage.mostActiveHour}:00. Consider scheduling important tasks during this time.`,
        action: 'Optimize Schedule'
      });
    }
    
    if (usage.averageSessionDuration > 3600000) { // 1 hour
      insights.push({
        type: 'info',
        title: 'Long Sessions',
        description: 'Your sessions are typically over 1 hour. Remember to take breaks for optimal performance.',
        action: 'Take Breaks'
      });
    }
    
    return insights;
  }
  
  function calculateWorkspaceAge(createdAt) {
    if (!createdAt) return 0;
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24)); // days
  }
  
  function getTimeRangeMs(range) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity
    };
    return ranges[range] || ranges['7d'];
  }
  
  function calculatePerformanceTrends(metrics) {
    if (metrics.length < 2) return { fps: 'stable', renderTime: 'stable', memory: 'stable' };
    
    const half = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, half);
    const secondHalf = metrics.slice(half);
    
    const avgFPSFirst = firstHalf.reduce((sum, m) => sum + m.fps, 0) / firstHalf.length;
    const avgFPSSecond = secondHalf.reduce((sum, m) => sum + m.fps, 0) / secondHalf.length;
    
    const avgRenderFirst = firstHalf.reduce((sum, m) => sum + m.renderTime, 0) / firstHalf.length;
    const avgRenderSecond = secondHalf.reduce((sum, m) => sum + m.renderTime, 0) / secondHalf.length;
    
    const fpsTrend = avgFPSSecond > avgFPSFirst * 1.1 ? 'improving' : 
                    avgFPSSecond < avgFPSFirst * 0.9 ? 'declining' : 'stable';
    
    const renderTrend = avgRenderSecond < avgRenderFirst * 0.9 ? 'improving' : 
                       avgRenderSecond > avgRenderFirst * 1.1 ? 'declining' : 'stable';
    
    return { fps: fpsTrend, renderTime: renderTrend };
  }
  
  function calculatePerformanceScore(fps, renderTime, memoryUsage) {
    let score = 100;
    
    // FPS scoring (60 is ideal)
    if (fps < 30) score -= 40;
    else if (fps < 45) score -= 20;
    else if (fps < 55) score -= 10;
    
    // Render time scoring (lower is better)
    if (renderTime > 20) score -= 30;
    else if (renderTime > 10) score -= 15;
    else if (renderTime > 5) score -= 5;
    
    // Memory usage scoring (lower is better)
    if (memoryUsage > 200) score -= 20;
    else if (memoryUsage > 100) score -= 10;
    else if (memoryUsage > 50) score -= 5;
    
    return Math.max(0, score);
  }
  
  function startAutoRefresh() {
    refreshInterval = setInterval(() => {
      loadAnalyticsData();
    }, 30000); // Refresh every 30 seconds
  }
  
  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
  
  function toggleAutoRefresh() {
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }
  
  function exportAnalytics() {
    const exportData = {
      timestamp: new Date().toISOString(),
      timeRange: selectedTimeRange,
      analytics: analyticsData
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `neurosense_analytics_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  function getInsightIcon(type) {
    switch (type) {
      case 'error': return 'alert-circle';
      case 'warning': return 'alert-triangle';
      case 'success': return 'check-circle';
      default: return 'info';
    }
  }
  
  function getInsightVariant(type) {
    switch (type) {
      case 'error': return 'danger';
      case 'warning': return 'warning';
      case 'success': return 'success';
      default: return 'secondary';
    }
  }
  
  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
</script>

<div class="workspace-analytics">
  <div class="analytics-header">
    <h2>Workspace Analytics & Insights</h2>
    <div class="analytics-controls">
      <Select
        options={timeRanges}
        bind:value={selectedTimeRange}
        onChange={loadAnalyticsData}
      />
      <Select
        options={metricCategories}
        bind:value={selectedMetric}
      />
      <div class="toggle-refresh">
        <Toggle bind:checked={autoRefresh} onChange={toggleAutoRefresh} />
        <label>Auto Refresh</label>
      </div>
      <Button variant="outline" onClick={exportAnalytics}>
        <Icon name="download" />
        Export
      </Button>
      <Button variant="ghost" onClick={() => showDetailedView = !showDetailedView}>
        <Icon name={showDetailedView ? 'minimize-2' : 'maximize-2'} />
        {showDetailedView ? 'Simple' : 'Detailed'}
      </Button>
    </div>
  </div>
  
  <div class="analytics-content">
    <!-- Performance Overview -->
    <div class="analytics-section">
      <h3>Performance Overview</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <Icon name="activity" />
            <span>Average FPS</span>
          </div>
          <div class="metric-value">{analyticsData.performance.averageFPS || '0'}</div>
          <div class="metric-trend trend-{analyticsData.performance.trends?.fps || 'stable'}>
            <Icon name="trending-{analyticsData.performance.trends?.fps || 'up'}" />
            {analyticsData.performance.trends?.fps || 'stable'}
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-header">
            <Icon name="clock" />
            <span>Avg Render Time</span>
          </div>
          <div class="metric-value">{analyticsData.performance.averageRenderTime || '0'}ms</div>
          <div class="metric-trend trend-{analyticsData.performance.trends?.renderTime || 'stable'}>
            <Icon name="trending-{analyticsData.performance.trends?.renderTime || 'up'}" />
            {analyticsData.performance.trends?.renderTime || 'stable'}
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-header">
            <Icon name="cpu" />
            <span>Memory Usage</span>
          </div>
          <div class="metric-value">{analyticsData.performance.averageMemoryUsage || '0'}MB</div>
          <div class="metric-score">
            Performance Score: {analyticsData.performance.performanceScore || 0}/100
          </div>
        </div>
        
        <div class="metric-card">
          <div class="metric-header">
            <Icon name="database" />
            <span>Data Points</span>
          </div>
          <div class="metric-value">{analyticsData.performance.totalDataPoints || 0}</div>
          <div class="metric-subtitle">Last {selectedTimeRange}</div>
        </div>
      </div>
    </div>
    
    <!-- Workspace Statistics -->
    <div class="analytics-section">
      <h3>Workspace Statistics</h3>
      <div class="workspace-stats">
        <div class="stat-item">
          <div class="stat-label">Total Canvases</div>
          <div class="stat-value">{analyticsData.workspace.totalCanvases || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Unique Symbols</div>
          <div class="stat-value">{analyticsData.workspace.uniqueSymbols || 0}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Workspace Age</div>
          <div class="stat-value">{analyticsData.workspace.workspaceAge || 0} days</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Avg Canvas Size</div>
          <div class="stat-value">{Math.round(analyticsData.workspace.averageCanvasSize || 0)}px²</div>
        </div>
      </div>
      
      {showDetailedView && (
        <div class="detailed-stats">
          <div class="stat-chart">
            <h4>Symbol Distribution</h4>
            <div class="chart-content">
              {#each Object.entries(analyticsData.workspace.symbolDistribution || {}) as [symbol, count]}
                <div class="chart-bar">
                  <span class="chart-label">{symbol}</span>
                  <div class="chart-bar-fill" style="width: {count * 20}%"></div>
                  <span class="chart-value">{count}</span>
                </div>
              {/each}
            </div>
          </div>
          
          <div class="stat-chart">
            <h4>Indicator Usage</h4>
            <div class="chart-content">
              {#each Object.entries(analyticsData.workspace.indicatorUsage || {}) as [indicator, count]}
                <div class="chart-bar">
                  <span class="chart-label">{indicator}</span>
                  <div class="chart-bar-fill" style="width: {count * 20}%"></div>
                  <span class="chart-value">{count}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      )}
    </div>
    
    <!-- Usage Patterns -->
    <div class="analytics-section">
      <h3>Usage Patterns</h3>
      <div class="usage-stats">
        <div class="usage-metric">
          <div class="usage-label">Total Sessions</div>
          <div class="usage-value">{analyticsData.usage.totalSessions || 0}</div>
        </div>
        <div class="usage-metric">
          <div class="usage-label">Avg Session Duration</div>
          <div class="usage-value">{formatDuration(analyticsData.usage.averageSessionDuration || 0)}</div>
        </div>
        <div class="usage-metric">
          <div class="usage-label">Most Active Hour</div>
          <div class="usage-value">{analyticsData.usage.mostActiveHour || 'N/A'}:00</div>
        </div>
        <div class="usage-metric">
          <div class="usage-label">Canvas Interactions</div>
          <div class="usage-value">{analyticsData.usage.canvasInteractions || 0}</div>
        </div>
      </div>
    </div>
    
    <!-- Insights -->
    <div class="analytics-section">
      <h3>Insights & Recommendations</h3>
      <div class="insights-list">
        {#each analyticsData.insights as insight}
          <div class="insight-item" class:insight-{insight.type}>
            <div class="insight-header">
              <Icon name={getInsightIcon(insight.type)} />
              <Badge variant={getInsightVariant(insight.type)} size="sm">
                {insight.type}
              </Badge>
              <strong>{insight.title}</strong>
            </div>
            <p class="insight-description">{insight.description}</p>
            {insight.action && (
              <Button size="sm" variant="outline">
                {insight.action}
              </Button>
            )}
          </div>
        {/each}
        
        {#if analyticsData.insights.length === 0}
          <div class="no-insights">
            <Icon name="check-circle" size="lg" />
            <p>No insights available</p>
            <p class="no-insights-description">Your workspace is performing optimally!</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .workspace-analytics {
    padding: var(--space-6);
  }
  
  .analytics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
  }
  
  .analytics-header h2 {
    margin: 0;
    color: var(--text-primary);
  }
  
  .analytics-controls {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }
  
  .toggle-refresh {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .analytics-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  
  .analytics-section {
    background: var(--bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }
  
  .analytics-section h3 {
    margin: 0 0 var(--space-4) 0;
    color: var(--text-primary);
  }
  
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-4);
  }
  
  .metric-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .metric-card:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-sm);
  }
  
  .metric-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
  
  .metric-value {
    font-size: var(--font-size-2xl);
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }
  
  .metric-trend {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-sm);
  }
  
  .metric-trend.trend-improving {
    color: var(--color-success);
  }
  
  .metric-trend.trend-declining {
    color: var(--color-danger);
  }
  
  .metric-trend.trend-stable {
    color: var(--text-secondary);
  }
  
  .metric-score {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .metric-subtitle {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .workspace-stats,
  .usage-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-4);
  }
  
  .stat-item,
  .usage-metric {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    text-align: center;
  }
  
  .stat-label,
  .usage-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-1);
  }
  
  .stat-value,
  .usage-value {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .detailed-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-top: var(--space-4);
  }
  
  .stat-chart h4 {
    margin: 0 0 var(--space-3) 0;
    color: var(--text-primary);
  }
  
  .chart-content {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-3);
  }
  
  .chart-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  
  .chart-label {
    min-width: 100px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
  
  .chart-bar-fill {
    height: 20px;
    background: var(--color-focus);
    border-radius: var(--radius-sm);
    min-width: 2px;
    transition: width var(--motion-normal) var(--ease-snappy);
  }
  
  .chart-value {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: 500;
  }
  
  .insights-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .insight-item {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .insight-item:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-sm);
  }
  
  .insight-item.insight-error {
    border-left: 4px solid var(--color-danger);
  }
  
  .insight-item.insight-warning {
    border-left: 4px solid var(--color-warning);
  }
  
  .insight-item.insight-success {
    border-left: 4px solid var(--color-success);
  }
  
  .insight-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  
  .insight-description {
    margin: 0 0 var(--space-3) 0;
    color: var(--text-secondary);
  }
  
  .no-insights {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    text-align: center;
    color: var(--text-secondary);
  }
  
  .no-insights p {
    margin: var(--space-2) 0 0 0;
  }
  
  .no-insights-description {
    font-size: var(--font-size-sm);
    margin-top: var(--space-1) !important;
  }
  
  @media (max-width: 768px) {
    .analytics-header {
      flex-direction: column;
      gap: var(--space-4);
      align-items: stretch;
    }
    
    .analytics-controls {
      flex-wrap: wrap;
      justify-content: center;
    }
    
    .metrics-grid {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    
    .workspace-stats,
    .usage-stats {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .detailed-stats {
      grid-template-columns: 1fr;
    }
  }
</style>
