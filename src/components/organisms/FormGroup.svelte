<script>
  import { createEventDispatcher, setContext, onMount } from 'svelte';
  import { Button, Badge } from '../atoms/index.js';
  import { FormField } from '../molecules/index.js';
  
  // Component props
  export let title = '';
  export let description = '';
  export let fields = [];
  export let values = {};
  export let errors = {};
  export let touched = {};
  export let isValid = false;
  export let isDirty = false;
  export let isSubmitting = false;
  export let isLoading = false;
  export let layout = 'vertical'; // 'vertical', 'horizontal', 'grid'
  export let columns = 1; // for grid layout
  export let gap = 'var(--space-4)';
  export let showValidationSummary = true;
  export let validateOnChange = true;
  export let validateOnBlur = true;
  export let validateOnSubmit = true;
  export let resetOnSubmit = false;
  export let autoFocusFirstError = false;
  export let disabled = false;
  export let readonly = false;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'outlined', 'filled'
  export let submitText = 'Submit';
  export let resetText = 'Reset';
  export let cancelText = 'Cancel';
  export let showSubmit = true;
  export let showReset = true;
  export let showCancel = false;
  export let submitVariant = 'primary';
  export let resetVariant = 'ghost';
  export let cancelVariant = 'ghost';
  export let submitOnEnter = true;
  export let preventDefaultSubmit = true;
  
  const dispatch = createEventDispatcher();
  
  // Form state
  let formElement;
  let fieldRefs = new Map();
  let validationRules = new Map();
  let fieldValidators = new Map();
  
  // Generate unique form ID
  $: formId = `form-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate CSS classes
  $: formClasses = [
    'form-group',
    `form-group--${layout}`,
    `form-group--${size}`,
    `form-group--${variant}`,
    isValid && 'form-group--valid',
    isDirty && 'form-group--dirty',
    isSubmitting && 'form-group--submitting',
    isLoading && 'form-group--loading',
    disabled && 'form-group--disabled',
    readonly && 'form-group--readonly'
  ].filter(Boolean).join(' ');
  
  $: containerClasses = [
    'form-group__container',
    `form-group__container--${layout}`,
    `form-group__container--${columns}-columns`
  ].filter(Boolean).join(' ');
  
  // Form validation state
  $: hasErrors = Object.keys(errors).length > 0;
  $: errorCount = Object.keys(errors).length;
  $: firstErrorField = Object.keys(errors)[0];
  $: canSubmit = !disabled && !isSubmitting && !isLoading && isValid && !hasErrors;
  
  // Provide form context to child components
  setContext('formId', formId);
  setContext('formDisabled', disabled);
  setContext('formReadonly', readonly);
  setContext('formSize', size);
  setContext('formVariant', variant);
  setContext('formSubmitting', isSubmitting);
  
  // Initialize form
  onMount(() => {
    initializeForm();
  });
  
  function initializeForm() {
    // Set up field validators
    fields.forEach(field => {
      if (field.validation) {
        validationRules.set(field.name, field.validation);
      }
      if (field.validator) {
        fieldValidators.set(field.name, field.validator);
      }
    });
    
    // Validate initial values if provided
    if (Object.keys(values).length > 0) {
      validateAllFields();
    }
  }
  
  // Handle field value changes
  function handleFieldChange(event) {
    const { value, fieldId } = event.detail;
    const fieldName = getFieldName(fieldId);
    
    // Update values
    values = { ...values, [fieldName]: value };
    
    // Mark as touched
    touched = { ...touched, [fieldName]: true };
    
    // Mark as dirty
    isDirty = true;
    
    // Validate if required
    if (validateOnChange && touched[fieldName]) {
      validateField(fieldName, value);
    }
    
    dispatch('fieldChange', { fieldName, value, values, touched });
  }
  
  // Handle field focus events
  function handleFieldFocus(event) {
    const { fieldId } = event.detail;
    const fieldName = getFieldName(fieldId);
    
    dispatch('fieldFocus', { fieldName, fieldId });
  }
  
  // Handle field blur events
  function handleFieldBlur(event) {
    const { fieldId } = event.detail;
    const fieldName = getFieldName(fieldId);
    
    // Mark as touched
    touched = { ...touched, [fieldName]: true };
    
    // Validate if required
    if (validateOnBlur) {
      validateField(fieldName, values[fieldName]);
    }
    
    dispatch('fieldBlur', { fieldName, fieldId });
  }
  
  // Handle field keydown events
  function handleFieldKeydown(event) {
    const { event: keyboardEvent, fieldId } = event.detail;
    const fieldName = getFieldName(fieldId);
    
    // Handle Enter key submission
    if (submitOnEnter && keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      handleSubmit();
    }
    
    dispatch('fieldKeydown', { fieldName, event: keyboardEvent, fieldId });
  }
  
  // Get field name from field ID
  function getFieldName(fieldId) {
    const field = fields.find(f => f.id === fieldId);
    return field ? field.name : fieldId;
  }
  
  // Validate individual field
  function validateField(fieldName, value) {
    const field = fields.find(f => f.name === fieldName);
    if (!field) return true;
    
    const validationErrors = [];
    
    // Required validation
    if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      validationErrors.push(`${field.label || fieldName} is required`);
    }
    
    // Type validation
    if (value && field.type) {
      switch (field.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            validationErrors.push('Please enter a valid email address');
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            validationErrors.push('Please enter a valid number');
          }
          break;
        case 'tel':
          const phoneRegex = /^[\d\s\-\+\(\)]+$/;
          if (!phoneRegex.test(value)) {
            validationErrors.push('Please enter a valid phone number');
          }
          break;
      }
    }
    
    // Length validation
    if (value && typeof value === 'string') {
      if (field.minLength && value.length < field.minLength) {
        validationErrors.push(`Minimum ${field.minLength} characters required`);
      }
      if (field.maxLength && value.length > field.maxLength) {
        validationErrors.push(`Maximum ${field.maxLength} characters allowed`);
      }
    }
    
    // Pattern validation
    if (value && field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(value)) {
        validationErrors.push(field.patternMessage || 'Invalid format');
      }
    }
    
    // Custom validation rules
    const validationRule = validationRules.get(fieldName);
    if (validationRule && typeof validationRule === 'function') {
      const customError = validationRule(value, values);
      if (customError) {
        validationErrors.push(customError);
      }
    }
    
    // Custom validator function
    const validator = fieldValidators.get(fieldName);
    if (validator && typeof validator === 'function') {
      const customError = validator(value, values);
      if (customError) {
        validationErrors.push(customError);
      }
    }
    
    // Update errors
    const newErrors = { ...errors };
    if (validationErrors.length > 0) {
      newErrors[fieldName] = validationErrors;
    } else {
      delete newErrors[fieldName];
    }
    errors = newErrors;
    
    // Update form validity
    isValid = Object.keys(newErrors).length === 0;
    
    return validationErrors.length === 0;
  }
  
  // Validate all fields
  function validateAllFields() {
    let allValid = true;
    const newErrors = {};
    
    fields.forEach(field => {
      const fieldValue = values[field.name];
      const fieldValid = validateField(field.name, fieldValue);
      if (!fieldValid) {
        allValid = false;
        if (errors[field.name]) {
          newErrors[field.name] = errors[field.name];
        }
      }
    });
    
    errors = newErrors;
    isValid = allValid;
    
    return allValid;
  }
  
  // Handle form submission
  async function handleSubmit(event) {
    if (event && preventDefaultSubmit) {
      event.preventDefault();
    }
    
    if (!canSubmit) return;
    
    isSubmitting = true;
    
    try {
      // Validate all fields if required
      if (validateOnSubmit) {
        const allValid = validateAllFields();
        if (!allValid) {
          // Focus first error field
          if (autoFocusFirstError && firstErrorField) {
            const firstFieldRef = fieldRefs.get(firstErrorField);
            if (firstFieldRef && firstFieldRef.focus) {
              firstFieldRef.focus();
            }
          }
          
          dispatch('validationError', { errors, firstErrorField });
          return;
        }
      }
      
      // Mark all fields as touched
      const newTouched = {};
      fields.forEach(field => {
        newTouched[field.name] = true;
      });
      touched = newTouched;
      
      // Dispatch submit event
      dispatch('submit', { values, errors, touched });
      
      // Reset form if required
      if (resetOnSubmit) {
        await handleReset();
      }
      
    } catch (error) {
      console.error('Form submission error:', error);
      errors = { _form: ['An error occurred during submission'] };
      dispatch('submitError', { error: error.message });
    } finally {
      isSubmitting = false;
    }
  }
  
  // Handle form reset
  async function handleReset() {
    // Reset values
    values = {};
    
    // Reset errors
    errors = {};
    
    // Reset touched state
    touched = {};
    
    // Reset dirty state
    isDirty = false;
    
    // Reset validity
    isValid = false;
    
    dispatch('reset', { formId });
  }
  
  // Handle form cancel
  function handleCancel() {
    dispatch('cancel', { values, errors, touched });
  }
  
  // Get field configuration
  function getFieldConfig(field) {
    return {
      ...field,
      disabled: disabled || field.disabled,
      readonly: readonly || field.readonly,
      size: field.size || size,
      variant: field.variant || variant,
      errorMessage: errors[field.name] ? errors[field.name][0] : field.errorMessage,
      successMessage: field.successMessage,
      warningMessage: field.warningMessage,
      validationState: errors[field.name] ? 'invalid' : 
                      field.successMessage ? 'valid' : 
                      field.warningMessage ? 'warning' : 'none'
    };
  }
  
  // Register field reference
  function registerFieldRef(fieldName, ref) {
    fieldRefs.set(fieldName, ref);
  }
  
  // Reactive: Update field configurations when values/errors change
  $: fieldConfigs = fields.map(field => getFieldConfig(field));
</script>

<form 
  id={formId}
  class={formClasses}
  style="--form-gap: {gap};"
  bind:this={formElement}
  on:submit={handleSubmit}
  on:reset={handleReset}
>
  <!-- Form header -->
  {#if title || description}
    <div class="form-group__header">
      {#if title}
        <h2 class="form-group__title">{title}</h2>
      {/if}
      
      {#if description}
        <p class="form-group__description">{description}</p>
      {/if}
      
      <!-- Form status indicators -->
      <div class="form-group__status">
        {#if isSubmitting}
          <Badge variant="info" size="sm">Submitting...</Badge>
        {:else if isDirty}
          <Badge variant="warning" size="sm">Unsaved changes</Badge>
        {:else if isValid && Object.keys(values).length > 0}
          <Badge variant="success" size="sm">Valid</Badge>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Validation summary -->
  {#if showValidationSummary && hasErrors}
    <div class="form-group__validation-summary">
      <div class="form-group__validation-summary-header">
        <h3 class="form-group__validation-summary-title">
          Please correct the following errors:
        </h3>
        <Badge variant="danger" size="sm">{errorCount} {errorCount === 1 ? 'error' : 'errors'}</Badge>
      </div>
      
      <ul class="form-group__validation-summary-list">
        {#each Object.entries(errors) as [fieldName, fieldErrors]}
          <li class="form-group__validation-summary-item">
            <button 
              type="button"
              class="form-group__validation-summary-link"
              on:click={() => {
                const fieldRef = fieldRefs.get(fieldName);
                if (fieldRef && fieldRef.focus) {
                  fieldRef.focus();
                }
              }}
            >
              {fieldErrors[0]}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  
  <!-- Form fields -->
  <div class={containerClasses}>
    {#each fieldConfigs as fieldConfig (fieldConfig.name)}
      <div class="form-group__field">
        <FormField
          {...fieldConfig}
          bind:value={values[fieldConfig.name]}
          on:input={handleFieldChange}
          on:focus={handleFieldFocus}
          on:blur={handleFieldBlur}
          on:keydown={handleFieldKeydown}
          bind:this={fieldRefs[fieldConfig.name]}
        />
      </div>
    {/each}
  </div>
  
  <!-- Form actions -->
  {#if showSubmit || showReset || showCancel}
    <div class="form-group__actions">
      <div class="form-group__actions-primary">
        {#if showSubmit}
          <Button
            type="submit"
            variant={submitVariant}
            size={size}
            disabled={!canSubmit}
            loading={isSubmitting}
            fullWidth={layout === 'vertical'}
          >
            {submitText}
          </Button>
        {/if}
      </div>
      
      <div class="form-group__actions-secondary">
        {#if showReset}
          <Button
            type="button"
            variant={resetVariant}
            size={size}
            disabled={isSubmitting || isLoading}
            onClick={handleReset}
          >
            {resetText}
          </Button>
        {/if}
        
        {#if showCancel}
          <Button
            type="button"
            variant={cancelVariant}
            size={size}
            disabled={isSubmitting || isLoading}
            onClick={handleCancel}
          >
            {cancelText}
          </Button>
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Additional form content -->
  {#if $$slots.additional}
    <div class="form-group__additional">
      <slot name="additional" />
    </div>
  {/if}
</form>

<style>
  .form-group {
    display: flex;
    flex-direction: column;
    font-family: var(--font-sans);
    width: 100%;
    max-width: 100%;
  }
  
  /* Layout variants */
  .form-group--vertical {
    gap: var(--form-gap, var(--space-4));
  }
  
  .form-group--horizontal {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--form-gap, var(--space-6));
  }
  
  .form-group--grid {
    gap: var(--form-gap, var(--space-4));
  }
  
  /* Size variants */
  .form-group--sm {
    font-size: var(--text-sm);
  }
  
  .form-group--md {
    font-size: var(--text-base);
  }
  
  .form-group--lg {
    font-size: var(--text-lg);
  }
  
  /* State variants */
  .form-group--valid {
    --form-border-color: var(--color-success-subtle);
  }
  
  .form-group--dirty {
    --form-border-color: var(--color-warning-subtle);
  }
  
  .form-group--submitting {
    opacity: 0.8;
    pointer-events: none;
  }
  
  .form-group--loading {
    position: relative;
  }
  
  .form-group--disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  .form-group--readonly {
    --form-bg: var(--bg-tertiary);
  }
  
  /* Form header */
  .form-group__header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  
  .form-group__title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }
  
  .form-group__description {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-secondary);
    line-height: 1.5;
  }
  
  .form-group__status {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  
  /* Validation summary */
  .form-group__validation-summary {
    background: var(--bg-error-subtle);
    border: 1px solid var(--color-error-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
  }
  
  .form-group__validation-summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  
  .form-group__validation-summary-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--color-error);
  }
  
  .form-group__validation-summary-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .form-group__validation-summary-item {
    margin-bottom: var(--space-2);
  }
  
  .form-group__validation-summary-item:last-child {
    margin-bottom: 0;
  }
  
  .form-group__validation-summary-link {
    background: none;
    border: none;
    padding: 0;
    color: var(--color-error);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--text-sm);
    text-align: left;
    transition: opacity var(--motion-fast) var(--ease-snappy);
  }
  
  .form-group__validation-summary-link:hover {
    opacity: 0.8;
  }
  
  /* Form container */
  .form-group__container {
    display: flex;
    flex-direction: column;
    gap: var(--form-gap, var(--space-4));
  }
  
  .form-group__container--horizontal {
    flex-direction: row;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  
  .form-group__container--grid {
    display: grid;
    gap: var(--form-gap, var(--space-4));
  }
  
  /* Grid columns */
  .form-group__container--2-columns {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .form-group__container--3-columns {
    grid-template-columns: repeat(3, 1fr);
  }
  
  .form-group__container--4-columns {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .form-group__field {
    display: flex;
    flex-direction: column;
  }
  
  .form-group__container--horizontal .form-group__field {
    flex: 1;
    min-width: 200px;
  }
  
  /* Form actions */
  .form-group__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-top: var(--space-6);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }
  
  .form-group__actions-primary {
    display: flex;
    gap: var(--space-2);
  }
  
  .form-group__actions-secondary {
    display: flex;
    gap: var(--space-2);
  }
  
  /* Additional content */
  .form-group__additional {
    margin-top: var(--space-4);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .form-group--horizontal {
      flex-direction: column;
      gap: var(--space-4);
    }
    
    .form-group__container--horizontal {
      flex-direction: column;
    }
    
    .form-group__container--2-columns,
    .form-group__container--3-columns,
    .form-group__container--4-columns {
      grid-template-columns: 1fr;
    }
    
    .form-group__actions {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    
    .form-group__actions-primary,
    .form-group__actions-secondary {
      justify-content: center;
    }
    
    .form-group__validation-summary-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-2);
    }
  }
  
  @media (max-width: 480px) {
    .form-group__container--horizontal .form-group__field {
      min-width: auto;
    }
    
    .form-group__actions {
      margin-top: var(--space-4);
      padding-top: var(--space-3);
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .form-group__validation-summary {
      border-width: 2px;
    }
    
    .form-group__validation-summary-link {
      text-decoration: none;
      border-bottom: 2px solid var(--color-error);
    }
    
    .form-group__actions {
      border-top-width: 2px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .form-group__validation-summary-link {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .form-group {
      break-inside: avoid;
    }
    
    .form-group__status {
      display: none;
    }
    
    .form-group__validation-summary {
      background: white;
      border: 1px solid black;
      color: black;
    }
    
    .form-group__actions {
      display: none;
    }
  }
</style>
