<script>
  /**
   * Badge Component
   * A versatile badge component for status indicators, counts, and labels
   */

  export let variant = 'default'; // default, primary, secondary, success, warning, danger, info
  export let size = 'md'; // xs, sm, md, lg
  export let shape = 'rounded'; // rounded, square, pill
  export let dot = false; // Show as dot indicator
  export let count = null; // Show count number
  export let max = 99; // Maximum count to display (shows "99+" for higher)
  export let showZero = false; // Show badge when count is 0
  export let removable = false; // Show remove button
  export let href = null; // Render as link if provided
  export let target = null; // Link target
  export let ariaLabel = '';
  export let id = '';

  // Generate unique ID if not provided
  let badgeId = id || `badge-${Math.random().toString(36).substr(2, 9)}`;

  // Handle click events
  function handleClick(event) {
    dispatchEvent('click', event);
  }

  // Handle remove event
  function handleRemove(event) {
    event.stopPropagation();
    dispatchEvent('remove', event);
  }

  // Get CSS classes based on props
  $: baseClasses = [
    'badge',
    `badge-${variant}`,
    `badge-${size}`,
    `badge-${shape}`,
    dot && 'badge-dot',
    count !== null && 'badge-count',
    removable && 'badge-removable'
  ].filter(Boolean).join(' ');

  // Format count display
  $: displayCount = count !== null ? (count > max ? `${max}+` : count) : null;

  // Determine if badge should be shown
  $: isVisible = dot || (count !== null && (showZero || count > 0)) || $$slots.default;

  // Determine if it should render as a link
  $: isLink = href && !removable;

  // Get aria label for accessibility
  $: computedAriaLabel = ariaLabel || (count !== null ? `${count} items` : '');
</script>

{#if isVisible}
  {#if isLink}
    <a
      id={badgeId}
      href={href}
      target={target}
      class={baseClasses}
      aria-label={computedAriaLabel}
      role="badge"
      on:click={handleClick}
    >
      {#if dot}
        <span class="badge-dot-indicator" aria-hidden="true"></span>
      {:else if displayCount !== null}
        <span class="badge-count-text">{displayCount}</span>
      {/if}
      
      {#if $$slots.default}
        <span class="badge-content">
          <slot />
        </span>
      {/if}
      
      {#if removable}
        <button
          type="button"
          class="badge-remove"
          aria-label="Remove"
          on:click={handleRemove}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M8 1.5L1.5 8M1.5 1.5L8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      {/if}
    </a>
  {:else}
    <span
      id={badgeId}
      class={baseClasses}
      aria-label={computedAriaLabel}
      role="badge"
      on:click={handleClick}
    >
      {#if dot}
        <span class="badge-dot-indicator" aria-hidden="true"></span>
      {:else if displayCount !== null}
        <span class="badge-count-text">{displayCount}</span>
      {/if}
      
      {#if $$slots.default}
        <span class="badge-content">
          <slot />
        </span>
      {/if}
      
      {#if removable}
        <button
          type="button"
          class="badge-remove"
          aria-label="Remove"
          on:click={handleRemove}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M8 1.5L1.5 8M1.5 1.5L8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      {/if}
    </span>
  {/if}
{/if}

<style>
  /* Base badge styles */
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    font-family: var(--font-family-sans);
    font-weight: var(--font-weight-medium);
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    vertical-align: middle;
    cursor: default;
    transition: all var(--motion-fast) var(--ease-out);
    position: relative;
  }

  .badge[href] {
    cursor: pointer;
  }

  .badge[href]:hover {
    text-decoration: none;
  }

  /* Size variants */
  .badge-xs {
    font-size: var(--font-size-xs);
    padding: var(--space-0-5) var(--space-1);
    min-width: 16px;
    min-height: 16px;
  }

  .badge-sm {
    font-size: var(--font-size-xs);
    padding: var(--space-0-5) var(--space-1-5);
    min-width: 20px;
    min-height: 20px;
  }

  .badge-md {
    font-size: var(--font-size-sm);
    padding: var(--space-0-5) var(--space-2);
    min-width: 24px;
    min-height: 24px;
  }

  .badge-lg {
    font-size: var(--font-size-base);
    padding: var(--space-1) var(--space-2-5);
    min-width: 32px;
    min-height: 32px;
  }

  /* Shape variants */
  .badge-rounded {
    border-radius: var(--radius-md);
  }

  .badge-square {
    border-radius: var(--radius-sm);
  }

  .badge-pill {
    border-radius: 9999px;
  }

  /* Dot indicator */
  .badge-dot {
    padding: 0;
    min-width: 8px;
    min-height: 8px;
    width: 8px;
    height: 8px;
  }

  .badge-dot.badge-xs {
    width: 6px;
    height: 6px;
    min-width: 6px;
    min-height: 6px;
  }

  .badge-dot.badge-sm {
    width: 7px;
    height: 7px;
    min-width: 7px;
    min-height: 7px;
  }

  .badge-dot.badge-lg {
    width: 10px;
    height: 10px;
    min-width: 10px;
    min-height: 10px;
  }

  .badge-dot-indicator {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background-color: currentColor;
  }

  /* Content styles */
  .badge-content {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .badge-count-text {
    font-variant-numeric: tabular-nums;
  }

  /* Remove button */
  .badge-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    background: none;
    border: none;
    color: inherit;
    opacity: 0.7;
    cursor: pointer;
    border-radius: inherit;
    transition: opacity var(--motion-fast) var(--ease-out);
  }

  .badge-remove:hover {
    opacity: 1;
  }

  .badge-remove:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
  }

  /* Variant styles */
  .badge-default {
    background-color: var(--bg-secondary);
    color: var(--text-secondary);
  }

  .badge-default[href]:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .badge-primary {
    background-color: var(--color-primary);
    color: var(--text-on-primary);
  }

  .badge-primary[href]:hover {
    background-color: var(--color-primary-hover);
  }

  .badge-secondary {
    background-color: var(--color-secondary);
    color: var(--text-on-secondary);
  }

  .badge-secondary[href]:hover {
    background-color: var(--color-secondary-hover);
  }

  .badge-success {
    background-color: var(--color-success);
    color: var(--text-on-success);
  }

  .badge-success[href]:hover {
    background-color: var(--color-success-hover);
  }

  .badge-warning {
    background-color: var(--color-warning);
    color: var(--text-on-warning);
  }

  .badge-warning[href]:hover {
    background-color: var(--color-warning-hover);
  }

  .badge-danger {
    background-color: var(--color-danger);
    color: var(--text-on-danger);
  }

  .badge-danger[href]:hover {
    background-color: var(--color-danger-hover);
  }

  .badge-info {
    background-color: var(--color-info);
    color: var(--text-on-info);
  }

  .badge-info[href]:hover {
    background-color: var(--color-info-hover);
  }

  /* Interactive states */
  .badge[href]:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .badge-default {
      background-color: var(--bg-secondary-dark);
      color: var(--text-secondary-dark);
    }

    .badge-default[href]:hover {
      background-color: var(--bg-tertiary-dark);
      color: var(--text-primary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .badge {
      border: 1px solid currentColor;
    }

    .badge-dot {
      border: none;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .badge {
      transition: none;
    }

    .badge-remove {
      transition: none;
    }
  }

  /* Print styles */
  @media print {
    .badge {
      background-color: transparent !important;
      color: black !important;
      border: 1px solid black !important;
    }

    .badge-remove {
      display: none;
    }
  }
</style>
