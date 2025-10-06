<script>
  import { createEventDispatcher } from 'svelte';
  import { Icon } from './index.js';
  
  export let options = [];
  export let value = '';
  export let placeholder = 'Select an option';
  export let disabled = false;
  export let required = false;
  export let error = '';
  export let size = 'md';
  export let variant = 'default';
  export let searchable = false;
  export let clearable = false;
  
  const dispatch = createEventDispatcher();
  
  let isOpen = false;
  let searchTerm = '';
  let filteredOptions = [];
  let selectedIndex = -1;
  let selectElement;
  
  $: displayValue = getDisplayValue(value);
  $: filteredOptions = searchable ? filterOptions(options, searchTerm) : options;
  
  function getDisplayValue(selectedValue) {
    if (!selectedValue) return '';
    const option = options.find(opt => 
      typeof opt === 'string' ? opt === selectedValue : opt.value === selectedValue
    );
    return option ? (typeof option === 'string' ? option : option.label) : '';
  }
  
  function filterOptions(opts, term) {
    if (!term) return opts;
    
    return opts.filter(opt => {
      const label = typeof opt === 'string' ? opt : opt.label;
      return label.toLowerCase().includes(term.toLowerCase());
    });
  }
  
  function handleToggle() {
    if (disabled) return;
    isOpen = !isOpen;
    searchTerm = '';
    selectedIndex = -1;
    
    if (isOpen) {
      // Focus search input if searchable
      setTimeout(() => {
        const searchInput = selectElement?.querySelector('.search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }, 0);
    }
  }
  
  function handleSelect(option) {
    const optionValue = typeof option === 'string' ? option : option.value;
    const optionLabel = typeof option === 'string' ? option : option.label;
    
    value = optionValue;
    isOpen = false;
    searchTerm = '';
    selectedIndex = -1;
    
    dispatch('change', { value: optionValue, label: optionLabel });
  }
  
  function handleClear(event) {
    event.stopPropagation();
    value = '';
    isOpen = false;
    searchTerm = '';
    selectedIndex = -1;
    
    dispatch('change', { value: '', label: '' });
    dispatch('clear');
  }
  
  function handleKeydown(event) {
    if (disabled) return;
    
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          handleToggle();
        } else if (selectedIndex >= 0) {
          handleSelect(filteredOptions[selectedIndex]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        isOpen = false;
        searchTerm = '';
        selectedIndex = -1;
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          handleToggle();
        } else {
          selectedIndex = Math.min(selectedIndex + 1, filteredOptions.length - 1);
          scrollToSelected();
        }
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          selectedIndex = Math.max(selectedIndex - 1, 0);
          scrollToSelected();
        }
        break;
        
      case 'Tab':
        isOpen = false;
        break;
    }
  }
  
  function handleSearchKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredOptions.length - 1);
        scrollToSelected();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
        
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(filteredOptions[selectedIndex]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        isOpen = false;
        searchTerm = '';
        selectedIndex = -1;
        break;
    }
  }
  
  function scrollToSelected() {
    if (selectedIndex < 0) return;
    
    const container = selectElement?.querySelector('.options-container');
    const selected = container?.querySelectorAll('.option')[selectedIndex];
    
    if (selected && container) {
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      
      if (selectedRect.bottom > containerRect.bottom) {
        container.scrollTop += selectedRect.bottom - containerRect.bottom;
      } else if (selectedRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - selectedRect.top;
      }
    }
  }
  
  function handleClickOutside(event) {
    if (!selectElement?.contains(event.target)) {
      isOpen = false;
      searchTerm = '';
      selectedIndex = -1;
    }
  }
  
  function isSelected(option) {
    const optionValue = typeof option === 'string' ? option : option.value;
    return optionValue === value;
  }
  
  // Handle click outside
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside);
  }
</script>

<div 
  bind:this={selectElement}
  class="select {size} {variant} {disabled ? 'disabled' : ''} {error ? 'error' : ''} {isOpen ? 'open' : ''}"
  on:keydown={handleKeydown}
  tabindex={disabled ? -1 : 0}
  role="combobox"
  aria-expanded={isOpen}
  aria-required={required}
  aria-invalid={!!error}
>
  <!-- Select Trigger -->
  <div 
    class="select-trigger {!value ? 'placeholder' : ''}"
    on:click={handleToggle}
  >
    <span class="select-value">
      {#if value}
        {displayValue}
      {:else}
        {placeholder}
      {/if}
    </span>
    
    <div class="select-actions">
      {#if clearable && value && !disabled}
        <button 
          class="clear-button"
          on:click={handleClear}
          type="button"
          aria-label="Clear selection"
        >
          <Icon name="x" size="xs" />
        </button>
      {/if}
      
      <Icon 
        name="chevron-down" 
        size="sm" 
        class="dropdown-icon {isOpen ? 'rotated' : ''}"
      />
    </div>
  </div>
  
  <!-- Options Dropdown -->
  {#if isOpen}
    <div class="select-dropdown">
      {#if searchable}
        <div class="search-container">
          <input
            type="text"
            class="search-input"
            bind:value={searchTerm}
            on:keydown={handleSearchKeydown}
            placeholder="Search options..."
            autocomplete="off"
          />
        </div>
      {/if}
      
      <div class="options-container">
        {#if filteredOptions.length === 0}
          <div class="no-options">
            {searchTerm ? 'No options found' : 'No options available'}
          </div>
        {:else}
          {#each filteredOptions as option, index}
            <div
              class="option {isSelected(option) ? 'selected' : ''} {index === selectedIndex ? 'focused' : ''}"
              on:click={() => handleSelect(option)}
              on:mouseenter={() => selectedIndex = index}
              role="option"
              aria-selected={isSelected(option)}
            >
              {#if typeof option === 'object' && option.icon}
                <Icon name={option.icon} size="sm" class="option-icon" />
              {/if}
              
              <span class="option-label">
                {typeof option === 'string' ? option : option.label}
              </span>
              
              {#if typeof option === 'object' && option.description}
                <span class="option-description">{option.description}</span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
  
  <!-- Error Message -->
  {#if error}
    <div class="error-message">
      <Icon name="alert-circle" size="xs" />
      <span>{error}</span>
    </div>
  {/if}
</div>

<style>
  .select {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .select:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    background: var(--bg-secondary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
    min-height: 40px;
  }
  
  .select:hover .select-trigger {
    border-color: var(--border-hover);
    background: var(--bg-tertiary);
  }
  
  .select:focus .select-trigger {
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px var(--color-focus-subtle);
  }
  
  .select.error .select-trigger {
    border-color: var(--color-danger);
  }
  
  .select.disabled .select-trigger {
    background: var(--bg-disabled);
    border-color: var(--border-disabled);
    color: var(--text-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  .select-value {
    flex: 1;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .select-value.placeholder {
    color: var(--text-tertiary);
  }
  
  .select-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .clear-button:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  .dropdown-icon {
    transition: transform var(--motion-fast) var(--ease-snappy);
    color: var(--text-secondary);
  }
  
  .dropdown-icon.rotated {
    transform: rotate(180deg);
  }
  
  .select-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 1000;
    background: var(--bg-primary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    margin-top: var(--space-1);
    overflow: hidden;
  }
  
  .search-container {
    padding: var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .search-input {
    width: 100%;
    padding: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
  
  .search-input:focus {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  
  .options-container {
    max-height: 200px;
    overflow-y: auto;
  }
  
  .option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
    border-bottom: 1px solid transparent;
  }
  
  .option:hover,
  .option.focused {
    background: var(--bg-tertiary);
  }
  
  .option.selected {
    background: var(--color-primary-subtle);
    color: var(--color-primary);
  }
  
  .option:last-child {
    border-bottom: none;
  }
  
  .option-icon {
    flex-shrink: 0;
  }
  
  .option-label {
    flex: 1;
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }
  
  .option-description {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }
  
  .no-options {
    padding: var(--space-3);
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
  }
  
  .error-message {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--color-danger);
  }
  
  /* Size Variants */
  .select.sm .select-trigger {
    padding: var(--space-1) var(--space-2);
    min-height: 32px;
    font-size: var(--font-size-xs);
  }
  
  .select.lg .select-trigger {
    padding: var(--space-3) var(--space-4);
    min-height: 48px;
    font-size: var(--font-size-base);
  }
  
  /* Variant Styles */
  .select.outline .select-trigger {
    background: transparent;
    border-width: 2px;
  }
  
  .select.filled .select-trigger {
    background: var(--bg-tertiary);
    border: none;
  }
  
  .select.underlined .select-trigger {
    background: transparent;
    border: none;
    border-bottom: 2px solid var(--border-default);
    border-radius: 0;
    padding-left: 0;
    padding-right: 0;
  }
  
  .select.underlined .select-trigger:focus {
    border-bottom-color: var(--color-focus);
  }
</style>
