# DESIGN_SYMBOL_PALETTE_KEYBOARD_NAVIGATION

## Overview

The Keyboard Navigation system provides comprehensive keyboard control over the symbol palette, enabling traders to efficiently search, select, and create displays without touching the mouse. This implementation establishes the symbol palette as the primary, keyboard-first interface for market data access.

## Design Philosophy

### Core Principles
1. **Keyboard First**: Complete functionality accessible via keyboard
2. **Trader Efficiency**: Optimized for rapid, repeated symbol selection
3. **Muscle Memory**: Consistent shortcuts that become second nature
4. **Professional Workflow**: Designed for trading desk speed requirements

### User Experience Goals
- **Zero Mouse Dependency**: Full workflow from search to display creation via keyboard
- **Sub-Second Workflows**: Complete symbol selection and display creation in under 2 seconds
- **Error Prevention**: Clear visual feedback and undo capabilities
- **Accessibility**: Screen reader compatible and follows ARIA standards

## Keyboard Navigation Architecture

### Global Shortcuts
```javascript
// Global keyboard shortcuts (App.svelte)
const GLOBAL_SHORTCUTS = {
  'Ctrl+K': 'focusSymbolPalette',      // Primary access
  'Cmd+K': 'focusSymbolPalette',       // Mac equivalent
  'Escape': 'clearSearchAndMinimize',  // Reset state
  'Ctrl+Shift+K': 'toggleSymbolPalette' // Quick toggle
};
```

### Search Input Shortcuts
```javascript
// Search-specific shortcuts
const SEARCH_SHORTCUTS = {
  'ArrowDown': 'selectNextResult',
  'ArrowUp': 'selectPreviousResult',
  'Enter': 'createSelectedDisplay',
  'Escape': 'clearSearch',
  'Tab': 'keepFocusInSearch',
  'Ctrl+Enter': 'createDisplayAndKeepSearch',
  'Ctrl+Space': 'showRecentSymbols',
  'Ctrl+?': 'showKeyboardHelp'
};
```

### Results Navigation Shortcuts
```javascript
// Results list shortcuts
const RESULTS_SHORTCUTS = {
  'j': 'selectNextResult',      // Vim-style navigation
  'k': 'selectPreviousResult',
  'Enter': 'createSelectedDisplay',
  'Space': 'previewSelectedSymbol',
  'Ctrl+Enter': 'createAndStay',
  'Delete': 'removeFromHistory',
  '1-9': 'quickSelectResult'    // Number shortcuts
};
```

## Implementation Details

### Enhanced Keyboard Event Handling
```javascript
// Comprehensive keyboard event system
function handleKeyboardEvent(e) {
  const context = getKeyboardContext(e);
  const shortcut = resolveShortcut(e, context);
  
  if (shortcut && shortcut.action) {
    e.preventDefault();
    executeShortcut(shortcut.action, e, context);
  }
}

function getKeyboardContext(e) {
  return {
    target: e.target,
    inSearchInput: e.target.classList.contains('search-input'),
    inResults: e.target.closest('.search-results'),
    hasSelection: selectedIndex >= 0,
    searchQuery: searchQuery,
    resultsCount: filteredSymbols.length
  };
}

function resolveShortcut(e, context) {
  const key = buildKeyString(e);
  const shortcuts = context.inSearchInput ? SEARCH_SHORTCUTS : 
                   context.inResults ? RESULTS_SHORTCUTS : 
                   GLOBAL_SHORTCUTS;
  
  return shortcuts[key];
}
```

### Advanced Navigation Features
```javascript
// Multi-select and bulk operations
let multiSelectMode = false;
let selectedIndices = new Set();

function toggleMultiSelect(e) {
  if (e.ctrlKey || e.metaKey) {
    multiSelectMode = true;
    selectedIndices.add(selectedIndex);
  }
}

function createMultipleDisplays() {
  const symbolsToCreate = Array.from(selectedIndices)
    .map(index => filteredSymbols[index])
    .filter(Boolean);
  
  symbolsToCreate.forEach(symbol => {
    actions.addDisplay(symbol, getRandomPosition());
  });
  
  clearMultiSelect();
}

// Quick number selection (1-9 keys)
function handleNumberKey(e) {
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9 && num <= filteredSymbols.length) {
    selectedIndex = num - 1;
    createDisplayFromSearch(filteredSymbols[selectedIndex]);
  }
}
```

### Search Input Enhancement
```svelte
<!-- Enhanced search input with keyboard support -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  export let value = '';
  export let placeholder = '';
  export let autoFocus = false;
  
  let inputElement;
  const dispatch = createEventDispatcher();
  
  // Custom keyboard handling
  function handleKeydown(e) {
    const shortcuts = {
      'ArrowDown': () => dispatch('navigateDown'),
      'ArrowUp': () => dispatch('navigateUp'),
      'Enter': () => dispatch('select'),
      'Escape': () => dispatch('escape'),
      'Tab': (e) => {
        e.preventDefault();
        dispatch('keepFocus');
      },
      'Ctrl+Enter': () => dispatch('selectAndKeep'),
      'Ctrl+Space': () => dispatch('showRecent'),
      'Ctrl+?': () => dispatch('showHelp')
    };
    
    const keyString = buildKeyString(e);
    const action = shortcuts[keyString];
    
    if (action) {
      e.preventDefault();
      action(e);
    }
  }
  
  // Auto-focus management
  export function focus() {
    inputElement?.focus();
    inputElement?.select();
  }
  
  export function blur() {
    inputElement?.blur();
  }
</script>

<input
  bind:this={inputElement}
  bind:value
  {placeholder}
  class="search-input"
  on:keydown={handleKeydown}
  on:focus={() => dispatch('focus')}
  on:blur={() => dispatch('blur')}
  use:autoFocus={autoFocus}
/>
```

## Visual Feedback System

### Focus Indicators
```css
/* Enhanced focus styling */
.search-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
}

.search-result.selected {
  background: #374151;
  border-left: 3px solid #4f46e5;
  outline: 2px solid rgba(79, 70, 229, 0.3);
  outline-offset: -2px;
}

.search-result:focus {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}
```

### Keyboard Shortcut Display
```svelte
<!-- Keyboard shortcut hints -->
<div class="keyboard-hints">
  <div class="hint-group">
    <span class="hint-title">Navigation:</span>
    <span class="hint">↑↓ Navigate</span>
    <span class="hint">Enter Select</span>
    <span class="hint">Esc Clear</span>
  </div>
  
  <div class="hint-group">
    <span class="hint-title">Actions:</span>
    <span class="hint">Ctrl+K Focus</span>
    <span class="hint">1-9 Quick Select</span>
    <span class="hint">Ctrl+? Help</span>
  </div>
</div>

<style>
.keyboard-hints {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  background: #1f2937;
  border-top: 1px solid #374151;
  font-size: 11px;
  color: #9ca3af;
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
}
</style>
```

### Status Indicators
```svelte
<!-- Keyboard mode indicator -->
{#if keyboardMode}
<div class="keyboard-mode-indicator">
  <span class="mode-icon">⌨</span>
  <span class="mode-text">Keyboard Mode</span>
</div>
{/if}

<style>
.keyboard-mode-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(79, 70, 229, 0.2);
  color: #4f46e5;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
</style>
```

## Advanced Features

### Search History Navigation
```javascript
// Search history with keyboard navigation
let searchHistory = [];
let historyIndex = -1;

function navigateHistory(direction) {
  if (direction === 'up' && historyIndex < searchHistory.length - 1) {
    historyIndex++;
    searchQuery = searchHistory[searchHistory.length - 1 - historyIndex];
  } else if (direction === 'down' && historyIndex > 0) {
    historyIndex--;
    searchQuery = searchHistory[searchHistory.length - 1 - historyIndex];
  } else if (direction === 'down' && historyIndex === 0) {
    historyIndex = -1;
    searchQuery = '';
  }
}

function addToHistory(query) {
  if (query && query.length > 0) {
    searchHistory = searchHistory.filter(h => h !== query);
    searchHistory.push(query);
    if (searchHistory.length > 50) {
      searchHistory.shift();
    }
  }
  historyIndex = -1;
}
```

### Symbol Preview
```javascript
// Quick symbol preview without creating display
let previewedSymbol = null;

function previewSymbol(symbol) {
  previewedSymbol = symbol;
  // Show minimal preview (price, spread, etc.)
  // Could fetch quick data from backend
}

function clearPreview() {
  previewedSymbol = null;
}

// Keyboard shortcut for preview
function handlePreviewShortcut(e) {
  if (e.key === ' ' && e.ctrlKey) {
    e.preventDefault();
    if (filteredSymbols[selectedIndex]) {
      previewSymbol(filteredSymbols[selectedIndex]);
    }
  }
}
```

### Multi-Symbol Operations
```javascript
// Bulk operations with keyboard
function toggleBulkMode() {
  bulkMode = !bulkMode;
  selectedSymbols.clear();
}

function addToBulkSelection(symbol) {
  if (selectedSymbols.has(symbol)) {
    selectedSymbols.delete(symbol);
  } else {
    selectedSymbols.add(symbol);
  }
}

function createBulkDisplays() {
  selectedSymbols.forEach(symbol => {
    const displayId = actions.addDisplay(symbol, getRandomPosition());
    connectionManager.subscribeCanvas(displayId, symbol);
  });
  
  clearBulkSelection();
}
```

## Help System

### Keyboard Help Modal
```svelte
<!-- Keyboard help modal -->
<script>
  export let isOpen = false;
  
  const shortcuts = [
    { category: 'Global', keys: ['Ctrl+K'], description: 'Focus symbol palette' },
    { category: 'Global', keys: ['Escape'], description: 'Clear search/minimize' },
    { category: 'Search', keys: ['↑↓'], description: 'Navigate results' },
    { category: 'Search', keys: ['Enter'], description: 'Create selected display' },
    { category: 'Search', keys: ['1-9'], description: 'Quick select result' },
    { category: 'Search', keys: ['Ctrl+Enter'], description: 'Create and keep search' },
    { category: 'Search', keys: ['Ctrl+Space'], description: 'Show recent symbols' },
    { category: 'Search', keys: ['Ctrl+?'], description: 'Show this help' },
    { category: 'Navigation', keys: ['j/k'], description: 'Vim-style navigation' },
    { category: 'Navigation', keys: ['Tab'], description: 'Keep focus in search' }
  ];
</script>

{#if isOpen}
<div class="help-modal" on:click={() => isOpen = false}>
  <div class="help-content" on:click|stopPropagation>
    <div class="help-header">
      <h2>Keyboard Shortcuts</h2>
      <button class="close-btn" on:click={() => isOpen = false}>×</button>
    </div>
    
    <div class="help-body">
      {#each shortcuts as shortcut}
        <div class="shortcut-row">
          <div class="shortcut-category">{shortcut.category}</div>
          <div class="shortcut-keys">
            {#each shortcut.keys as key}
              <kbd>{key}</kbd>
            {/each}
          </div>
          <div class="shortcut-description">{shortcut.description}</div>
        </div>
      {/each}
    </div>
  </div>
</div>
{/if}

<style>
.help-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
}

.help-content {
  background: #1f2937;
  border-radius: 8px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.shortcut-row {
  display: grid;
  grid-template-columns: 100px 150px 1fr;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #374151;
}

kbd {
  background: #374151;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  border: 1px solid #4b5563;
}
</style>
```

## Performance Optimization

### Event Handling Optimization
```javascript
// Efficient event delegation
let keyboardEventHandler;

onMount(() => {
  keyboardEventHandler = (e) => handleKeyboardEvent(e);
  document.addEventListener('keydown', keyboardEventHandler, true);
});

onDestroy(() => {
  document.removeEventListener('keydown', keyboardEventHandler, true);
});

// Debounced search for performance
import { debounce } from './utils/debounce.js';

const debouncedSearch = debounce((query) => {
  performSearch(query);
}, 150);
```

### Memory Management
```javascript
// Cleanup and memory management
function cleanupKeyboardState() {
  searchHistory = [];
  selectedSymbols.clear();
  multiSelectMode = false;
  bulkMode = false;
  previewedSymbol = null;
}

// Auto-cleanup on component destroy
onDestroy(() => {
  cleanupKeyboardState();
});
```

## Accessibility Implementation

### ARIA Attributes
```svelte
<div 
  class="search-results"
  role="listbox"
  aria-label="Search results"
  aria-activedescendant={filteredSymbols[selectedIndex] ? `result-${selectedIndex}` : undefined}
>
  {#each filteredSymbols as symbol, index}
    <div 
      id="result-{index}"
      class="search-result"
      role="option"
      aria-selected={index === selectedIndex}
      on:click={() => createDisplayFromSearch(symbol)}
    >
      <span class="symbol-name" aria-label={`Symbol ${symbol}`}>
        {highlightMatch(symbol, searchQuery)}
      </span>
    </div>
  {/each}
</div>
```

### Screen Reader Announcements
```javascript
// Screen reader announcements
function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
}

function announceSearchResults(count) {
  if (count === 0) {
    announceToScreenReader('No symbols found');
  } else {
    announceToScreenReader(`${count} symbols found`);
  }
}

function announceDisplayCreation(symbol) {
  announceToScreenReader(`Created display for ${symbol}`);
}
```

## Testing Strategy

### Keyboard Navigation Tests
```javascript
// Comprehensive keyboard testing
describe('Keyboard Navigation', () => {
  test('Arrow keys navigate results', () => {
    searchQuery = 'eur';
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    expect(selectedIndex).toBe(1);
    
    fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
    expect(selectedIndex).toBe(0);
  });
  
  test('Enter creates display', () => {
    searchQuery = 'eur';
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    expect(actions.addDisplay).toHaveBeenCalledWith(
      filteredSymbols[0],
      expect.any(Object)
    );
  });
  
  test('Ctrl+K focuses search', () => {
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    
    expect(document.activeElement).toBe(searchInput);
  });
  
  test('Number keys quick select', () => {
    searchQuery = 'eur';
    fireEvent.keyDown(searchInput, { key: '1' });
    
    expect(actions.addDisplay).toHaveBeenCalledWith(
      filteredSymbols[0],
      expect.any(Object)
    );
  });
});
```

### Performance Tests
```javascript
describe('Keyboard Performance', () => {
  test('Rapid keyboard input handled smoothly', () => {
    const startTime = performance.now();
    
    // Simulate rapid typing
    for (let i = 0; i < 50; i++) {
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    }
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(100); // Should handle 50 key presses in <100ms
  });
});
```

## Browser Compatibility

### Supported Features
- **Modern Browsers**: Full keyboard navigation support
- **Legacy Browsers**: Basic keyboard functionality
- **Mobile Devices**: Touch fallbacks for keyboard features

### Fallback Strategies
```javascript
// Feature detection
const supportsAdvancedKeyboard = () => {
  return 'KeyboardEvent' in window && 
         'key' in KeyboardEvent.prototype &&
         'ctrlKey' in KeyboardEvent.prototype;
};

// Fallback for older browsers
if (!supportsAdvancedKeyboard()) {
  // Implement simpler keyboard handling
  // Provide visual cues for mouse usage
}
```

This comprehensive keyboard navigation system transforms the symbol palette into a professional, keyboard-first interface that enables traders to work efficiently without mouse dependency, significantly improving workflow speed and reducing cognitive load.
