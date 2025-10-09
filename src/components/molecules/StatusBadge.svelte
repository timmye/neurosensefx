<script>
  import { createEventDispatcher } from 'svelte';
  
  // Component props
  export let status = 'info'; // 'success', 'info', 'warning', 'danger', 'neutral'
  export let label = '';
  export let description = '';
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'solid'; // 'solid', 'outline', 'subtle'
  export let animated = false;
  export let dismissible = false;
  export let clickable = false;
  export let icon = null;
  export let count = null;
  export let maxCount = 99;
  
  const dispatch = createEventDispatcher();
  
  // Status configurations
  const statusConfig = {
    success: {
      color: 'success',
      bgColor: 'var(--color-success)',
      textColor: 'var(--text-inverse)',
      borderColor: 'var(--color-success)',
      subtleBg: 'var(--color-success-subtle)',
      subtleText: 'var(--color-success)',
      defaultIcon: '✓'
    },
    info: {
      color: 'info',
      bgColor: 'var(--color-info)',
      textColor: 'var(--text-inverse)',
      borderColor: 'var(--color-info)',
      subtleBg: 'var(--color-info-subtle)',
      subtleText: 'var(--color-info)',
      defaultIcon: 'ℹ'
    },
    warning: {
      color: 'warning',
      bgColor: 'var(--color-warning)',
      textColor: 'var(--text-inverse)',
      borderColor: 'var(--color-warning)',
      subtleBg: 'var(--color-warning-subtle)',
      subtleText: 'var(--color-warning)',
      defaultIcon: '⚠'
    },
    danger: {
      color: 'danger',
      bgColor: 'var(--color-danger)',
      textColor: 'var(--text-inverse)',
      borderColor: 'var(--color-danger)',
      subtleBg: 'var(--color-danger-subtle)',
      subtleText: 'var(--color-danger)',
      defaultIcon: '✕'
    },
    neutral: {
      color: 'neutral',
      bgColor: 'var(--color-neutral)',
      textColor: 'var(--text-inverse)',
      borderColor: 'var(--color-neutral)',
      subtleBg: 'var(--color-neutral-subtle)',
      subtleText: 'var(--color-neutral)',
      defaultIcon: '○'
    }
  };
  
  // Reactive calculations
  $: currentConfig = statusConfig[status] || statusConfig.info;
  $: displayIcon = icon || currentConfig.defaultIcon;
  $: displayCount = count !== null && count > maxCount ? `${maxCount}+` : count;
  $: ariaLabel = `${label || status}${description ? `: ${description}` : ''}${displayCount ? ` (${displayCount})` : ''}`;
  
  // Handle click events
  function handleClick() {
    if (clickable) {
      dispatch('click', { status, label, count });
    }
  }
  
  // Handle keyboard events
  function handleKeydown(event) {
    if (clickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleClick();
    }
  }
  
  // Handle dismiss
  function handleDismiss(event) {
    event.stopPropagation();
    dispatch('dismiss', { status, label, count });
  }
  
  // Calculate CSS classes
  $: badgeClasses = [
    'status-badge',
    `status-badge--${status}`,
    `status-badge--${variant}`,
    `status-badge--${size}`,
    animated && 'status-badge--animated',
    clickable && 'status-badge--clickable',
    dismissible && 'status-badge--dismissible'
  ].filter(Boolean).join(' ');
  
  // Calculate inline styles
  $: badgeStyles = variant === 'subtle' 
    ? `background: ${currentConfig.subtleBg}; color: ${currentConfig.subtleText}; border-color: ${currentConfig.borderColor};`
    : variant === 'outline'
    ? `background: transparent; color: ${currentConfig.textColor}; border-color: ${currentConfig.borderColor};`
    : `background: ${currentConfig.bgColor}; color: ${currentConfig.textColor}; border-color: ${currentConfig.borderColor};`;
</script>

<div 
  class={badgeClasses}
  style={badgeStyles}
  role={clickable ? 'button' : 'status'}
  aria-label={ariaLabel}
  tabindex={clickable ? 0 : undefined}
  title={description}
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <!-- Icon -->
  {#if displayIcon}
    <span class="status-badge__icon">
      {displayIcon}
    </span>
  {/if}
  
  <!-- Label -->
  {#if label}
    <span class="status-badge__label">
      {label}
    </span>
  {/if}
  
  <!-- Count -->
  {#if displayCount !== null}
    <span class="status-badge__count">
      {displayCount}
    </span>
  {/if}
  
  <!-- Dismiss button -->
  {#if dismissible}
    <button 
      class="status-badge__dismiss"
      type="button"
      aria-label="Dismiss"
      on:click={handleDismiss}
    >
      ×
    </button>
  {/if}
</div>

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    border: 1px solid;
    font-family: var(--font-sans);
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
    line-height: 1;
    white-space: nowrap;
    transition: all var(--motion-fast) var(--ease-snappy);
    position: relative;
    max-width: 100%;
  }
  
  .status-badge--clickable {
    cursor: pointer;
  }
  
  .status-badge--clickable:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .status-badge--clickable:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  /* Size variants */
  .status-badge--sm {
    padding: var(--space-0-5) var(--space-1);
    font-size: var(--text-xs);
  }
  
  .status-badge--lg {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-base);
  }
  
  /* Variant styles */
  .status-badge--outline {
    background: transparent !important;
  }
  
  .status-badge--subtle {
    border-width: 1px;
  }
  
  /* Icon styles */
  .status-badge__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1em;
    line-height: 1;
  }
  
  .status-badge__label {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  
  .status-badge__count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.2em;
    height: 1.2em;
    background: rgba(0, 0, 0, 0.1);
    border-radius: var(--radius-full);
    font-size: 0.75em;
    font-weight: var(--font-bold);
    margin-left: var(--space-1);
  }
  
  .status-badge--subtle .status-badge__count {
    background: rgba(0, 0, 0, 0.05);
  }
  
  /* Dismiss button */
  .status-badge__dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: var(--space-1);
    background: rgba(0, 0, 0, 0.1);
    border: none;
    border-radius: 50%;
    color: inherit;
    font-size: 12px;
    font-weight: var(--font-bold);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .status-badge__dismiss:hover {
    background: rgba(0, 0, 0, 0.2);
  }
  
  .status-badge__dismiss:focus {
    outline: 1px solid currentColor;
    outline-offset: 1px;
  }
  
  /* Animated variant */
  .status-badge--animated {
    animation: badgePulse 2s ease-in-out infinite;
  }
  
  @keyframes badgePulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.05);
    }
  }
  
  /* Status-specific animations */
  .status-badge--warning.status-badge--animated {
    animation: badgePulseWarning 1s ease-in-out infinite;
  }
  
  .status-badge--danger.status-badge--animated {
    animation: badgePulseDanger 0.5s ease-in-out infinite;
  }
  
  @keyframes badgePulseWarning {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.02);
    }
  }
  
  @keyframes badgePulseDanger {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.03);
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .status-badge {
      border-width: 2px;
    }
    
    .status-badge__count {
      background: rgba(0, 0, 0, 0.2);
    }
    
    .status-badge__dismiss {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid currentColor;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .status-badge,
    .status-badge--animated,
    .status-badge--warning.status-badge--animated,
    .status-badge--danger.status-badge--animated {
      animation: none !important;
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .status-badge {
      background: white !important;
      color: black !important;
      border: 1px solid black !important;
    }
    
    .status-badge__count {
      background: black !important;
      color: white !important;
    }
    
    .status-badge__dismiss {
      display: none !important;
    }
  }
</style>
