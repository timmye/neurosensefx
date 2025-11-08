<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { parameterGroups, getParameterMetadata, getParameterMetadataWithPercentage, isPercentageParameter } from './utils/parameterGroups.js';
  import { searchParameters } from './utils/searchUtils.js';
  // Simple highlight function for search results
  function highlightMatch(text, query) {
    if (!query || !text) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
  import { createShortcutHandler, defaultShortcuts } from './utils/keyboardShortcuts.js';
  import { displays } from '../../stores/displayStore.js';
  
  export let displayId = null;
  export let onParameterChange = () => {};
  export let onMultipleParameterChange = () => {};
  export let onReset = () => {};
  
  const dispatch = createEventDispatcher();
  
  // Component state
  let activeTab = 0;
  let searchQuery = '';
  let searchResults = [];
  let showSearchResults = false;
  let selectedSearchIndex = 0;
  let menuElement = null;
  let searchInput = null;
  let cleanupShortcuts = null;
  let config = {};
  
  // Get display config from store
  $: if (displayId && $displays.has(displayId)) {
    config = $displays.get(displayId).config || {};
  }
  
  // Tab components mapping
  const tabComponents = parameterGroups;
  
  // Handle tab navigation
  function switchTab(index) {
    if (index >= 0 && index < parameterGroups.length) {
      activeTab = index;
      clearSearch();
    }
  }
  
  // Handle parameter changes
  function handleParameterChange(parameter, value) {
    // Update local config
    config = { ...config, [parameter]: value };
    
    // Call parent handler
    onParameterChange(parameter, value);
  }
  
  // Handle search
  function handleSearch(event) {
    const query = event.target.value;
    searchQuery = query;
    
    if (query.trim() === '') {
      clearSearch();
      return;
    }
    
    searchResults = searchParameters(query, 30, 10);
    showSearchResults = searchResults.length > 0;
    selectedSearchIndex = 0;
  }
  
  function clearSearch() {
    searchQuery = '';
    searchResults = [];
    showSearchResults = false;
    selectedSearchIndex = 0;
  }
  
  function selectSearchResult(result) {
    if (!result) return;
    
    // Switch to the tab containing this parameter
    const tabIndex = parameterGroups.findIndex(group => group.id === result.group);
    if (tabIndex !== -1) {
      switchTab(tabIndex);
    }
    
    clearSearch();
  }
  
  function navigateSearchResults(direction) {
    if (!showSearchResults || searchResults.length === 0) return;
    
    if (direction === 'next') {
      selectedSearchIndex = (selectedSearchIndex + 1) % searchResults.length;
    } else {
      selectedSearchIndex = selectedSearchIndex === 0 
        ? searchResults.length - 1 
        : selectedSearchIndex - 1;
    }
  }
  
  function selectHighlightedResult() {
    if (showSearchResults && searchResults[selectedSearchIndex]) {
      selectSearchResult(searchResults[selectedSearchIndex]);
    }
  }
  
  // Handle keyboard shortcuts
  function handleShortcutAction(actionData) {
    const { action, params } = actionData;
    
    switch (action) {
      case 'nextTab':
        switchTab((activeTab + 1) % parameterGroups.length);
        break;
      case 'prevTab':
        switchTab(activeTab === 0 ? parameterGroups.length - 1 : activeTab - 1);
        break;
      case 'goToTab':
        switchTab(params.tabIndex);
        break;
      case 'focusSearch':
        if (searchInput) {
          searchInput.focus();
        }
        break;
      case 'clearSearch':
        if (searchQuery.trim() === '') {
          handleClose();
        } else {
          clearSearch();
        }
        break;
      case 'selectSearchResult':
        selectHighlightedResult();
        break;
      case 'nextSearchResult':
        navigateSearchResults('next');
        break;
      case 'prevSearchResult':
        navigateSearchResults('prev');
        break;
      case 'resetToDefaults':
        handleReset();
        break;
      case 'closeMenu':
        handleClose();
        break;
      case 'applyAndClose':
        handleClose();
        break;
    }
  }
  
  // Handle menu actions
  function handleReset() {
    onReset();
  }
  
  function handleClose() {
    dispatch('close', { displayId });
  }
  
  // Handle click outside to close
  function handleClickOutside(event) {
    if (menuElement && !menuElement.contains(event.target)) {
      handleClose();
    }
  }
  
  // Lifecycle
  onMount(() => {
    // Setup keyboard shortcuts
    cleanupShortcuts = createShortcutHandler({
      onAction: handleShortcutAction,
      target: menuElement
    });
    
    // Add click outside listener
    document.addEventListener('click', handleClickOutside);
  });
  
  onDestroy(() => {
    // Cleanup shortcuts
    if (cleanupShortcuts) {
      cleanupShortcuts();
    }
    
    // Remove click outside listener
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<svelte:window on:keydown={(e) => {
  if (e.key === 'Escape') {
    if (searchQuery.trim() === '') {
      handleClose();
    } else {
      clearSearch();
    }
  }
}} />

<div
  bind:this={menuElement}
  class="canvas-tabbed-interface"
  on:click|stopPropagation
>
  <!-- Menu Header with Search -->
  <div class="menu-header">
    <div class="header-left">
      <h3>Canvas Controls</h3>
      {#if displayId}
        <span class="canvas-id">ID: {displayId}</span>
      {/if}
    </div>
    <div class="header-right">
      <!-- Search Input -->
      <div class="search-container">
        <input 
          bind:this={searchInput}
          id="search-input"
          type="text" 
          placeholder="Search parameters..."
          class="search-input"
          bind:value={searchQuery}
          on:input={handleSearch}
          on:keydown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              navigateSearchResults('next');
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              navigateSearchResults('prev');
            } else if (e.key === 'Enter') {
              e.preventDefault();
              selectHighlightedResult();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              clearSearch();
            }
          }}
        />
        {#if searchQuery}
          <button class="search-clear" on:click={clearSearch}>×</button>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Search Results Dropdown -->
  {#if showSearchResults}
    <div class="search-results" role="listbox" aria-label="Search results">
      {#each searchResults as result, index}
        <div 
          class="search-result {index === selectedSearchIndex ? 'selected' : ''}"
          role="option"
          aria-selected={index === selectedSearchIndex}
          tabindex={index === selectedSearchIndex ? '0' : '-1'}
          on:click={() => selectSearchResult(result)}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectSearchResult(result);
            }
          }}
          on:mouseover={() => selectedSearchIndex = index}
        >
          <div class="result-label">
            {@html highlightMatch(result.label, searchQuery)}
          </div>
          <div class="result-group">{result.groupTitle}</div>
        </div>
      {/each}
    </div>
  {/if}
  
  <!-- Tab Navigation -->
  <div class="tab-navigation">
    {#each parameterGroups as group, index}
      <button 
        class="tab-button {activeTab === index ? 'active' : ''}"
        on:click={() => switchTab(index)}
        title={group.description}
      >
        <span class="tab-icon">{group.title.charAt(0)}</span>
        <span class="tab-label">{group.title}</span>
      </button>
    {/each}
  </div>
  
  <!-- Tab Content -->
  <div class="tab-content-container">
    {#each parameterGroups as group, index}
      {#if activeTab === index}
        <div class="tab-content">
          <div class="parameter-group">
            <h4>{group.title}</h4>
            <p class="group-description">{group.description}</p>
            
            <div class="parameters-grid">
              {#each group.parameters as parameter}
                {@const metadata = getParameterMetadata(parameter)}
                {@const controlId = `param-${parameter}`}
                {#if metadata}
                  <div class="parameter-control">
                    <label class="parameter-label" for={controlId}>
                      {metadata.label}
                    </label>
                    
                    {#if metadata.type === 'toggle'}
                      <label class="toggle-switch">
                        <input 
                          id={controlId}
                          type="checkbox" 
                          checked={config[parameter] || metadata.defaultValue}
                          on:change={(e) => handleParameterChange(parameter, e.target.checked)}
                        />
                        <span class="toggle-slider"></span>
                      </label>
                    
                    {:else if metadata.type === 'color'}
                      <div class="color-input-wrapper">
                        <input 
                          id={`${controlId}-color`}
                          type="color" 
                          class="color-input"
                          value={config[parameter] || metadata.defaultValue}
                          on:change={(e) => handleParameterChange(parameter, e.target.value)}
                        />
                        <input 
                          id={`${controlId}-text`}
                          type="text" 
                          class="color-text"
                          value={config[parameter] || metadata.defaultValue}
                          on:change={(e) => handleParameterChange(parameter, e.target.value)}
                        />
                      </div>
                    
                    {:else if metadata.type === 'range'}
                      {@const percentageMeta = getParameterMetadataWithPercentage(parameter)}
                      <div class="range-input-wrapper">
                        <input
                          id={controlId}
                          type="range"
                          class="range-input"
                          min={percentageMeta?.isPercentage ? (metadata.range?.min * 100) || 0 : (metadata.range?.min || 0)}
                          max={percentageMeta?.isPercentage ? (metadata.range?.max * 100) || 100 : (metadata.range?.max || 100)}
                          step={percentageMeta?.isPercentage ? (metadata.range?.step * 100) || 1 : (metadata.range?.step || 1)}
                          value={percentageMeta?.isPercentage ? ((config[parameter] || metadata.defaultValue) * 100) : (config[parameter] || metadata.defaultValue)}
                          on:input={(e) => {
                            const rawValue = parseFloat(e.target.value);
                            const finalValue = percentageMeta?.isPercentage ? (rawValue / 100) : rawValue;
                            handleParameterChange(parameter, finalValue);
                          }}
                        />
                        <span class="range-value">
                          {percentageMeta?.isPercentage ? ((config[parameter] || metadata.defaultValue) * 100).toFixed(1) : (config[parameter] || metadata.defaultValue)}
                          {#if percentageMeta?.isPercentage}
                            <span class="percentage-indicator">%</span>
                          {/if}
                        </span>
                      </div>
                    
                    {:else if metadata.type === 'select'}
                      <select 
                        id={controlId}
                        class="select-input"
                        value={config[parameter] || metadata.defaultValue}
                        on:change={(e) => handleParameterChange(parameter, e.target.value)}
                      >
                        {#each metadata.options || [] as option}
                          <option value={option}>{option}</option>
                        {/each}
                      </select>
                    
                    {:else}
                      <input 
                        id={controlId}
                        type="text" 
                        class="text-input"
                        value={config[parameter] || metadata.defaultValue}
                        on:change={(e) => handleParameterChange(parameter, e.target.value)}
                      />
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        </div>
      {/if}
    {/each}
  </div>
  
  <!-- Keyboard Shortcuts Help -->
  <div class="shortcuts-help">
    <span class="help-text">Press Ctrl+F to search, Ctrl+Tab to switch tabs</span>
  </div>
</div>

<style>
  .canvas-tabbed-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1f2937;
  }
  
  .menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    gap: 16px;
  }
  
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .header-right {
    flex: 1;
    max-width: 300px;
  }
  
  .menu-header h3 {
    margin: 0;
    color: #d1d5db;
    font-size: 14px;
    font-weight: 600;
  }
  
  .canvas-id {
    color: #9ca3af;
    font-size: 11px;
    font-family: 'Courier New', monospace;
  }
  
  .search-container {
    position: relative;
    width: 100%;
  }
  
  .search-input {
    width: 100%;
    padding: 6px 24px 6px 8px;
    background: #1f2937;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #e5e7eb;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s ease;
  }
  
  .search-input:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.3);
  }
  
  .search-input::placeholder {
    color: #6b7280;
  }
  
  .search-clear {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #6b7280;
    font-size: 16px;
    cursor: pointer;
    padding: 2px;
    border-radius: 2px;
    transition: color 0.2s ease;
  }
  
  .search-clear:hover {
    color: #d1d5db;
  }
  
  .search-results {
    background: #1f2937;
    border-bottom: 1px solid #4b5563;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .search-result {
    padding: 8px 16px;
    cursor: pointer;
    border-bottom: 1px solid #374151;
    transition: background-color 0.2s ease;
  }
  
  .search-result:last-child {
    border-bottom: none;
  }
  
  .search-result:hover,
  .search-result.selected {
    background: #374151;
  }
  
  .result-label {
    color: #d1d5db;
    font-size: 12px;
    font-weight: 500;
  }
  
  .result-group {
    color: #9ca3af;
    font-size: 10px;
    margin-top: 2px;
  }
  
  .result-label :global(mark) {
    background: #4f46e5;
    color: white;
    padding: 1px 2px;
    border-radius: 2px;
  }
  
  .tab-navigation {
    display: flex;
    background: #2d3748;
    border-bottom: 1px solid #4b5563;
    overflow-x: auto;
  }
  
  .tab-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 12px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 80px;
    font-size: 11px;
    gap: 4px;
  }
  
  .tab-button:hover {
    background: #374151;
    color: #d1d5db;
  }
  
  .tab-button.active {
    border-bottom-color: #4f46e5;
    color: #e5e7eb;
    background: #374151;
  }
  
  .tab-icon {
    font-size: 16px;
    font-weight: 600;
  }
  
  .tab-label {
    text-align: center;
    line-height: 1.2;
  }
  
  .tab-content-container {
    flex: 1;
    overflow-y: auto;
    background: #1f2937;
  }
  
  .tab-content {
    padding: 16px;
  }
  
  .parameter-group h4 {
    margin: 0 0 8px 0;
    color: #d1d5db;
    font-size: 16px;
    font-weight: 600;
  }
  
  .group-description {
    margin: 0 0 16px 0;
    color: #9ca3af;
    font-size: 12px;
    font-style: italic;
  }
  
  .parameters-grid {
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr;
  }
  
  .parameter-control {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .parameter-label {
    color: #d1d5db;
    font-size: 12px;
    font-weight: 500;
  }
  
  /* Toggle Switch */
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }
  
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #4b5563;
    transition: 0.2s;
    border-radius: 24px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }
  
  input:checked + .toggle-slider {
    background-color: #4f46e5;
  }
  
  input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }
  
  /* Color Input */
  .color-input-wrapper {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .color-input {
    width: 40px;
    height: 32px;
    border: 1px solid #4b5563;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .color-text {
    flex: 1;
    padding: 6px 8px;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #e5e7eb;
    font-size: 12px;
    font-family: monospace;
  }
  
  /* Range Input */
  .range-input-wrapper {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .range-input {
    flex: 1;
    height: 4px;
    background: #4b5563;
    border-radius: 2px;
    outline: none;
    -webkit-appearance: none;
  }
  
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #4f46e5;
    border-radius: 50%;
    cursor: pointer;
  }
  
  .range-input::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #4f46e5;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
  
  .range-value {
    min-width: 40px;
    text-align: right;
    color: #d1d5db;
    font-size: 12px;
    font-family: monospace;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .percentage-indicator {
    color: #10b981;
    font-weight: 600;
    font-size: 10px;
  }
  
  /* Select Input */
  .select-input {
    padding: 6px 8px;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #e5e7eb;
    font-size: 12px;
    cursor: pointer;
  }
  
  /* Text Input */
  .text-input {
    padding: 6px 8px;
    background: #374151;
    border: 1px solid #4b5563;
    border-radius: 4px;
    color: #e5e7eb;
    font-size: 12px;
  }
  
  .shortcuts-help {
    padding: 6px 16px;
    background: #111827;
    border-top: 1px solid #374151;
    text-align: center;
  }
  
  .help-text {
    color: #6b7280;
    font-size: 10px;
    font-style: italic;
  }
  
  /* Scrollbar styling */
  .tab-content-container::-webkit-scrollbar,
  .search-results::-webkit-scrollbar {
    width: 6px;
  }
  
  .tab-content-container::-webkit-scrollbar-track,
  .search-results::-webkit-scrollbar-track {
    background: #111827;
  }
  
  .tab-content-container::-webkit-scrollbar-thumb,
  .search-results::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }
  
  .tab-content-container::-webkit-scrollbar-thumb:hover,
  .search-results::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
</style>
