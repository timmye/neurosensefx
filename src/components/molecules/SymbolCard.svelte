<script>
  import { createEventDispatcher } from 'svelte';
  import { SymbolBadge } from '../atoms/index.js';
  import { Button } from '../atoms/index.js';
  
  // Component props
  export let symbol = '';
  export let name = '';
  export let description = '';
  export let category = 'forex';
  export let price = null;
  export let change = null;
  export let changePercent = null;
  export let volume = null;
  export let marketCap = null;
  export let status = 'active';
  export let marketSession = 'open';
  export let favorite = false;
  export let recent = false;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'compact', 'detailed'
  export let selectable = false;
  export let selected = false;
  export let showActions = true;
  export let showMetrics = true;
  export let showDescription = true;
  
  const dispatch = createEventDispatcher();
  
  // Category configurations
  const categoryConfig = {
    forex: {
      label: 'Forex',
      icon: '💱',
      color: 'info'
    },
    commodities: {
      label: 'Commodities',
      icon: '🛢️',
      color: 'warning'
    },
    indices: {
      label: 'Indices',
      icon: '📊',
      color: 'success'
    },
    crypto: {
      label: 'Crypto',
      icon: '₿',
      color: 'primary'
    },
    stocks: {
      label: 'Stocks',
      icon: '📈',
      color: 'success'
    }
  };
  
  // Reactive calculations
  $: currentCategory = categoryConfig[category] || categoryConfig.forex;
  $: isPositive = change > 0;
  $: isNegative = change < 0;
  $: isNeutral = change === 0;
  $: changeColor = isPositive ? 'success' : isNegative ? 'danger' : 'neutral';
  $: formattedVolume = volume !== null ? formatVolume(volume) : '--';
  $: formattedMarketCap = marketCap !== null ? formatMarketCap(marketCap) : '--';
  $: hasDescription = description && description.trim() !== '';
  
  // Format volume with appropriate units
  function formatVolume(value) {
    if (typeof value !== 'number') return '--';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  }
  
  // Format market cap with appropriate units
  function formatMarketCap(value) {
    if (typeof value !== 'number') return '--';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }
  
  // Handle symbol selection
  function handleSelect() {
    if (selectable) {
      selected = !selected;
      dispatch('select', { symbol, selected });
    }
  }
  
  // Handle favorite toggle
  function handleFavoriteToggle(event) {
    event.stopPropagation();
    favorite = !favorite;
    dispatch('favoriteToggle', { symbol, favorite });
  }
  
  // Handle subscribe action
  function handleSubscribe(event) {
    event.stopPropagation();
    dispatch('subscribe', { symbol, name, price });
  }
  
  // Handle compare action
  function handleCompare(event) {
    event.stopPropagation();
    dispatch('compare', { symbol, name, price });
  }
  
  // Handle details view
  function handleDetails(event) {
    event.stopPropagation();
    dispatch('details', { symbol, name, category });
  }
  
  // Calculate CSS classes
  $: cardClasses = [
    'symbol-card',
    `symbol-card--${size}`,
    `symbol-card--${variant}`,
    `symbol-card--${category}`,
    selectable && 'symbol-card--selectable',
    selected && 'symbol-card--selected',
    favorite && 'symbol-card--favorite',
    recent && 'symbol-card--recent'
  ].filter(Boolean).join(' ');
</script>

<div 
  class={cardClasses}
  class:selectable
  role={selectable ? 'button' : 'article'}
  tabindex={selectable ? 0 : undefined}
  on:click={handleSelect}
  on:keydown={(e) => selectable && (e.key === 'Enter' || e.key === ' ') && handleSelect()}
>
  <!-- Card header with symbol badge -->
  <div class="symbol-card__header">
    <SymbolBadge
      {symbol}
      {name}
      {price}
      {change}
      {changePercent}
      {status}
      {marketSession}
      {favorite}
      variant="compact"
      size={size}
      clickable={false}
      on:favoriteToggle={handleFavoriteToggle}
    />
    
    <!-- Category indicator -->
    <div class="symbol-card__category" title={currentCategory.label}>
      <span class="symbol-card__category-icon">{currentCategory.icon}</span>
    </div>
  </div>
  
  <!-- Card content -->
  <div class="symbol-card__content">
    <!-- Description -->
    {#if showDescription && hasDescription}
      <div class="symbol-card__description">
        {description}
      </div>
    {/if}
    
    <!-- Metrics -->
    {#if showMetrics}
      <div class="symbol-card__metrics">
        {#if volume !== null}
          <div class="symbol-card__metric">
            <span class="symbol-card__metric-label">Volume</span>
            <span class="symbol-card__metric-value">{formattedVolume}</span>
          </div>
        {/if}
        
        {#if marketCap !== null}
          <div class="symbol-card__metric">
            <span class="symbol-card__metric-label">Market Cap</span>
            <span class="symbol-card__metric-value">{formattedMarketCap}</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
  
  <!-- Card actions -->
  {#if showActions}
    <div class="symbol-card__actions">
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubscribe}
      >
        Subscribe
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCompare}
      >
        Compare
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDetails}
      >
        Details
      </Button>
    </div>
  {/if}
  
  <!-- Recent indicator -->
  {#if recent}
    <div class="symbol-card__recent">
      <span class="symbol-card__recent-badge">Recent</span>
    </div>
  {/if}
</div>

<style>
  .symbol-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    font-family: var(--font-sans);
    transition: all var(--motion-fast) var(--ease-snappy);
    position: relative;
    min-width: 0;
  }
  
  .symbol-card--selectable {
    cursor: pointer;
  }
  
  .symbol-card--selectable:hover {
    background: var(--bg-elevated);
    border-color: var(--color-focus);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .symbol-card--selectable:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .symbol-card--selected {
    background: var(--color-focus-subtle);
    border-color: var(--color-focus);
  }
  
  /* Size variants */
  .symbol-card--sm {
    gap: var(--space-2);
    padding: var(--space-3);
  }
  
  .symbol-card--lg {
    gap: var(--space-4);
    padding: var(--space-5);
  }
  
  /* Variant styles */
  .symbol-card--compact {
    gap: var(--space-2);
    padding: var(--space-3);
  }
  
  .symbol-card--compact .symbol-card__description {
    display: none;
  }
  
  .symbol-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  
  .symbol-card__category {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    font-size: var(--text-lg);
  }
  
  .symbol-card__category-icon {
    line-height: 1;
  }
  
  .symbol-card__content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
    min-width: 0;
  }
  
  .symbol-card__description {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .symbol-card__metrics {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  
  .symbol-card__metric {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }
  
  .symbol-card__metric-label {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .symbol-card__metric-value {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
  
  .symbol-card__actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  
  .symbol-card__recent {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
  }
  
  .symbol-card__recent-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    background: var(--color-info);
    color: white;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    border-radius: var(--radius-full);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  /* Category-specific styles */
  .symbol-card--forex {
    border-left: 4px solid var(--color-info);
  }
  
  .symbol-card--commodities {
    border-left: 4px solid var(--color-warning);
  }
  
  .symbol-card--indices {
    border-left: 4px solid var(--color-success);
  }
  
  .symbol-card--crypto {
    border-left: 4px solid var(--color-primary);
  }
  
  .symbol-card--stocks {
    border-left: 4px solid var(--color-success);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .symbol-card {
      padding: var(--space-3);
      gap: var(--space-2);
    }
    
    .symbol-card__metrics {
      gap: var(--space-3);
    }
    
    .symbol-card__actions {
      flex-direction: column;
    }
    
    .symbol-card__actions button {
      width: 100%;
    }
  }
  
  @media (max-width: 480px) {
    .symbol-card__description {
      -webkit-line-clamp: 1;
    }
    
    .symbol-card__metrics {
      flex-direction: column;
      gap: var(--space-2);
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .symbol-card {
      border-width: 2px;
    }
    
    .symbol-card__category {
      border: 1px solid var(--border-default);
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .symbol-card {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .symbol-card {
      background: white !important;
      border: 1px solid black !important;
      color: black !important;
      break-inside: avoid;
    }
    
    .symbol-card__actions {
      display: none !important;
    }
    
    .symbol-card__recent {
      display: none !important;
    }
  }
</style>
