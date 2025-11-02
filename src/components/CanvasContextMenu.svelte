<script>
  import { createEventDispatcher, onMount, onDestroy, setContext } from 'svelte';
  import { defaultConfig } from '../stores/displayStore.js';
  import { parameterGroups, getParameterMetadata } from './CanvasContextMenu/utils/parameterGroups.js';
  import { searchParameters } from './CanvasContextMenu/utils/searchUtils.js';
  import { highlightMatch } from '../utils/fuzzySearch.js';
  import { createShortcutHandler, defaultShortcuts } from './CanvasContextMenu/utils/keyboardShortcuts.js';
  import { getZIndex } from '../constants/zIndex.js';
  
  // Import tab components
  import QuickActionsTab from './CanvasContextMenu/tabs/QuickActionsTab.svelte';
  import PriceDisplayTab from './CanvasContextMenu/tabs/PriceDisplayTab.svelte';
  import MarketProfileTab from './CanvasContextMenu/tabs/MarketProfileTab.svelte';
  import VolatilityTab from './CanvasContextMenu/tabs/VolatilityTab.svelte';
  import LayoutSizingTab from './CanvasContextMenu/tabs/LayoutSizingTab.svelte';
  import AdvancedTab from './CanvasContextMenu/tabs/AdvancedTab.svelte';
  
  export let position = { x: 0, y: 0 };
  export let canvasId = null;
  export let config = defaultConfig;
  
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
  
  // Viewport boundary detection
  let adjustedPosition = { ...position };
  let menuMaxHeight = '70vh';
  
  // Tab components mapping
  const tabComponents = [
    QuickActionsTab,
    PriceDisplayTab,
    MarketProfileTab,
    VolatilityTab,
    LayoutSizingTab,
    AdvancedTab
  ];
  
  // Calculate adjusted position to keep menu within viewport
  function adjustPositionForViewport() {
    if (!menuElement) return;
    
    const rect = menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let { x, y } = position;
    
    // Adjust horizontal position
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    
    // Adjust vertical position
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }
    
    // Ensure minimum position
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    adjustedPosition = { x, y };
    
    // Set max height based on available space
    const availableHeight = viewportHeight - y - 20;
    menuMaxHeight = `${Math.min(availableHeight, viewportHeight * 0.7)}px`;
  }
  
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
    config[parameter] = value;
    
    // Dispatch change event
    dispatch('configChange', { 
      canvasId,
      [parameter]: value 
    });
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
    // Reset to defaults
    config = { ...defaultConfig };
    
    // Dispatch reset event
    dispatch('configReset', { 
      canvasId,
      config: defaultConfig 
    });
  }
  
  function handleClose() {
    dispatch('close', { canvasId });
  }
  
  // Handle click outside to close
  function handleClickOutside(event) {
    if (menuElement && !menuElement.contains(event.target)) {
      handleClose();
    }
  }
  
  // Lifecycle
  onMount(() => {
    // Adjust position after render
    setTimeout(() => {
      adjustPositionForViewport();
    }, 0);
    
    // Setup keyboard shortcuts
    cleanupShortcuts = createShortcutHandler({
      onAction: handleShortcutAction,
      target: menuElement
    });
    
    // Add click outside listener
    document.addEventListener('click', handleClickOutside);
    
    // Handle window resize
    const handleResize = () => adjustPositionForViewport();
    window.addEventListener('resize', handleResize);
    
    // Store resize handler for cleanup
    menuElement.dataset.resizeHandler = handleResize.toString();
  });
  
  onDestroy(() => {
    // Cleanup shortcuts
    if (cleanupShortcuts) {
      cleanupShortcuts();
    }
    
    // Remove click outside listener
    document.removeEventListener('click', handleClickOutside);
    
    // Remove resize listener if it exists
    if (menuElement?.dataset.resizeHandler) {
      try {
        // This is a bit of a hack, but it's necessary to clean up the resize listener
        const resizeHandlers = window.getEventListeners?.(window)?.resize || [];
        resizeHandlers.forEach(handler => window.removeEventListener('resize', handler.listener));
      } catch (e) {
        // Fallback - remove all resize listeners
        window.removeEventListener('resize', window.handleResize);
      }
    }
  });
  
  // Context for child components
  setContext('canvasId', canvasId);
  setContext('config', config);
  setContext('onParameterChange', handleParameterChange);
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
  class="context-menu enhanced"
  style="left: {adjustedPosition.x}px; top: {adjustedPosition.y}px; max-height: {menuMaxHeight}; z-index: {getZIndex('CONTEXT_MENU')};"
  on:click|stopPropagation
>
  <!-- Menu Header -->
  <div class="menu-header">
    <div class="header-left">
      <h3>Canvas Controls</h3>
      {#if canvasId}
        <span class="canvas-id">ID: {canvasId}</span>
      {/if}
    </div>
    <div class="header-right">
      <!-- Search Input -->
      <div class="search-container">
        <input 
          bind:this={searchInput}
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
    <div class="search-results">
      {#each searchResults as result, index}
        <div 
          class="search-result {index === selectedSearchIndex ? 'selected' : ''}"
          on:click={() => selectSearchResult(result)}
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
    {#each tabComponents as TabComponent, index}
      {#if activeTab === index}
        <div class="tab-content">
          <svelte:component 
            this={TabComponent} 
            config={config}
            onParameterChange={handleParameterChange}
          />
        </div>
      {/if}
    {/each}
  </div>
  
  <!-- Menu Actions -->
  <div class="menu-actions">
    <button class="reset-btn" on:click={handleReset} title="Reset to defaults (Ctrl+R)">
      Reset to Defaults
    </button>
    <button class="close-btn" on:click={handleClose} title="Close (Escape)">
      Close
    </button>
  </div>
  
  <!-- Keyboard Shortcuts Help -->
  <div class="shortcuts-help">
    <span class="help-text">Press Ctrl+F to search, Ctrl+Tab to switch tabs</span>
  </div>
</div>

<style>
  .context-menu.enhanced {
    position: fixed;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 0;
    min-width: 500px;
    max-width: 700px;
    max-height: 70vh;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    animation: menuAppear 0.15s ease-out;
    display: flex;
    flex-direction: column;
  }
  
  @keyframes menuAppear {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  .menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #374151;
    border-bottom: 1px solid #4b5563;
    border-radius: 8px 8px 0 0;
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
  
  .menu-actions {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    background: #111827;
    border-top: 1px solid #374151;
  }
  
  .reset-btn, .close-btn {
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  
  .reset-btn {
    background: #374151;
    color: #e5e7eb;
  }
  
  .reset-btn:hover {
    background: #4b5563;
    color: #d1d5db;
  }
  
  .close-btn {
    background: #4f46e5;
    color: white;
  }
  
  .close-btn:hover {
    background: #6366f1;
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
  .context-menu::-webkit-scrollbar,
  .tab-content-container::-webkit-scrollbar,
  .search-results::-webkit-scrollbar {
    width: 6px;
  }
  
  .context-menu::-webkit-scrollbar-track,
  .tab-content-container::-webkit-scrollbar-track,
  .search-results::-webkit-scrollbar-track {
    background: #111827;
  }
  
  .context-menu::-webkit-scrollbar-thumb,
  .tab-content-container::-webkit-scrollbar-thumb,
  .search-results::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }
  
  .context-menu::-webkit-scrollbar-thumb:hover,
  .tab-content-container::-webkit-scrollbar-thumb:hover,
  .search-results::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
  
  /* Responsive adjustments */
  @media (max-width: 600px) {
    .context-menu.enhanced {
      min-width: 320px;
      max-width: 90vw;
    }
    
    .tab-button {
      min-width: 60px;
      padding: 6px 8px;
    }
    
    .tab-label {
      font-size: 9px;
    }
    
    .header-right {
      max-width: 200px;
    }
  }
</style>
