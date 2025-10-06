<script>
  import { createEventDispatcher } from 'svelte';
  
  // Component props
  export let symbol = '';
  export let name = '';
  export let price = null;
  export let change = null;
  export let changePercent = null;
  export let status = 'active'; // 'active', 'inactive', 'closed', 'error'
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'compact', 'detailed'
  export let showPrice = true;
  export let showChange = true;
  export let clickable = false;
  export let selected = false;
  export let favorite = false;
  export let marketSession = 'open'; // 'open', 'closed', 'pre', 'post'
  
  const dispatch = createEventDispatcher();
  
  // Status configurations
  const statusConfig = {
    active: {
      color: 'success',
      label: 'Active',
      description: 'Market is open and trading'
    },
    inactive: {
      color: 'neutral',
      label: 'Inactive',
      description: 'Symbol is not currently available'
    },
    closed: {
      color: 'warning',
      label: 'Closed',
      description: 'Market is closed'
    },
    error: {
      color: 'danger',
      label: 'Error',
      description: 'Data unavailable'
    }
  };
  
  // Market session configurations
  const sessionConfig = {
    open: {
      color: 'success',
      label: 'Open',
      icon: '🟢'
    },
    closed: {
      color: 'neutral',
      label: 'Closed',
      icon: '🔴'
    },
    pre: {
      color: 'info',
      label: 'Pre-Market',
      icon: '🟡'
    },
    post: {
      color: 'info',
      label: 'After Hours',
      icon: '🟠'
    }
  };
  
  // Reactive calculations
  $: currentStatus = statusConfig[status] || statusConfig.active;
  $: currentSession = sessionConfig[marketSession] || sessionConfig.open;
  $: isPositive = change > 0;
  $: isNegative = change < 0;
  $: isNeutral = change === 0;
  $: changeColor = isPositive ? 'success' : isNegative ? 'danger' : 'neutral';
  $: formattedPrice = price !== null ? formatPrice(price) : '--';
  $: formattedChange = change !== null ? formatChange(change) : '--';
  $: formattedChangePercent = changePercent !== null ? formatPercent(changePercent) : '--';
  $: ariaLabel = `${symbol} ${name || ''} ${formattedPrice} ${formattedChange} ${formattedChangePercent} ${currentStatus.label} ${currentSession.label}`;
  
  // Format price based on typical forex precision
  function formatPrice(value) {
    if (typeof value !== 'number') return '--';
    return value.toFixed(5);
  }
  
  // Format change with sign
  function formatChange(value) {
    if (typeof value !== 'number') return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(5)}`;
  }
  
  // Format percentage with sign
  function formatPercent(value) {
    if (typeof value !== 'number') return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
  
  // Handle click events
  function handleClick() {
    if (clickable) {
      dispatch('click', { symbol, name, price, change, changePercent });
    }
  }
  
  // Handle keyboard events
  function handleKeydown(event) {
    if (clickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  }
  
  // Handle favorite toggle
  function handleFavoriteToggle(event) {
    event.stopPropagation();
    dispatch('favoriteToggle', { symbol, favorite: !favorite });
  }
  
  // Calculate CSS classes
  $: badgeClasses = [
    'symbol-badge',
    `symbol-badge--${size}`,
    `symbol-badge--${variant}`,
    `symbol-badge--${status}`,
    `symbol-badge--${marketSession}`,
    clickable && 'symbol-badge--clickable',
    selected && 'symbol-badge--selected',
    favorite && 'symbol-badge--favorite'
  ].filter(Boolean).join(' ');
</script>

<div 
  class={badgeClasses}
  class:clickable
  role={clickable ? 'button' : 'status'}
  aria-label={ariaLabel}
  tabindex={clickable ? 0 : undefined}
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <!-- Symbol info -->
  <div class="symbol-badge__symbol-info">
    <div class="symbol-badge__symbol">
      {symbol}
      {#if favorite}
        <button 
          class="symbol-badge__favorite"
          type="button"
          aria-label="Remove from favorites"
          on:click={handleFavoriteToggle}
        >
          ⭐
        </button>
      {:else if clickable}
        <button 
          class="symbol-badge__favorite symbol-badge__favorite--empty"
          type="button"
          aria-label="Add to favorites"
          on:click={handleFavoriteToggle}
        >
          ☆
        </button>
      {/if}
    </div>
    {#if name && variant === 'detailed'}
      <div class="symbol-badge__name">{name}</div>
    {/if}
  </div>
  
  <!-- Market session indicator -->
  <div class="symbol-badge__session" title={currentSession.label}>
    {currentSession.icon}
  </div>
  
  <!-- Price information -->
  {#if showPrice}
    <div class="symbol-badge__price-info">
      <div class="symbol-badge__price">{formattedPrice}</div>
      
      {#if showChange && change !== null}
        <div class="symbol-badge__change symbol-badge__change--{changeColor}">
          {formattedChange}
          {#if changePercent !== null}
            <span class="symbol-badge__change-percent">({formattedChangePercent})</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Status indicator -->
  <div class="symbol-badge__status" title={currentStatus.description}>
    <div class="symbol-badge__status-dot"></div>
  </div>
</div>

<style>
  .symbol-badge {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    transition: all var(--motion-fast) var(--ease-snappy);
    position: relative;
    min-width: 0;
  }
  
  .symbol-badge--clickable {
    cursor: pointer;
  }
  
  .symbol-badge--clickable:hover {
    background: var(--bg-elevated);
    border-color: var(--color-focus);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .symbol-badge--clickable:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .symbol-badge--selected {
    background: var(--color-focus-subtle);
    border-color: var(--color-focus);
  }
  
  /* Size variants */
  .symbol-badge--sm {
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-xs);
  }
  
  .symbol-badge--lg {
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    font-size: var(--text-base);
  }
  
  /* Variant styles */
  .symbol-badge--compact {
    padding: var(--space-1) var(--space-2);
    gap: var(--space-1);
  }
  
  .symbol-badge--compact .symbol-badge__name {
    display: none;
  }
  
  .symbol-badge--detailed {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
  
  .symbol-badge__symbol-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  
  .symbol-badge__symbol {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }
  
  .symbol-badge__name {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .symbol-badge__favorite {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    font-size: inherit;
    line-height: 1;
    transition: transform var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-badge__favorite:hover {
    transform: scale(1.2);
  }
  
  .symbol-badge__favorite--empty {
    opacity: 0.3;
  }
  
  .symbol-badge__favorite--empty:hover {
    opacity: 1;
  }
  
  .symbol-badge__session {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--text-sm);
    opacity: 0.8;
  }
  
  .symbol-badge__price-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    text-align: right;
    min-width: 0;
  }
  
  .symbol-badge__price {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
  
  .symbol-badge__change {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    font-family: var(--font-mono);
  }
  
  .symbol-badge__change--success {
    color: var(--color-success);
  }
  
  .symbol-badge__change--danger {
    color: var(--color-danger);
  }
  
  .symbol-badge__change--neutral {
    color: var(--text-secondary);
  }
  
  .symbol-badge__change-percent {
    opacity: 0.8;
  }
  
  .symbol-badge__status {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .symbol-badge__status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
  }
  
  .symbol-badge--inactive .symbol-badge__status-dot {
    background: var(--color-neutral);
  }
  
  .symbol-badge--closed .symbol-badge__status-dot {
    background: var(--color-warning);
  }
  
  .symbol-badge--error .symbol-badge__status-dot {
    background: var(--color-danger);
  }
  
  /* Market session styles */
  .symbol-badge--closed {
    opacity: 0.7;
  }
  
  .symbol-badge--closed .symbol-badge__price {
    color: var(--text-secondary);
  }
  
  /* Responsive design */
  @media (max-width: 480px) {
    .symbol-badge {
      padding: var(--space-1) var(--space-2);
      gap: var(--space-1);
    }
    
    .symbol-badge__name {
      display: none;
    }
    
    .symbol-badge__change-percent {
      display: none;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .symbol-badge {
      border-width: 2px;
    }
    
    .symbol-badge__status-dot {
      border: 1px solid currentColor;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .symbol-badge,
    .symbol-badge__favorite {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .symbol-badge {
      background: white !important;
      border: 1px solid black !important;
      color: black !important;
    }
    
    .symbol-badge__favorite {
      display: none !important;
    }
    
    .symbol-badge__session {
      display: none !important;
    }
  }
</style>
