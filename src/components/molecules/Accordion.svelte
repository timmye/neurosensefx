<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { Button, Icon, Badge } from '../atoms/index.js';
  
  // Component props
  export let items = [];
  export let activeItems = [];
  export let multiple = false; // Allow multiple items to be open
  export let collapsible = true; // Allow items to be collapsed
  export let bordered = true;
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'ghost', 'filled'
  export let iconPosition = 'left'; // 'left', 'right', 'none'
  export let showIcons = true;
  export let animated = true;
  export let chevron = true; // Show chevron icons
  export let keyboardNavigation = true;
  export let disabled = [];
  export let readonly = false;
  export let flush = false; // Remove borders between items
  export let alwaysOpen = false; // Keep at least one item open
  export let lazy = false; // Lazy load content
  export let rememberState = false; // Remember open state in localStorage
  
  const dispatch = createEventDispatcher();
  
  // Accordion state
  let accordionId = `accordion-${Math.random().toString(36).substr(2, 9)}`;
  let focusedIndex = -1;
  
  // Calculate CSS classes
  $: accordionClasses = [
    'accordion',
    `accordion--${variant}`,
    `accordion--${size}`,
    bordered && 'accordion--bordered',
    flush && 'accordion--flush',
    animated && 'accordion--animated',
    readonly && 'accordion--readonly'
  ].filter(Boolean).join(' ');
  
  // Filter out disabled items
  $: enabledItems = items.filter((_, index) => !disabled.includes(index));
  $: enabledIndices = items.map((_, index) => index).filter(index => !disabled.includes(index));
  
  // Initialize active items
  onMount(() => {
    // Load remembered state
    if (rememberState) {
      const remembered = localStorage.getItem(`${accordionId}-active-items`);
      if (remembered) {
        try {
          const rememberedItems = JSON.parse(remembered);
          if (Array.isArray(rememberedItems)) {
            activeItems = rememberedItems.filter(index => !disabled.includes(index) && index < items.length);
          }
        } catch (error) {
          console.warn('Failed to load remembered accordion state:', error);
        }
      }
    }
    
    // Ensure at least one item is open if alwaysOpen
    if (alwaysOpen && activeItems.length === 0 && enabledIndices.length > 0) {
      activeItems = [enabledIndices[0]];
    }
  });
  
  // Save state to localStorage
  $: if (rememberState && activeItems.length > 0) {
    localStorage.setItem(`${accordionId}-active-items`, JSON.stringify(activeItems));
  }
  
  // Handle item toggle
  function toggleItem(index, event) {
    if (readonly || disabled.includes(index)) return;
    
    const isActive = activeItems.includes(index);
    let newActiveItems;
    
    if (isActive) {
      if (!collapsible || (alwaysOpen && activeItems.length === 1)) {
        return; // Can't collapse if not collapsible or would leave no items open
      }
      newActiveItems = activeItems.filter(i => i !== index);
    } else {
      if (multiple) {
        newActiveItems = [...activeItems, index];
      } else {
        newActiveItems = [index];
      }
    }
    
    activeItems = newActiveItems;
    
    dispatch('change', { 
      activeItems: newActiveItems, 
      changedIndex: index, 
      isActive: !isActive,
      item: items[index]
    });
    
    dispatch('itemToggle', { 
      index, 
      isActive: !isActive, 
      item: items[index] 
    });
  }
  
  // Handle keyboard navigation
  function handleKeydown(event) {
    if (!keyboardNavigation || readonly) return;
    
    const { key } = event;
    
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        navigateFocus(1);
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        navigateFocus(-1);
        break;
        
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
        
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          toggleItem(focusedIndex, event);
        }
        break;
    }
  }
  
  // Navigate focus to next/previous item
  function navigateFocus(direction) {
    const newIndex = focusedIndex + direction;
    focusItem(newIndex);
  }
  
  // Focus specific item
  function focusItem(index) {
    if (index < 0 || index >= items.length || disabled.includes(index)) {
      return;
    }
    
    focusedIndex = index;
    
    // Focus the button element
    const button = document.querySelector(`[data-accordion-button="${index}"]`);
    if (button) {
      button.focus();
    }
  }
  
  // Get item classes
  function getItemClasses(index) {
    const isActive = activeItems.includes(index);
    const isDisabled = disabled.includes(index);
    
    return [
      'accordion__item',
      `accordion__item--${variant}`,
      `accordion__item--${size}`,
      isActive && 'accordion__item--active',
      isDisabled && 'accordion__item--disabled',
      !flush && 'accordion__item--bordered'
    ].filter(Boolean).join(' ');
  }
  
  // Get header classes
  function getHeaderClasses(index) {
    const isActive = activeItems.includes(index);
    const isDisabled = disabled.includes(index);
    
    return [
      'accordion__header',
      `accordion__header--${variant}`,
      `accordion__header--${size}`,
      isActive && 'accordion__header--active',
      isDisabled && 'accordion__header--disabled',
      readonly && 'accordion__header--readonly'
    ].filter(Boolean).join(' ');
  }
  
  // Get button classes
  function getButtonClasses(index) {
    const isActive = activeItems.includes(index);
    const isDisabled = disabled.includes(index);
    
    return [
      'accordion__button',
      `accordion__button--${variant}`,
      `accordion__button--${size}`,
      `accordion__button--icon-${iconPosition}`,
      isActive && 'accordion__button--active',
      isDisabled && 'accordion__button--disabled'
    ].filter(Boolean).join(' ');
  }
  
  // Get content classes
  function getContentClasses(index) {
    const isActive = activeItems.includes(index);
    const isLoaded = !lazy || isActive || items[index]._loaded;
    
    return [
      'accordion__content',
      `accordion__content--${variant}`,
      `accordion__content--${size}`,
      isActive && 'accordion__content--active',
      isLoaded && 'accordion__content--loaded',
      animated && 'accordion__content--animated'
    ].filter(Boolean).join(' ');
  }
  
  // Get chevron icon
  function getChevronIcon(index) {
    if (!chevron) return null;
    return activeItems.includes(index) ? 'chevron-down' : 'chevron-right';
  }
  
  // Mark item as loaded when it becomes active (for lazy loading)
  $: activeItems.forEach(index => {
    if (lazy && items[index] && !items[index]._loaded) {
      items[index]._loaded = true;
      items = items; // Trigger reactivity
    }
  });
</script>

<div 
  class={accordionClasses}
  on:keydown={handleKeydown}
  role="region"
  aria-label="Accordion"
>
  {#each items as item, index (index)}
    <div class={getItemClasses(index)}>
      <!-- Accordion header -->
      <div class={getHeaderClasses(index)}>
        <button
          type="button"
          class={getButtonClasses(index)}
          data-accordion-button={index}
          aria-expanded={activeItems.includes(index)}
          aria-controls={`${accordionId}-content-${index}`}
          aria-disabled={disabled.includes(index)}
          onclick={(e) => toggleItem(index, e)}
          disabled={disabled.includes(index) || readonly}
        >
          <!-- Left icon -->
          {#if showIcons && iconPosition === 'left' && item.icon}
            <Icon 
              name={item.icon} 
              size={size === 'lg' ? 'md' : 'sm'} 
              class="accordion__icon accordion__icon--left"
            />
          {/if}
          
          <!-- Chevron -->
          {#if chevron && iconPosition === 'left'}
            <Icon 
              name={getChevronIcon(index)} 
              size="sm" 
              class="accordion__chevron accordion__chevron--left"
            />
          {/if}
          
          <!-- Title and subtitle -->
          <div class="accordion__title-container">
            <div class="accordion__title">
              {item.title || `Item ${index + 1}`}
              
              <!-- Badge -->
              {#if item.badge}
                <Badge 
                  variant={item.badge.variant || 'default'} 
                  size="sm" 
                  class="accordion__badge"
                >
                  {item.badge.value}
                </Badge>
              {/if}
            </div>
            
            {#if item.subtitle}
              <div class="accordion__subtitle">{item.subtitle}</div>
            {/if}
          </div>
          
          <!-- Right icon -->
          {#if showIcons && iconPosition === 'right' && item.icon}
            <Icon 
              name={item.icon} 
              size={size === 'lg' ? 'md' : 'sm'} 
              class="accordion__icon accordion__icon--right"
            />
          {/if}
          
          <!-- Right chevron -->
          {#if chevron && iconPosition === 'right'}
            <Icon 
              name={getChevronIcon(index)} 
              size="sm" 
              class="accordion__chevron accordion__chevron--right"
            />
          {/if}
          
          <!-- Actions -->
          {#if item.actions && !readonly}
            <div class="accordion__actions">
              {#each item.actions as action}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={action.icon}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (action.handler) action.handler(item, index);
                  }}
                  title={action.title}
                  disabled={action.disabled}
                />
              {/each}
            </div>
          {/if}
        </button>
      </div>
      
      <!-- Accordion content -->
      <div
        id={`${accordionId}-content-${index}`}
        class={getContentClasses(index)}
        role="region"
        aria-labelledby={`${accordionId}-header-${index}`}
        hidden={!activeItems.includes(index)}
      >
        {#if !lazy || item._loaded}
          <div class="accordion__content-inner">
            {#if typeof item.content === 'function'}
              <item.content {item} {index} />
            {:else}
              {@html item.content}
            {/if}
          </div>
        {:else}
          <div class="accordion__placeholder">
            <Icon name="loader" class="accordion__placeholder-icon" />
            <span>Loading...</span>
          </div>
        {/if}
      </div>
    </div>
  {/each}
  
  <!-- Additional content slot -->
  {#if $$slots.additional}
    <div class="accordion__additional">
      <slot name="additional" />
    </div>
  {/if}
</div>

<style>
  .accordion {
    display: flex;
    flex-direction: column;
    width: 100%;
    font-family: var(--font-sans);
  }
  
  /* Accordion items */
  .accordion__item {
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-2);
    overflow: hidden;
    background: var(--bg-primary);
  }
  
  .accordion__item:last-child {
    margin-bottom: 0;
  }
  
  .accordion__item--bordered {
    border: 1px solid var(--border-default);
  }
  
  .accordion__item--active {
    border-color: var(--color-focus-subtle);
  }
  
  .accordion__item--disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  /* Flush variant */
  .accordion--flush .accordion__item {
    border-radius: 0;
    border-left: none;
    border-right: none;
    margin-bottom: 0;
  }
  
  .accordion--flush .accordion__item:first-child {
    border-top: 1px solid var(--border-default);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }
  
  .accordion--flush .accordion__item:last-child {
    border-bottom: 1px solid var(--border-default);
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }
  
  /* Accordion header */
  .accordion__header {
    background: var(--bg-primary);
  }
  
  .accordion__header--active {
    background: var(--bg-secondary);
  }
  
  /* Accordion button */
  .accordion__button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
    font-family: inherit;
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }
  
  .accordion__button:hover:not(.accordion__button--disabled) {
    background: var(--bg-secondary);
  }
  
  .accordion__button--active {
    background: var(--bg-secondary);
    color: var(--color-focus);
  }
  
  .accordion__button--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  /* Size variants */
  .accordion__button--sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
  }
  
  .accordion__button--lg {
    padding: var(--space-5) var(--space-6);
    font-size: var(--text-lg);
  }
  
  /* Icon positioning */
  .accordion__button--icon-left {
    justify-content: flex-start;
  }
  
  .accordion__button--icon-right {
    justify-content: space-between;
  }
  
  .accordion__button--icon-none {
    justify-content: flex-start;
  }
  
  /* Title container */
  .accordion__title-container {
    flex: 1;
    min-width: 0;
  }
  
  .accordion__title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--font-semibold);
    line-height: 1.3;
  }
  
  .accordion__subtitle {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-1);
    line-height: 1.3;
  }
  
  /* Icons and chevrons */
  .accordion__icon {
    flex-shrink: 0;
  }
  
  .accordion__chevron {
    flex-shrink: 0;
    transition: transform var(--motion-fast) var(--ease-snappy);
  }
  
  .accordion__button--active .accordion__chevron--left,
  .accordion__button--active .accordion__chevron--right {
    transform: rotate(90deg);
  }
  
  .accordion__badge {
    flex-shrink: 0;
  }
  
  .accordion__actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }
  
  /* Accordion content */
  .accordion__content {
    overflow: hidden;
  }
  
  .accordion__content--animated {
    transition: max-height var(--motion-normal) var(--ease-snappy);
  }
  
  .accordion__content-inner {
    padding: var(--space-4);
  }
  
  .accordion__content--active .accordion__content-inner {
    padding-top: 0;
  }
  
  /* Size variants for content */
  .accordion__content--sm .accordion__content-inner {
    padding: var(--space-2) var(--space-3);
  }
  
  .accordion__content--lg .accordion__content-inner {
    padding: var(--space-5) var(--space-6);
  }
  
  /* Placeholder for lazy loading */
  .accordion__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-6);
    color: var(--text-secondary);
  }
  
  .accordion__placeholder-icon {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Variant styles */
  .accordion--ghost .accordion__item {
    border: none;
    background: transparent;
  }
  
  .accordion--ghost .accordion__header {
    background: transparent;
  }
  
  .accordion--ghost .accordion__button {
    background: transparent;
    border-radius: var(--radius-md);
  }
  
  .accordion--ghost .accordion__button:hover {
    background: var(--bg-secondary);
  }
  
  .accordion--filled .accordion__item {
    background: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
  }
  
  .accordion--filled .accordion__header {
    background: var(--bg-secondary);
  }
  
  .accordion--filled .accordion__button--active {
    background: var(--bg-tertiary);
  }
  
  /* Additional content */
  .accordion__additional {
    margin-top: var(--space-4);
  }
  
  /* Readonly state */
  .accordion--readonly .accordion__actions {
    display: none;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .accordion__button {
      padding: var(--space-3);
      font-size: var(--text-sm);
    }
    
    .accordion__button--sm {
      padding: var(--space-2);
      font-size: var(--text-xs);
    }
    
    .accordion__button--lg {
      padding: var(--space-4);
      font-size: var(--text-base);
    }
    
    .accordion__content-inner {
      padding: var(--space-3);
    }
    
    .accordion__content--sm .accordion__content-inner {
      padding: var(--space-2);
    }
    
    .accordion__content--lg .accordion__content-inner {
      padding: var(--space-4);
    }
    
    .accordion__actions {
      gap: var(--space-0);
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .accordion__item {
      border-width: 2px;
    }
    
    .accordion__button {
      font-weight: var(--font-bold);
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .accordion__button,
    .accordion__chevron,
    .accordion__content--animated {
      transition: none !important;
    }
    
    .accordion__placeholder-icon {
      animation: none;
    }
  }
  
  /* Print styles */
  @media print {
    .accordion__content {
      display: block !important;
      height: auto !important;
    }
    
    .accordion__placeholder {
      display: none;
    }
    
    .accordion__actions {
      display: none;
    }
  }
</style>
