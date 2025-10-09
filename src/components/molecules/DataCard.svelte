<script>
  import { createEventDispatcher } from 'svelte';
  import { Badge, Icon, Button } from '../atoms/index.js';
  
  // Component props
  export let title = '';
  export let subtitle = '';
  export let description = '';
  export let value = '';
  export let unit = '';
  export let change = null; // { value: number, type: 'increase' | 'decrease' | 'neutral', period: string }
  export let status = 'default'; // 'default', 'success', 'warning', 'danger', 'info'
  export let variant = 'default'; // 'default', 'outlined', 'elevated', 'filled'
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let icon = null;
  export let iconPosition = 'left'; // 'left', 'right', 'top'
  export let actions = [];
  export let badges = [];
  export let loading = false;
  export let disabled = false;
  export let clickable = false;
  export let selected = false;
  export let hoverable = true;
  export let compact = false;
  export let showBorder = true;
  export let showShadow = false;
  export let showDivider = true;
  export let alignContent = 'left'; // 'left', 'center', 'right'
  export let verticalLayout = false;
  export let animated = true;
  export let truncateText = true;
  export let maxLines = 2;
  
  const dispatch = createEventDispatcher();
  
  // Calculate CSS classes
  $: cardClasses = [
    'data-card',
    `data-card--${variant}`,
    `data-card--${size}`,
    `data-card--${status}`,
    `data-card--${alignContent}`,
    loading && 'data-card--loading',
    disabled && 'data-card--disabled',
    clickable && 'data-card--clickable',
    selected && 'data-card--selected',
    hoverable && 'data-card--hoverable',
    compact && 'data-card--compact',
    showBorder && 'data-card--bordered',
    showShadow && 'data-card--shadow',
    verticalLayout && 'data-card--vertical',
    animated && 'data-card--animated'
  ].filter(Boolean).join(' ');
  
  $: contentClasses = [
    'data-card__content',
    `data-card__content--${iconPosition}`,
    verticalLayout && 'data-card__content--vertical'
  ].filter(Boolean).join(' ');
  
  $: headerClasses = [
    'data-card__header',
    `data-card__header--${iconPosition}`,
    verticalLayout && 'data-card__header--vertical'
  ].filter(Boolean).join(' ');
  
  $: bodyClasses = [
    'data-card__body',
    truncateText && 'data-card__body--truncate'
  ].filter(Boolean).join(' ');
  
  $: footerClasses = [
    'data-card__footer',
    actions.length > 0 && 'data-card__footer--has-actions',
    badges.length > 0 && 'data-card__footer--has-badges'
  ].filter(Boolean).join(' ');
  
  // Change indicator
  $: hasChange = change && change.value !== null && change.value !== undefined;
  $: changeType = change?.type || 'neutral';
  $: changeIcon = changeType === 'increase' ? 'trending-up' : 
                   changeType === 'decrease' ? 'trending-down' : 
                   'minus';
  $: changeClass = `data-card__change--${changeType}`;
  
  // Handle card click
  function handleClick(event) {
    if (!clickable || disabled || loading) return;
    
    dispatch('click', { event });
  }
  
  // Handle action click
  function handleAction(action, event) {
    if (action.handler) {
      action.handler(event);
    }
    dispatch('action', { action, event });
  }
  
  // Handle badge click
  function handleBadgeClick(badge, event) {
    if (badge.clickable) {
      dispatch('badgeClick', { badge, event });
    }
  }
  
  // Format value with unit
  function formatValue(value, unit) {
    if (value === null || value === undefined) return '';
    
    const formattedValue = typeof value === 'number' 
      ? value.toLocaleString()
      : String(value);
    
    return unit ? `${formattedValue}${unit}` : formattedValue;
  }
  
  // Get status color
  function getStatusColor(status) {
    const colors = {
      default: 'var(--text-primary)',
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      danger: 'var(--color-danger)',
      info: 'var(--color-info)'
    };
    return colors[status] || colors.default;
  }
</script>

<div 
  class={cardClasses}
  onclick={handleClick}
  role={clickable ? 'button' : 'article'}
  tabindex={clickable && !disabled ? 0 : -1}
  on:keydown={(e) => clickable && (e.key === 'Enter' || e.key === ' ') && handleClick(e)}
>
  <!-- Loading overlay -->
  {#if loading}
    <div class="data-card__loading-overlay">
      <Icon name="loader" class="data-card__loading-icon" />
    </div>
  {/if}
  
  <!-- Card content -->
  <div class={contentClasses}>
    <!-- Card header -->
    {#if title || subtitle || icon}
      <div class={headerClasses}>
        <!-- Icon -->
        {#if icon}
          <div class="data-card__icon">
            <Icon 
              name={icon} 
              size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
              variant={status === 'default' ? 'muted' : status}
            />
          </div>
        {/if}
        
        <!-- Title and subtitle -->
        <div class="data-card__titles">
          {#if title}
            <h3 class="data-card__title" class:truncate={truncateText}>
              {title}
            </h3>
          {/if}
          
          {#if subtitle}
            <h4 class="data-card__subtitle" class:truncate={truncateText}>
              {subtitle}
            </h4>
          {/if}
        </div>
      </div>
    {/if}
    
    <!-- Card body -->
    <div class={bodyClasses}>
      <!-- Main value -->
      {#if value !== null && value !== undefined}
        <div class="data-card__value" style="color: {getStatusColor(status)};">
          {formatValue(value, unit)}
        </div>
      {/if}
      
      <!-- Description -->
      {#if description}
        <p class="data-card__description" class:truncate={truncateText}>
          {description}
        </p>
      {/if}
      
      <!-- Change indicator -->
      {#if hasChange}
        <div class="data-card__change {changeClass}">
          <Icon name={changeIcon} size="sm" />
          <span class="data-card__change-value">
            {Math.abs(change.value).toLocaleString()}%
          </span>
          {#if change.period}
            <span class="data-card__change-period">{change.period}</span>
          {/if}
        </div>
      {/if}
    </div>
    
    <!-- Card footer -->
    {#if actions.length > 0 || badges.length > 0}
      <div class={footerClasses}>
        <!-- Badges -->
        {#if badges.length > 0}
          <div class="data-card__badges">
            {#each badges as badge}
              <Badge
                variant={badge.variant || 'default'}
                size={badge.size || 'sm'}
                clickable={badge.clickable}
                onClick={() => handleBadgeClick(badge)}
              >
                {badge.label}
              </Badge>
            {/each}
          </div>
        {/if}
        
        <!-- Actions -->
        {#if actions.length > 0}
          <div class="data-card__actions">
            {#each actions as action}
              <Button
                variant={action.variant || 'ghost'}
                size={action.size || 'sm'}
                icon={action.icon}
                onClick={() => handleAction(action)}
                title={action.title}
                disabled={action.disabled}
              >
                {#if action.text}
                  {action.text}
                {/if}
              </Button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .data-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-snappy);
    overflow: hidden;
  }
  
  /* Variant styles */
  .data-card--default {
    border: 1px solid var(--border-default);
  }
  
  .data-card--outlined {
    border: 2px solid var(--border-default);
  }
  
  .data-card--elevated {
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-subtle);
  }
  
  .data-card--filled {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
  }
  
  /* Size variants */
  .data-card--sm {
    padding: var(--space-3);
    min-height: 80px;
  }
  
  .data-card--md {
    padding: var(--space-4);
    min-height: 120px;
  }
  
  .data-card--lg {
    padding: var(--space-6);
    min-height: 160px;
  }
  
  .data-card--compact {
    padding: var(--space-2);
    min-height: auto;
  }
  
  /* Status variants */
  .data-card--success {
    border-color: var(--color-success-subtle);
  }
  
  .data-card--warning {
    border-color: var(--color-warning-subtle);
  }
  
  .data-card--danger {
    border-color: var(--color-danger-subtle);
  }
  
  .data-card--info {
    border-color: var(--color-info-subtle);
  }
  
  /* Interactive states */
  .data-card--clickable {
    cursor: pointer;
  }
  
  .data-card--clickable:hover,
  .data-card--hoverable:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  
  .data-card--selected {
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px var(--color-focus-subtle);
  }
  
  .data-card--disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  .data-card--loading {
    pointer-events: none;
  }
  
  .data-card--animated {
    transition: transform var(--motion-normal) var(--ease-snappy);
  }
  
  /* Content layout */
  .data-card__content {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: var(--space-3);
  }
  
  .data-card__content--left {
    flex-direction: row;
    align-items: flex-start;
  }
  
  .data-card__content--right {
    flex-direction: row-reverse;
    align-items: flex-start;
  }
  
  .data-card__content--top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .data-card__content--vertical {
    flex-direction: column;
  }
  
  /* Header styles */
  .data-card__header {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .data-card__header--left {
    order: 1;
  }
  
  .data-card__header--right {
    order: -1;
  }
  
  .data-card__header--top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .data-card__header--vertical {
    flex-direction: column;
  }
  
  .data-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .data-card__titles {
    flex: 1;
    min-width: 0;
  }
  
  .data-card__title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    line-height: 1.3;
  }
  
  .data-card__subtitle {
    margin: var(--space-1) 0 0 0;
    font-size: var(--text-sm);
    font-weight: var(--font-normal);
    color: var(--text-secondary);
    line-height: 1.3;
  }
  
  /* Body styles */
  .data-card__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  
  .data-card__body--truncate {
    overflow: hidden;
  }
  
  .data-card__value {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    line-height: 1.2;
    margin: 0;
  }
  
  .data-card--sm .data-card__value {
    font-size: var(--text-lg);
  }
  
  .data-card--lg .data-card__value {
    font-size: var(--text-3xl);
  }
  
  .data-card__description {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.4;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    display: -webkit-box;
    overflow: hidden;
  }
  
  .data-card__body--truncate .data-card__description {
    -webkit-line-clamp: var(--max-lines, 2);
  }
  
  /* Change indicator */
  .data-card__change {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
  
  .data-card__change--increase {
    color: var(--color-success);
  }
  
  .data-card__change--decrease {
    color: var(--color-danger);
  }
  
  .data-card__change--neutral {
    color: var(--text-secondary);
  }
  
  .data-card__change-value {
    font-weight: var(--font-semibold);
  }
  
  .data-card__change-period {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }
  
  /* Footer styles */
  .data-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: auto;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-subtle);
  }
  
  .data-card__footer--has-actions:not(.data-card__footer--has-badges) {
    justify-content: flex-end;
  }
  
  .data-card__footer--has-badges:not(.data-card__footer--has-actions) {
    justify-content: flex-start;
  }
  
  .data-card__badges {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  
  .data-card__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  /* Loading overlay */
  .data-card__loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
  }
  
  .data-card__loading-icon {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Text truncation */
  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  /* Alignment variants */
  .data-card--center .data-card__content--top,
  .data-card--center .data-card__value,
  .data-card--center .data-card__description {
    text-align: center;
  }
  
  .data-card--right .data-card__content,
  .data-card--right .data-card__value,
  .data-card--right .data-card__description {
    text-align: right;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .data-card--md {
      padding: var(--space-3);
      min-height: 100px;
    }
    
    .data-card--lg {
      padding: var(--space-4);
      min-height: 120px;
    }
    
    .data-card__content--left,
    .data-card__content--right {
      flex-direction: column;
      gap: var(--space-2);
    }
    
    .data-card__footer {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-2);
    }
    
    .data-card__footer--has-actions:not(.data-card__footer--has-badges) {
      justify-content: center;
    }
    
    .data-card__footer--has-badges:not(.data-card__footer--has-actions) {
      justify-content: center;
    }
    
    .data-card__value {
      font-size: var(--text-xl);
    }
    
    .data-card--lg .data-card__value {
      font-size: var(--text-2xl);
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .data-card--default,
    .data-card--outlined {
      border-width: 2px;
    }
    
    .data-card--selected {
      border-width: 3px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .data-card,
    .data-card--animated,
    .data-card--hoverable:hover,
    .data-card--clickable:hover {
      transition: none !important;
      transform: none !important;
    }
    
    .data-card__loading-icon {
      animation: none;
    }
  }
  
  /* Print styles */
  @media print {
    .data-card {
      break-inside: avoid;
      box-shadow: none !important;
      border: 1px solid black !important;
    }
    
    .data-card__loading-overlay {
      display: none;
    }
    
    .data-card__actions {
      display: none;
    }
  }
</style>
