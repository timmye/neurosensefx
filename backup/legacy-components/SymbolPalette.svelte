<script>
  import { onMount, onDestroy } from 'svelte';
  import { actions, panels, icons } from '../stores/floatingStore.js';
  import FloatingPanel from './FloatingPanel.svelte';
  import { symbolStore } from '../data/symbolStore.js';
  import { availableSymbols, subscribe } from '../data/wsClient.js';
  import { connectionManager } from '../data/ConnectionManager.js';
  import { FuzzySearch, debounce } from '../utils/fuzzySearch.js';
  
  let symbols = [];
  let availableSyms = [];
  let wsStatus = 'disconnected';
  
  // Search state
  let searchQuery = '';
  let filteredSymbols = [];
  let selectedIndex = 0;
  let searchInput;
  let fuzzySearch;
  let isSearchFocused = false;
  
  // Store subscriptions
  const unsubscribeSymbol = symbolStore.subscribe(value => {
    symbols = Object.keys(value);
  });
  
  const unsubscribeAvailable = availableSymbols.subscribe(value => {
    availableSyms = value;
    if (fuzzySearch) {
      fuzzySearch.updateItems(value);
    }
  });
  
  const unsubscribePanels = panels.subscribe(panels => {
    const panel = panels.get('symbol-palette');
    if (panel && panel.isVisible) {
      // Auto-focus when panel becomes visible
      setTimeout(() => {
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }, 100);
    }
  });
  
  // Initialize fuzzy search
  onMount(() => {
    fuzzySearch = new FuzzySearch(availableSyms, {
      threshold: 0.6,
      includeScore: false,
      maxResults: 50
    });
    
    // Initial search if query exists
    if (searchQuery) {
      performSearch(searchQuery);
    }
  });
  
  // Cleanup
  onDestroy(() => {
    unsubscribeSymbol();
    unsubscribeAvailable();
    unsubscribePanels();
  });
  
  // Reactive search with debouncing
  const debouncedSearch = debounce((query) => {
    performSearch(query);
  }, 300);
  
  $: if (searchQuery && fuzzySearch) {
    debouncedSearch(searchQuery);
  } else {
    filteredSymbols = [];
    selectedIndex = 0;
  }
  
  function performSearch(query) {
    if (!fuzzySearch) return;
    
    const startTime = performance.now();
    filteredSymbols = fuzzySearch.search(query);
    selectedIndex = 0;
    
    // Track performance
    const duration = performance.now() - startTime;
    if (duration > 100) {
      console.warn(`Slow search detected: ${duration.toFixed(2)}ms for ${filteredSymbols.length} results`);
    }
  }
  
  // Keyboard navigation
  function handleSearchKeydown(e) {
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredSymbols.length - 1);
        scrollToSelected();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
        
      case 'Enter':
        e.preventDefault();
        if (filteredSymbols[selectedIndex]) {
          createDisplayFromSearch(filteredSymbols[selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        clearSearch();
        break;
        
      case 'Tab':
        e.preventDefault(); // Keep focus in search
        break;
        
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          const num = parseInt(e.key);
          if (num <= filteredSymbols.length) {
            createDisplayFromSearch(filteredSymbols[num - 1]);
          }
        }
        break;
    }
  }
  
  function scrollToSelected() {
    // Scroll selected item into view
    setTimeout(() => {
      const selectedElement = document.querySelector('.search-result.selected');
      if (selectedElement) {
        selectedElement.scrollIntoView({ 
          block: 'nearest', 
          behavior: 'smooth' 
        });
      }
    }, 50);
  }
  
  function clearSearch() {
    searchQuery = '';
    filteredSymbols = [];
    selectedIndex = 0;
    searchInput?.focus();
  }
  
  function highlightMatch(symbol, query) {
    if (!query || !fuzzySearch) return symbol;
    return fuzzySearch.highlightMatch(symbol, query);
  }
  
  // Create display from search
  async function createDisplayFromSearch(symbol) {
    console.log('Creating display for symbol:', symbol);
    
    // Create display first
    const displayId = actions.addDisplay(symbol, {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100
    });
    
    // Then subscribe to data
    try {
      await connectionManager.subscribeCanvas(displayId, symbol);
      console.log('Successfully subscribed display to data');
      
      // Clear search after successful creation
      clearSearch();
      
      // Collapse symbol palette after a short delay
      setTimeout(() => {
        const icon = $icons.get('symbol-palette-icon');
        if (icon && icon.isExpanded) {
          actions.collapseIcon('symbol-palette-icon');
        }
      }, 500);
      
    } catch (error) {
      console.error('Failed to subscribe display to data:', error);
    }
  }
  
  // Legacy symbol click for non-search mode
  async function handleSymbolClick(symbol) {
    await createDisplayFromSearch(symbol);
  }
  
  // Focus management
  export function focusSearch() {
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
</script>

<FloatingPanel id="symbol-palette" type="symbol-palette" title="Symbol Palette">
  <div class="palette-content">
    <!-- Search Section -->
    <div class="search-section">
      <div class="search-container">
        <input 
          bind:this={searchInput}
          bind:value={searchQuery}
          class="search-input"
          placeholder="Search symbols... (Ctrl+K)"
          on:keydown={handleSearchKeydown}
          on:focus={() => isSearchFocused = true}
          on:blur={() => isSearchFocused = false}
        />
        <div class="search-shortcut">Ctrl+K</div>
      </div>
      
      <!-- Search Results -->
      {#if searchQuery && filteredSymbols.length > 0}
        <div class="search-results">
          {#each filteredSymbols as symbol, index}
            <div 
              class="search-result"
              class:selected={index === selectedIndex}
              on:click={() => createDisplayFromSearch(symbol)}
              on:mouseenter={() => selectedIndex = index}
            >
              <span class="symbol-number">{index + 1}</span>
              <span class="symbol-name" 
                on:click={() => createDisplayFromSearch(symbol)}
              >{@html highlightMatch(symbol, searchQuery)}</span>
              <span class="symbol-action">Create Display</span>
            </div>
          {/each}
        </div>
      {/if}
      
      <!-- No Results -->
      {#if searchQuery && filteredSymbols.length === 0}
        <div class="no-results">
          <div class="no-results-text">No symbols found for "{searchQuery}"</div>
          <div class="no-results-hint">Try different keywords or check spelling</div>
        </div>
      {/if}
    </div>
    
    <!-- Legacy Symbol Lists (shown when no search) -->
    {#if !searchQuery}
      <!-- Available Symbols -->
      {#if availableSyms.length > 0}
        <div class="section">
          <div class="section-title">Available Symbols ({availableSyms.length})</div>
          <div class="symbol-list">
            {#each availableSyms.slice(0, 10) as symbol}
              <div class="symbol-item" on:click={() => handleSymbolClick(symbol)}>
                <span class="symbol-name">{symbol}</span>
                <span class="symbol-action">+</span>
              </div>
            {/each}
            {#if availableSyms.length > 10}
              <div class="symbol-item more-symbols">
                <span class="symbol-name">... and {availableSyms.length - 10} more</span>
                <span class="symbol-hint">Use search to find all</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
      
      <!-- Active Symbols -->
      {#if symbols.length > 0}
        <div class="section">
          <div class="section-title">Active Displays ({symbols.length})</div>
          <div class="symbol-list">
            {#each symbols as symbol}
              <div class="symbol-item active" on:click={() => handleSymbolClick(symbol)}>
                <span class="symbol-name">{symbol}</span>
                <span class="symbol-action">+</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- No symbols message -->
      {#if availableSyms.length === 0 && symbols.length === 0}
        <div class="no-symbols">
          <div class="no-symbols-text">No symbols available</div>
          <div class="no-symbols-hint">Connecting to data source...</div>
        </div>
      {/if}
    {/if}
    
    <!-- Keyboard Hints -->
    <div class="keyboard-hints">
      <div class="hint-group">
        <span class="hint-title">Navigation:</span>
        <span class="hint">↑↓ Navigate</span>
        <span class="hint">Enter Select</span>
        <span class="hint">Esc Clear</span>
      </div>
      <div class="hint-group">
        <span class="hint-title">Quick:</span>
        <span class="hint">1-9 Select</span>
        <span class="hint">Ctrl+K Focus</span>
      </div>
    </div>
  </div>
</FloatingPanel>

<style>
  .palette-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  /* Search Section */
  .search-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .search-container {
    position: relative;
    margin-bottom: 8px;
  }
  
  .search-input {
    width: 100%;
    padding: 12px 40px 12px 16px;
    background: #374151;
    border: 2px solid #4b5563;
    border-radius: 8px;
    color: #f3f4f6;
    font-size: 16px;
    font-family: 'Courier New', monospace;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }
  
  .search-input:focus {
    outline: none;
    border-color: #4f46e5;
    background: #4b5563;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
  
  .search-input::placeholder {
    color: #9ca3af;
  }
  
  .search-shortcut {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    font-size: 12px;
    font-family: monospace;
    background: #1f2937;
    padding: 2px 6px;
    border-radius: 4px;
    pointer-events: none;
  }
  
  /* Search Results */
  .search-results {
    max-height: 300px;
    overflow-y: auto;
    border-radius: 8px;
    background: #1f2937;
    border: 1px solid #374151;
  }
  
  .search-result {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 1px solid #374151;
  }
  
  .search-result:last-child {
    border-bottom: none;
  }
  
  .search-result:hover,
  .search-result.selected {
    background: #374151;
  }
  
  .search-result.selected {
    border-left: 3px solid #4f46e5;
    padding-left: 13px; /* Compensate for border */
  }
  
  .symbol-number {
    color: #6b7280;
    font-size: 12px;
    font-family: monospace;
    font-weight: bold;
    min-width: 20px;
  }
  
  .search-result .symbol-name {
    color: #f3f4f6;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    flex: 1;
    line-height: 1.4;
  }
  
  .search-result .symbol-name mark {
    background: #4f46e5;
    color: white;
    padding: 1px 2px;
    border-radius: 2px;
    font-weight: bold;
  }
  
  .search-result .symbol-action {
    color: #4f46e5;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.2s ease;
    white-space: nowrap;
  }
  
  .search-result:hover .symbol-action,
  .search-result.selected .symbol-action {
    opacity: 1;
  }
  
  /* No Results */
  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #6b7280;
    text-align: center;
    background: #1f2937;
    border-radius: 8px;
    border: 1px solid #374151;
  }
  
  .no-results-text {
    font-size: 14px;
    margin-bottom: 4px;
    color: #d1d5db;
  }
  
  .no-results-hint {
    font-size: 12px;
    color: #9ca3af;
  }
  
  /* Legacy Sections */
  .section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .section-title {
    color: #9ca3af;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 4px;
  }
  
  .symbol-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .symbol-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #374151;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .symbol-item:hover {
    background: #4b5563;
  }
  
  .symbol-item.active {
    background: rgba(79, 70, 229, 0.1);
    border: 1px solid rgba(79, 70, 229, 0.3);
  }
  
  .symbol-item.more-symbols {
    background: #1f2937;
    border: 1px dashed #4b5563;
    cursor: default;
  }
  
  .symbol-item.more-symbols:hover {
    background: #1f2937;
  }
  
  .symbol-hint {
    color: #9ca3af;
    font-size: 12px;
    font-style: italic;
  }
  
  .symbol-name {
    color: #d1d5db;
    font-family: 'Courier New', monospace;
    font-size: 14px;
  }
  
  .symbol-action {
    color: #4f46e5;
    font-weight: bold;
    font-size: 16px;
  }
  
  .no-symbols {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    color: #6b7280;
    text-align: center;
  }
  
  .no-symbols-text {
    font-size: 14px;
    margin-bottom: 4px;
  }
  
  .no-symbols-hint {
    font-size: 12px;
    color: #9ca3af;
  }
  
  /* Keyboard Hints */
  .keyboard-hints {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 8px 12px;
    background: #1f2937;
    border-top: 1px solid #374151;
    font-size: 11px;
    color: #9ca3af;
    border-radius: 0 0 8px 8px;
  }
  
  .hint-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .hint-title {
    font-weight: 600;
    color: #d1d5db;
  }
  
  .hint {
    background: #374151;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: monospace;
    color: #e5e7eb;
  }
  
  /* Scrollbar Styling */
  .search-results::-webkit-scrollbar {
    width: 6px;
  }
  
  .search-results::-webkit-scrollbar-track {
    background: #1f2937;
  }
  
  .search-results::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }
  
  .search-results::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .search-input,
    .search-result,
    .symbol-item {
      transition: none;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .search-input {
      border-width: 3px;
      background: #000;
      color: #fff;
    }
    
    .search-input:focus {
      border-color: #fff;
    }
    
    .search-result.selected {
      border-left-width: 4px;
    }
  }
</style>
