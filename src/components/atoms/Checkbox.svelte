<script>
  /**
   * Checkbox Component
   * A versatile checkbox component with multiple states and accessibility features
   */

  export let checked = false;
  export let indeterminate = false;
  export let disabled = false;
  export let readonly = false;
  export let required = false;
  export let size = 'md'; // sm, md, lg
  export let variant = 'default'; // default, primary, secondary, success, warning, danger
  export let label = ''; // Label text
  export let helperText = ''; // Helper text below checkbox
  export let errorMessage = ''; // Error message
  export let id = '';
  export let name = '';
  export let value = '';
  export let ariaLabel = '';
  export let ariaDescribedBy = '';

  // Generate unique ID if not provided
  let checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
  let helperId = `${checkboxId}-helper`;
  let errorId = `${checkboxId}-error`;

  // Internal state
  let internalChecked = checked;
  let internalIndeterminate = indeterminate;
  let checkboxElement;

  // Sync internal state with props
  $: if (checked !== internalChecked) {
    internalChecked = checked;
  }
  $: if (indeterminate !== internalIndeterminate) {
    internalIndeterminate = indeterminate;
  }

  // Handle input changes
  function handleChange(event) {
    if (disabled || readonly) return;
    
    internalChecked = event.target.checked;
    internalIndeterminate = false; // Reset indeterminate on user interaction
    checked = internalChecked;
    indeterminate = internalIndeterminate;
    
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
    'checkbox',
    `checkbox-${size}`,
    `checkbox-${variant}`,
    disabled && 'checkbox-disabled',
    readonly && 'checkbox-readonly',
    required && 'checkbox-required',
    internalChecked && 'checkbox-checked',
    internalIndeterminate && 'checkbox-indeterminate',
    errorMessage && 'checkbox-invalid'
  ].filter(Boolean).join(' ');

  // Get input wrapper classes
  $: wrapperClasses = [
    'checkbox-wrapper',
    `checkbox-wrapper-${size}`,
    disabled && 'checkbox-wrapper-disabled',
    readonly && 'checkbox-wrapper-readonly',
    errorMessage && 'checkbox-wrapper-invalid'
  ].filter(Boolean).join(' ');

  // Get checkbox size
  $: checkboxSize = {
    sm: '16px',
    md: '20px',
    lg: '24px'
  }[size] || '20px';

  // Get icon size
  $: iconSize = {
    sm: '10px',
    md: '12px',
    lg: '14px'
  }[size] || '12px';

  // ARIA attributes
  $: ariaDescribedByValue = [
    helperText && helperId,
    errorMessage && errorId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  // Set indeterminate state on DOM element
  $: if (internalIndeterminate && checkboxElement) {
    checkboxElement.indeterminate = true;
  }
</script>

<div class={wrapperClasses}>
  <div class="checkbox-container">
    <input
      bind:this={checkboxElement}
      id={checkboxId}
      type="checkbox"
      class="checkbox-input"
      {name}
      {value}
      {disabled}
      {readonly}
      {required}
      bind:checked={internalChecked}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedByValue}
      aria-invalid={errorMessage ? 'true' : undefined}
      aria-required={required ? 'true' : undefined}
      on:change={handleChange}
      on:click={handleClick}
      on:keydown={handleKeydown}
    />

    <div class={baseClasses} style="--checkbox-size: {checkboxSize}; --icon-size: {iconSize};">
      {#if internalIndeterminate}
        <div class="checkbox-icon checkbox-indeterminate-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="11" width="12" height="2" rx="1"/>
          </svg>
        </div>
      {:else if internalChecked}
        <div class="checkbox-icon checkbox-checked-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
      {/if}
    </div>

    {#if label}
      <label 
        for={checkboxId} 
        class="checkbox-label"
        class:checkbox-label-disabled={disabled}
        class:checkbox-label-readonly={readonly}
        class:checkbox-label-invalid={errorMessage}
      >
        {label}
        {#if required}
          <span class="checkbox-required-indicator" aria-hidden="true">*</span>
        {/if}
      </label>
    {/if}
  </div>

  {#if helperText || errorMessage}
    <div class="checkbox-helper">
      {#if errorMessage}
        <div id={errorId} class="checkbox-error" role="alert" aria-live="polite">
          {@html errorMessage}
        </div>
      {:else if helperText}
        <div id={helperId} class="checkbox-helper-text">
          {@html helperText}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Checkbox wrapper */
  .checkbox-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .checkbox-wrapper-sm {
    gap: var(--space-0-5);
  }

  .checkbox-wrapper-lg {
    gap: var(--space-1-5);
  }

  /* Checkbox container */
  .checkbox-container {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  /* Hidden input */
  .checkbox-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  /* Checkbox visual */
  .checkbox {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--checkbox-size);
    height: var(--checkbox-size);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-sm);
    background-color: var(--bg-primary);
    transition: all var(--motion-fast) var(--ease-out);
    cursor: pointer;
    flex-shrink: 0;
    margin-top: 2px; /* Align with text */
  }

  /* Size variants */
  .checkbox-sm {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-xs);
  }

  .checkbox-md {
    width: 20px;
    height: 20px;
    border-radius: var(--radius-sm);
  }

  .checkbox-lg {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-md);
  }

  /* State variants */
  .checkbox:hover:not(.checkbox-disabled):not(.checkbox-readonly) {
    border-color: var(--color-primary);
    background-color: var(--bg-secondary);
  }

  .checkbox:focus-within {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .checkbox-checked {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--text-on-primary);
  }

  .checkbox-indeterminate {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--text-on-primary);
  }

  .checkbox-disabled {
    background-color: var(--bg-disabled);
    border-color: var(--border-disabled);
    color: var(--text-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .checkbox-readonly {
    background-color: var(--bg-secondary);
    border-color: var(--border-default);
    color: var(--text-secondary);
    cursor: default;
  }

  .checkbox-invalid {
    border-color: var(--color-danger);
  }

  .checkbox-invalid:focus-within {
    outline-color: var(--color-danger);
  }

  /* Variant styles */
  .checkbox-primary.checkbox-checked,
  .checkbox-primary.checkbox-indeterminate {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
  }

  .checkbox-secondary.checkbox-checked,
  .checkbox-secondary.checkbox-indeterminate {
    background-color: var(--color-secondary);
    border-color: var(--color-secondary);
  }

  .checkbox-success.checkbox-checked,
  .checkbox-success.checkbox-indeterminate {
    background-color: var(--color-success);
    border-color: var(--color-success);
  }

  .checkbox-warning.checkbox-checked,
  .checkbox-warning.checkbox-indeterminate {
    background-color: var(--color-warning);
    border-color: var(--color-warning);
  }

  .checkbox-danger.checkbox-checked,
  .checkbox-danger.checkbox-indeterminate {
    background-color: var(--color-danger);
    border-color: var(--color-danger);
  }

  /* Checkbox icons */
  .checkbox-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-size);
    height: var(--icon-size);
    animation: checkIn 0.2s var(--ease-out);
  }

  .checkbox-icon svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  @keyframes checkIn {
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
  .checkbox-label {
    font-family: var(--font-family-sans);
    font-size: var(--font-size-base);
    line-height: 1.5;
    color: var(--text-primary);
    cursor: pointer;
    user-select: none;
  }

  .checkbox-label-sm {
    font-size: var(--font-size-sm);
  }

  .checkbox-label-lg {
    font-size: var(--font-size-lg);
  }

  .checkbox-label-disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
  }

  .checkbox-label-readonly {
    color: var(--text-secondary);
    cursor: default;
  }

  .checkbox-label-invalid {
    color: var(--color-danger);
  }

  .checkbox-required-indicator {
    color: var(--color-danger);
    font-weight: var(--font-weight-bold);
    margin-left: var(--space-0-5);
  }

  /* Helper text */
  .checkbox-helper {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .checkbox-helper-text {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  .checkbox-error {
    font-size: var(--font-size-xs);
    color: var(--color-danger);
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .checkbox-error::before {
    content: '⚠';
    font-size: var(--font-size-sm);
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .checkbox {
      background-color: var(--bg-primary-dark);
      border-color: var(--border-default-dark);
    }

    .checkbox:hover:not(.checkbox-disabled):not(.checkbox-readonly) {
      background-color: var(--bg-secondary-dark);
      border-color: var(--color-primary);
    }

    .checkbox-readonly {
      background-color: var(--bg-secondary-dark);
      border-color: var(--border-default-dark);
    }

    .checkbox-label {
      color: var(--text-primary-dark);
    }

    .checkbox-label-disabled {
      color: var(--text-disabled-dark);
    }

    .checkbox-label-readonly {
      color: var(--text-secondary-dark);
    }

    .checkbox-helper-text {
      color: var(--text-tertiary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .checkbox {
      border-width: 3px;
    }

    .checkbox:focus-within {
      outline-width: 3px;
    }

    .checkbox-label {
      font-weight: var(--font-weight-medium);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .checkbox {
      transition: none;
    }

    .checkbox-icon {
      animation: none;
    }
  }

  /* Print styles */
  @media print {
    .checkbox {
      border-color: black !important;
      background-color: white !important;
    }

    .checkbox-checked,
    .checkbox-indeterminate {
      background-color: black !important;
      color: white !important;
    }

    .checkbox-label {
      color: black !important;
    }
  }
</style>
