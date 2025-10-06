<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { Input, Button, Badge } from '../atoms/index.js';
  
  // Component props
  export let placeholder = 'Search symbols...';
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'compact', 'advanced'
  export let showFilters = true;
  export let showRecent = true;
  export let showFavorites = true;
  export let autoFocus = false;
  export let debounceMs = 300;
  export let maxResults = 50;
  
  const dispatch = createEventDispatcher();
  
  // Search state
  let searchQuery = '';
  let searchResults = [];
  let isSearching = false;
  let searchError = null;
  let searchHistory = [];
  let favoriteSymbols = [];
  let recentSymbols = [];
  
  // Filter state
  let selectedCategory = 'all';
  let selectedSession = 'all';
  let sortBy = 'relevance'; // 'relevance', 'name', 'price', 'change'
  let sortOrder = 'asc'; // 'asc', 'desc'
  
  // UI state
  let showResults = false;
  let selectedResultIndex = -1;
  let searchInput = null;
  let searchTimer = null;
  
  // Filter options
  const categories = [
    { value: 'all', label: 'All Categories', icon: '🌐' },
    { value: 'forex', label: 'Forex', icon: '💱' },
    { value: 'commodities', label: 'Commodities', icon: '🛢️' },
    { value: 'indices', label: 'Indices', icon: '📊' },
    { value: 'crypto', label: 'Crypto', icon: '₿' },
    { value: 'stocks', label: 'Stocks', icon: '📈' }
  ];
  
  const sessions = [
    { value: 'all', label: 'All Sessions', icon: '🕐' },
    { value: 'open', label: 'Open', icon: '🟢' },
    { value: 'closed', label: 'Closed', icon: '🔴' },
    { value: 'pre', label: 'Pre-Market', icon: '🟡' },
    { value: 'post', label: 'After Hours', icon: '🟠' }
  ];
  
  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'name', label: 'Symbol Name' },
    { value: 'price', label: 'Price' },
    { value: 'change', label: 'Change' },
    { value: 'volume', label: 'Volume' }
  ];
  
  // Mock symbol data (in real implementation, this would come from data layer)
  const mockSymbols = [
    { symbol: 'EURUSD', name: 'Euro/US Dollar', category: 'forex', price: 1.05678, change: 0.00234, changePercent: 0.22, volume: 125000000, marketSession: 'open' },
    { symbol: 'GBPUSD', name: 'British Pound/US Dollar', category: 'forex', price: 1.23456, change: -0.00123, changePercent: -0.10, volume: 98000000, marketSession: 'open' },
    { symbol: 'USDJPY', name: 'US Dollar/Japanese Yen', category: 'forex', price: 149.876, change: 0.01234, changePercent: 0.08, volume: 156000000, marketSession: 'open' },
    { symbol: 'XAUUSD', name: 'Gold/US Dollar', category: 'commodities', price: 1987.65, change: 12.34, changePercent: 0.62, volume: 45000000, marketSession: 'open' },
    { symbol: 'BTCUSD', name: 'Bitcoin/US Dollar', category: 'crypto', price: 43256.78, change: 1234.56, changePercent: 2.94, volume: 2300000000, marketSession: 'open' },
    { symbol: 'SPX500', name: 'S&P 500 Index', category: 'indices', price: 4567.89, change: -23.45, changePercent: -0.51, volume: 0, marketSession: 'post' },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks', price: 178.92, change: 2.34, changePercent: 1.32, volume: 52000000, marketSession: 'closed' },
    { symbol: 'EURGBP', name: 'Euro/British Pound', category: 'forex', price: 0.85678, change: -0.00045, changePercent: -0.05, volume: 34000000, marketSession: 'open' },
    { symbol: 'USDCAD', name: 'US Dollar/Canadian Dollar', category: 'forex', price: 1.34567, change: 0.00089, changePercent: 0.07, volume: 67000000, marketSession: 'open' },
    { symbol: 'OILUSD', name: 'Crude Oil/US Dollar', category: 'commodities', price: 78.45, change: -1.23, changePercent: -1.55, volume: 89000000, marketSession: 'closed' }
  ];
  
  // Initialize component
  onMount(() => {
    if (autoFocus && searchInput) {
      searchInput.focus();
    }
    
    // Load search history from localStorage
    loadSearchHistory();
    loadFavoriteSymbols();
    loadRecentSymbols();
    
    // Add global click handler to close results
    document.addEventListener('click', handleGlobalClick);
  });
  
  onDestroy(() => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    document.removeEventListener('click', handleGlobalClick);
  });
  
  // Load search history from localStorage
  function loadSearchHistory() {
    try {
      const history = localStorage.getItem('neurosense_search_history');
      searchHistory = history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Failed to load search history:', error);
      searchHistory = [];
    }
  }
  
  // Load favorite symbols from localStorage
  function loadFavoriteSymbols() {
    try {
      const favorites = localStorage.getItem('neurosense_favorite_symbols');
      favoriteSymbols = favorites ? JSON.parse(favorites) : ['EURUSD', 'GBPUSD', 'XAUUSD'];
    } catch (error) {
      console.error('Failed to load favorite symbols:', error);
      favoriteSymbols = ['EURUSD', 'GBPUSD', 'XAUUSD'];
    }
  }
  
  // Load recent symbols from localStorage
  function loadRecentSymbols() {
    try {
      const recent = localStorage.getItem('neurosense_recent_symbols');
      recentSymbols = recent ? JSON.parse(recent) : ['BTCUSD', 'SPX500', 'AAPL'];
    } catch (error) {
      console.error('Failed to load recent symbols:', error);
      recentSymbols = ['BTCUSD', 'SPX500', 'AAPL'];
    }
  }
  
  // Handle global click to close results
  function handleGlobalClick(event) {
    if (!event.target.closest('.symbol-search')) {
      showResults = false;
      selectedResultIndex = -1;
    }
  }
  
  // Handle search input
  function handleSearchInput(event) {
    const query = event.target.value;
    searchQuery = query;
    selectedResultIndex = -1;
    
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    
    if (query.trim().length === 0) {
      searchResults = [];
      showResults = false;
      return;
    }
    
    isSearching = true;
    searchError = null;
    
    searchTimer = setTimeout(() => {
      performSearch(query);
    }, debounceMs);
  }
  
  // Perform search
  function performSearch(query) {
    try {
      const results = mockSymbols.filter(symbol => {
        const searchLower = query.toLowerCase();
        return (
          symbol.symbol.toLowerCase().includes(searchLower) ||
          symbol.name.toLowerCase().includes(searchLower)
        );
      });
      
      // Apply filters
      const filteredResults = results.filter(symbol => {
        if (selectedCategory !== 'all' && symbol.category !== selectedCategory) {
          return false;
        }
        if (selectedSession !== 'all' && symbol.marketSession !== selectedSession) {
          return false;
        }
        return true;
      });
      
      // Apply sorting
      const sortedResults = sortResults(filteredResults, sortBy, sortOrder);
      
      searchResults = sortedResults.slice(0, maxResults);
      showResults = true;
      
      // Add to search history
      addToSearchHistory(query);
      
    } catch (error) {
      console.error('Search error:', error);
      searchError = 'Failed to perform search';
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }
  
  // Sort search results
  function sortResults(results, sortBy, sortOrder) {
    const sorted = [...results];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'change':
          comparison = (a.change || 0) - (b.change || 0);
          break;
        case 'volume':
          comparison = (a.volume || 0) - (b.volume || 0);
          break;
        case 'relevance':
        default:
          // Simple relevance: exact symbol match first, then name match
          const aExact = a.symbol.toLowerCase() === searchQuery.toLowerCase();
          const bExact = b.symbol.toLowerCase() === searchQuery.toLowerCase();
          if (aExact && !bExact) comparison = -1;
          else if (!aExact && bExact) comparison = 1;
          else comparison = a.symbol.localeCompare(b.symbol);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  }
  
  // Add query to search history
  function addToSearchHistory(query) {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length === 0) return;
    
    // Remove existing entry
    searchHistory = searchHistory.filter(item => item !== trimmedQuery);
    
    // Add to beginning
    searchHistory.unshift(trimmedQuery);
    
    // Keep only last 10 entries
    searchHistory = searchHistory.slice(0, 10);
    
    // Save to localStorage
    try {
      localStorage.setItem('neurosense_search_history', JSON.stringify(searchHistory));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }
  
  // Handle result selection
  function handleResultSelect(symbol) {
    showResults = false;
    selectedResultIndex = -1;
    searchQuery = symbol.symbol;
    
    // Add to recent symbols
    addToRecentSymbols(symbol.symbol);
    
    dispatch('select', symbol);
  }
  
  // Add symbol to recent
  function addToRecentSymbols(symbol) {
    // Remove existing entry
    recentSymbols = recentSymbols.filter(item => item !== symbol);
    
    // Add to beginning
    recentSymbols.unshift(symbol);
    
    // Keep only last 10 entries
    recentSymbols = recentSymbols.slice(0, 10);
    
    // Save to localStorage
    try {
      localStorage.setItem('neurosense_recent_symbols', JSON.stringify(recentSymbols));
    } catch (error) {
      console.error('Failed to save recent symbols:', error);
    }
  }
  
  // Handle keyboard navigation
  function handleKeydown(event) {
    if (!showResults || searchResults.length === 0) return;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedResultIndex = Math.min(selectedResultIndex + 1, searchResults.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedResultIndex = Math.max(selectedResultIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedResultIndex >= 0) {
          handleResultSelect(searchResults[selectedResultIndex]);
        }
        break;
      case 'Escape':
        showResults = false;
        selectedResultIndex = -1;
        break;
    }
  }
  
  // Handle filter change
  function handleFilterChange() {
    if (searchQuery.trim().length > 0) {
      performSearch(searchQuery);
    }
  }
  
  // Handle clear search
  function handleClearSearch() {
    searchQuery = '';
    searchResults = [];
    showResults = false;
    selectedResultIndex = -1;
    searchError = null;
  }
  
  // Handle history item click
  function handleHistoryClick(query) {
    searchQuery = query;
    performSearch(query);
  }
  
  // Get symbol by ticker
  function getSymbolByTicker(ticker) {
    return mockSymbols.find(symbol => symbol.symbol === ticker);
  }
  
  // Reactive calculations
  $: hasFilters = selectedCategory !== 'all' || selectedSession !== 'all' || sortBy !== 'relevance';
</script>

<div class="symbol-search" class:compact={variant === 'compact'}>
  <!-- Search input -->
  <div class="symbol-search__input-wrapper">
    <Input
      bind:this={searchInput}
      bind:value={searchQuery}
      {placeholder}
      {size}
      loading={isSearching}
      error={searchError}
      on:input={handleSearchInput}
      on:keydown={handleKeydown}
      class="symbol-search__input"
    />
    
    {#if searchQuery}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClearSearch}
        class="symbol-search__clear"
      >
        ✕
      </Button>
    {/if}
  </div>
  
  <!-- Filters -->
  {#if showFilters && variant === 'advanced'}
    <div class="symbol-search__filters">
      <div class="symbol-search__filter-group">
        <label class="symbol-search__filter-label">Category</label>
        <select 
          bind:value={selectedCategory}
          on:change={handleFilterChange}
          class="symbol-search__filter-select"
        >
          {#each categories as category}
            <option value={category.value}>{category.icon} {category.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="symbol-search__filter-group">
        <label class="symbol-search__filter-label">Session</label>
        <select 
          bind:value={selectedSession}
          on:change={handleFilterChange}
          class="symbol-search__filter-select"
        >
          {#each sessions as session}
            <option value={session.value}>{session.icon} {session.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="symbol-search__filter-group">
        <label class="symbol-search__filter-label">Sort By</label>
        <select 
          bind:value={sortBy}
          on:change={handleFilterChange}
          class="symbol-search__filter-select"
        >
          {#each sortOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="symbol-search__filter-group">
        <label class="symbol-search__filter-label">Order</label>
        <select 
          bind:value={sortOrder}
          on:change={handleFilterChange}
          class="symbol-search__filter-select"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
    </div>
  {/if}
  
  <!-- Search results -->
  {#if showResults}
    <div class="symbol-search__results">
      {#if isSearching}
        <div class="symbol-search__loading">
          <span class="symbol-search__loading-text">Searching...</span>
        </div>
      {:else if searchResults.length > 0}
        <div class="symbol-search__results-list">
          {#each searchResults as result, index}
            <div 
              class="symbol-search__result"
              class:selected={index === selectedResultIndex}
              role="option"
              on:click={() => handleResultSelect(result)}
              on:mouseenter={() => selectedResultIndex = index}
            >
              <div class="symbol-search__result-symbol">{result.symbol}</div>
              <div class="symbol-search__result-name">{result.name}</div>
              <div class="symbol-search__result-price">
                {result.price ? result.price.toFixed(5) : '--'}
              </div>
              <div class="symbol-search__result-change" class:positive={result.change > 0} class:negative={result.change < 0}>
                {result.change ? `${result.change > 0 ? '+' : ''}${result.change.toFixed(5)}` : '--'}
                {#if result.changePercent}
                  <span class="symbol-search__result-change-percent">
                    ({result.changePercent > 0 ? '+' : ''}{result.changePercent.toFixed(2)}%)
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="symbol-search__no-results">
          <span class="symbol-search__no-results-text">No symbols found</span>
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Search history and quick access -->
  {#if !showResults && searchQuery.length === 0}
    <div class="symbol-search__quick-access" class:compact={variant === 'compact'}>
      <!-- Recent symbols -->
      {#if showRecent && recentSymbols.length > 0}
        <div class="symbol-search__section">
          <h3 class="symbol-search__section-title">Recent</h3>
          <div class="symbol-search__quick-items">
            {#each recentSymbols as ticker}
              {#if getSymbolByTicker(ticker)}
                {@const symbol = getSymbolByTicker(ticker)}
                <div 
                  class="symbol-search__quick-item"
                  on:click={() => handleResultSelect(symbol)}
                >
                  <Badge variant="outline" size="sm">{ticker}</Badge>
                  <span class="symbol-search__quick-price">
                    {symbol.price ? symbol.price.toFixed(5) : '--'}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- Favorite symbols -->
      {#if showFavorites && favoriteSymbols.length > 0}
        <div class="symbol-search__section">
          <h3 class="symbol-search__section-title">Favorites</h3>
          <div class="symbol-search__quick-items">
            {#each favoriteSymbols as ticker}
              {#if getSymbolByTicker(ticker)}
                {@const symbol = getSymbolByTicker(ticker)}
                <div 
                  class="symbol-search__quick-item"
                  on:click={() => handleResultSelect(symbol)}
                >
                  <Badge variant="subtle" size="sm">⭐ {ticker}</Badge>
                  <span class="symbol-search__quick-price">
                    {symbol.price ? symbol.price.toFixed(5) : '--'}
                  </span>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- Search history -->
      {#if searchHistory.length > 0}
        <div class="symbol-search__section">
          <h3 class="symbol-search__section-title">Recent Searches</h3>
          <div class="symbol-search__history-items">
            {#each searchHistory as query}
              <div 
                class="symbol-search__history-item"
                on:click={() => handleHistoryClick(query)}
              >
                🔍 {query}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .symbol-search {
    position: relative;
    width: 100%;
    max-width: 600px;
    font-family: var(--font-sans);
  }
  
  .symbol-search.compact {
    max-width: 400px;
  }
  
  .symbol-search__input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  
  .symbol-search__input {
    flex: 1;
  }
  
  .symbol-search__clear {
    position: absolute;
    right: var(--space-2);
    top: 50%;
    transform: translateY(-50%);
    min-width: auto;
    padding: var(--space-1);
  }
  
  .symbol-search__filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
    margin-top: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .symbol-search__filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .symbol-search__filter-label {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .symbol-search__filter-select {
    padding: var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
  }
  
  .symbol-search__results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 1000;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 300px;
    overflow-y: auto;
    margin-top: var(--space-1);
  }
  
  .symbol-search__loading,
  .symbol-search__no-results {
    padding: var(--space-4);
    text-align: center;
    color: var(--text-secondary);
  }
  
  .symbol-search__results-list {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .symbol-search__result {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-3);
    cursor: pointer;
    transition: background-color var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-search__result:hover,
  .symbol-search__result.selected {
    background: var(--bg-tertiary);
  }
  
  .symbol-search__result-symbol {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    font-family: var(--font-mono);
    min-width: 80px;
  }
  
  .symbol-search__result-name {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .symbol-search__result-price {
    font-weight: var(--font-medium);
    color: var(--text-primary);
    font-family: var(--font-mono);
    min-width: 80px;
    text-align: right;
  }
  
  .symbol-search__result-change {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-1);
    min-width: 100px;
    text-align: right;
  }
  
  .symbol-search__result-change.positive {
    color: var(--color-success);
  }
  
  .symbol-search__result-change.negative {
    color: var(--color-danger);
  }
  
  .symbol-search__result-change-percent {
    font-size: var(--text-xs);
    opacity: 0.8;
  }
  
  .symbol-search__quick-access {
    margin-top: var(--space-3);
    padding: var(--space-3);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .symbol-search__quick-access.compact {
    padding: var(--space-2);
  }
  
  .symbol-search__section {
    margin-bottom: var(--space-4);
  }
  
  .symbol-search__section:last-child {
    margin-bottom: 0;
  }
  
  .symbol-search__section-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    margin: 0 0 var(--space-2) 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .symbol-search__quick-items {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  
  .symbol-search__quick-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    transition: background-color var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-search__quick-item:hover {
    background: var(--bg-secondary);
  }
  
  .symbol-search__quick-price {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }
  
  .symbol-search__history-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  
  .symbol-search__history-item {
    padding: var(--space-2);
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    transition: background-color var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-search__history-item:hover {
    background: var(--bg-secondary);
    color: var(--text-primary);
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .symbol-search {
      max-width: 100%;
    }
    
    .symbol-search__filters {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }
    
    .symbol-search__result {
      grid-template-columns: 1fr;
      gap: var(--space-2);
      text-align: left;
    }
    
    .symbol-search__result-symbol,
    .symbol-search__result-price,
    .symbol-search__result-change {
      min-width: auto;
      text-align: left;
    }
    
    .symbol-search__quick-items {
      flex-direction: column;
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .symbol-search__results {
      border-width: 2px;
    }
    
    .symbol-search__filter-select {
      border-width: 2px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .symbol-search__result,
    .symbol-search__quick-item,
    .symbol-search__history-item {
      transition: none !important;
    }
  }
</style>
