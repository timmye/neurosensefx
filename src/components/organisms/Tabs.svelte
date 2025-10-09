<script>
  import { createEventDispatcher, setContext, onMount } from 'svelte';
  import { Button, Badge, Icon } from '../atoms/index.js';
  
  // Component props
  export let tabs = [];
  export let activeTab = 0;
  export let variant = 'default'; // 'default', 'pills', 'underline', 'card'
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let orientation = 'horizontal'; // 'horizontal', 'vertical'
  export let justified = false; // Stretch tabs to fill container
  export let vertical = false; // Alias for orientation='vertical'
  export let pills = false; // Alias for variant='pills'
  export let underline = false; // Alias for variant='underline'
  export let card = false; // Alias for variant='card'
  export let showBadges = false;
  export let showIcons = true;
  export let showCloseButtons = false;
  export let closable = false;
  export let addable = false;
  export let draggable = false;
  export let scrollable = false;
  export let animated = true;
  export let lazy = false; // Lazy load tab content
  export let rememberActive = false; // Remember active tab in localStorage
  export let keyboardNavigation = true;
  export let disabled = [];
  export let readonly = false;
  
  const dispatch = createEventDispatcher();
  
  // Tab state
  let tabListElement;
  let activeTabElement;
  let indicatorElement;
  let scrollContainer;
  let draggedTab = null;
  let dragOverTab = null;
  
  // Generate unique tabs ID
  $: tabsId = `tabs-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate CSS classes
  $: tabsClasses = [
    'tabs',
    `tabs--${variant}`,
    `tabs--${size}`,
    `tabs--${orientation}`,
    justified && 'tabs--justified',
    animated && 'tabs--animated',
    scrollable && 'tabs--scrollable',
    readonly && 'tabs--readonly'
  ].filter(Boolean).join(' ');
  
  $: tabListClasses = [
    'tabs__list',
    `tabs__list--${variant}`,
    `tabs__list--${orientation}`,
    justified && 'tabs__list--justified',
    scrollable && 'tabs__list--scrollable'
  ].filter(Boolean).join(' ');
  
  $: panelClasses = [
    'tabs__panel',
    animated && 'tabs__panel--animated',
    lazy && 'tabs__panel--lazy'
  ].filter(Boolean).join(' ');
  
  // Handle variant aliases
  $: actualVariant = pills ? 'pills' : underline ? 'underline' : card ? 'card' : variant;
  $: actualOrientation = vertical ? 'vertical' : orientation;
  
  // Filter out disabled tabs for active tab calculation
  $: enabledTabs = tabs.filter((_, index) => !disabled.includes(index));
  $: enabledTabIndices = tabs.map((_, index) => index).filter(index => !disabled.includes(index));
  
  // Ensure active tab is not disabled
  $: validActiveTab = disabled.includes(activeTab) 
    ? (enabledTabIndices[0] || 0)
    : activeTab;
  
  // Active tab content
  $: activeTabContent = tabs[validActiveTab];
  
  // Initialize tabs
  onMount(() => {
    // Load remembered active tab
    if (rememberActive) {
      const remembered = localStorage.getItem(`${tabsId}-active-tab`);
      if (remembered !== null) {
        const rememberedIndex = parseInt(remembered, 10);
        if (!disabled.includes(rememberedIndex) && rememberedIndex < tabs.length) {
          activeTab = rememberedIndex;
        }
      }
    }
    
    // Update indicator position
    updateIndicator();
  });
  
  // Update indicator when active tab changes
  $: if (activeTabElement && indicatorElement && actualVariant === 'underline') {
    updateIndicator();
  }
  
  // Save active tab to localStorage
  $: if (rememberActive && validActiveTab !== undefined) {
    localStorage.setItem(`${tabsId}-active-tab`, validActiveTab.toString());
  }
  
  // Handle tab activation
  function activateTab(index, event) {
    if (readonly || disabled.includes(index) || index === validActiveTab) return;
    
    const previousTab = validActiveTab;
    activeTab = index;
    
    dispatch('change', { 
      activeTab: index, 
      previousTab, 
      tab: tabs[index],
      tabs 
    });
    
    // Scroll tab into view if needed
    if (scrollable && tabListElement) {
      const tabElement = tabListElement.children[index];
      if (tabElement) {
        tabElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'center' 
        });
      }
    }
  }
  
  // Handle tab close
  function closeTab(index, event) {
    if (!closable || readonly) return;
    
    event.stopPropagation();
    
    const tab = tabs[index];
    const newTabs = tabs.filter((_, i) => i !== index);
    const newDisabled = disabled.map(d => d > index ? d - 1 : d).filter(d => d < newTabs.length);
    
    // Adjust active tab if needed
    if (activeTab === index && activeTab > 0) {
      activeTab = activeTab - 1;
    } else if (activeTab > index) {
      activeTab = activeTab - 1;
    }
    
    tabs = newTabs;
    disabled = newDisabled;
    
    dispatch('close', { index, tab, tabs: newTabs });
  }
  
  // Handle tab add
  function addTab() {
    if (!addable || readonly) return;
    
    const newTab = {
      id: `tab-${Date.now()}`,
      title: `New Tab ${tabs.length + 1}`,
      content: '',
      closable: true
    };
    
    tabs = [...tabs, newTab];
    activeTab = tabs.length - 1;
    
    dispatch('add', { tab: newTab, index: tabs.length - 1, tabs });
  }
  
  // Handle keyboard navigation
  function handleKeydown(event) {
    if (!keyboardNavigation || readonly) return;
    
    const { key } = event;
    
    switch (key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        if (actualOrientation === 'horizontal' ? key === 'ArrowLeft' : key === 'ArrowUp') {
          event.preventDefault();
          navigateTabs(-1);
        }
        break;
        
      case 'ArrowRight':
      case 'ArrowDown':
        if (actualOrientation === 'horizontal' ? key === 'ArrowRight' : key === 'ArrowDown') {
          event.preventDefault();
          navigateTabs(1);
        }
        break;
        
      case 'Home':
        event.preventDefault();
        activateTab(enabledTabIndices[0], event);
        break;
        
      case 'End':
        event.preventDefault();
        activateTab(enabledTabIndices[enabledTabIndices.length - 1], event);
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        activateTab(validActiveTab, event);
        break;
    }
  }
  
  // Navigate to next/previous enabled tab
  function navigateTabs(direction) {
    const currentIndex = enabledTabIndices.indexOf(validActiveTab);
    const newIndex = currentIndex + direction;
    
    if (newIndex >= 0 && newIndex < enabledTabIndices.length) {
      activateTab(enabledTabIndices[newIndex], { preventDefault: () => {} });
    }
  }
  
  // Update underline indicator position
  function updateIndicator() {
    if (!activeTabElement || !indicatorElement) return;
    
    const tabRect = activeTabElement.getBoundingClientRect();
    const containerRect = tabListElement.getBoundingClientRect();
    
    indicatorElement.style.width = `${tabRect.width}px`;
    indicatorElement.style.left = `${tabRect.left - containerRect.left}px`;
  }
  
  // Handle drag start
  function handleDragStart(index, event) {
    if (!draggable || readonly) return;
    
    draggedTab = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', '');
    
    // Add dragging class
    event.target.classList.add('tabs__tab--dragging');
  }
  
  // Handle drag over
  function handleDragOver(index, event) {
    if (!draggable || readonly) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    if (dragOverTab !== index) {
      dragOverTab = index;
    }
  }
  
  // Handle drop
  function handleDrop(index, event) {
    if (!draggable || readonly || draggedTab === null) return;
    
    event.preventDefault();
    
    if (draggedTab !== index) {
      const newTabs = [...tabs];
      const draggedTabData = newTabs[draggedTab];
      
      // Remove dragged tab
      newTabs.splice(draggedTab, 1);
      
      // Insert at new position
      const insertIndex = draggedTab < index ? index - 1 : index;
      newTabs.splice(insertIndex, 0, draggedTabData);
      
      // Update active tab index if needed
      if (activeTab === draggedTab) {
        activeTab = insertIndex;
      } else if (activeTab > draggedTab && activeTab <= index) {
        activeTab = activeTab - 1;
      } else if (activeTab < draggedTab && activeTab >= index) {
        activeTab = activeTab + 1;
      }
      
      tabs = newTabs;
      
      dispatch('reorder', { 
        fromIndex: draggedTab, 
        toIndex: insertIndex, 
        tabs: newTabs 
      });
    }
    
    // Clean up
    draggedTab = null;
    dragOverTab = null;
  }
  
  // Handle drag end
  function handleDragEnd(event) {
    if (!draggable) return;
    
    // Remove dragging class
    event.target.classList.remove('tabs__tab--dragging');
    
    draggedTab = null;
    dragOverTab = null;
  }
  
  // Get tab button classes
  function getTabButtonClasses(index) {
    const tab = tabs[index];
    const isActive = index === validActiveTab;
    const isDisabled = disabled.includes(index);
    
    return [
      'tabs__tab',
      `tabs__tab--${actualVariant}`,
      `tabs__tab--${size}`,
      isActive && 'tabs__tab--active',
      isDisabled && 'tabs__tab--disabled',
      tab.closable && closable && 'tabs__tab--closable',
      draggedTab === index && 'tabs__tab--dragging',
      dragOverTab === index && 'tabs__tab--drag-over'
    ].filter(Boolean).join(' ');
  }
  
  // Get tab panel classes
  function getTabPanelClasses(index) {
    const isActive = index === validActiveTab;
    const isLoaded = !lazy || isActive || tabs[index]._loaded;
    
    return [
      'tabs__panel-item',
      isActive && 'tabs__panel-item--active',
      isLoaded && 'tabs__panel-item--loaded'
    ].filter(Boolean).join(' ');
  }
  
  // Mark tab as loaded when it becomes active (for lazy loading)
  $: if (lazy && activeTabContent && !activeTabContent._loaded) {
    activeTabContent._loaded = true;
    tabs = tabs; // Trigger reactivity
  }
  
  // Action to set active tab reference
  function setActiveTabRef(element, isActive) {
    if (isActive) {
      activeTabElement = element;
    }
    return {};
  }
</script>

<div class={tabsClasses} on:keydown={handleKeydown}>
  <!-- Tab list -->
  <div 
    class={tabListClasses}
    role="tablist"
    bind:this={tabListElement}
  >
    <!-- Add button -->
    {#if addable && !readonly}
      <Button
        variant="ghost"
        size="sm"
        icon="plus"
        onClick={addTab}
        class="tabs__add-button"
        title="Add new tab"
      />
    {/if}
    
    <!-- Tab buttons -->
    {#each tabs as tab, index (index)}
      <button
        type="button"
        class={getTabButtonClasses(index)}
        role="tab"
        aria-selected={index === validActiveTab}
        aria-controls={`${tabsId}-panel-${index}`}
        aria-disabled={disabled.includes(index)}
        tabindex={index === validActiveTab ? 0 : -1}
        onclick={(e) => activateTab(index, e)}
        on:dragstart={(e) => handleDragStart(index, e)}
        on:dragover={(e) => handleDragOver(index, e)}
        on:drop={(e) => handleDrop(index, e)}
        on:dragend={handleDragEnd}
        use:setActiveTabRef={index === validActiveTab}
      >
        <!-- Tab icon -->
        {#if showIcons && tab.icon}
          <Icon name={tab.icon} size="sm" class="tabs__tab-icon" />
        {/if}
        
        <!-- Tab title -->
        <span class="tabs__tab-title">{tab.title || `Tab ${index + 1}`}</span>
        
        <!-- Tab badge -->
        {#if showBadges && tab.badge}
          <Badge 
            variant={tab.badge.variant || 'default'} 
            size="sm" 
            class="tabs__tab-badge"
          >
            {tab.badge.value}
          </Badge>
        {/if}
        
        <!-- Close button -->
        {#if closable && tab.closable !== false && !readonly}
          <button
            type="button"
            class="tabs__tab-close"
            aria-label={`Close ${tab.title || `Tab ${index + 1}`}`}
            onclick={(e) => closeTab(index, e)}
          >
            <Icon name="x" size="xs" />
          </button>
        {/if}
      </button>
    {/each}
    
    <!-- Underline indicator -->
    {#if actualVariant === 'underline'}
      <div class="tabs__indicator" bind:this={indicatorElement}></div>
    {/if}
  </div>
  
  <!-- Tab panels -->
  <div class={panelClasses}>
    {#each tabs as tab, index (index)}
      <div
        id={`${tabsId}-panel-${index}`}
        class={getTabPanelClasses(index)}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${index}`}
        hidden={index !== validActiveTab}
      >
        {#if !lazy || tab._loaded}
          {#if typeof tab.content === 'function'}
            <tab.content {tab} {index} />
          {:else}
            {@html tab.content}
          {/if}
        {:else}
          <div class="tabs__placeholder">
            <Icon name="loader" class="tabs__placeholder-icon" />
            <span>Loading...</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  
  <!-- Additional content slot -->
  {#if $$slots.additional}
    <div class="tabs__additional">
      <slot name="additional" />
    </div>
  {/if}
</div>

<style>
  .tabs {
    display: flex;
    flex-direction: column;
    width: 100%;
    font-family: var(--font-sans);
  }
  
  /* Tab list */
  .tabs__list {
    display: flex;
    position: relative;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-default);
  }
  
  .tabs__list--horizontal {
    flex-direction: row;
  }
  
  .tabs__list--vertical {
    flex-direction: column;
    border-bottom: none;
    border-right: 1px solid var(--border-default);
    width: 200px;
    flex-shrink: 0;
  }
  
  .tabs__list--justified {
    justify-content: space-between;
  }
  
  .tabs__list--scrollable {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  .tabs__list--scrollable::-webkit-scrollbar {
    display: none;
  }
  
  /* Tab buttons */
  .tabs__tab {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
    white-space: nowrap;
    position: relative;
    user-select: none;
  }
  
  .tabs__tab:hover:not(.tabs__tab--disabled) {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }
  
  .tabs__tab--active {
    color: var(--color-focus);
    background: var(--bg-secondary);
  }
  
  .tabs__tab--disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  .tabs__tab--closable {
    padding-right: var(--space-8);
  }
  
  .tabs__tab--dragging {
    opacity: 0.5;
  }
  
  .tabs__tab--drag-over {
    border-bottom: 2px solid var(--color-focus);
  }
  
  /* Variant styles */
  .tabs__tab--default {
    border-bottom: 2px solid transparent;
  }
  
  .tabs__tab--default.tabs__tab--active {
    border-bottom-color: var(--color-focus);
  }
  
  .tabs__tab--pills {
    border-radius: var(--radius-full);
    margin: var(--space-1);
  }
  
  .tabs__tab--pills.tabs__tab--active {
    background: var(--color-focus);
    color: white;
    border-bottom: none;
  }
  
  .tabs__tab--card {
    border: 1px solid var(--border-default);
    border-bottom: none;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    margin-bottom: -1px;
  }
  
  .tabs__tab--card.tabs__tab--active {
    background: var(--bg-primary);
    border-bottom: 1px solid var(--bg-primary);
  }
  
  .tabs__tab--underline {
    border-bottom: 2px solid transparent;
  }
  
  .tabs__tab--underline.tabs__tab--active {
    border-bottom-color: var(--color-focus);
  }
  
  /* Size variants */
  .tabs__tab--sm {
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
  }
  
  .tabs__tab--lg {
    padding: var(--space-4) var(--space-6);
    font-size: var(--text-base);
  }
  
  /* Tab elements */
  .tabs__tab-icon {
    flex-shrink: 0;
  }
  
  .tabs__tab-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .tabs__tab-badge {
    flex-shrink: 0;
  }
  
  .tabs__tab-close {
    position: absolute;
    top: 50%;
    right: var(--space-2);
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .tabs__tab-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  
  /* Add button */
  .tabs__add-button {
    margin: var(--space-1);
    flex-shrink: 0;
  }
  
  /* Underline indicator */
  .tabs__indicator {
    position: absolute;
    bottom: 0;
    height: 2px;
    background: var(--color-focus);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  /* Tab panels */
  .tabs__panel {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  
  .tabs__panel--animated {
    transition: height var(--motion-normal) var(--ease-snappy);
  }
  
  .tabs__panel-item {
    width: 100%;
    height: 100%;
  }
  
  .tabs__panel-item--active {
    display: block;
  }
  
  .tabs__panel-item:not(.tabs__panel-item--active) {
    display: none;
  }
  
  .tabs__panel--animated .tabs__panel-item {
    transition: opacity var(--motion-normal) var(--ease-snappy),
                transform var(--motion-normal) var(--ease-snappy);
  }
  
  .tabs__panel--animated .tabs__panel-item--active {
    opacity: 1;
    transform: translateX(0);
  }
  
  .tabs__panel--animated .tabs__panel-item:not(.tabs__panel-item--active) {
    opacity: 0;
    transform: translateX(20px);
  }
  
  /* Placeholder for lazy loading */
  .tabs__placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-8);
    color: var(--text-secondary);
  }
  
  .tabs__placeholder-icon {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Additional content */
  .tabs__additional {
    margin-top: var(--space-4);
  }
  
  /* Readonly state */
  .tabs--readonly .tabs__tab-close {
    display: none;
  }
  
  .tabs--readonly .tabs__add-button {
    display: none;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .tabs__list--vertical {
      width: 150px;
    }
    
    .tabs__tab {
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-xs);
    }
    
    .tabs__tab-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .tabs__tab-badge {
      display: none;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .tabs__tab {
      border-bottom-width: 3px;
    }
    
    .tabs__tab--card {
      border-width: 2px;
    }
    
    .tabs__indicator {
      height: 3px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .tabs__tab,
    .tabs__indicator,
    .tabs__panel,
    .tabs__panel-item {
      transition: none !important;
    }
    
    .tabs__placeholder-icon {
      animation: none;
    }
  }
  
  /* Print styles */
  @media print {
    .tabs__list {
      display: none;
    }
    
    .tabs__panel-item {
      display: block !important;
      page-break-inside: avoid;
    }
    
    .tabs__placeholder {
      display: none;
    }
  }
</style>
