<script>
  import { createEventDispatcher } from 'svelte';
  import { Badge } from '../atoms/index.js';
  
  // Component props
  export let category = 'forex';
  export let label = '';
  export let icon = '';
  export let description = '';
  export let symbolCount = 0;
  export let activeCount = 0;
  export let selected = false;
  export let expanded = false;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'compact', 'detailed'
  export let showCounts = true;
  export let showDescription = true;
  export let clickable = true;
  export let collapsible = false;
  
  const dispatch = createEventDispatcher();
  
  // Category configurations
  const categoryConfig = {
    forex: {
      label: 'Forex',
      icon: '💱',
      description: 'Foreign exchange currency pairs',
      color: 'info',
      bgColor: 'var(--color-info-subtle)',
      borderColor: 'var(--color-info)'
    },
    commodities: {
      label: 'Commodities',
      icon: '🛢️',
      description: 'Physical commodities and raw materials',
      color: 'warning',
      bgColor: 'var(--color-warning-subtle)',
      borderColor: 'var(--color-warning)'
    },
    indices: {
      label: 'Indices',
      icon: '📊',
      description: 'Stock market indices and benchmarks',
      color: 'success',
      bgColor: 'var(--color-success-subtle)',
      borderColor: 'var(--color-success)'
    },
    crypto: {
      label: 'Crypto',
      icon: '₿',
      description: 'Cryptocurrencies and digital assets',
      color: 'primary',
      bgColor: 'var(--color-primary-subtle)',
      borderColor: 'var(--color-primary)'
    },
    stocks: {
      label: 'Stocks',
      icon: '📈',
      description: 'Individual company stocks',
      color: 'success',
      bgColor: 'var(--color-success-subtle)',
      borderColor: 'var(--color-success)'
    }
  };
  
  // Reactive calculations
  $: currentConfig = categoryConfig[category] || categoryConfig.forex;
  $: displayLabel = label || currentConfig.label;
  $: displayIcon = icon || currentConfig.icon;
  $: displayDescription = description || currentConfig.description;
  $: isActive = activeCount > 0;
  $: activePercentage = symbolCount > 0 ? (activeCount / symbolCount) * 100 : 0;
  $: hasDescription = displayDescription && displayDescription.trim() !== '';
  
  // Handle category selection
  function handleSelect() {
    if (clickable) {
      selected = !selected;
      dispatch('select', { category, selected });
    }
  }
  
  // Handle expand/collapse
  function handleToggleExpand(event) {
    if (collapsible) {
      event.stopPropagation();
      expanded = !expanded;
      dispatch('toggleExpand', { category, expanded });
    }
  }
  
  // Handle keyboard events
  function handleKeydown(event) {
    if (clickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleSelect();
    }
  }
  
  // Calculate CSS classes
  $: categoryClasses = [
    'symbol-category',
    `symbol-category--${category}`,
    `symbol-category--${size}`,
    `symbol-category--${variant}`,
    clickable && 'symbol-category--clickable',
    selected && 'symbol-category--selected',
    expanded && 'symbol-category--expanded',
    isActive && 'symbol-category--active'
  ].filter(Boolean).join(' ');
  
  $: iconClasses = [
    'symbol-category__icon',
    `symbol-category__icon--${size}`
  ].filter(Boolean).join(' ');
  
  $: contentClasses = [
    'symbol-category__content',
    `symbol-category__content--${variant}`
  ].filter(Boolean).join(' ');
</script>

<div 
  class={categoryClasses}
  class:clickable
  role={clickable ? 'button' : 'region'}
  tabindex={clickable ? 0 : undefined}
  aria-label={`${displayLabel} category${symbolCount > 0 ? ` with ${symbolCount} symbols` : ''}`}
  on:click={handleSelect}
  on:keydown={handleKeydown}
>
  <!-- Category header -->
  <div class="symbol-category__header">
    <!-- Icon -->
    <div class={iconClasses}>
      {displayIcon}
    </div>
    
    <!-- Content -->
    <div class={contentClasses}>
      <div class="symbol-category__title">
        <span class="symbol-category__label">{displayLabel}</span>
        
        {#if collapsible}
          <button 
            class="symbol-category__toggle"
            type="button"
            aria-label={expanded ? 'Collapse category' : 'Expand category'}
            on:click={handleToggleExpand}
          >
            {expanded ? '▼' : '▶'}
          </button>
        {/if}
      </div>
      
      {#if showDescription && hasDescription && variant === 'detailed'}
        <div class="symbol-category__description">
          {displayDescription}
        </div>
      {/if}
      
      {#if showCounts}
        <div class="symbol-category__counts">
          <Badge 
            variant="outline" 
            size="sm"
            color={currentConfig.color}
          >
            {symbolCount} symbols
          </Badge>
          
          {#if activeCount > 0}
            <Badge 
              variant="subtle" 
              size="sm"
              color="success"
            >
              {activeCount} active
            </Badge>
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- Status indicator -->
    <div class="symbol-category__status">
      <div 
        class="symbol-category__status-dot"
        class:active={isActive}
        style="background-color: {currentConfig.borderColor}"
      ></div>
    </div>
  </div>
  
  <!-- Active percentage bar (detailed variant) -->
  {#if variant === 'detailed' && symbolCount > 0}
    <div class="symbol-category__progress">
      <div 
        class="symbol-category__progress-bar"
        style="width: {activePercentage}%; background-color: {currentConfig.borderColor}"
      ></div>
    </div>
  {/if}
  
  <!-- Expanded content (if collapsible) -->
  {#if collapsible && expanded}
    <div class="symbol-category__expanded">
      <div class="symbol-category__expanded-content">
        <slot name="expanded">
          <div class="symbol-category__placeholder">
            <p>Category content would go here</p>
            <p>Active symbols: {activeCount}/{symbolCount}</p>
          </div>
        </slot>
      </div>
    </div>
  {/if}
</div>

<style>
  .symbol-category {
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    transition: all var(--motion-fast) var(--ease-snappy);
    position: relative;
    overflow: hidden;
  }
  
  .symbol-category--clickable {
    cursor: pointer;
  }
  
  .symbol-category--clickable:hover {
    background: var(--bg-elevated);
    border-color: var(--color-focus);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .symbol-category--clickable:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .symbol-category--selected {
    background: var(--color-focus-subtle);
    border-color: var(--color-focus);
  }
  
  .symbol-category--active {
    border-left: 4px solid var(--color-info);
  }
  
  .symbol-category--forex {
    border-left-color: var(--color-info);
  }
  
  .symbol-category--commodities {
    border-left-color: var(--color-warning);
  }
  
  .symbol-category--indices {
    border-left-color: var(--color-success);
  }
  
  .symbol-category--crypto {
    border-left-color: var(--color-primary);
  }
  
  .symbol-category--stocks {
    border-left-color: var(--color-success);
  }
  
  /* Size variants */
  .symbol-category--sm {
    padding: var(--space-2);
    gap: var(--space-2);
  }
  
  .symbol-category--md {
    padding: var(--space-3);
    gap: var(--space-3);
  }
  
  .symbol-category--lg {
    padding: var(--space-4);
    gap: var(--space-4);
  }
  
  /* Variant styles */
  .symbol-category--compact {
    padding: var(--space-2);
    gap: var(--space-2);
  }
  
  .symbol-category--compact .symbol-category__description {
    display: none;
  }
  
  .symbol-category__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: 1;
    min-width: 0;
  }
  
  .symbol-category__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
    font-size: var(--text-lg);
    flex-shrink: 0;
  }
  
  .symbol-category__icon--sm {
    width: 32px;
    height: 32px;
    font-size: var(--text-base);
  }
  
  .symbol-category__icon--lg {
    width: 48px;
    height: 48px;
    font-size: var(--text-xl);
  }
  
  .symbol-category__content {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
  }
  
  .symbol-category__title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  
  .symbol-category__label {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-size: var(--text-base);
  }
  
  .symbol-category__toggle {
    background: none;
    border: none;
    padding: var(--space-1);
    cursor: pointer;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    transition: transform var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-category__toggle:hover {
    color: var(--text-primary);
  }
  
  .symbol-category__description {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .symbol-category__counts {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
  }
  
  .symbol-category__status {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .symbol-category__status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-neutral);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-category__status-dot.active {
    background: var(--color-success);
    box-shadow: 0 0 0 2px var(--color-success-subtle);
  }
  
  .symbol-category__progress {
    height: 4px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-top: var(--space-2);
  }
  
  .symbol-category__progress-bar {
    height: 100%;
    background: var(--color-primary);
    transition: width var(--motion-normal) var(--ease-snappy);
    border-radius: var(--radius-full);
  }
  
  .symbol-category__expanded {
    border-top: 1px solid var(--border-default);
    background: var(--bg-tertiary);
  }
  
  .symbol-category__expanded-content {
    padding: var(--space-3);
  }
  
  .symbol-category__placeholder {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    text-align: center;
    padding: var(--space-4);
  }
  
  /* Category-specific colors */
  .symbol-category--forex .symbol-category__icon {
    background: var(--color-info-subtle);
    color: var(--color-info);
  }
  
  .symbol-category--commodities .symbol-category__icon {
    background: var(--color-warning-subtle);
    color: var(--color-warning);
  }
  
  .symbol-category--indices .symbol-category__icon {
    background: var(--color-success-subtle);
    color: var(--color-success);
  }
  
  .symbol-category--crypto .symbol-category__icon {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }
  
  .symbol-category--stocks .symbol-category__icon {
    background: var(--color-success-subtle);
    color: var(--color-success);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .symbol-category {
      padding: var(--space-2);
      gap: var(--space-2);
    }
    
    .symbol-category__icon {
      width: 32px;
      height: 32px;
      font-size: var(--text-base);
    }
    
    .symbol-category__description {
      display: none;
    }
    
    .symbol-category__counts {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-1);
    }
  }
  
  @media (max-width: 480px) {
    .symbol-category__header {
      gap: var(--space-2);
    }
    
    .symbol-category__label {
      font-size: var(--text-sm);
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .symbol-category {
      border-width: 2px;
    }
    
    .symbol-category__status-dot {
      border: 1px solid currentColor;
    }
    
    .symbol-category__icon {
      border: 1px solid var(--border-default);
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .symbol-category,
    .symbol-category__toggle,
    .symbol-category__progress-bar,
    .symbol-category__status-dot {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .symbol-category {
      background: white !important;
      border: 1px solid black !important;
      color: black !important;
      break-inside: avoid;
    }
    
    .symbol-category__toggle {
      display: none !important;
    }
    
    .symbol-category__status-dot {
      background: black !important;
    }
  }
</style>
