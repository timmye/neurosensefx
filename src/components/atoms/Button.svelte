<script>
  /**
   * Button Component
   * A versatile button component with multiple variants, sizes, and states
   */

  import { Settings, Trash2, Eye, EyeOff, Wifi, WifiOff, AlertCircle, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-svelte';

  export let variant = 'primary'; // primary, secondary, ghost, outline, danger
  export let size = 'md'; // xs, sm, md, lg, xl
  export let disabled = false;
  export let loading = false;
  export let fullWidth = false;
  export let rounded = false;
  export let icon = null;
  export let iconPosition = 'left'; // left, right, only
  export let href = null;
  export let target = null;
  export let type = 'button';
  export let ariaLabel = '';
  export let ariaDescribedBy = '';

  // Common icon mappings for convenience
  export let iconType = null; // settings, delete, visibility, connection, status, etc.

  // Generate unique ID for accessibility
  let buttonId = `button-${Math.random().toString(36).substr(2, 9)}`;

  // Handle click events
  function handleClick(event) {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    
    // Dispatch custom event
    dispatchEvent('click', event);
  }

  // Handle key events for accessibility
  function handleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event);
    }
  }

  // Get CSS classes based on props
  $: baseClasses = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    rounded && 'btn-rounded',
    loading && 'btn-loading',
    disabled && 'btn-disabled',
    icon && iconPosition === 'only' && 'btn-icon-only'
  ].filter(Boolean).join(' ');

  // Determine if it should render as a link
  $: isLink = href && !disabled;

  // Get icon size based on button size
  $: iconSize = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20
  }[size] || 16;

  // Map icon types to Lucide components
  $: iconComponent = (() => {
    if (icon) return icon;
    if (!iconType) return null;
    
    const iconMap = {
      settings: Settings,
      delete: Trash2,
      visibility: Eye,
      'visibility-off': EyeOff,
      connection: Wifi,
      'connection-off': WifiOff,
      alert: AlertCircle,
      success: CheckCircle,
      error: XCircle,
      warning: AlertTriangle,
      loading: Loader2
    };
    
    return iconMap[iconType] || null;
  })();

  // Determine which icon to show
  $: displayIcon = loading ? Loader2 : iconComponent;
</script>

{#if isLink}
  <a
    id={buttonId}
    href={href}
    target={target}
    class={baseClasses}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedBy}
    role="button"
    tabindex={disabled ? -1 : 0}
    on:click={handleClick}
    on:keydown={handleKeydown}
  >
    {#if loading}
      <div class="btn-icon">
        <Loader2 size={iconSize} />
      </div>
    {:else if displayIcon}
      <div class="btn-icon">
        <svelte:component this={displayIcon} size={iconSize} />
      </div>
    {/if}
    
    {#if iconPosition !== 'only'}
      <slot></slot>
    {/if}
  </a>
{:else}
  <button
    id={buttonId}
    class={baseClasses}
    type={type}
    {disabled}
    aria-label={ariaLabel}
    aria-describedby={ariaDescribedBy}
    on:click={handleClick}
    on:keydown={handleKeydown}
  >
    {#if loading}
      <div class="btn-icon">
        <Loader2 size={iconSize} />
      </div>
    {:else if displayIcon}
      <div class="btn-icon">
        <svelte:component this={displayIcon} size={iconSize} />
      </div>
    {/if}
    
    {#if iconPosition !== 'only'}
      <slot></slot>
    {/if}
  </button>
{/if}

<style>
  /* Base button styles */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-family: var(--font-family-sans);
    font-weight: var(--font-weight-medium);
    line-height: 1;
    text-decoration: none;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-out);
    user-select: none;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
  }

  .btn:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .btn:disabled,
  .btn-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Size variants */
  .btn-xs {
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    min-height: 24px;
    border-radius: var(--radius-sm);
  }

  .btn-sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-sm);
    min-height: 32px;
    border-radius: var(--radius-sm);
  }

  .btn-md {
    padding: var(--space-2-5) var(--space-4);
    font-size: var(--font-size-base);
    min-height: 40px;
    border-radius: var(--radius-md);
  }

  .btn-lg {
    padding: var(--space-3) var(--space-6);
    font-size: var(--font-size-lg);
    min-height: 48px;
    border-radius: var(--radius-lg);
  }

  .btn-xl {
    padding: var(--space-4) var(--space-8);
    font-size: var(--font-size-xl);
    min-height: 56px;
    border-radius: var(--radius-lg);
  }

  /* Style variants */
  .btn-primary {
    background-color: var(--color-primary);
    color: var(--text-on-primary);
    border-color: var(--color-primary);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
    border-color: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-primary:active:not(:disabled) {
    background-color: var(--color-primary-active);
    border-color: var(--color-primary-active);
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  .btn-secondary {
    background-color: var(--color-secondary);
    color: var(--text-on-secondary);
    border-color: var(--color-secondary);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-secondary-hover);
    border-color: var(--color-secondary-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-secondary:active:not(:disabled) {
    background-color: var(--color-secondary-active);
    border-color: var(--color-secondary-active);
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  .btn-ghost {
    background-color: transparent;
    color: var(--text-primary);
    border-color: transparent;
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
  }

  .btn-ghost:active:not(:disabled) {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .btn-outline {
    background-color: transparent;
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .btn-outline:hover:not(:disabled) {
    background-color: var(--color-primary);
    color: var(--text-on-primary);
  }

  .btn-outline:active:not(:disabled) {
    background-color: var(--color-primary-active);
    border-color: var(--color-primary-active);
    color: var(--text-on-primary);
  }

  .btn-danger {
    background-color: var(--color-danger);
    color: var(--text-on-danger);
    border-color: var(--color-danger);
  }

  .btn-danger:hover:not(:disabled) {
    background-color: var(--color-danger-hover);
    border-color: var(--color-danger-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-danger:active:not(:disabled) {
    background-color: var(--color-danger-active);
    border-color: var(--color-danger-active);
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
  }

  /* Modifiers */
  .btn-full-width {
    width: 100%;
  }

  .btn-rounded {
    border-radius: 9999px;
  }

  .btn-loading {
    color: transparent;
  }

  .btn-icon-only {
    padding: var(--space-2);
    aspect-ratio: 1;
  }

  /* Icon styles */
  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-size);
    height: var(--icon-size);
    flex-shrink: 0;
  }

  .btn-icon :deep(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  /* Loading spinner */
  .btn-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: var(--icon-size);
    height: var(--icon-size);
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .btn-ghost:hover:not(:disabled) {
      background-color: var(--bg-secondary-dark);
    }

    .btn-ghost:active:not(:disabled) {
      background-color: var(--bg-tertiary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .btn {
      border-width: 2px;
    }

    .btn:focus {
      outline-width: 3px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
    }

    .btn:hover:not(:disabled) {
      transform: none;
    }

    .btn-spinner {
      animation: none;
    }
  }
</style>
