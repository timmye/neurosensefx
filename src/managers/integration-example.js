// =============================================================================
// WORKER MANAGER INTEGRATION EXAMPLE
// =============================================================================
// Shows how to integrate workerManager with existing displayStore
// Demonstrates Phase 2 of the displayStore decomposition
// =============================================================================

import { writable } from 'svelte/store';
import { workerManager } from './workerManager.js';

/**
 * Example of how to integrate workerManager with displayStore
 * This replaces the worker-related functionality in the monolithic displayStore.js
 */

// =============================================================================
// SIMPLIFIED DISPLAY STORE (Phase 2 - Worker Extraction)
// =============================================================================

const initialState = {
  // === DISPLAY MANAGEMENT ===
  displays: new Map(),
  activeDisplayId: null,

  // === GLOBAL CONFIGURATION ===
  defaultConfig: {
    // Example configuration
    volatilitySmoothing: 0.8,
    priceBucketMultiplier: 1.5,
    // ... other config parameters
  },

  // === GLOBAL DATA TRACKING ===
  lastTickTime: null
};

export const displayStore = writable(initialState);

// =============================================================================
// DISPLAY ACTIONS (Phase 2 - Worker Manager Integration)
// =============================================================================

export const displayActions = {

  // === DISPLAY OPERATIONS ===

  addDisplay: async (symbol, position = { x: 100, y: 100 }, config = {}) => {
    console.log(`Creating display for symbol: ${symbol}`);
    const displayId = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    displayStore.update(store => {
      const display = {
        id: displayId,
        symbol,
        position,
        size: { width: 220, height: 120 },
        isActive: false,
        zIndex: store.nextDisplayZIndex || 1,
        config: {
          ...store.defaultConfig,
          ...config,
          containerSize: { width: 220, height: 120 }
        },
        state: null,
        ready: false
      };

      const newDisplays = new Map(store.displays);
      newDisplays.set(displayId, display);

      return {
        ...store,
        displays: newDisplays,
        activeDisplayId: displayId,
        nextDisplayZIndex: (store.nextDisplayZIndex || 1) + 1
      };
    });

    // Create worker using workerManager
    try {
      await workerManager.createWorkerForSymbol(symbol, displayId);

      // Initialize worker with default data
      const defaultInitData = {
        digits: 5,
        bid: 1.1000,
        currentPrice: 1.1000,
        todaysOpen: 1.1000,
        projectedAdrHigh: 1.1100,
        projectedAdrLow: 1.0900,
        todaysHigh: 1.1100,
        todaysLow: 1.0900,
        volume: 1000
      };

      // Get current display config for worker initialization
      const currentStore = {};
      displayStore.subscribe(store => Object.assign(currentStore, store))();

      await workerManager.initializeWorker(symbol, displayId, {
        ...defaultInitData,
        config: currentStore.displays.get(displayId)?.config
      });

      console.log(`Worker created and initialized for ${symbol}-${displayId}`);

    } catch (error) {
      console.error(`Failed to create worker for ${symbol}-${displayId}:`, error);
      throw error;
    }

    return displayId;
  },

  removeDisplay: (displayId) => {
    console.log(`Removing display: ${displayId}`);

    displayStore.update(store => {
      const display = store.displays.get(displayId);
      if (!display) return store;

      // Remove symbol using workerManager
      workerManager.removeSymbol(display.symbol, (symbol) => {
        return symbol === display.symbol ? [displayId] : [];
      });

      const newDisplays = new Map(store.displays);
      newDisplays.delete(displayId);

      return {
        ...store,
        displays: newDisplays,
        activeDisplayId: store.activeDisplayId === displayId ? null : store.activeDisplayId
      };
    });
  },

  updateDisplayState: (displayId, newState) => {
    displayStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);

      if (display) {
        const updatedDisplay = {
          ...display,
          state: newState,
          ready: newState?.ready || false
        };
        newDisplays.set(displayId, updatedDisplay);

        // Update global lastTickTime if new tick data
        if (newState?.lastTickTime && newState.lastTickTime > (store.lastTickTime || 0)) {
          store.lastTickTime = newState.lastTickTime;
        }
      }

      return { ...store, displays: newDisplays };
    });
  },

  // === CONFIGURATION OPERATIONS (using workerManager) ===

  updateDisplayConfig: (displayId, parameter, value) => {
    displayStore.update(store => {
      const display = store.displays.get(displayId);
      if (!display) return store;

      // Update display config
      const newDisplays = new Map(store.displays);
      const updatedConfig = { ...display.config, [parameter]: value };

      newDisplays.set(displayId, {
        ...display,
        config: updatedConfig
      });

      // Update worker config via workerManager
      workerManager.updateWorkerConfig(display.symbol, displayId, { [parameter]: value });

      return { ...store, displays: newDisplays };
    });
  },

  updateGlobalConfig: (parameter, value) => {
    displayStore.update(store => {
      const updatedConfig = { ...store.defaultConfig, [parameter]: value };

      // Update all displays with global parameter
      const newDisplays = new Map(store.displays);
      newDisplays.forEach((display, displayId) => {
        const newDisplayConfig = { ...display.config, [parameter]: value };
        newDisplays.set(displayId, {
          ...display,
          config: newDisplayConfig
        });

        // Update worker config via workerManager
        workerManager.updateWorkerConfig(display.symbol, displayId, { [parameter]: value });
      });

      return {
        ...store,
        defaultConfig: updatedConfig,
        displays: newDisplays
      };
    });
  },

  // === WORKER OPERATIONS (delegated to workerManager) ===

  // These methods are now handled by workerManager
  createWorkerForSymbol: (symbol, displayId) =>
    workerManager.createWorkerForSymbol(symbol, displayId),

  initializeWorker: (symbol, displayId, initData) =>
    workerManager.initializeWorker(symbol, displayId, initData),

  dispatchTickToWorker: (symbol, tick) =>
    workerManager.dispatchTickToWorker(symbol, tick),

  dispatchTick: (symbol, tickData) =>
    workerManager.dispatchTick(symbol, tickData),

  createNewSymbol: (symbol, data) =>
    workerManager.createNewSymbol(symbol, data, displayActions.addDisplay),

  updateExistingSymbol: async (symbol, data) => {
    let existingDisplayId = null;

    // Find existing display ID
    displayStore.update(store => {
      for (const [id, display] of store.displays) {
        if (display.symbol === symbol) {
          existingDisplayId = id;
          break;
        }
      }
      return store;
    });

    if (existingDisplayId) {
      await workerManager.updateExistingSymbol(symbol, data, (sym) => {
        return existingDisplayId;
      });
    }
  },

  removeSymbol: (symbol) =>
    workerManager.removeSymbol(symbol, (sym) => {
      const displayIds = [];
      displayStore.update(store => {
        store.displays.forEach((display, id) => {
          if (display.symbol === sym) {
            displayIds.push(id);
          }
        });
        return store;
      });
      return displayIds;
    }),

  // === UTILITY OPERATIONS ===

  getWorkerStats: () => workerManager.getWorkerStats(),

  getMemoryUsage: () => workerManager.getMemoryUsage(),

  configureWorkerOptimizations: (options) =>
    workerManager.configureOptimizations(options),

  clear: () => {
    // Clear all displays and workers
    workerManager.cleanup();

    displayStore.update(store => ({
      ...store,
      displays: new Map(),
      activeDisplayId: null,
      lastTickTime: null
    }));
  }
};

// =============================================================================
// WEBSOCKET INTEGRATION EXAMPLE
// =============================================================================

/**
 * Example of how to integrate workerManager with existing WebSocket client
 * This would replace the displayActions calls in wsClient.js
 */

export function handleWebSocketMessage(data) {
  if (data.type === 'tick') {
    // Use workerManager instead of direct displayActions call
    workerManager.dispatchTick(data.symbol, data);
  } else if (data.type === 'symbolDataPackage') {
    // Handle data packages with workerManager
    handleDataPackage(data);
  }
}

function handleDataPackage(data) {
  // Check if display already exists
  let existingDisplayId = null;
  displayStore.update(store => {
    for (const [id, display] of store.displays) {
      if (display.symbol === data.symbol) {
        existingDisplayId = id;
        break;
      }
    }
    return store;
  });

  if (existingDisplayId) {
    // Update existing display
    workerManager.updateExistingSymbol(data.symbol, data, () => existingDisplayId);
  } else {
    // Create new display
    workerManager.createNewSymbol(data.symbol, data, displayActions.addDisplay);
  }
}

// =============================================================================
// PERFORMANCE MONITORING EXAMPLE
// =============================================================================

/**
 * Example of performance monitoring with workerManager
 */

export function startPerformanceMonitoring() {
  // Configure workerManager for performance tracking
  workerManager.configureOptimizations({
    batchDispatching: true,
    memoryOptimization: true,
    performanceMonitoring: true
  });

  // Monitor worker statistics
  setInterval(() => {
    const stats = workerManager.getWorkerStats();
    const memoryUsage = workerManager.getMemoryUsage();

    console.log('Performance Monitor:', {
      workers: stats.activeWorkers,
      avgLatency: `${stats.averageLatency.toFixed(2)}ms`,
      memory: memoryUsage.available
        ? `${(memoryUsage.current / memoryUsage.total * 100).toFixed(1)}%`
        : 'N/A'
    });

    // Alert on performance issues
    if (stats.averageLatency > 100) {
      console.warn('High latency detected:', stats.averageLatency.toFixed(2) + 'ms');
    }

    if (memoryUsage.available && memoryUsage.current / memoryUsage.limit > 0.8) {
      console.warn('High memory usage detected:', memoryUsage);
    }
  }, 30000); // Every 30 seconds
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  displayStore,
  displayActions,
  handleWebSocketMessage,
  startPerformanceMonitoring
};