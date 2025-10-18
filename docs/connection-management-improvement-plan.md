# Connection Management Improvement Plan

## Overview

This document outlines the improvements needed for the frontend connection logic and management in NeuroSense FX, specifically addressing the issue where live data is not showing in created canvases and improving the symbol selection workflow.

## Current Issues Identified

1. **Missing Symbol Subscription**: When creating a canvas, there's no explicit subscription to the symbol in live mode
2. **Fragmented Connection Management**: Connection logic is scattered across multiple components
3. **No Centralized Data Flow Manager**: No single component manages the data flow from WebSocket to canvas
4. **Inconsistent State Initialization**: Canvas state initialization is inconsistent between live and simulated modes
5. **Missing Error Handling**: No proper error handling for connection failures
6. **Poor User Experience**: Users must click "Create Canvas" button instead of using Enter key or direct symbol click

## Proposed Solution Architecture

### 1. ConnectionManager Class

Create a centralized ConnectionManager class to handle all data flow from WebSocket to canvases.

**File**: `src/data/ConnectionManager.js`

```javascript
/**
 * ConnectionManager - Centralized data flow management for NeuroSense FX
 * Handles WebSocket connections, symbol subscriptions, and data distribution to canvases
 */

import { writable } from 'svelte/store';
import { symbolStore } from './symbolStore.js';
import { dataSourceMode, wsStatus, availableSymbols, subscribe, unsubscribe } from './wsClient.js';
import { createLogger } from '../utils/debugLogger.js';

const logger = createLogger('ConnectionManager');

// Connection state for UI components
export const connectionState = writable({
  status: 'disconnected', // disconnected, connecting, connected, error
  activeSubscriptions: new Set(),
  lastError: null,
  retryCount: 0
});

class ConnectionManager {
  constructor() {
    // Track which canvases are subscribed to which symbols
    this.canvasSubscriptions = new Map(); // canvasId -> symbol
    this.symbolCanvases = new Map(); // symbol -> Set of canvasIds
    
    // Cache for symbol data to avoid duplicate requests
    this.symbolDataCache = new Map(); // symbol -> symbol data
    
    // Track subscription requests to prevent duplicates
    this.pendingSubscriptions = new Set(); // symbols being requested
    
    // Initialize connection monitoring
    this.initializeConnectionMonitoring();
  }
  
  /**
   * Subscribe a canvas to a symbol
   * @param {string} canvasId - Unique canvas identifier
   * @param {string} symbol - Symbol to subscribe to
   * @returns {Promise<Object>} - Symbol data for the canvas
   */
  async subscribeCanvas(canvasId, symbol) {
    logger.debug('Subscribing canvas to symbol', { canvasId, symbol });
    
    // Track the subscription
    this.canvasSubscriptions.set(canvasId, symbol);
    
    if (!this.symbolCanvases.has(symbol)) {
      this.symbolCanvases.set(symbol, new Set());
    }
    this.symbolCanvases.get(symbol).add(canvasId);
    
    // Get or fetch symbol data
    const symbolData = await this.getSymbolData(symbol);
    
    // Update connection state
    connectionState.update(state => ({
      ...state,
      activeSubscriptions: new Set(this.symbolCanvases.keys())
    }));
    
    return symbolData;
  }
  
  /**
   * Unsubscribe a canvas from a symbol
   * @param {string} canvasId - Canvas identifier
   */
  unsubscribeCanvas(canvasId) {
    const symbol = this.canvasSubscriptions.get(canvasId);
    if (!symbol) return;
    
    logger.debug('Unsubscribing canvas from symbol', { canvasId, symbol });
    
    // Remove canvas from symbol tracking
    this.canvasSubscriptions.delete(canvasId);
    
    const canvasSet = this.symbolCanvases.get(symbol);
    if (canvasSet) {
      canvasSet.delete(canvasId);
      
      // If no more canvases need this symbol, unsubscribe from WebSocket
      if (canvasSet.size === 0) {
        this.symbolCanvases.delete(symbol);
        if ($dataSourceMode === 'live') {
          unsubscribe(symbol);
        }
      }
    }
    
    // Update connection state
    connectionState.update(state => ({
      ...state,
      activeSubscriptions: new Set(this.symbolCanvases.keys())
    }));
  }
  
  /**
   * Get symbol data from cache or fetch from server
   * @param {string} symbol - Symbol to get data for
   * @returns {Promise<Object>} - Symbol data
   */
  async getSymbolData(symbol) {
    // Check cache first
    if (this.symbolDataCache.has(symbol)) {
      logger.debug('Returning cached symbol data', { symbol });
      return this.symbolDataCache.get(symbol);
    }
    
    // Check if already being requested
    if (this.pendingSubscriptions.has(symbol)) {
      logger.debug('Symbol already being requested, waiting', { symbol });
      return this.waitForSymbolData(symbol);
    }
    
    // Fetch new data
    logger.debug('Fetching new symbol data', { symbol });
    this.pendingSubscriptions.add(symbol);
    
    try {
      if ($dataSourceMode === 'live') {
        // Subscribe to live data
        subscribe(symbol);
        
        // Wait for symbol data to be received
        const data = await this.waitForSymbolData(symbol);
        this.symbolDataCache.set(symbol, data);
        return data;
      } else {
        // For simulated mode, symbol should already be in symbolStore
        const symbolStoreValue = $symbolStore;
        const data = symbolStoreValue[symbol];
        
        if (data) {
          this.symbolDataCache.set(symbol, data);
          return data;
        } else {
          throw new Error(`Symbol ${symbol} not available in simulated mode`);
        }
      }
    } catch (error) {
      logger.error('Failed to get symbol data', { symbol, error });
      throw error;
    } finally {
      this.pendingSubscriptions.delete(symbol);
    }
  }
  
  /**
   * Wait for symbol data to be received
   * @param {string} symbol - Symbol to wait for
   * @returns {Promise<Object>} - Symbol data
   */
  waitForSymbolData(symbol) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${symbol} data`));
      }, 10000); // 10 second timeout
      
      const unsubscribe = symbolStore.subscribe(symbols => {
        const data = symbols[symbol];
        if (data && data.state && data.config) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(data);
        }
      });
    });
  }
  
  /**
   * Initialize connection monitoring
   */
  initializeConnectionMonitoring() {
    // Monitor WebSocket status
    const unsubscribeWsStatus = wsStatus.subscribe(status => {
      connectionState.update(state => ({
        ...state,
        status
      }));
    });
    
    // Monitor data source mode changes
    const unsubscribeDataSourceMode = dataSourceMode.subscribe(mode => {
      logger.debug('Data source mode changed', { mode });
      this.handleDataSourceModeChange(mode);
    });
    
    // Clean up on component destruction
    return () => {
      unsubscribeWsStatus();
      unsubscribeDataSourceMode();
    };
  }
  
  /**
   * Handle data source mode changes
   * @param {string} mode - New data source mode
   */
  handleDataSourceModeChange(mode) {
    logger.debug('Handling data source mode change', { mode });
    
    // Clear cache when switching modes
    this.symbolDataCache.clear();
    this.pendingSubscriptions.clear();
    
    // Re-subscribe to all active symbols if switching to live mode
    if (mode === 'live') {
      this.symbolCanvases.forEach((canvasSet, symbol) => {
        if (canvasSet.size > 0) {
          subscribe(symbol);
        }
      });
    }
  }
  
  /**
   * Get all active subscriptions
   * @returns {Set<string>} - Set of active symbols
   */
  getActiveSubscriptions() {
    return new Set(this.symbolCanvases.keys());
  }
  
  /**
   * Get canvases subscribed to a symbol
   * @param {string} symbol - Symbol to check
   * @returns {Set<string>} - Set of canvas IDs
   */
  getCanvasesForSymbol(symbol) {
    return this.symbolCanvases.get(symbol) || new Set();
  }
  
  /**
   * Get symbol for a canvas
   * @param {string} canvasId - Canvas ID
   * @returns {string|null} - Symbol or null
   */
  getSymbolForCanvas(canvasId) {
    return this.canvasSubscriptions.get(canvasId) || null;
  }
  
  /**
   * Clear all subscriptions and cache
   */
  clearAll() {
    logger.debug('Clearing all subscriptions and cache');
    
    this.canvasSubscriptions.clear();
    this.symbolCanvases.clear();
    this.symbolDataCache.clear();
    this.pendingSubscriptions.clear();
    
    connectionState.update(state => ({
      ...state,
      activeSubscriptions: new Set()
    }));
  }
}

// Create and export singleton instance
export const connectionManager = new ConnectionManager();
export default connectionManager;
```

### 2. Enhanced Canvas Creation Flow

Update `App.svelte` to use the ConnectionManager:

```javascript
// In App.svelte, replace the addFloatingCanvas function with:

import { connectionManager } from './data/ConnectionManager.js';

async function addFloatingCanvas(symbol = null, position = null) {
  // Validate input parameters
  if (symbol && typeof symbol !== 'string') {
    throw new Error(`Symbol must be a string, received ${typeof symbol}: ${JSON.stringify(symbol)}`);
  }
  
  // Use provided symbol or default to first available symbol
  const selectedSymbol = symbol || Object.keys(symbols)[0] || 'SIM-EURUSD';
  const canvasPosition = position || {
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 100
  };
  
  try {
    // Subscribe canvas to symbol through ConnectionManager
    const symbolData = await connectionManager.subscribeCanvas(canvasId, selectedSymbol);
    
    // Create canvas data with symbol data
    const canvasData = createCanvasData(selectedSymbol, canvasPosition);
    
    if (symbolData && symbolData.config && symbolData.state) {
      canvasData.config = { ...symbolData.config };
      canvasData.state = { ...symbolData.state };
    } else {
      // Use safe defaults
      canvasData.config = { ...defaultConfig };
      canvasData.state = {
        ready: false,
        currentPrice: 0,
        projectedAdrHigh: 0,
        projectedAdrLow: 0,
        visualHigh: 0,
        visualLow: 0,
        volatility: 0
      };
    }
    
    // Register and add canvas
    registryActions.registerCanvas(canvasData.id, {
      symbol: selectedSymbol,
      type: 'floating'
    });
    
    workspaceActions.addCanvas(canvasData);
    
    // Set up cleanup for canvas destruction
    canvasData.unsubSymbolStore = () => {
      connectionManager.unsubscribeCanvas(canvasData.id);
    };
    
    return canvasData;
  } catch (error) {
    logger.error('Failed to create canvas', { symbol: selectedSymbol, error });
    throw error;
  }
}

// Update the canvas close handler:
function handleCanvasClose(event) {
  const { canvasId } = event.detail;
  
  // Unsubscribe from ConnectionManager
  connectionManager.unsubscribeCanvas(canvasId);
  
  // Remove from workspace
  workspaceActions.removeCanvas(canvasId);
  registryActions.unregisterCanvas(canvasId);
}
```

### 3. Improved Symbol Selection Workflow

#### 3.1 Add Enter Key Support to FXSymbolSelector

Update `src/components/FXSymbolSelector.svelte`:

```javascript
// In the handleKeyDown function, update the Enter case:
case 'Enter':
  logger.debug('Enter pressed', { highlightedIndex, filteredSymbolsLength: filteredSymbols.length });
  event.preventDefault();
  if (highlightedIndex >= 0 && highlightedIndex < filteredSymbols.length) {
    logger.debug('calling handleSymbolSelect with highlighted symbol');
    handleSymbolSelect(filteredSymbols[highlightedIndex], true); // Trigger subscription and canvas creation
  } else if (filteredSymbols.length > 0) {
    logger.debug('calling handleSymbolSelect with first symbol');
    handleSymbolSelect(filteredSymbols[0], true); // Trigger subscription and canvas creation
  } else {
    logger.debug('no symbols to select');
  }
  break;
```

#### 3.2 Add Click-to-Create Functionality

Update `src/components/FloatingSymbolPalette.svelte`:

```javascript
// Add a new function to handle symbol selection with canvas creation
function handleSymbolSelectAndCreate(symbol) {
  selectedSymbol = symbol;
  handleCreateCanvas();
}

// Update the recent symbols buttons:
<button
  class="recent-symbol-btn"
  class:selected={selectedSymbol === symbol}
  on:click={() => handleSymbolSelectAndCreate(symbol)}
>
  {symbol}
</button>
```

#### 3.3 Add Visual Feedback for Loading States

Update `src/components/FloatingSymbolPalette.svelte`:

```javascript
// Add loading state
let isCreatingCanvas = false;

// Update handleCreateCanvas function:
async function handleCreateCanvas() {
  if (!selectedSymbol || isCreatingCanvas) return;
  
  isCreatingCanvas = true;
  
  try {
    // Create canvas at position near the palette
    const canvasPosition = {
      x: Math.max(50, palettePosition.x + 50),
      y: Math.max(50, palettePosition.y + 50)
    };
    
    // Create canvas data
    const canvasData = createCanvasData(selectedSymbol, canvasPosition);
    
    // Get symbol data from ConnectionManager
    const symbolData = await connectionManager.subscribeCanvas(canvasData.id, selectedSymbol);
    
    if (symbolData && symbolData.config && symbolData.state) {
      canvasData.config = { ...symbolData.config };
      canvasData.state = { ...symbolData.state };
    } else {
      canvasData.config = { ...defaultConfig };
      canvasData.state = { ready: false };
    }
    
    // Register canvas
    registryActions.registerCanvas(canvasData.id, {
      symbol: selectedSymbol,
      type: 'floating'
    });
    
    // Dispatch event for parent components to handle canvas creation
    dispatch('canvasCreated', {
      canvasId: canvasData.id,
      symbol: selectedSymbol,
      position: canvasPosition,
      canvasData
    });
  } catch (error) {
    logger.error('Failed to create canvas', { symbol: selectedSymbol, error });
    // Show error to user
  } finally {
    isCreatingCanvas = false;
  }
}

// Update the create button:
<button
  class="create-btn"
  class:disabled={!selectedSymbol || isCreatingCanvas}
  on:click={handleCreateCanvas}
  disabled={!selectedSymbol || isCreatingCanvas}
>
  {isCreatingCanvas ? 'Creating...' : 'Create Canvas'}
</button>
```

### 4. Error Handling Improvements

#### 4.1 Add Error Display Component

Create `src/components/shared/ErrorDisplay.svelte`:

```javascript
<script>
  export let error = null;
  export let onDismiss = null;
  
  function handleDismiss() {
    if (onDismiss) onDismiss();
  }
</script>

{#if error}
  <div class="error-display">
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <span class="error-message">{error.message || 'An error occurred'}</span>
      <button class="error-dismiss" on:click={handleDismiss}>×</button>
    </div>
  </div>
{/if}

<style>
  .error-display {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 12px;
  }
  
  .error-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ef4444;
    font-size: 12px;
  }
  
  .error-icon {
    font-size: 14px;
  }
  
  .error-message {
    flex: 1;
  }
  
  .error-dismiss {
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  
  .error-dismiss:hover {
    background: rgba(239, 68, 68, 0.2);
  }
</style>
```

#### 4.2 Add Error State to FloatingSymbolPalette

Update `src/components/FloatingSymbolPalette.svelte`:

```javascript
// Add error state
let createError = null;

// Update handleCreateCanvas to handle errors:
async function handleCreateCanvas() {
  if (!selectedSymbol || isCreatingCanvas) return;
  
  isCreatingCanvas = true;
  createError = null;
  
  try {
    // ... existing code ...
  } catch (error) {
    logger.error('Failed to create canvas', { symbol: selectedSymbol, error });
    createError = error;
  } finally {
    isCreatingCanvas = false;
  }
}

// Add error display in the template:
{#if createError}
  <ErrorDisplay error={createError} onDismiss={() => createError = null} />
{/if}
```

## Implementation Steps

1. **Create ConnectionManager Class**
   - Create `src/data/ConnectionManager.js`
   - Implement centralized subscription management
   - Add symbol data caching
   - Integrate with existing WebSocket client

2. **Update App.svelte**
   - Import ConnectionManager
   - Update `addFloatingCanvas` function
   - Update canvas close handler
   - Add error handling

3. **Enhance FXSymbolSelector.svelte**
   - Add Enter key support for canvas creation
   - Update event handlers

4. **Improve FloatingSymbolPalette.svelte**
   - Add click-to-create functionality
   - Add loading states
   - Add error handling
   - Improve visual feedback

5. **Add Error Display Component**
   - Create `src/components/shared/ErrorDisplay.svelte`
   - Add to components that need error display

6. **Test the Implementation**
   - Test with live data
   - Test with simulated data
   - Test error handling
   - Test multiple canvases

## Expected Benefits

1. **Fixed Live Data Issue**: Canvases will properly receive live data after creation
2. **Improved User Experience**: Users can create canvases with Enter key or by clicking symbols
3. **Better Error Handling**: Users will see clear error messages when something goes wrong
4. **Centralized Connection Management**: Easier to maintain and debug connection issues
5. **Performance Improvements**: Reduced duplicate symbol requests through caching
6. **Consistent State Management**: All canvases receive consistent initial state

## Testing Plan

1. **Unit Tests**
   - Test ConnectionManager methods
   - Test symbol subscription/unsubscription
   - Test error handling

2. **Integration Tests**
   - Test canvas creation with live data
   - Test canvas creation with simulated data
   - Test multiple canvases with same symbol
   - Test error scenarios

3. **User Experience Tests**
   - Test Enter key functionality
   - Test click-to-create functionality
   - Test loading states
   - Test error display

4. **Performance Tests**
   - Test with multiple canvases (20+)
   - Test memory usage
   - Test connection recovery

## Conclusion

This implementation plan addresses the core issues with live data not showing in created canvases and improves the overall user experience for symbol selection and canvas creation. The centralized ConnectionManager will provide a robust foundation for managing data flow in the floating workspace architecture.