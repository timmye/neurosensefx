<script>
  /**
   * Label Component
   * A versatile label component for form elements and general labeling
   */

  export let htmlFor = ''; // ID of the element this label is for
  export let size = 'md'; // xs, sm, md, lg
  export let weight = 'medium'; // normal, medium, semibold, bold
  export let required = false;
  export let disabled = false;
  export let invalid = false;
  export let fullWidth = false;
  export let srOnly = false; // Screen reader only
  export let as = 'label'; // label, span, div
  export let id = '';

  // Generate unique ID if not provided
  let labelId = id || `label-${Math.random().toString(36).substr(2, 9)}`;

  // Handle click events
  function handleClick(event) {
    dispatchEvent('click', event);
  }

  // Get CSS classes based on props
  $: baseClasses = [
    'label',
    `label-${size}`,
    `label-${weight}`,
    required && 'label-required',
    disabled && 'label-disabled',
    invalid && 'label-invalid',
    fullWidth && 'label-full-width',
    srOnly && 'label-sr-only'
  ].filter(Boolean).join(' ');

  // Determine if it should render as a label element
  $: isLabelElement = as === 'label' && htmlFor;
</script>

{#if isLabelElement}
  <label
    id={labelId}
    for={htmlFor}
    class={baseClasses}
    on:click={handleClick}
  >
    <slot />
    {#if required}
      <span class="label-required-indicator" aria-hidden="true">*</span>
    {/if}
  </label>
{:else if as === 'span'}
  <span
    id={labelId}
    class={baseClasses}
    on:click={handleClick}
  >
    <slot />
    {#if required}
      <span class="label-required-indicator" aria-hidden="true">*</span>
    {/if}
  </span>
{:else if as === 'div'}
  <div
    id={labelId}
    class={baseClasses}
    on:click={handleClick}
  >
    <slot />
    {#if required}
      <span class="label-required-indicator" aria-hidden="true">*</span>
    {/if}
  </div>
{:else}
  <span
    id={labelId}
    class={baseClasses}
    on:click={handleClick}
  >
    <slot />
    {#if required}
      <span class="label-required-indicator" aria-hidden="true">*</span>
    {/if}
  </span>
{/if}

<style>
  /* Base label styles */
  .label {
    display: inline-block;
    font-family: var(--font-family-sans);
    line-height: 1.4;
    color: var(--text-secondary);
    transition: color var(--motion-fast) var(--ease-out);
    cursor: default;
  }

  /* Size variants */
  .label-xs {
    font-size: var(--font-size-xs);
  }

  .label-sm {
    font-size: var(--font-size-sm);
  }

  .label-md {
    font-size: var(--font-size-base);
  }

  .label-lg {
    font-size: var(--font-size-lg);
  }

  /* Weight variants */
  .label-normal {
    font-weight: var(--font-weight-normal);
  }

  .label-medium {
    font-weight: var(--font-weight-medium);
  }

  .label-semibold {
    font-weight: var(--font-weight-semibold);
  }

  .label-bold {
    font-weight: var(--font-weight-bold);
  }

  /* State variants */
  .label-required {
    color: var(--text-primary);
  }

  .label-disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
  }

  .label-invalid {
    color: var(--color-danger);
  }

  /* Modifiers */
  .label-full-width {
    display: block;
    width: 100%;
  }

  .label-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Required indicator */
  .label-required-indicator {
    color: var(--color-danger);
    font-weight: var(--font-weight-bold);
    margin-left: var(--space-0-5);
  }

  /* Interactive states */
  .label:hover:not(.label-disabled) {
    color: var(--text-primary);
  }

  /* Focus styles for label elements */
  :global(label:focus) {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .label {
      color: var(--text-secondary-dark);
    }

    .label-required {
      color: var(--text-primary-dark);
    }

    .label-disabled {
      color: var(--text-disabled-dark);
    }

    .label-invalid {
      color: var(--color-danger-dark);
    }

    .label:hover:not(.label-disabled) {
      color: var(--text-primary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .label {
      font-weight: var(--font-weight-medium);
    }

    .label-required-indicator {
      font-weight: var(--font-weight-bold);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .label {
      transition: none;
    }
  }
</style>
