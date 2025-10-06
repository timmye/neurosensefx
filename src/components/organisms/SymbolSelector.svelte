<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { SymbolBadge, Button, Input } from '../atoms/index.js';
  import { SymbolCard, SymbolSearch, SymbolCategory } from '../molecules/index.js';
  
  // Component props
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let variant = 'default'; // 'default', 'compact', 'detailed'
  export let showSearch = true;
  export let showCategories = true;
  export let showFavorites = true;
  export let showRecent = true;
  export let allowMultiple = false;
  export let maxSelections = null;
  export let layout = 'grid'; // 'grid', 'list', 'card'
  export let searchable = true;
  export let filterable = true;
  export let sortable = false;
  export let autoRefresh = true;
  export let refreshInterval = 30000; // 30 seconds
  
  const dispatch = createEventDispatcher();
  
  // Component state
  let symbols = [];
  let filteredSymbols = [];
  let selectedSymbols = [];
  let favoriteSymbols = [];
  let recentSymbols = [];
  let categories = [];
  let selectedCategory = 'all';
  let searchQuery = '';
  let isLoading = false;
  let error = null;
  let refreshTimer = null;
  
  // UI state
  let viewMode = 'grid'; // 'grid', 'list', 'card'
  let sortBy = 'name'; // 'name', 'price', 'change', 'volume'
  let sortOrder = 'asc'; // 'asc', 'desc'
  let showFilters = false;
  let showDetails = false;
  
  // Mock symbol data (in real implementation, this would come from data layer)
  const mockSymbols = [
    { symbol: 'EURUSD', name: 'Euro/US Dollar', category: 'forex', price: 1.05678, change: 0.00234, changePercent: 0.22, volume: 125000000, marketSession: 'open', description: 'Major currency pair representing the Euro against the US Dollar' },
    { symbol: 'GBPUSD', name: 'British Pound/US Dollar', category: 'forex', price: 1.23456, change: -0.00123, changePercent: -0.10, volume: 98000000, marketSession: 'open', description: 'Major currency pair representing the British Pound against the US Dollar' },
    { symbol: 'USDJPY', name: 'US Dollar/Japanese Yen', category: 'forex', price: 149.876, change: 0.01234, changePercent: 0.08, volume: 156000000, marketSession: 'open', description: 'Major currency pair representing the US Dollar against the Japanese Yen' },
    { symbol: 'XAUUSD', name: 'Gold/US Dollar', category: 'commodities', price: 1987.65, change: 12.34, changePercent: 0.62, volume: 45000000, marketSession: 'open', description: 'Gold price quoted in US Dollars' },
    { symbol: 'BTCUSD', name: 'Bitcoin/US Dollar', category: 'crypto', price: 43256.78, change: 1234.56, changePercent: 2.94, volume: 2300000000, marketSession: 'open', description: 'Bitcoin price quoted in US Dollars' },
    { symbol: 'SPX500', name: 'S&P 500 Index', category: 'indices', price: 4567.89, change: -23.45, changePercent: -0.51, volume: 0, marketSession: 'post', description: 'S&P 500 stock market index' },
    { symbol: 'AAPL', name: 'Apple Inc.', category: 'stocks', price: 178.92, change: 2.34, changePercent: 1.32, volume: 52000000, marketSession: 'closed', description: 'Apple Inc. stock price' },
    { symbol: 'EURGBP', name: 'Euro/British Pound', category: 'forex', price: 0.85678, change: -0.00045, changePercent: -0.05, volume: 34000000, marketSession: 'open', description: 'Cross currency pair representing the Euro against the British Pound' },
    { symbol: 'USDCAD', name: 'US Dollar/Canadian Dollar', category: 'forex', price: 1.34567, change: 0.00089, changePercent: 0.07, volume: 67000000, marketSession: 'open', description: 'Major currency pair representing the US Dollar against the Canadian Dollar' },
    { symbol: 'OILUSD', name: 'Crude Oil/US Dollar', category: 'commodities', price: 78.45, change: -1.23, changePercent: -1.55, volume: 89000000, marketSession: 'closed', description: 'Crude oil price quoted in US Dollars' }
  ];
  
  // Category configurations
  const categoryConfig = {
    forex: { label: 'Forex', icon: '💱', description: 'Foreign exchange currency pairs' },
    commodities: { label: 'Commodities', icon: '🛢️', description: 'Physical commodities and raw materials' },
    indices: { label: 'Indices', icon: '📊', description: 'Stock market indices and benchmarks' },
    crypto: { label: 'Crypto', icon: '₿', description: 'Cryptocurrencies and digital assets' },
    stocks: { label: 'Stocks', icon: '📈', description: 'Individual company stocks' }
  };
  
  // Initialize component
  onMount(() => {
    initializeComponent();
    startAutoRefresh();
    
    // Add keyboard event listeners
    document.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    document.removeEventListener('keydown', handleKeydown);
  });
  
  // Initialize component data
  function initializeComponent() {
    loadSymbols();
    loadFavoriteSymbols();
    loadRecentSymbols();
    initializeCategories();
    applyFilters();
  }
  
  // Load symbols from data source
  async function loadSymbols() {
    try {
      isLoading = true;
      error = null;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      symbols = [...mockSymbols];
      filteredSymbols = [...symbols];
      
    } catch (err) {
      console.error('Failed to load symbols:', err);
      error = 'Failed to load symbols';
    } finally {
      isLoading = false;
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
  
  // Initialize categories
  function initializeCategories() {
    const categoryCounts = {};
    const categoryActiveCounts = {};
    
    symbols.forEach(symbol => {
      const category = symbol.category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      if (symbol.marketSession === 'open') {
        categoryActiveCounts[category] = (categoryActiveCounts[category] || 0) + 1;
      }
    });
    
    categories = Object.keys(categoryConfig).map(categoryKey => ({
      ...categoryConfig[categoryKey],
      category: categoryKey,
      symbolCount: categoryCounts[categoryKey] || 0,
      activeCount: categoryActiveCounts[categoryKey] || 0
    }));
  }
  
  // Start auto refresh
  function startAutoRefresh() {
    if (autoRefresh && refreshInterval > 0) {
      refreshTimer = setInterval(() => {
        refreshSymbols();
      }, refreshInterval);
    }
  }
  
  // Refresh symbols data
  async function refreshSymbols() {
    try {
      await loadSymbols();
      dispatch('refresh', { symbols: filteredSymbols });
    } catch (error) {
      console.error('Failed to refresh symbols:', error);
    }
  }
  
  // Apply filters and sorting
  function applyFilters() {
    let filtered = [...symbols];
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(symbol => symbol.category === selectedCategory);
    }
    
    // Apply search filter
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(symbol => 
        symbol.symbol.toLowerCase().includes(query) ||
        symbol.name.toLowerCase().includes(query) ||
        symbol.description?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
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
        default:
          comparison = a.symbol.localeCompare(b.symbol);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    filteredSymbols = filtered;
  }
  
  // Handle search
  function handleSearch(event) {
    searchQuery = event.detail.value;
    applyFilters();
  }
  
  // Handle category selection
  function handleCategorySelect(event) {
    selectedCategory = event.detail.category;
    applyFilters();
  }
  
  // Handle symbol selection
  function handleSymbolSelect(event) {
    const symbol = event.detail;
    
    if (allowMultiple) {
      const index = selectedSymbols.findIndex(s => s.symbol === symbol.symbol);
      if (index >= 0) {
        selectedSymbols.splice(index, 1);
      } else {
        if (maxSelections && selectedSymbols.length >= maxSelections) {
          dispatch('maxSelectionsReached', { max: maxSelections });
          return;
        }
        selectedSymbols.push(symbol);
      }
    } else {
      selectedSymbols = [symbol];
    }
    
    // Add to recent symbols
    addToRecentSymbols(symbol.symbol);
    
    dispatch('select', { 
      symbols: selectedSymbols, 
      symbol: allowMultiple ? null : symbol,
      multiple: allowMultiple 
    });
  }
  
  // Handle symbol favorite toggle
  function handleFavoriteToggle(event) {
    const { symbol, favorite } = event.detail;
    
    if (favorite) {
      if (!favoriteSymbols.includes(symbol)) {
        favoriteSymbols.push(symbol);
      }
    } else {
      favoriteSymbols = favoriteSymbols.filter(s => s !== symbol);
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('neurosense_favorite_symbols', JSON.stringify(favoriteSymbols));
    } catch (error) {
      console.error('Failed to save favorite symbols:', error);
    }
    
    dispatch('favoriteToggle', { symbol, favorite });
  }
  
  // Add symbol to recent
  function addToRecentSymbols(symbol) {
    // Remove existing entry
    recentSymbols = recentSymbols.filter(s => s !== symbol);
    
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
  
  // Handle sort change
  function handleSortChange(event) {
    sortBy = event.target.value;
    applyFilters();
  }
  
  // Handle sort order change
  function handleSortOrderChange() {
    sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    applyFilters();
  }
  
  // Handle view mode change
  function handleViewModeChange(mode) {
    viewMode = mode;
  }
  
  // Handle keyboard events
  function handleKeydown(event) {
    // Ctrl/Cmd + K for search focus
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      // Focus search input
      const searchInput = document.querySelector('.symbol-search input');
      if (searchInput) {
        searchInput.focus();
      }
    }
    
    // Escape to clear selection
    if (event.key === 'Escape' && selectedSymbols.length > 0) {
      selectedSymbols = [];
      dispatch('clearSelection');
    }
  }
  
  // Get symbol by ticker
  function getSymbolByTicker(ticker) {
    return symbols.find(symbol => symbol.symbol === ticker);
  }
  
  // Check if symbol is selected
  function isSymbolSelected(symbol) {
    return selectedSymbols.some(s => s.symbol === symbol.symbol);
  }
  
  // Check if symbol is favorite
  function isSymbolFavorite(symbol) {
    return favoriteSymbols.includes(symbol.symbol);
  }
  
  // Check if symbol is recent
  function isSymbolRecent(symbol) {
    return recentSymbols.includes(symbol.symbol);
  }
  
  // Reactive calculations
  $: hasSelections = selectedSymbols.length > 0;
  $: selectionCount = selectedSymbols.length;
  $: filteredCount = filteredSymbols.length;
  $: totalCount = symbols.length;
  
  // Apply filters when dependencies change
  $: if (symbols.length > 0) {
    applyFilters();
  }
</script>

<div class="symbol-selector" class:size={size} class:variant={variant}>
  <!-- Header -->
  <div class="symbol-selector__header">
    <div class="symbol-selector__title">
      <h2>Symbol Selector</h2>
      {#if hasSelections}
        <div class="symbol-selector__selection-count">
          {selectionCount} selected
        </div>
      {/if}
    </div>
    
    <div class="symbol-selector__actions">
      <!-- View mode toggle -->
      <div class="symbol-selector__view-modes">
        <Button
          variant={viewMode === 'grid' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => handleViewModeChange('grid')}
        >
          Grid
        </Button>
        <Button
          variant={viewMode === 'list' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => handleViewModeChange('list')}
        >
          List
        </Button>
        <Button
          variant={viewMode === 'card' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => handleViewModeChange('card')}
        >
          Cards
        </Button>
      </div>
      
      <!-- Sort controls -->
      {#if sortable}
        <div class="symbol-selector__sort">
          <select 
            value={sortBy} 
            on:change={handleSortChange}
            class="symbol-selector__sort-select"
          >
            <option value="name">Name</option>
            <option value="price">Price</option>
            <option value="change">Change</option>
            <option value="volume">Volume</option>
          </select>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSortOrderChange}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      {/if}
      
      <!-- Refresh button -->
      <Button
        variant="ghost"
        size="sm"
        onClick={refreshSymbols}
        loading={isLoading}
      >
        Refresh
      </Button>
      
      <!-- Clear selection -->
      {#if hasSelections}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            selectedSymbols = [];
            dispatch('clearSelection');
          }}
        >
          Clear
        </Button>
      {/if}
    </div>
  </div>
  
  <!-- Search -->
  {#if showSearch && searchable}
    <div class="symbol-selector__search">
      <SymbolSearch
        placeholder="Search symbols..."
        variant="advanced"
        showFilters={filterable}
        showRecent={showRecent}
        showFavorites={showFavorites}
        on:select={handleSearch}
      />
    </div>
  {/if}
  
  <!-- Categories -->
  {#if showCategories}
    <div class="symbol-selector__categories">
      <div class="symbol-selector__category-list">
        <!-- All categories -->
        <SymbolCategory
          category="all"
          label="All Symbols"
          icon="🌐"
          symbolCount={totalCount}
          activeCount={symbols.filter(s => s.marketSession === 'open').length}
          selected={selectedCategory === 'all'}
          size="sm"
          variant="compact"
          on:select={handleCategorySelect}
        />
        
        <!-- Individual categories -->
        {#each categories as category}
          <SymbolCategory
            {category}
            label={category.label}
            icon={category.icon}
            description={category.description}
            symbolCount={category.symbolCount}
            activeCount={category.activeCount}
            selected={selectedCategory === category.category}
            size="sm"
            variant="compact"
            on:select={handleCategorySelect}
          />
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- Results summary -->
  <div class="symbol-selector__summary">
    <span class="symbol-selector__summary-text">
      Showing {filteredCount} of {totalCount} symbols
      {#if selectedCategory !== 'all'}
        in {categories.find(c => c.category === selectedCategory)?.label || selectedCategory}
      {/if}
      {#if searchQuery}
        matching "{searchQuery}"
      {/if}
    </span>
  </div>
  
  <!-- Symbols display -->
  <div class="symbol-selector__content">
    {#if isLoading}
      <div class="symbol-selector__loading">
        <div class="symbol-selector__loading-text">Loading symbols...</div>
      </div>
    {:else if error}
      <div class="symbol-selector__error">
        <div class="symbol-selector__error-text">{error}</div>
        <Button variant="primary" size="sm" onClick={loadSymbols}>
          Retry
        </Button>
      </div>
    {:else if filteredSymbols.length === 0}
      <div class="symbol-selector__empty">
        <div class="symbol-selector__empty-text">
          {#if searchQuery}
            No symbols found matching "{searchQuery}"
          {:else}
            No symbols available
          {/if}
        </div>
      </div>
    {:else}
      <div class="symbol-selector__symbols" class:view-mode={viewMode}>
        {#each filteredSymbols as symbol}
          <div 
            class="symbol-selector__symbol-item"
            class:selected={isSymbolSelected(symbol)}
            class:view-mode={viewMode}
          >
            {#if viewMode === 'card'}
              <SymbolCard
                {symbol}
                name={symbol.name}
                description={symbol.description}
                category={symbol.category}
                price={symbol.price}
                change={symbol.change}
                changePercent={symbol.changePercent}
                volume={symbol.volume}
                status={symbol.marketSession === 'open' ? 'active' : 'closed'}
                marketSession={symbol.marketSession}
                favorite={isSymbolFavorite(symbol)}
                recent={isSymbolRecent(symbol)}
                selectable={true}
                selected={isSymbolSelected(symbol)}
                variant="compact"
                on:select={handleSymbolSelect}
                on:favoriteToggle={handleFavoriteToggle}
              />
            {:else if viewMode === 'list'}
              <div class="symbol-selector__list-item">
                <SymbolBadge
                  {symbol}
                  name={symbol.name}
                  price={symbol.price}
                  change={symbol.change}
                  changePercent={symbol.changePercent}
                  status={symbol.marketSession === 'open' ? 'active' : 'closed'}
                  marketSession={symbol.marketSession}
                  favorite={isSymbolFavorite(symbol)}
                  clickable={true}
                  selected={isSymbolSelected(symbol)}
                  variant="detailed"
                  on:click={handleSymbolSelect}
                  on:favoriteToggle={handleFavoriteToggle}
                />
              </div>
            {:else}
              <!-- Grid view -->
              <SymbolBadge
                {symbol}
                name={symbol.name}
                price={symbol.price}
                change={symbol.change}
                changePercent={symbol.changePercent}
                status={symbol.marketSession === 'open' ? 'active' : 'closed'}
                marketSession={symbol.marketSession}
                favorite={isSymbolFavorite(symbol)}
                clickable={true}
                selected={isSymbolSelected(symbol)}
                variant="default"
                on:click={handleSymbolSelect}
                on:favoriteToggle={handleFavoriteToggle}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  <!-- Selected symbols footer -->
  {#if hasSelections}
    <div class="symbol-selector__footer">
      <div class="symbol-selector__selected-symbols">
        <div class="symbol-selector__selected-title">
          Selected Symbols ({selectionCount})
        </div>
        <div class="symbol-selector__selected-list">
          {#each selectedSymbols as symbol}
            <SymbolBadge
              {symbol}
              name={symbol.name}
              price={symbol.price}
              change={symbol.change}
              changePercent={symbol.changePercent}
              status={symbol.marketSession === 'open' ? 'active' : 'closed'}
              marketSession={symbol.marketSession}
              favorite={isSymbolFavorite(symbol)}
              clickable={false}
              variant="compact"
            />
          {/each}
        </div>
      </div>
      
      <div class="symbol-selector__footer-actions">
        <Button
          variant="primary"
          onClick={() => dispatch('confirm', { symbols: selectedSymbols })}
        >
          {allowMultiple ? `Add ${selectionCount} Symbols` : 'Add Symbol'}
        </Button>
        
        <Button
          variant="ghost"
          onClick={() => {
            selectedSymbols = [];
            dispatch('clearSelection');
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .symbol-selector {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    font-family: var(--font-sans);
    background: var(--bg-primary);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    max-height: 80vh;
    overflow: hidden;
  }
  
  .symbol-selector--sm {
    padding: var(--space-3);
    gap: var(--space-3);
  }
  
  .symbol-selector--lg {
    padding: var(--space-5);
    gap: var(--space-5);
  }
  
  .symbol-selector__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-shrink: 0;
  }
  
  .symbol-selector__title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .symbol-selector__title h2 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }
  
  .symbol-selector__selection-count {
    padding: var(--space-1) var(--space-2);
    background: var(--color-focus-subtle);
    color: var(--color-focus);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
  }
  
  .symbol-selector__actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  
  .symbol-selector__view-modes {
    display: flex;
    gap: var(--space-1);
  }
  
  .symbol-selector__sort {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  
  .symbol-selector__sort-select {
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
  }
  
  .symbol-selector__search {
    flex-shrink: 0;
  }
  
  .symbol-selector__categories {
    flex-shrink: 0;
  }
  
  .symbol-selector__category-list {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    overflow-x: auto;
    padding-bottom: var(--space-1);
  }
  
  .symbol-selector__summary {
    flex-shrink: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    padding: var(--space-2) 0;
  }
  
  .symbol-selector__content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .symbol-selector__loading,
  .symbol-selector__error,
  .symbol-selector__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    text-align: center;
    color: var(--text-secondary);
  }
  
  .symbol-selector__symbols {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2);
  }
  
  .symbol-selector__symbols--grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  
  .symbol-selector__symbols--list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .symbol-selector__symbols--card {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-4);
  }
  
  .symbol-selector__symbol-item {
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-selector__symbol-item.selected {
    transform: scale(0.98);
    opacity: 0.8;
  }
  
  .symbol-selector__list-item {
    padding: var(--space-2);
    border-radius: var(--radius-md);
    transition: background-color var(--motion-fast) var(--ease-snappy);
  }
  
  .symbol-selector__list-item:hover {
    background: var(--bg-tertiary);
  }
  
  .symbol-selector__footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .symbol-selector__selected-symbols {
    flex: 1;
    min-width: 0;
  }
  
  .symbol-selector__selected-title {
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }
  
  .symbol-selector__selected-list {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  
  .symbol-selector__footer-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .symbol-selector {
      padding: var(--space-3);
      gap: var(--space-3);
      max-height: 90vh;
    }
    
    .symbol-selector__header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    
    .symbol-selector__actions {
      justify-content: center;
    }
    
    .symbol-selector__category-list {
      flex-direction: column;
      gap: var(--space-1);
    }
    
    .symbol-selector__symbols--grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--space-2);
    }
    
    .symbol-selector__symbols--card {
      grid-template-columns: 1fr;
      gap: var(--space-3);
    }
    
    .symbol-selector__footer {
      flex-direction: column;
      gap: var(--space-3);
    }
    
    .symbol-selector__footer-actions {
      flex-direction: column;
      width: 100%;
    }
    
    .symbol-selector__footer-actions button {
      width: 100%;
    }
  }
  
  @media (max-width: 480px) {
    .symbol-selector__symbols--grid {
      grid-template-columns: 1fr;
    }
    
    .symbol-selector__selected-list {
      flex-direction: column;
      gap: var(--space-1);
    }
  }
  
  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .symbol-selector {
      border: 2px solid var(--border-default);
    }
    
    .symbol-selector__sort-select {
      border-width: 2px;
    }
  }
  
  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .symbol-selector__symbol-item,
    .symbol-selector__list-item {
      transition: none !important;
    }
  }
  
  /* Print styles */
  @media print {
    .symbol-selector {
      background: white !important;
      color: black !important;
      border: 1px solid black !important;
      max-height: none !important;
      overflow: visible !important;
    }
    
    .symbol-selector__actions,
    .symbol-selector__footer {
      display: none !important;
    }
  }
</style>
