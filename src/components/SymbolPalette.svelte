<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayActions, panels, icons } from '../stores/displayStore.js';
  import FloatingPanel from './FloatingPanel.svelte';
  import { displays } from '../stores/displayStore.js';
  import { availableSymbols, subscribe } from '../data/wsClient.js';
  import { FuzzySearch } from '../utils/fuzzySearch.js';
  import { Environment, EnvironmentConfig } from '../lib/utils/environmentUtils.js';
  
  let symbols = [];
  let availableSyms = [];

  // Search state
  let searchQuery = '';
  let filteredSymbols = [];
  let selectedIndex = 0;
  let searchInput;
  let fuzzySearch;
  let isSearching = false;

  // 🌍 ENVIRONMENT AWARENESS: Environment state and configuration
  let showEnvironmentWarning = false;
  let environmentWarningMessage = '';
  
  // Store subscriptions
  const unsubscribeDisplays = displays.subscribe(value => {
    symbols = Array.from(value.values()).map(display => display.symbol);
  });
  
  const unsubscribeAvailable = availableSymbols.subscribe(value => {
    console.log('📦 Available symbols updated:', {
      newCount: value.length,
      symbols: value.slice(0, 10),
      fuzzySearchExists: !!fuzzySearch
    });

    availableSyms = value;

    // Initialize fuzzySearch if it doesn't exist yet, or update if it does
    if (fuzzySearch) {
      fuzzySearch.updateItems(value);
      console.log('🔧 Updated existing fuzzySearch with new symbols');
    } else if (value.length > 0) {
      // Initialize fuzzySearch as soon as we have symbols, don't wait for onMount
      fuzzySearch = new FuzzySearch(value, {
        threshold: 0.6,
        includeScore: false,
        maxResults: 50
      });
      console.log('🚀 Initialized fuzzySearch with symbols');
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

  // 🌍 ENVIRONMENT AWARENESS: Reactive environment warnings
  $: if (EnvironmentConfig.current.showEnvironmentIndicator) {
    showEnvironmentWarning = Environment.isDevelopment;
    environmentWarningMessage = Environment.isDevelopment
      ? 'Development Mode: Symbol changes may affect dev environment only'
      : '';
  }
  
  // Initialize fuzzy search with proper caching (per design spec)
  onMount(() => {
    console.log('🏗️ Component mounted:', {
      availableSymsCount: availableSyms.length,
      fuzzySearchExists: !!fuzzySearch
    });

    // Only initialize if not already initialized by subscription
    if (!fuzzySearch) {
      fuzzySearch = new FuzzySearch(availableSyms, {
        threshold: 0.6,
        includeScore: false,
        maxResults: 50
      });
      console.log('🏗️ Initialized fuzzySearch in onMount');
    } else {
      console.log('🏗️ fuzzySearch already initialized, skipping');
    }

    // Initial search if query exists (using reactive pattern)
    if (searchQuery) {
      performSearch(searchQuery);
    }
  });
  
  // Cleanup
  onDestroy(() => {
    unsubscribeDisplays();
    unsubscribeAvailable();
    unsubscribePanels();
    clearPendingSearch();
  });
  
  // Reactive search with improved progressive debouncing
  $: {
    console.log('🔄 Reactive statement triggered:', {
      searchQuery,
      fuzzySearchExists: !!fuzzySearch,
      currentFilteredCount: filteredSymbols.length,
      isSearching
    });

    if (fuzzySearch) {
      if (searchQuery) {
        isSearching = true;
        progressiveDebouncedSearch(searchQuery);
      } else {
        filteredSymbols = [];
        selectedIndex = 0;
        isSearching = false;
        clearPendingSearch();
      }
    }
  }

  // Progressive debouncing with proper scope (industry standard)
  let searchTimeout;
  let lastInputTime = 0;

  function progressiveDebouncedSearch(query) {
    const now = performance.now();
    const timeSinceLastInput = now - lastInputTime;

    console.log('🔍 Search debug:', {
      query,
      queryLength: query.length,
      availableSymsCount: availableSyms.length,
      fuzzySearchExists: !!fuzzySearch,
      isSearching,
      timeSinceLastInput
    });

    // Clear any pending search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Show immediate feedback for all query lengths
    performImmediateSearch(query);

    // Calculate delay based on input patterns (industry standard)
    let delay;
    if (query.length === 1) {
      delay = 150; // Faster feedback for first character
    } else if (query.length === 2) {
      delay = 120; // Slightly faster for short queries
    } else if (timeSinceLastInput < 100) {
      // Rapid typing - longer delay to wait for completion
      delay = 150;
    } else {
      // Normal typing or refinement - shorter delay
      delay = 100;
    }

    // Schedule full search with progressive delay
    searchTimeout = setTimeout(() => {
      performSearch(query);
      isSearching = false;
    }, delay);

    lastInputTime = now;
  }

  function clearPendingSearch() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  }

  function performImmediateSearch(query) {
    // Handle case where symbols might not be loaded yet
    if (!availableSyms || availableSyms.length === 0) {
      console.log('⚠️ No symbols available for immediate search');
      filteredSymbols = [];
      selectedIndex = 0;
      return;
    }

    // Show immediate results for better UX feedback
    const queryLower = query.toLowerCase();
    let immediateResults = [];

    console.log('⚡ Immediate search debug:', {
      query,
      queryLower,
      availableSymsCount: availableSyms.length,
      sampleSyms: availableSyms.slice(0, 5)
    });

    if (query.length === 1) {
      // Single character: show exact matches and popular symbols
      const exactMatches = availableSyms.filter(symbol =>
        symbol.toLowerCase().startsWith(queryLower)
      ).slice(0, 8);

      const popularMatches = availableSyms.filter(symbol => {
        const popularSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD'];
        return popularSymbols.includes(symbol) &&
               symbol.toLowerCase().includes(queryLower);
      });

      immediateResults = [...exactMatches, ...popularMatches].slice(0, 10);
    } else {
      // Multi-character: show exact and prefix matches immediately
      const exactMatches = availableSyms.filter(symbol =>
        symbol.toLowerCase() === queryLower
      );

      const prefixMatches = availableSyms.filter(symbol =>
        symbol.toLowerCase().startsWith(queryLower) &&
        !exactMatches.includes(symbol)
      ).slice(0, 8);

      const containsMatches = availableSyms.filter(symbol =>
        symbol.toLowerCase().includes(queryLower) &&
        !exactMatches.includes(symbol) &&
        !prefixMatches.includes(symbol)
      ).slice(0, 5);

      immediateResults = [...exactMatches, ...prefixMatches, ...containsMatches].slice(0, 15);
    }

    console.log('📝 Immediate search results:', {
      query,
      resultsCount: immediateResults.length,
      results: immediateResults.slice(0, 5)
    });

    filteredSymbols = immediateResults;
    selectedIndex = 0;
  }

  function performSearch(query) {
    if (!fuzzySearch || !query) {
      isSearching = false;
      return;
    }

    // Handle case where fuzzy search exists but has no items
    if (!availableSyms || availableSyms.length === 0) {
      console.log('⚠️ No symbols available for fuzzy search');
      filteredSymbols = [];
      selectedIndex = 0;
      isSearching = false;
      return;
    }

    const startTime = performance.now();

    try {
      const results = fuzzySearch.search(query);
      filteredSymbols = results;
      selectedIndex = 0;

      console.log('🔍 Fuzzy search completed:', {
        query,
        resultsCount: results.length,
        duration: (performance.now() - startTime).toFixed(2) + 'ms',
        results: results.slice(0, 5)
      });

      // Track performance and log slow searches (per design spec)
      const duration = performance.now() - startTime;
      if (duration > 100) {
        console.warn(`Slow search detected: ${duration.toFixed(2)}ms for ${filteredSymbols.length} results`);
      }
    } catch (error) {
      console.error('Search error:', error);
      filteredSymbols = [];
      selectedIndex = 0;
    } finally {
      isSearching = false;
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
    isSearching = false;
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    searchInput?.focus();
  }
  
  function highlightMatch(symbol, query) {
    if (!query || !symbol) return symbol;

    try {
      // Create a simple highlight function that doesn't depend on fuzzySearch instance
      const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
      return symbol.replace(regex, '<mark>$1</mark>');
    } catch (error) {
      console.warn('Highlight error:', error);
      return symbol;
    }
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Create display from search
  async function createDisplayFromSearch(symbol) {
    console.log('Creating display for symbol:', symbol);

    // Create display first
    displayActions.addDisplay(symbol, {
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 100
    });
    
    // Then subscribe to data
    try {
      // Direct WebSocket subscription
      subscribe(symbol);
      
      // Wait for symbol data to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for ${symbol} data`));
        }, 10000);
        
        const unsubscribeDisplays = displays.subscribe(displaysMap => {
          const display = Array.from(displaysMap.values()).find(d => d.symbol === symbol);
          if (display?.ready) {
            clearTimeout(timeout);
            unsubscribeDisplays();
            resolve();
          }
        });
      });
      
      console.log('Successfully subscribed display to data');
      
      // Clear search after successful creation
      clearSearch();
      
      // Collapse symbol palette after a short delay
      setTimeout(() => {
        const icon = $icons.get('symbol-palette-icon');
        if (icon && icon.isExpanded) {
          displayActions.collapseIcon('symbol-palette-icon');
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
          on:input={() => {}}
          on:keydown={handleSearchKeydown}
          on:focus={() => {}}
        />
        <div class="search-shortcut">Ctrl+K</div>
        {#if isSearching}
          <div class="search-loading">Searching...</div>
        {/if}

        <!-- Debug info (remove in production) -->
        {#if searchQuery}
          <div class="debug-info" style="font-size: 10px; color: #666; margin-top: 4px;">
            Query: "{searchQuery}" | Results: {filteredSymbols.length} | Symbols: {availableSyms.length} | FuzzySearch: {fuzzySearch ? '✓' : '✗'}
          </div>
        {/if}
      </div>

      <!-- 🌍 Environment Warning (when in development mode) -->
      {#if showEnvironmentWarning && environmentWarningMessage}
        <div class="environment-warning" class:env-dev={Environment.isDevelopment}>
          <div class="warning-icon">⚠️</div>
          <div class="warning-message">
            <span class="warning-title">Development Environment</span>
            <span class="warning-text">{environmentWarningMessage}</span>
          </div>
        </div>
      {/if}

      <!-- Search Results -->
      {#if searchQuery && filteredSymbols.length > 0}
        <div class="search-results" role="listbox">
          {#each filteredSymbols as symbol, index}
            <div
              class="search-result"
              class:selected={index === selectedIndex}
              role="option"
              aria-selected={index === selectedIndex}
              on:click={() => createDisplayFromSearch(symbol)}
              on:mouseenter={() => selectedIndex = index}
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  createDisplayFromSearch(symbol);
                }
              }}
              tabindex="0"
            >
              <span class="symbol-number">{index + 1}</span>
              <span class="symbol-name">{@html highlightMatch(symbol, searchQuery)}</span>
              <span class="symbol-action">Create Display</span>
            </div>
          {/each}
        </div>
      {/if}
      
      <!-- No Results -->
      {#if searchQuery && filteredSymbols.length === 0 && !isSearching}
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
          <div class="symbol-list" role="list">
            {#each availableSyms.slice(0, 10) as symbol}
              <div
                class="symbol-item"
                role="button"
                tabindex="0"
                aria-label={`Create display for ${symbol}`}
                on:click={() => handleSymbolClick(symbol)}
                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSymbolClick(symbol);
                  }
                }}
              >
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
          <div class="symbol-list" role="list">
            {#each symbols as symbol}
              <div
                class="symbol-item active"
                role="button"
                tabindex="0"
                aria-label={`Create another display for ${symbol}`}
                on:click={() => handleSymbolClick(symbol)}
                on:keydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleSymbolClick(symbol);
                  }
                }}
              >
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
  
  .search-loading {
    position: absolute;
    right: 80px;
    top: 50%;
    transform: translateY(-50%);
    color: #4f46e5;
    font-size: 12px;
    font-family: monospace;
    opacity: 0.7;
    animation: pulse 1s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 0.3; }
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

  /* 🌍 Environment Warning Styles */
  .environment-warning {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    margin: 8px 0;
    border-radius: 8px;
    border: 1px solid;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
  }

  .environment-warning.env-dev {
    border-color: rgba(168, 85, 247, 0.3);
    background: rgba(168, 85, 247, 0.1);
  }

  .warning-icon {
    font-size: 18px;
    line-height: 1;
    flex-shrink: 0;
  }

  .warning-message {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .warning-title {
    font-size: 13px;
    font-weight: 600;
    color: #a855f7;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .warning-text {
    font-size: 12px;
    color: #d1d5db;
    line-height: 1.4;
  }

  /* Responsive adjustments for environment warning */
  @media (max-width: 768px) {
    .environment-warning {
      padding: 10px 12px;
      gap: 8px;
    }

    .warning-icon {
      font-size: 16px;
    }

    .warning-title {
      font-size: 12px;
    }

    .warning-text {
      font-size: 11px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .environment-warning {
      transition: none;
    }
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
    
    .search-loading {
      animation: none;
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
