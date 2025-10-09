<script>
  /**
   * Radio Component
   * A versatile radio button component with accessibility features
   */

  export let group = undefined; // Group binding for radio buttons
  export let disabled = false;
  export let readonly = false;
  export let required = false;
  export let size = 'md'; // sm, md, lg
  export let variant = 'default'; // default, primary, secondary, success, warning, danger
  export let label = ''; // Label text
  export let helperText = ''; // Helper text below radio
  export let errorMessage = ''; // Error message
  export let id = '';
  export let name = '';
  export let value = '';
  export let ariaLabel = '';
  export let ariaDescribedBy = '';

  // Generate unique ID if not provided
  let radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;
  let helperId = `${radioId}-helper`;
  let errorId = `${radioId}-error`;

  // Handle input changes
  function handleChange(event) {
    if (disabled || readonly) return;
    
    // Dispatch custom events
    dispatchEvent('change', event);
    dispatchEvent('input', event);
  }

  // Handle click events
  function handleClick(event) {
    if (disabled || readonly) {
      event.preventDefault();
      return;
    }
    
    dispatchEvent('click', event);
  }

  // Handle key events
  function handleKeydown(event) {
    if (disabled || readonly) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const syntheticEvent = new Event('change', { bubbles: true });
      handleChange(syntheticEvent);
    }
    
    dispatchEvent('keydown', event);
  }

  // Get CSS classes based on props
  $: baseClasses = [
    'radio',
    `radio-${size}`,
    `radio-${variant}`,
    disabled && 'radio-disabled',
    readonly && 'radio-readonly',
    required && 'radio-required',
    group === value && 'radio-checked',
    errorMessage && 'radio-invalid'
  ].filter(Boolean).join(' ');

  // Get input wrapper classes
  $: wrapperClasses = [
    'radio-wrapper',
    `radio-wrapper-${size}`,
    disabled && 'radio-wrapper-disabled',
    readonly && 'radio-wrapper-readonly',
    errorMessage && 'radio-wrapper-invalid'
  ].filter(Boolean).join(' ');

  // Get radio size
  $: radioSize = {
    sm: '16px',
    md: '20px',
    lg: '24px'
  }[size] || '20px';

  // Get dot size
  $: dotSize = {
    sm: '6px',
    md: '8px',
    lg: '10px'
  }[size] || '8px';

  // ARIA attributes
  $: ariaDescribedByValue = [
    helperText && helperId,
    errorMessage && errorId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;
</script>

<div class={wrapperClasses}>
  <div class="radio-container">
    <input
      id={radioId}
      type="radio"
      class="radio-input"
      {name}
      {value}
      {disabled}
      {readonly}
      {required}
      bind:group={group}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedByValue}
      aria-invalid={errorMessage ? 'true' : undefined}
      aria-required={required ? 'true' : undefined}
      on:change={handleChange}
      on:click={handleClick}
      on:keydown={handleKeydown}
    />

    <div class={baseClasses} style="--radio-size: {radioSize}; --dot-size: {dotSize};">
      {#if group === value}
        <div class="radio-dot"></div>
      {/if}
    </div>

    {#if label}
      <label 
        for={radioId} 
        class="radio-label"
        class:radio-label-disabled={disabled}
        class:radio-label-readonly={readonly}
        class:radio-label-invalid={errorMessage}
      >
        {label}
        {#if required}
          <span class="radio-required-indicator" aria-hidden="true">*</span>
        {/if}
      </label>
    {/if}
  </div>

  {#if helperText || errorMessage}
    <div class="radio-helper">
      {#if errorMessage}
        <div id={errorId} class="radio-error" role="alert" aria-live="polite">
          {@html errorMessage}
        </div>
      {:else if helperText}
        <div id={helperId} class="radio-helper-text">
          {@html helperText}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Radio wrapper */
  .radio-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .radio-wrapper-sm {
    gap: var(--space-0-5);
  }

  .radio-wrapper-lg {
    gap: var(--space-1-5);
  }

  /* Radio container */
  .radio-container {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  /* Hidden input */
  .radio-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  /* Radio visual */
  .radio {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--radio-size);
    height: var(--radio-size);
    border: 2px solid var(--border-default);
    border-radius: 50%;
    background-color: var(--bg-primary);
    transition: all var(--motion-fast) var(--ease-out);
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 2px; /* Align with text */
  }

  /* Size variants */
  .radio-sm {
    width: 16px;
    height: 16px;
  }

  .radio-md {
    width: 20px;
    height: 20px;
  }

  .radio-lg {
    width: 24px;
    height: 24px;
  }

  /* State variants */
  .radio:hover:not(.radio-disabled):not(.radio-readonly) {
    border-color: var(--color-primary);
    background-color: var(--bg-secondary);
  }

  .radio:focus-within {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .radio-checked {
    border-color: var(--color-primary);
    background-color: var(--bg-primary);
  }

  .radio-disabled {
    background-color: var(--bg-disabled);
    border-color: var(--border-disabled);
    color: var(--text-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .radio-readonly {
    background-color: var(--bg-secondary);
    border-color: var(--border-default);
    color: var(--text-secondary);
    cursor: default;
  }

  .radio-invalid {
    border-color: var(--color-danger);
  }

  .radio-invalid:focus-within {
    outline-color: var(--color-danger);
  }

  /* Variant styles */
  .radio-primary.radio-checked {
    border-color: var(--color-primary);
  }

  .radio-primary.radio-checked .radio-dot {
    background-color: var(--color-primary);
  }

  .radio-secondary.radio-checked {
    border-color: var(--color-secondary);
  }

  .radio-secondary.radio-checked .radio-dot {
    background-color: var(--color-secondary);
  }

  .radio-success.radio-checked {
    border-color: var(--color-success);
  }

  .radio-success.radio-checked .radio-dot {
    background-color: var(--color-success);
  }

  .radio-warning.radio-checked {
    border-color: var(--color-warning);
  }

  .radio-warning.radio-checked .radio-dot {
    background-color: var(--color-warning);
  }

  .radio-danger.radio-checked {
    border-color: var(--color-danger);
  }

  .radio-danger.radio-checked .radio-dot {
    background-color: var(--color-danger);
  }

  /* Radio dot */
  .radio-dot {
    width: var(--dot-size);
    height: var(--dot-size);
    border-radius: 50%;
    background-color: var(--color-primary);
    animation: radioDotIn 0.2s var(--ease-out);
  }

  @keyframes radioDotIn {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Label styles */
  .radio-label {
    font-family: var(--font-family-sans);
    font-size: var(--font-size-base);
    line-height: 1.5;
    color: var(--text-primary);
    cursor: pointer;
    user-select: none;
  }

  .radio-label-sm {
    font-size: var(--font-size-sm);
  }

  .radio-label-lg {
    font-size: var(--font-size-lg);
  }

  .radio-label-disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
  }

  .radio-label-readonly {
    color: var(--text-secondary);
    cursor: default;
  }

  .radio-label-invalid {
    color: var(--color-danger);
  }

  .radio-required-indicator {
    color: var(--color-danger);
    font-weight: var(--font-weight-bold);
    margin-left: var(--space-0-5);
  }

  /* Helper text */
  .radio-helper {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .radio-helper-text {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  .radio-error {
    font-size: var(--font-size-xs);
    color: var(--color-danger);
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .radio-error::before {
    content: '⚠';
    font-size: var(--font-size-sm);
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .radio {
      background-color: var(--bg-primary-dark);
      border-color: var(--border-default-dark);
    }

    .radio:hover:not(.radio-disabled):not(.radio-readonly) {
      background-color: var(--bg-secondary-dark);
      border-color: var(--color-primary);
    }

    .radio-readonly {
      background-color: var(--bg-secondary-dark);
      border-color: var(--border-default-dark);
    }

    .radio-label {
      color: var(--text-primary-dark);
    }

    .radio-label-disabled {
      color: var(--text-disabled-dark);
    }

    .radio-label-readonly {
      color: var(--text-secondary-dark);
    }

    .radio-helper-text {
      color: var(--text-tertiary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .radio {
      border-width: 3px;
    }

    .radio:focus-within {
      outline-width: 3px;
    }

    .radio-label {
      font-weight: var(--font-weight-medium);
    }

    .radio-dot {
      border: 1px solid var(--bg-primary);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .radio {
      transition: none;
    }

    .radio-dot {
      animation: none;
    }
  }

  /* Print styles */
  @media print {
    .radio {
      border-color: black !important;
      background-color: white !important;
    }

    .radio-checked .radio-dot {
      background-color: black !important;
    }

    .radio-label {
      color: black !important;
    }
  }
</style>
