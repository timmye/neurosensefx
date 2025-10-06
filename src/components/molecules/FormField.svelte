<script>
  import { createEventDispatcher, setContext } from 'svelte';
  import { Label, Input, Badge, Icon } from '../atoms/index.js';
  
  // Component props
  export let id = '';
  export let label = '';
  export let type = 'text';
  export let placeholder = '';
  export let value = undefined;
  export let defaultValue = '';
  export let required = false;
  export let disabled = false;
  export let readonly = false;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'outlined', 'filled'
  export let helperText = '';
  export let errorMessage = '';
  export let successMessage = '';
  export let warningMessage = '';
  export let infoMessage = '';
  export let validationState = 'none'; // 'none', 'valid', 'invalid', 'warning'
  export let leftIcon = null;
  export let rightIcon = null;
  export let loading = false;
  export let maxLength = null;
  export let minLength = null;
  export let pattern = null;
  export let autocomplete = null;
  export let autoFocus = false;
  export let fullWidth = true;
  export let showCharacterCount = false;
  export let showRequiredIndicator = true;
  export let labelPosition = 'top'; // 'top', 'left', 'hidden'
  export let labelWidth = '120px'; // for left position
  export let gap = 'var(--space-3)';
  
  const dispatch = createEventDispatcher();
  
  // Generate unique ID if not provided
  $: fieldId = id || `field-${Math.random().toString(36).substr(2, 9)}`;
  
  // Determine validation state based on messages
  $: computedValidationState = errorMessage ? 'invalid' : 
                              successMessage ? 'valid' : 
                              warningMessage ? 'warning' : validationState;
  
  // Get appropriate message based on validation state
  $: displayMessage = errorMessage || successMessage || warningMessage || infoMessage || helperText;
  
  // Message variant based on validation state
  $: messageVariant = errorMessage ? 'danger' : 
                      successMessage ? 'success' : 
                      warningMessage ? 'warning' : 
                      infoMessage ? 'info' : 'neutral';
  
  // Character count calculations
  $: currentLength = value?.length || 0;
  $: isOverLimit = maxLength && currentLength > maxLength;
  $: isNearLimit = maxLength && currentLength > maxLength * 0.9;
  
  // Determine if field should show error state
  $: hasError = computedValidationState === 'invalid' || isOverLimit;
  
  // Determine if field should show warning state
  $: hasWarning = computedValidationState === 'warning' || isNearLimit;
  
  // Provide field context to child components
  setContext('fieldId', fieldId);
  setContext('fieldSize', size);
  setContext('fieldDisabled', disabled);
  setContext('fieldRequired', required);
  setContext('fieldHasError', hasError);
  
  // Handle input changes
  function handleInput(event) {
    value = event.detail.value;
    dispatch('input', { value, fieldId });
    dispatch('change', { value, fieldId });
  }
  
  // Handle focus events
  function handleFocus(event) {
    dispatch('focus', { value, fieldId });
  }
  
  function handleBlur(event) {
    dispatch('blur', { value, fieldId });
  }
  
  // Handle key events
  function handleKeydown(event) {
    dispatch('keydown', { event, value, fieldId });
  }
  
  // Handle icon clicks
  function handleLeftIconClick() {
    dispatch('leftIconClick', { fieldId });
  }
  
  function handleRightIconClick() {
    dispatch('rightIconClick', { fieldId });
  }
  
  // Calculate CSS classes
  $: fieldClasses = [
    'form-field',
    `form-field--${size}`,
    `form-field--${variant}`,
    `form-field--label-${labelPosition}`,
    computedValidationState !== 'none' && `form-field--${computedValidationState}`,
    fullWidth && 'form-field--full-width',
    disabled && 'form-field--disabled',
    readonly && 'form-field--readonly',
    loading && 'form-field--loading'
  ].filter(Boolean).join(' ');
  
  $: containerClasses = [
    'form-field__container',
    `form-field__container--${labelPosition}`
  ].filter(Boolean).join(' ');
  
  $: inputWrapperClasses = [
    'form-field__input-wrapper',
    leftIcon && 'form-field__input-wrapper--has-left-icon',
    rightIcon && 'form-field__input-wrapper--has-right-icon',
    hasError && 'form-field__input-wrapper--error',
    hasWarning && 'form-field__input-wrapper--warning'
  ].filter(Boolean).join(' ');
</script>

<div class={fieldClasses} style="--field-gap: {gap}; --label-width: {labelWidth};">
  <!-- Label -->
  {#if labelPosition !== 'hidden' && label}
    <div class="form-field__label-container">
      <Label
        for={fieldId}
        size={size}
        required={required && showRequiredIndicator}
        disabled={disabled}
        invalid={hasError}
        class="form-field__label"
      >
        {label}
      </Label>
      
      <!-- Optional label suffix -->
      {#if $$slots.labelSuffix}
        <div class="form-field__label-suffix">
          <slot name="labelSuffix" />
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Input container -->
  <div class={containerClasses}>
    <div class="form-field__input-container">
      <!-- Left icon -->
      {#if leftIcon}
        <div 
          class="form-field__left-icon"
          class:clickable={leftIcon.clickable}
          on:click={handleLeftIconClick}
          role={leftIcon.clickable ? 'button' : undefined}
          tabindex={leftIcon.clickable ? 0 : undefined}
          on:keydown={leftIcon.clickable ? (e) => e.key === 'Enter' && handleLeftIconClick() : undefined}
        >
          <Icon 
            name={leftIcon.name || leftIcon} 
            size={size}
            variant={leftIcon.variant || 'muted'}
            class="form-field__icon"
          />
        </div>
      {/if}
      
      <!-- Input field -->
      <div class={inputWrapperClasses}>
        <Input
          {id}
          bind:value
          {type}
          {placeholder}
          {required}
          {disabled}
          {readonly}
          {size}
          {variant}
          {maxLength}
          {minLength}
          {pattern}
          {autocomplete}
          {autoFocus}
          {fullWidth}
          invalid={hasError}
          valid={computedValidationState === 'valid'}
          loading={loading}
          leftIcon={leftIcon ? true : undefined}
          rightIcon={rightIcon ? true : undefined}
          class="form-field__input"
          on:input={handleInput}
          on:focus={handleFocus}
          on:blur={handleBlur}
          on:keydown={handleKeydown}
        />
        
        <!-- Character count -->
        {#if showCharacterCount && maxLength}
          <div 
            class="form-field__character-count"
            class:error={isOverLimit}
            class:warning={isNearLimit}
          >
            {currentLength}/{maxLength}
          </div>
        {/if}
      </div>
      
      <!-- Right icon -->
      {#if rightIcon}
        <div 
          class="form-field__right-icon"
          class:clickable={rightIcon.clickable}
          on:click={handleRightIconClick}
          role={rightIcon.clickable ? 'button' : undefined}
          tabindex={rightIcon.clickable ? 0 : undefined}
          on:keydown={rightIcon.clickable ? (e) => e.key === 'Enter' && handleRightIconClick() : undefined}
        >
          <Icon 
            name={rightIcon.name || rightIcon} 
            size={size}
            variant={rightIcon.variant || 'muted'}
            class="form-field__icon"
          />
        </div>
      {/if}
      
      <!-- Validation status icon -->
      {#if computedValidationState === 'valid' && !rightIcon}
        <div class="form-field__validation-icon form-field__validation-icon--success">
          <Icon name="check" size="sm" variant="success" />
        </div>
      {:else if hasError && !rightIcon}
        <div class="form-field__validation-icon form-field__validation-icon--error">
          <Icon name="alert-circle" size="sm" variant="danger" />
        </div>
      {:else if hasWarning && !rightIcon}
        <div class="form-field__validation-icon form-field__validation-icon--warning">
          <Icon name="alert-triangle" size="sm" variant="warning" />
        </div>
      {/if}
    </div>
    
    <!-- Helper text and messages -->
    {#if displayMessage}
      <div class="form-field__message-container">
        {#if $$slots.message}
          <slot name="message" />
        {:else}
          <div 
            class="form-field__message"
            class:form-field__message--error={hasError}
            class:form-field__message--success={computedValidationState === 'valid'}
            class:form-field__message--warning={hasWarning}
          >
            {displayMessage}
          </div>
        {/if}
        
        <!-- Additional message actions -->
        {#if $$slots.messageActions}
          <div class="form-field__message-actions">
            <slot name="messageActions" />
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Additional content -->
    {#if $$slots.additional}
      <div class="form-field__additional">
        <slot name="additional" />
      </div>
    {/if}
  </div>
</div>

<style>
  .form-field {
    display: flex;
    flex-direction: column;
    font-family: var(--font-sans);
    width: 100%;
    max-width: 100%;
  }
  
  .form-field--full-width {
    width: 100%;
  }
  
  .form-field--label-left {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--field-gap, var(--space-3));
  }
  
  .form-field--label-hidden {
    flex-direction: column;
  }
  
  /* Size variants */
  .form-field--sm {
    font-size: var(--text-sm);
  }
  
  .form-field--md {
    font-size: var(--text-base);
  }
  
  .form-field--lg {
    font-size: var(--text-lg);
  }
  
  /* Validation states */
  .form-field--valid {
    --field-border-color: var(--color-success);
    --field-focus-color: var(--color-success);
  }
  
  .form-field--invalid {
    --field-border-color: var(--color-danger);
    --field-focus-color: var(--color-danger);
  }
  
  .form-field--warning {
    --field-border-color: var(--color-warning);
    --field-focus-color: var(--color-warning);
  }
  
  /* Disabled and readonly states */
  .form-field--disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  .form-field--readonly {
    --field-bg: var(--bg-tertiary);
  }
  
  .form-field--loading {
    position: relative;
  }
  
  /* Label container */
  .form-field__label-container {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }
  
  .form-field--label-left .form-field__label-container {
    min-width: var(--label-width, 120px);
    margin-bottom: 0;
    margin-top: var(--space-2);
  }
  
  .form-field__label {
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }
  
  .form-field__label-suffix {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  /* Input container */
  .form-field__container {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  
  .form-field__container--left {
    flex-direction: column;
  }
  
  .form-field__input-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }
  
  .form-field__input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }
  
  .form-field__input-wrapper--has-left {
    margin-left: 0;
  }
  
  .form-field__input-wrapper--has-right {
    margin-right: 0;
  }
  
  /* Icons */
  .form-field__left-icon,
  .form-field__right-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    pointer-events: none;
  }
  
  .form-field__left-icon {
    left: var(--space-3);
  }
  
  .form-field__right-icon {
    right: var(--space-3);
  }
  
  .form-field__left-icon.clickable,
  .form-field__right-icon.clickable {
    pointer-events: auto;
    cursor: pointer;
    transition: color var(--motion-fast) var(--ease-snappy);
  }
  
  .form-field__left-icon.clickable:hover,
  .form-field__right-icon.clickable:hover {
    color: var(--color-primary);
  }
  
  .form-field__icon {
    color: var(--text-secondary);
  }
  
  /* Validation icons */
  .form-field__validation-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    right: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    z-index: 2;
    pointer-events: none;
  }
  
  .form-field__input-wrapper--has-right .form-field__validation-icon {
    right: calc(var(--space-3) + 24px);
  }
  
  /* Character count */
  .form-field__character-count {
    position: absolute;
    right: var(--space-3);
    bottom: var(--space-1);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    pointer-events: none;
    transition: color var(--motion-fast) var(--ease-snappy);
  }
  
  .form-field__character-count.warning {
    color: var(--color-warning);
  }
  
  .form-field__character-count.error {
    color: var(--color-danger);
    font-weight: var(--font-semibold);
  }
  
  /* Input adjustments for icons */
  .form-field__input-wrapper--has-left :global(.form-field__input) {
    padding-left: calc(var(--space-3) + 20px);
  }
  
  .form-field__input-wrapper--has-right :global(.form-field__input) {
    padding-right: calc(var(--space-3) + 20px);
  }
  
  /* Message container */
  .form-field__message-container {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    margin-top: var(--space-1);
    min-height: var(--space-5);
  }
  
  .form-field__message {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.4;
    flex: 1;
  }
  
  .form-field__message--error {
    color: var(--color-danger);
  }
  
  .form-field__message--success {
    color: var(--color-success);
  }
  
  .form-field__message--warning {
    color: var(--color-warning);
  }
  
  .form-field__message-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }
  
  /* Additional content */
  .form-field__additional {
    margin-top: var(--space-2);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .form-field--label-left {
      flex-direction: column;
      gap: var(--space-2);
    }
    
    .form-field--label-left .form-field__label-container {
      min-width: auto;
      margin-top: 0;
      margin-bottom: var(--space-1);
    }
    
    .form-field__container--left {
      flex-direction: column;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .form-field__character-count {
      font-weight: var(--font-semibold);
    }
    
    .form-field__validation-icon {
      filter: contrast(1.2);
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .form-field__left-icon.clickable,
    .form-field__right-icon.clickable,
    .form-field__character-count {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .form-field {
      break-inside: avoid;
    }
    
    .form-field__character-count {
      display: none;
    }
    
    .form-field__validation-icon {
      display: none;
    }
  }
</style>
