<script>
  export let checked = false;
  export let disabled = false;
  export let size = 'medium'; // small, medium, large
  export let label = '';
  
  function toggle() {
    if (!disabled) {
      checked = !checked;
    }
  }
  
  function getClasses() {
    return [
      'toggle',
      `toggle-${size}`,
      checked && 'toggle-checked',
      disabled && 'toggle-disabled'
    ].filter(Boolean).join(' ');
  }
</script>

<label class="toggle-wrapper" class:disabled>
  <input 
    type="checkbox" 
    {checked} 
    {disabled} 
    on:change={toggle}
    class="toggle-input"
    aria-label={label}
  />
  <span class={getClasses()}></span>
  {#if label}
    <span class="toggle-label">{label}</span>
  {/if}
</label>

<style>
  .toggle-wrapper {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }
  
  .toggle-wrapper.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .toggle-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  
  .toggle {
    position: relative;
    display: inline-block;
    background-color: var(--bg-tertiary);
    border-radius: var(--radius-full);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .toggle-small {
    width: 32px;
    height: 18px;
  }
  
  .toggle-medium {
    width: 40px;
    height: 22px;
  }
  
  .toggle-large {
    width: 48px;
    height: 26px;
  }
  
  .toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    background-color: var(--bg-elevated);
    border-radius: var(--radius-full);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .toggle-small::after {
    width: 14px;
    height: 14px;
  }
  
  .toggle-medium::after {
    width: 18px;
    height: 18px;
  }
  
  .toggle-large::after {
    width: 22px;
    height: 22px;
  }
  
  .toggle-checked {
    background-color: var(--color-focus);
  }
  
  .toggle-checked::after {
    transform: translateX(12px);
  }
  
  .toggle-small.toggle-checked::after {
    transform: translateX(14px);
  }
  
  .toggle-medium.toggle-checked::after {
    transform: translateX(18px);
  }
  
  .toggle-large.toggle-checked::after {
    transform: translateX(22px);
  }
  
  .toggle-label {
    font-size: var(--text-sm);
    color: var(--text-primary);
    user-select: none;
  }
</style>
