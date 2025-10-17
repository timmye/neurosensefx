<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { fuzzyMatch, getMatchInfo } from '../data/fuzzyMatch.js';

  export let availableSymbols = [];
  export let selectedSymbol = null;
  export let subscribedSymbols = [];
  export let placeholder = "Select a symbol...";
  export let disabled = false;

  const dispatch = createEventDispatcher();

  // Component state
  let searchQuery = '';
  let filteredSymbols = [];
  let highlightedIndex = -1;
  let isOpen = false;
  let inputElement;
  let dropdownElement;

  // Debounce timer for search
  let debounceTimeout;

  // Reactive: Filter symbols when search query or available symbols change
  $: {
    if (searchQuery.trim() === '') {
      filteredSymbols = [];
    } else {
      const searchResults = fuzzyMatch(searchQuery, availableSymbols);
      filteredSymbols = searchResults; // Keep all results for scrolling
    }
    highlightedIndex = -1; // Reset highlight when results change
  }

  // Focus management
  $: if (isOpen && inputElement) {
    inputElement.focus();
  }

  function handleInput(event) {
    searchQuery = event.target.value;
    
    // Clear previous debounce
    clearTimeout(debounceTimeout);
    
    // Set new debounce
    debounceTimeout = setTimeout(() => {
      if (searchQuery.trim() === '') {
        isOpen = false;
      } else {
        isOpen = true;
      }
    }, 100); // 100ms debounce
  }

  function handleFocus() {
    if (!disabled && availableSymbols.length > 0) {
      isOpen = true;
    }
  }

  function handleBlur() {
    // Use timeout to allow click events on dropdown items
    setTimeout(() => {
      isOpen = false;
    }, 150);
  }

  function handleSymbolSelect(symbol, shouldSubscribe = false) {
    console.log('🔍 DEBUG: FXSymbolSelector handleSymbolSelect called', { symbol, shouldSubscribe });
    selectedSymbol = symbol;
    searchQuery = '';
    isOpen = false;
    highlightedIndex = -1;
    console.log('🔍 DEBUG: FXSymbolSelector dispatching select event', { symbol, shouldSubscribe });
    dispatch('select', { symbol, shouldSubscribe });
    console.log('🔍 DEBUG: FXSymbolSelector select event dispatched');
  }

  function handleKeyDown(event) {
    console.log('🔍 DEBUG: FXSymbolSelector handleKeyDown called', { key: event.key, disabled, searchQuery, filteredSymbolsLength: filteredSymbols.length });
    
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        console.log('🔍 DEBUG: FXSymbolSelector ArrowDown pressed');
        event.preventDefault();
        if (filteredSymbols.length === 0) break;
        
        highlightedIndex = Math.min(highlightedIndex + 1, filteredSymbols.length - 1);
        // Auto-scroll the dropdown to keep highlighted item visible
        if (highlightedIndex >= 0 && dropdownElement) {
          const dropdown = dropdownElement;
          const itemHeight = 40; // Approximate height of each dropdown item
          
          // Calculate scroll position
          const scrollTop = dropdown.scrollTop;
          const scrollBottom = scrollTop + dropdown.clientHeight;
          const itemTop = highlightedIndex * itemHeight;
          const itemBottom = itemTop + itemHeight;
          
          // Scroll if item is not visible
          if (itemTop < scrollTop) {
            dropdown.scrollTop = itemTop;
          } else if (itemBottom > scrollBottom) {
            dropdown.scrollTop = itemBottom - dropdown.clientHeight;
          }
        }
        break;

      case 'ArrowUp':
        console.log('🔍 DEBUG: FXSymbolSelector ArrowUp pressed');
        event.preventDefault();
        if (filteredSymbols.length === 0) break;
        
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        // Auto-scroll the dropdown to keep highlighted item visible
        if (highlightedIndex >= 0 && dropdownElement) {
          const dropdown = dropdownElement;
          const itemHeight = 40; // Approximate height of each dropdown item
          
          // Calculate scroll position
          const scrollTop = dropdown.scrollTop;
          const itemTop = highlightedIndex * itemHeight;
          
          // Scroll if item is not visible
          if (itemTop < scrollTop) {
            dropdown.scrollTop = itemTop;
          } else if (itemTop >= scrollTop + dropdown.clientHeight) {
            dropdown.scrollTop = itemTop - dropdown.clientHeight + itemHeight;
          }
        }
        break;

      case 'Enter':
        console.log('🔍 DEBUG: FXSymbolSelector Enter pressed', { highlightedIndex, filteredSymbolsLength: filteredSymbols.length });
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredSymbols.length) {
          console.log('🔍 DEBUG: FXSymbolSelector calling handleSymbolSelect with highlighted symbol');
          handleSymbolSelect(filteredSymbols[highlightedIndex], true); // Trigger subscription
        } else if (filteredSymbols.length > 0) {
          console.log('🔍 DEBUG: FXSymbolSelector calling handleSymbolSelect with first symbol');
          handleSymbolSelect(filteredSymbols[0], true); // Trigger subscription
        } else {
          console.log('🔍 DEBUG: FXSymbolSelector no symbols to select');
        }
        break;

      case 'Escape':
        console.log('🔍 DEBUG: FXSymbolSelector Escape pressed');
        event.preventDefault();
        isOpen = false;
        searchQuery = '';
        highlightedIndex = -1;
        break;

      case 'Tab':
        console.log('🔍 DEBUG: FXSymbolSelector Tab pressed');
        // Allow tab navigation, close dropdown
        isOpen = false;
        break;
    }
  }

  function handleMouseEnter(index) {
    highlightedIndex = index;
  }

  function handleClickOutside(event) {
    if (dropdownElement && !dropdownElement.contains(event.target) && inputElement && !inputElement.contains(event.target)) {
      isOpen = false;
    }
  }

  // Set up click outside listener
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  // Cleanup debounce on unmount
  onDestroy(() => {
    clearTimeout(debounceTimeout);
  });

  // Get match info for highlighting
  function getSymbolMatchInfo(symbol) {
    return getMatchInfo(symbol, searchQuery);
  }

  // Check if symbol is subscribed
  function isSubscribed(symbol) {
    return subscribedSymbols.includes(symbol);
  }
</script>

<div class="fx-symbol-selector" class:disabled={disabled}>
  <!-- Input field -->
  <div 
    class="input-container"
    class:open={isOpen}
    class:focus={isOpen}
  >
    <input
      type="text"
      bind:this={inputElement}
      bind:value={searchQuery}
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls="symbol-dropdown"
      role="combobox"
    />
    <button
      type="button"
      class="input-icon"
      on:click={() => {
        searchQuery = '';
        isOpen = false;
      }}
      on:keydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          searchQuery = '';
          isOpen = false;
        }
      }}
      tabindex="-1"
      aria-label={searchQuery ? 'Clear search' : 'Open search'}
    >
      {searchQuery ? '✕' : '🔍'}
    </button>
  </div>

  <!-- Dropdown -->
  {#if isOpen && filteredSymbols.length > 0}
    <div
      bind:this={dropdownElement}
      id="symbol-dropdown"
      class="dropdown"
      role="listbox"
      aria-label="Available symbols"
    >
      {#each filteredSymbols as symbol, index}
        <div
          class="dropdown-item"
          class:highlighted={index === highlightedIndex}
          class:subscribed={isSubscribed(symbol)}
          on:click={() => handleSymbolSelect(symbol, true)}
          on:mouseenter={() => handleMouseEnter(index)}
          role="option"
          aria-selected={index === highlightedIndex}
          tabindex="-1"
        >
          <span class="symbol-name">{symbol}</span>
          {#if isSubscribed(symbol)}
            <span class="subscribed-badge">✓</span>
          {/if}
        </div>
      {/each}
    </div>
  {:else if isOpen && searchQuery && filteredSymbols.length === 0}
    <div class="dropdown empty">
      <div class="no-results">
        No symbols found
      </div>
    </div>
  {/if}
</div>

<style>
  .fx-symbol-selector {
    position: relative;
    width: 100%;
    font-family: inherit;
  }

  .input-container {
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid #4b5563;
    border-radius: 6px;
    background-color: #1f2937;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input-container:focus-within {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2);
  }

  .input-container.open {
    border-color: #4f46e5;
  }

  input {
    flex: 1;
    padding: 8px 32px 8px 12px;
    border: none;
    background: transparent;
    color: #e5e7eb;
    font-size: 14px;
    outline: none;
    cursor: pointer;
  }

  input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .input-icon {
    position: absolute;
    right: 8px;
    color: #6b7280;
    font-size: 12px;
    cursor: pointer;
    user-select: none;
    background: none;
    border: none;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .input-icon:hover {
    color: #9ca3af;
  }

  .input-icon:focus {
    outline: 2px solid #4f46e5;
    outline-offset: 2px;
    border-radius: 4px;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background-color: #374151;
    border: 1px solid #4b5563;
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    max-height: 320px; /* 8 items * 40px each = 320px */
    overflow-y: auto;
    z-index: 1000;
  }

  .dropdown-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid #4b5563;
    transition: background-color 0.2s;
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  .dropdown-item:hover,
  .dropdown-item.highlighted {
    background-color: #4b5563;
  }

  .dropdown-item.subscribed .symbol-name {
    color: #9ca3af;
  }

  .subscribed-badge {
    color: #22c55e;
    font-weight: bold;
    font-size: 12px;
  }

  .no-results {
    padding: 12px;
    color: #6b7280;
    text-align: center;
  }

  .empty {
    border: 1px dashed #4b5563;
  }

  /* Scrollbar styling */
  .dropdown::-webkit-scrollbar {
    width: 6px;
  }

  .dropdown::-webkit-scrollbar-track {
    background: #1f2937;
  }

  .dropdown::-webkit-scrollbar-thumb {
    background: #4b5563;
    border-radius: 3px;
  }

  .dropdown::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .dropdown {
      max-height: 200px;
    }
  }
</style>