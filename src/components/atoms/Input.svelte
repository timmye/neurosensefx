<script>
  /**
   * Input Component
   * A versatile input component with validation states, sizes, and accessibility features
   */

  export let type = 'text'; // text, password, email, number, tel, url, search
  export let size = 'md'; // sm, md, lg
  export let value = '';
  export let placeholder = '';
  export let disabled = false;
  export let readonly = false;
  export let required = false;
  export let invalid = false;
  export let valid = false;
  export let errorMessage = '';
  export let helperText = '';
  export let label = '';
  export let id = '';
  export let name = '';
  export let maxlength = null;
  export let minlength = null;
  export let min = null;
  export let max = null;
  export let step = null;
  export let pattern = null;
  export let autocomplete = null;
  export let autoFocus = false;
  export let fullWidth = false;
  export let leftIcon = null;
  export let rightIcon = null;
  export let loading = false;

  // Generate unique ID if not provided
  let inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  let helperId = `${inputId}-helper`;
  let errorId = `${inputId}-error`;

  // Internal state
  let focused = false;
  let internalValue = value;

  // Sync internal value with prop
  $: if (value !== internalValue) {
    internalValue = value;
  }

  // Handle input changes
  function handleInput(event) {
    internalValue = event.target.value;
    value = internalValue;
    
    // Dispatch custom event
    dispatchEvent('input', event);
    dispatchEvent('change', event);
  }

  // Handle focus events
  function handleFocus(event) {
    focused = true;
    dispatchEvent('focus', event);
  }

  function handleBlur(event) {
    focused = false;
    dispatchEvent('blur', event);
  }

  // Handle key events
  function handleKeydown(event) {
    dispatchEvent('keydown', event);
  }

  // Get CSS classes based on props
  $: baseClasses = [
    'input',
    `input-${size}`,
    fullWidth && 'input-full-width',
    disabled && 'input-disabled',
    readonly && 'input-readonly',
    required && 'input-required',
    focused && 'input-focused',
    invalid && 'input-invalid',
    valid && 'input-valid',
    loading && 'input-loading',
    (leftIcon || rightIcon) && 'input-has-icons'
  ].filter(Boolean).join(' ');

  // Determine if input has icons
  $: hasLeftIcon = leftIcon || loading;
  $: hasRightIcon = rightIcon;

  // Get icon size based on input size
  $: iconSize = {
    sm: '14px',
    md: '16px',
    lg: '18px'
  }[size] || '16px';

  // ARIA attributes
  $: ariaDescribedBy = [
    helperText && helperId,
    invalid && errorId
  ].filter(Boolean).join(' ') || undefined;

  // Input mode for mobile keyboards
  $: inputMode = {
    email: 'email',
    number: 'numeric',
    tel: 'tel',
    url: 'url'
  }[type] || 'text';
</script>

<div class="input-wrapper" class:input-wrapper-full-width={fullWidth}>
  {#if label}
    <label 
      for={inputId} 
      class="input-label"
      class:input-label-required={required}
      class:input-label-disabled={disabled}
      class:input-label-invalid={invalid}
      class:input-label-focused={focused}
    >
      {label}
      {#if required}
        <span class="input-required-indicator" aria-hidden="true">*</span>
      {/if}
    </label>
  {/if}

  <div class="input-container" class:input-container-focused={focused}>
    {#if hasLeftIcon}
      <div class="input-icon input-icon-left" style="--icon-size: {iconSize}">
        {#if loading}
          <div class="input-spinner"></div>
        {:else}
          {@html leftIcon}
        {/if}
      </div>
    {/if}

    {#if type === 'text'}
      <input
        id={inputId}
        class={baseClasses}
        type="text"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {maxlength}
        {minlength}
        {pattern}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {:else if type === 'password'}
      <input
        id={inputId}
        class={baseClasses}
        type="password"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {maxlength}
        {minlength}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {:else if type === 'email'}
      <input
        id={inputId}
        class={baseClasses}
        type="email"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {maxlength}
        {minlength}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {:else if type === 'number'}
      <input
        id={inputId}
        class={baseClasses}
        type="number"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {min}
        {max}
        {step}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {:else if type === 'tel'}
      <input
        id={inputId}
        class={baseClasses}
        type="tel"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {maxlength}
        {minlength}
        {pattern}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {:else if type === 'url'}
      <input
        id={inputId}
        class={baseClasses}
        type="url"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {maxlength}
        {minlength}
        {pattern}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {:else if type === 'search'}
      <input
        id={inputId}
        class={baseClasses}
        type="search"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {maxlength}
        {minlength}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {:else}
      <input
        id={inputId}
        class={baseClasses}
        type="text"
        {inputMode}
        {name}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        {maxlength}
        {minlength}
        {pattern}
        {autocomplete}
        {autofocus}
        bind:value={internalValue}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
        aria-required={required ? 'true' : undefined}
      />
    {/if}

    {#if hasRightIcon}
      <div class="input-icon input-icon-right" style="--icon-size: {iconSize}">
        {@html rightIcon}
      </div>
    {/if}
  </div>

  {#if helperText || errorMessage}
    <div class="input-helper">
      {#if errorMessage && invalid}
        <div id={errorId} class="input-error" role="alert" aria-live="polite">
          {@html errorMessage}
        </div>
      {:else if helperText}
        <div id={helperId} class="input-helper-text">
          {@html helperText}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Input wrapper */
  .input-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .input-wrapper-full-width {
    width: 100%;
  }

  /* Label styles */
  .input-label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-family-sans);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .input-label-required {
    color: var(--text-primary);
  }

  .input-label-disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
  }

  .input-label-invalid {
    color: var(--color-danger);
  }

  .input-label-focused {
    color: var(--color-primary);
  }

  .input-required-indicator {
    color: var(--color-danger);
    font-weight: var(--font-weight-bold);
  }

  /* Input container */
  .input-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-container-focused {
    /* Focused state handled by input itself */
  }

  /* Base input styles */
  .input {
    width: 100%;
    font-family: var(--font-family-sans);
    font-size: var(--font-size-base);
    line-height: 1.5;
    color: var(--text-primary);
    background-color: var(--bg-primary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    transition: all var(--motion-fast) var(--ease-out);
    outline: none;
    box-shadow: var(--shadow-sm);
  }

  .input::placeholder {
    color: var(--text-tertiary);
  }

  .input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-focus-transparent);
  }

  .input:disabled {
    background-color: var(--bg-disabled);
    color: var(--text-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .input:readonly {
    background-color: var(--bg-secondary);
    cursor: default;
  }

  .input:invalid {
    border-color: var(--color-danger);
  }

  /* Size variants */
  .input-sm {
    padding: var(--space-1-5) var(--space-2-5);
    font-size: var(--font-size-sm);
    min-height: 32px;
  }

  .input-md {
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-base);
    min-height: 40px;
  }

  .input-lg {
    padding: var(--space-2-5) var(--space-3-5);
    font-size: var(--font-size-lg);
    min-height: 48px;
  }

  /* State variants */
  .input-invalid {
    border-color: var(--color-danger);
  }

  .input-invalid:focus {
    border-color: var(--color-danger);
    box-shadow: 0 0 0 3px var(--color-danger-transparent);
  }

  .input-valid {
    border-color: var(--color-success);
  }

  .input-valid:focus {
    border-color: var(--color-success);
    box-shadow: 0 0 0 3px var(--color-success-transparent);
  }

  .input-focused {
    /* Focus state handled by :focus pseudo-class */
  }

  .input-loading {
    padding-right: calc(var(--space-3) + var(--icon-size));
  }

  /* Modifiers */
  .input-full-width {
    width: 100%;
  }

  .input-has-icons {
    /* Icon positioning handled by icon containers */
  }

  /* Icon styles */
  .input-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--icon-size);
    height: var(--icon-size);
    color: var(--text-tertiary);
    pointer-events: none;
    z-index: 1;
  }

  .input-icon-left {
    left: var(--space-2-5);
  }

  .input-icon-right {
    right: var(--space-2-5);
  }

  .input-icon :deep(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  /* Adjust padding for icons */
  .input-has-icons .input {
    padding-left: calc(var(--space-3) + var(--icon-size));
  }

  .input-has-icons .input-icon-left ~ .input {
    padding-left: calc(var(--space-3) + var(--icon-size));
  }

  .input-has-icons .input-icon-right ~ .input {
    padding-right: calc(var(--space-3) + var(--icon-size));
  }

  /* Loading spinner */
  .input-spinner {
    width: 100%;
    height: 100%;
    border: 2px solid var(--border-default);
    border-top: 2px solid var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: translateY(-50%) rotate(0deg); }
    100% { transform: translateY(-50%) rotate(360deg); }
  }

  /* Helper text */
  .input-helper {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .input-helper-text {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  .input-error {
    font-size: var(--font-size-xs);
    color: var(--color-danger);
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .input-error::before {
    content: '⚠';
    font-size: var(--font-size-sm);
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .input {
      background-color: var(--bg-primary-dark);
      border-color: var(--border-default-dark);
      color: var(--text-primary-dark);
    }

    .input::placeholder {
      color: var(--text-tertiary-dark);
    }

    .input:disabled {
      background-color: var(--bg-disabled-dark);
      color: var(--text-disabled-dark);
    }

    .input:readonly {
      background-color: var(--bg-secondary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .input {
      border-width: 2px;
    }

    .input:focus {
      box-shadow: 0 0 0 3px var(--color-focus);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .input {
      transition: none;
    }

    .input-spinner {
      animation: none;
    }
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .input {
      font-size: 16px; /* Prevent zoom on iOS */
    }
  }
</style>
