<script>
  /**
   * Slider Component
   * A versatile range slider component with accessibility features
   */

  export let value = 0;
  export let min = 0;
  export let max = 100;
  export let step = 1;
  export let disabled = false;
  export let readonly = false;
  export let required = false;
  export let size = 'md'; // sm, md, lg
  export let variant = 'default'; // default, primary, secondary, success, warning, danger
  export let label = ''; // Label text
  export let helperText = ''; // Helper text below slider
  export let errorMessage = ''; // Error message
  export let showValue = true; // Show current value
  export let showTicks = false; // Show tick marks
  export let showLabels = false; // Show min/max labels
  export let orientation = 'horizontal'; // horizontal, vertical
  export let id = '';
  export let name = '';
  export let ariaLabel = '';
  export let ariaDescribedBy = '';

  // Generate unique ID if not provided
  let sliderId = id || `slider-${Math.random().toString(36).substr(2, 9)}`;
  let helperId = `${sliderId}-helper`;
  let errorId = `${sliderId}-error`;

  // Internal state
  let internalValue = value;
  let isDragging = false;

  // Sync internal state with props
  $: if (value !== internalValue) {
    internalValue = value;
  }

  // Handle input changes
  function handleChange(event) {
    if (disabled || readonly) return;
    
    internalValue = parseFloat(event.target.value);
    value = internalValue;
    
    // Dispatch custom events
    dispatchEvent('change', event);
    dispatchEvent('input', event);
  }

  // Handle mouse events for better UX
  function handleMouseDown(event) {
    if (disabled || readonly) return;
    isDragging = true;
    dispatchEvent('mousedown', event);
  }

  function handleMouseUp(event) {
    if (disabled || readonly) return;
    isDragging = false;
    dispatchEvent('mouseup', event);
  }

  // Handle key events
  function handleKeydown(event) {
    if (disabled || readonly) return;
    
    dispatchEvent('keydown', event);
  }

  // Calculate percentage for visual positioning
  $: percentage = ((internalValue - min) / (max - min)) * 100;

  // Generate tick marks
  $: ticks = showTicks ? generateTicks() : [];

  function generateTicks() {
    const tickCount = Math.floor((max - min) / step) + 1;
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      const value = min + (i * step);
      ticks.push({
        value,
        position: ((value - min) / (max - min)) * 100
      });
    }
    return ticks;
  }

  // Format value display
  $: formattedValue = formatValue(internalValue);

  function formatValue(val) {
    if (Number.isInteger(val)) {
      return val.toString();
    }
    return val.toFixed(2);
  }

  // Get CSS classes based on props
  $: baseClasses = [
    'slider',
    `slider-${size}`,
    `slider-${variant}`,
    `slider-${orientation}`,
    disabled && 'slider-disabled',
    readonly && 'slider-readonly',
    required && 'slider-required',
    isDragging && 'slider-dragging',
    errorMessage && 'slider-invalid'
  ].filter(Boolean).join(' ');

  // Get input wrapper classes
  $: wrapperClasses = [
    'slider-wrapper',
    `slider-wrapper-${size}`,
    `slider-wrapper-${orientation}`,
    disabled && 'slider-wrapper-disabled',
    readonly && 'slider-wrapper-readonly',
    errorMessage && 'slider-wrapper-invalid'
  ].filter(Boolean).join(' ');

  // Get track size
  $: trackSize = {
    sm: orientation === 'horizontal' ? '4px' : '4px',
    md: orientation === 'horizontal' ? '6px' : '6px',
    lg: orientation === 'horizontal' ? '8px' : '8px'
  }[size] || '6px';

  // Get thumb size
  $: thumbSize = {
    sm: orientation === 'horizontal' ? '16px' : '16px',
    md: orientation === 'horizontal' ? '20px' : '20px',
    lg: orientation === 'horizontal' ? '24px' : '24px'
  }[size] || '20px';

  // ARIA attributes
  $: ariaDescribedByValue = [
    helperText && helperId,
    errorMessage && errorId,
    ariaDescribedBy
  ].filter(Boolean).join(' ') || undefined;

  // ARIA value attributes
  $: ariaValueNow = internalValue;
  $: ariaValueMin = min;
  $: ariaValueMax = max;
  $: ariaValueText = `${formattedValue} of ${max}`;
</script>

<div class={wrapperClasses}>
  {#if label}
    <label 
      for={sliderId} 
      class="slider-label"
      class:slider-label-disabled={disabled}
      class:slider-label-readonly={readonly}
      class:slider-label-invalid={errorMessage}
    >
      {label}
      {#if required}
        <span class="slider-required-indicator" aria-hidden="true">*</span>
      {/if}
      {#if showValue}
        <span class="slider-value">{formattedValue}</span>
      {/if}
    </label>
  {/if}

  <div class="slider-container">
    {#if showLabels}
      <div class="slider-labels">
        <span class="slider-label-min">{min}</span>
        <span class="slider-label-max">{max}</span>
      </div>
    {/if}

    <div class="slider-track-container">
      {#if showTicks}
        <div class="slider-ticks">
          {#each ticks as tick}
            <div 
              class="slider-tick"
              style="--tick-position: {tick.position}%"
            ></div>
          {/each}
        </div>
      {/if}

      <div class="slider-track" style="--track-size: {trackSize};">
        <div 
          class="slider-track-fill" 
          style="--fill-percentage: {percentage}%;"
        ></div>
      </div>

      <input
        id={sliderId}
        type="range"
        class={baseClasses}
        style="--thumb-size: {thumbSize}; --track-size: {trackSize};"
        {name}
        {min}
        {max}
        {step}
        {disabled}
        {readonly}
        {required}
        bind:value={internalValue}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedByValue}
        aria-invalid={errorMessage ? 'true' : undefined}
        aria-required={required ? 'true' : undefined}
        aria-valuenow={ariaValueNow}
        aria-valuemin={ariaValueMin}
        aria-valuemax={ariaValueMax}
        aria-valuetext={ariaValueText}
        on:change={handleChange}
        on:mousedown={handleMouseDown}
        on:mouseup={handleMouseUp}
        on:keydown={handleKeydown}
      />
    </div>

    {#if showValue && !label}
      <div class="slider-value-display">{formattedValue}</div>
    {/if}
  </div>

  {#if helperText || errorMessage}
    <div class="slider-helper">
      {#if errorMessage}
        <div id={errorId} class="slider-error" role="alert" aria-live="polite">
          {@html errorMessage}
        </div>
      {:else if helperText}
        <div id={helperId} class="slider-helper-text">
          {@html helperText}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Slider wrapper */
  .slider-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .slider-wrapper-sm {
    gap: var(--space-0-5);
  }

  .slider-wrapper-lg {
    gap: var(--space-1-5);
  }

  .slider-wrapper-vertical {
    gap: var(--space-2);
  }

  /* Label styles */
  .slider-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-family-sans);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .slider-label-sm {
    font-size: var(--font-size-sm);
  }

  .slider-label-lg {
    font-size: var(--font-size-lg);
  }

  .slider-label-disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
  }

  .slider-label-readonly {
    color: var(--text-secondary);
    cursor: default;
  }

  .slider-label-invalid {
    color: var(--color-danger);
  }

  .slider-required-indicator {
    color: var(--color-danger);
    font-weight: var(--font-weight-bold);
  }

  .slider-value {
    font-family: var(--font-family-mono);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  /* Slider container */
  .slider-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .slider-wrapper-vertical .slider-container {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
  }

  /* Min/max labels */
  .slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }

  .slider-wrapper-vertical .slider-labels {
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

  /* Track container */
  .slider-track-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .slider-wrapper-vertical .slider-track-container {
    height: 200px;
    flex-direction: column;
  }

  /* Tick marks */
  .slider-ticks {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    pointer-events: none;
  }

  .slider-wrapper-vertical .slider-ticks {
    top: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    height: auto;
  }

  .slider-tick {
    position: absolute;
    width: 2px;
    height: 4px;
    background-color: var(--border-default);
    border-radius: 1px;
    top: 50%;
    transform: translateY(-50%);
    left: var(--tick-position);
  }

  .slider-wrapper-vertical .slider-tick {
    width: 4px;
    height: 2px;
    top: auto;
    bottom: var(--tick-position);
    left: 50%;
    transform: translateX(-50%);
  }

  /* Track styles */
  .slider-track {
    position: relative;
    width: 100%;
    height: var(--track-size);
    background-color: var(--bg-tertiary);
    border-radius: calc(var(--track-size) / 2);
    overflow: hidden;
  }

  .slider-wrapper-vertical .slider-track {
    width: var(--track-size);
    height: 100%;
  }

  .slider-track-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: var(--fill-percentage);
    background-color: var(--color-primary);
    border-radius: inherit;
    transition: width var(--motion-fast) var(--ease-out);
  }

  .slider-wrapper-vertical .slider-track-fill {
    top: auto;
    bottom: 0;
    left: 0;
    width: 100%;
    height: var(--fill-percentage);
  }

  /* Hidden input */
  .slider {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 1;
  }

  .slider-wrapper-vertical .slider {
    width: 100%;
    height: 100%;
  }

  .slider-disabled {
    cursor: not-allowed;
  }

  .slider-readonly {
    cursor: default;
  }

  /* Custom thumb (visual only, since input is hidden) */
  .slider::-webkit-slider-thumb {
    appearance: none;
    width: var(--thumb-size);
    height: var(--thumb-size);
    border-radius: 50%;
    background-color: var(--color-primary);
    border: 2px solid var(--bg-primary);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-out);
  }

  .slider::-moz-range-thumb {
    width: var(--thumb-size);
    height: var(--thumb-size);
    border-radius: 50%;
    background-color: var(--color-primary);
    border: 2px solid var(--bg-primary);
    box-shadow: var(--shadow-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-out);
  }

  .slider:hover::-webkit-slider-thumb:not(.slider-disabled):not(.slider-readonly) {
    transform: scale(1.1);
    box-shadow: var(--shadow-lg);
  }

  .slider:hover::-moz-range-thumb:not(.slider-disabled):not(.slider-readonly) {
    transform: scale(1.1);
    box-shadow: var(--shadow-lg);
  }

  .slider-dragging::-webkit-slider-thumb {
    transform: scale(1.2);
    box-shadow: var(--shadow-xl);
  }

  .slider-dragging::-moz-range-thumb {
    transform: scale(1.2);
    box-shadow: var(--shadow-xl);
  }

  .slider-disabled::-webkit-slider-thumb {
    background-color: var(--bg-disabled);
    border-color: var(--border-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .slider-disabled::-moz-range-thumb {
    background-color: var(--bg-disabled);
    border-color: var(--border-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Variant styles */
  .slider-primary .slider-track-fill {
    background-color: var(--color-primary);
  }

  .slider-primary::-webkit-slider-thumb {
    background-color: var(--color-primary);
  }

  .slider-primary::-moz-range-thumb {
    background-color: var(--color-primary);
  }

  .slider-secondary .slider-track-fill {
    background-color: var(--color-secondary);
  }

  .slider-secondary::-webkit-slider-thumb {
    background-color: var(--color-secondary);
  }

  .slider-secondary::-moz-range-thumb {
    background-color: var(--color-secondary);
  }

  .slider-success .slider-track-fill {
    background-color: var(--color-success);
  }

  .slider-success::-webkit-slider-thumb {
    background-color: var(--color-success);
  }

  .slider-success::-moz-range-thumb {
    background-color: var(--color-success);
  }

  .slider-warning .slider-track-fill {
    background-color: var(--color-warning);
  }

  .slider-warning::-webkit-slider-thumb {
    background-color: var(--color-warning);
  }

  .slider-warning::-moz-range-thumb {
    background-color: var(--color-warning);
  }

  .slider-danger .slider-track-fill {
    background-color: var(--color-danger);
  }

  .slider-danger::-webkit-slider-thumb {
    background-color: var(--color-danger);
  }

  .slider-danger::-moz-range-thumb {
    background-color: var(--color-danger);
  }

  /* Value display */
  .slider-value-display {
    text-align: center;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    background-color: var(--bg-secondary);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-default);
  }

  /* Helper text */
  .slider-helper {
    display: flex;
    flex-direction: column;
    gap: var(--space-0-5);
  }

  .slider-helper-text {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  .slider-error {
    font-size: var(--font-size-xs);
    color: var(--color-danger);
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .slider-error::before {
    content: '⚠';
    font-size: var(--font-size-sm);
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .slider-track {
      background-color: var(--bg-tertiary-dark);
    }

    .slider-label {
      color: var(--text-secondary-dark);
    }

    .slider-label-disabled {
      color: var(--text-disabled-dark);
    }

    .slider-label-readonly {
      color: var(--text-secondary-dark);
    }

    .slider-value {
      color: var(--text-primary-dark);
    }

    .slider-value-display {
      background-color: var(--bg-secondary-dark);
      border-color: var(--border-default-dark);
      color: var(--text-primary-dark);
    }

    .slider-tick {
      background-color: var(--border-default-dark);
    }

    .slider-helper-text {
      color: var(--text-tertiary-dark);
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .slider-track {
      border: 2px solid var(--border-default);
    }

    .slider::-webkit-slider-thumb {
      border-width: 3px;
    }

    .slider::-moz-range-thumb {
      border-width: 3px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .slider-track-fill {
      transition: none;
    }

    .slider::-webkit-slider-thumb {
      transition: none;
    }

    .slider::-moz-range-thumb {
      transition: none;
    }
  }

  /* Print styles */
  @media print {
    .slider-track {
      background-color: white !important;
      border: 1px solid black !important;
    }

    .slider-track-fill {
      background-color: black !important;
    }

    .slider::-webkit-slider-thumb {
      background-color: black !important;
      border-color: white !important;
    }

    .slider::-moz-range-thumb {
      background-color: black !important;
      border-color: white !important;
    }

    .slider-value-display {
      background-color: white !important;
      border-color: black !important;
      color: black !important;
    }
  }
</style>
