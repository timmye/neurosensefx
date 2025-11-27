// =============================================================================
// OPTIMIZED DISPLAY STORE - Phase 2 Store Communication Optimization
// =============================================================================
// Optimized version of displayStore.js with subscription batching,
// memoization, and selective reactivity for 20+ concurrent displays

import { writable, derived, get } from 'svelte/store';
import {
  subscriptionBatcher,
  storeMemoizer,
  storeCommunicationOptimizer,
  createOptimizedDerived,
  createSelectiveDerived,
  optimizedSubscribe,
  deepEqual
} from '../lib/store/storeOptimizer.js';
import { performanceMonitor } from '../lib/monitoring/performanceMonitor.js';

// Import original display store functionality
import { displayStore as originalDisplayStore } from './displayStore.js';
import { displayStateStore, displayStateActions } from './displayStateStore.js';

// Error boundary utilities
import {
  withErrorBoundary,
  withAsyncErrorBoundary,
  memorySafeErrorHandler,
  getContextualFallback,
  SAFE_DEFAULTS,
  CircuitBreaker
} from '../utils/errorBoundaryUtils.js';

// =============================================================================
// OPTIMIZED SELECTIVE DERIVED STORES WITH ERROR BOUNDARIES
// =============================================================================

/**
 * Create safe derived store with fallback to original
 */
function createSafeDerivedStore(originalStore, selector, key, compareFn) {
  try {
    if (compareFn) {
      return createSelectiveDerived(originalStore, selector, compareFn);
    } else {
      return createOptimizedDerived(originalStore, selector, key);
    }
  } catch (error) {
    memorySafeErrorHandler(`SafeDerivedStore.${key}`, error);

    // Fallback to standard derived store
    console.warn(`[OPTIMIZED_STORE] Falling back to standard derived store for ${key}`);
    return derived(originalStore, selector);
  }
}

/**
 * Optimized panels selector - only updates when panels actually change
 */
export const optimizedPanels = createSafeDerivedStore(
  originalDisplayStore,
  ($store) => $store.panels || new Map(),
  'panels',
  deepEqual
);

/**
 * Optimized icons selector - only updates when icons actually change
 */
export const optimizedIcons = createSafeDerivedStore(
  originalDisplayStore,
  ($store) => $store.icons || new Map(),
  'icons',
  deepEqual
);

/**
 * Optimized context menu selector - only updates when context menu state changes
 */
export const optimizedContextMenu = createSafeDerivedStore(
  originalDisplayStore,
  ($store) => $store.contextMenu || { open: false, x: 0, y: 0 },
  'contextMenu',
  (a, b) => a.open === b.open && a.x === b.x && a.y === b.y
);

/**
 * Optimized default config selector - memoized for performance
 */
export const optimizedDefaultConfig = createSafeDerivedStore(
  originalDisplayStore,
  ($store) => $store.defaultConfig || {},
  'default_config'
);

/**
 * Optimized displays selector - delegates to displayStateStore with memoization
 */
export const optimizedDisplays = createSafeDerivedStore(
  displayStateStore,
  ($state) => {
    try {
      return storeMemoizer.memoize('displays_map', () => {
        console.log('[OPTIMIZED_STORE] Computing displays derived store, count:', $state.displays?.size || 0);
        return $state.displays || new Map();
      }, $state.displays?.size || 0);
    } catch (error) {
      memorySafeErrorHandler('OptimizedDisplays.memoize', error);
      return $state.displays || new Map();
    }
  },
  'displays_derived'
);

/**
 * Optimized active display selector - only updates when active display changes
 */
export const optimizedActiveDisplay = createSafeDerivedStore(
  displayStateStore,
  ($state) => {
    try {
      return storeMemoizer.memoize('active_display', () => {
        return $state.activeDisplayId ? $state.displays?.get($state.activeDisplayId) : null;
      }, $state.activeDisplayId);
    } catch (error) {
      memorySafeErrorHandler('OptimizedActiveDisplay.memoize', error);
      return $state.activeDisplayId ? $state.displays?.get($state.activeDisplayId) : null;
    }
  },
  'active_display',
  (a, b) => a?.id === b?.id
);

// =============================================================================
// STORE COMMUNICATION OPTIMIZATION
// =============================================================================

/**
 * Optimized display actions with batched updates and error boundaries
 */
export const optimizedDisplayActions = {
  /**
   * Batched display creation for multiple displays
   * @param {Array} displayConfigs - Array of display configurations
   * @returns {Array} Array of created display IDs
   */
  batchAddDisplays: withErrorBoundary((displayConfigs) => {
    if (!Array.isArray(displayConfigs)) {
      console.warn('[OPTIMIZED_STORE] batchAddDisplays: invalid displayConfigs array');
      return [];
    }

    const startTime = performance.now();
    const displayIds = [];
    let successCount = 0;

    try {
      subscriptionBatcher.batchUpdate('display_creation', () => {
        displayConfigs.forEach(config => {
          try {
            const displayId = displayStateActions.addDisplay(
              config.symbol,
              config.position,
              config.config,
              config.size
            );
            if (displayId) {
              displayIds.push(displayId);
              successCount++;
            }
          } catch (actionError) {
            memorySafeErrorHandler('batchAddDisplays.addDisplay', actionError, { config });
          }
        });
      });
    } catch (batchError) {
      memorySafeErrorHandler('batchAddDisplays.batchUpdate', batchError);

      // Fallback: Try individual displays without batching
      displayConfigs.forEach(config => {
        try {
          const displayId = displayStateActions.addDisplay(
            config.symbol,
            config.position,
            config.config,
            config.size
          );
          if (displayId) {
            displayIds.push(displayId);
          }
        } catch (fallbackError) {
          memorySafeErrorHandler('batchAddDisplays.fallback', fallbackError, { config });
        }
      });
    }

    const batchTime = performance.now() - startTime;
    try {
      performanceMonitor.recordMetric('batch_display_creation_time', batchTime);
      performanceMonitor.recordMetric('batch_display_success_rate', successCount / displayConfigs.length);
    } catch (monitorError) {
      // Ignore monitoring errors
    }

    return displayIds;
  }, [], 'optimizedDisplayActions.batchAddDisplays'),

  /**
   * Optimized display state update with deduplication
   * @param {string} displayId - Display ID
   * @param {Object} newState - New state
   * @returns {boolean} Update success
   */
  optimizedUpdateDisplayState: withErrorBoundary((displayId, newState) => {
    if (!displayId || !newState) {
      console.warn('[OPTIMIZED_STORE] optimizedUpdateDisplayState: invalid parameters');
      return false;
    }

    try {
      return storeMemoizer.memoize(`display_state_${displayId}`, () => {
        return displayStateActions.updateDisplayState(displayId, newState);
      }, JSON.stringify(newState));
    } catch (error) {
      memorySafeErrorHandler('optimizedUpdateDisplayState.memoize', error);

      // Fallback: Direct call without memoization
      try {
        return displayStateActions.updateDisplayState(displayId, newState);
      } catch (fallbackError) {
        memorySafeErrorHandler('optimizedUpdateDisplayState.fallback', fallbackError);
        return false;
      }
    }
  }, false, 'optimizedDisplayActions.optimizedUpdateDisplayState'),

  /**
   * Optimized display resize with cross-store communication
   * @param {string} displayId - Display ID
   * @param {number} width - New width
   * @param {number} height - New height
   * @returns {boolean} Resize success
   */
  optimizedResizeDisplay: withErrorBoundary((displayId, width, height) => {
    if (!displayId || typeof width !== 'number' || typeof height !== 'number') {
      console.warn('[OPTIMIZED_STORE] optimizedResizeDisplay: invalid parameters');
      return false;
    }

    const startTime = performance.now();
    let success = false;

    try {
      // Queue cross-store event for coordination
      storeCommunicationOptimizer.queueCrossStoreEvent(
        'displayStateStore',
        'displayStore',
        'display_resize',
        { displayId, width, height, timestamp: Date.now() }
      );

      success = displayStateActions.resizeDisplay(displayId, width, height);
    } catch (error) {
      memorySafeErrorHandler('optimizedResizeDisplay.optimization', error);

      // Fallback: Direct resize without optimization
      try {
        success = displayStateActions.resizeDisplay(displayId, width, height);
      } catch (fallbackError) {
        memorySafeErrorHandler('optimizedResizeDisplay.fallback', fallbackError);
        success = false;
      }
    }

    const resizeTime = performance.now() - startTime;
    try {
      performanceMonitor.recordMetric('optimized_display_resize_time', resizeTime);
    } catch (monitorError) {
      // Ignore monitoring errors
    }

    return success;
  }, false, 'optimizedDisplayActions.optimizedResizeDisplay'),

  /**
   * Optimized active display setting with minimal updates
   * @param {string} displayId - Display ID to activate
   * @returns {boolean} Success status
   */
  optimizedSetActiveDisplay: (displayId) => {
    const $currentState = get(displayStateStore);

    // Skip if already active to prevent unnecessary updates
    if ($currentState.activeDisplayId === displayId) {
      return false;
    }

    return displayStateActions.setActiveDisplay(displayId);
  },

  /**
   * Batch display removal for cleanup operations
   * @param {Array} displayIds - Array of display IDs to remove
   * @returns {number} Number of displays removed
   */
  batchRemoveDisplays: (displayIds) => {
    const startTime = performance.now();
    let removedCount = 0;

    subscriptionBatcher.batchUpdate('display_removal', () => {
      displayIds.forEach(displayId => {
        if (displayStateActions.removeDisplay(displayId)) {
          removedCount++;
        }
      });
    });

    const batchTime = performance.now() - startTime;
    performanceMonitor.recordMetric('batch_display_removal_time', batchTime);

    return removedCount;
  },

  // Delegate other actions to original displayActions
  addDisplay: displayStateActions.addDisplay,
  removeDisplay: displayStateActions.removeDisplay,
  moveDisplay: displayStateActions.moveDisplay,
  setActiveDisplay: displayStateActions.setActiveDisplay,
  updateDisplayState: displayStateActions.updateDisplayState,
  createWorkerForSymbol: (symbol, displayId) => {
    // This would be delegated to workerManager
    console.log(`[OPTIMIZED_STORE] Worker creation delegated for ${symbol}-${displayId}`);
  },
  dispatchTickToWorker: (symbol, tick) => {
    // This would be delegated to workerManager
    console.log(`[OPTIMIZED_STORE] Tick dispatch delegated for ${symbol}`);
  }
};

// =============================================================================
// CROSS-STORE EVENT SUBSCRIPTIONS
// =============================================================================

/**
 * Setup optimized cross-store communication
 */
export function setupOptimizedStoreCommunication() {
  // Subscribe to display state changes for UI synchronization
  const unsubscribe1 = storeCommunicationOptimizer.subscribeCrossStore(
    'displayStateStore',
    'displayStore',
    (eventType, data) => {
      switch (eventType) {
        case 'display_added':
          // Update UI store when display is added
          subscriptionBatcher.batchUpdate('ui_sync', () => {
            // UI update logic would go here
          });
          break;
        case 'display_removed':
          // Update UI store when display is removed
          subscriptionBatcher.batchUpdate('ui_sync', () => {
            // UI update logic would go here
          });
          break;
        case 'display_focus_changed':
          // Update active display in UI store
          subscriptionBatcher.batchUpdate('ui_sync', () => {
            // UI update logic would go here
          });
          break;
      }
    }
  );

  // Subscribe to configuration changes for propagation
  const unsubscribe2 = storeCommunicationOptimizer.subscribeCrossStore(
    'displayStore',
    'displayStateStore',
    (eventType, data) => {
      switch (eventType) {
        case 'config_updated':
          // Propagate configuration changes to displays
          subscriptionBatcher.batchUpdate('config_propagation', () => {
            // Configuration propagation logic would go here
          });
          break;
      }
    }
  );

  // Return cleanup function
  return () => {
    unsubscribe1();
    unsubscribe2();
  };
}

// =============================================================================
// PERFORMANCE MONITORING INTEGRATION
// =============================================================================

/**
 * Get optimized store performance metrics
 * @returns {Object} Performance metrics
 */
export function getOptimizedStoreMetrics() {
  return {
    derivedStores: {
      panelsRecomputations: storeMemoizer.cache.get('panels_recomputed') || 0,
      iconsRecomputations: storeMemoizer.cache.get('icons_recomputed') || 0,
      activeDisplayRecomputations: storeMemoizer.cache.get('active_display_recomputed') || 0
    },
    crossStoreCommunication: storeCommunicationOptimizer.getMetrics(),
    subscriptionBatching: {
      pendingBatches: subscriptionBatcher.pendingUpdates.size,
      activeSubscribers: subscriptionBatcher.subscribers.size
    }
  };
}

// =============================================================================
// OPTIMIZED SUBSCRIPTION HELPERS
// =============================================================================

/**
 * Subscribe to display updates with optimization
 * @param {Function} callback - Callback function
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDisplaysOptimized(callback, options = {}) {
  return optimizedSubscribe(optimizedDisplays, callback, {
    deduplicate: true,
    batchUpdates: true,
    measurePerformance: true,
    subscriberId: options.subscriberId || 'displays_subscriber'
  });
}

/**
 * Subscribe to active display with optimization
 * @param {Function} callback - Callback function
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveDisplayOptimized(callback, options = {}) {
  return optimizedSubscribe(optimizedActiveDisplay, callback, {
    deduplicate: true,
    batchUpdates: false, // Active display changes should be immediate
    measurePerformance: true,
    subscriberId: options.subscriberId || 'active_display_subscriber'
  });
}

/**
 * Subscribe to panels with optimization
 * @param {Function} callback - Callback function
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToPanelsOptimized(callback, options = {}) {
  return optimizedSubscribe(optimizedPanels, callback, {
    deduplicate: true,
    batchUpdates: true,
    measurePerformance: true,
    subscriberId: options.subscriberId || 'panels_subscriber'
  });
}

// =============================================================================
// INITIALIZATION AND CLEANUP
// =============================================================================

/**
 * Initialize optimized store system
 * @returns {Function} Cleanup function
 */
export function initializeOptimizedStores() {
  try {
    console.log('[OPTIMIZED_STORE] Initializing store optimization system');

    let cleanupCommunication = null;

    // Setup cross-store communication with error handling
    try {
      cleanupCommunication = setupOptimizedStoreCommunication();
    } catch (communicationError) {
      memorySafeErrorHandler('initializeOptimizedStores.communication', communicationError);
      console.warn('[OPTIMIZED_STORE] Cross-store communication setup failed, continuing without it');
      cleanupCommunication = () => {}; // No-op cleanup
    }

    // Setup performance monitoring
    try {
      performanceMonitor.recordMetric('optimized_stores_initialized', true);
    } catch (monitorError) {
      console.warn('[OPTIMIZED_STORE] Performance monitoring setup failed:', monitorError);
    }

    // Return cleanup function with error handling
    return () => {
      try {
        console.log('[OPTIMIZED_STORE] Cleaning up store optimization system');

        if (cleanupCommunication) {
          cleanupCommunication();
        }

        // Cleanup store optimization with error handling
        try {
          storeMemoizer.clear();
        } catch (clearError) {
          memorySafeErrorHandler('initializeOptimizedStores.cleanup.memoizer', clearError);
        }

        try {
          subscriptionBatcher.cleanup();
        } catch (cleanupError) {
          memorySafeErrorHandler('initializeOptimizedStores.cleanup.batcher', cleanupError);
        }
      } catch (cleanupError) {
        memorySafeErrorHandler('initializeOptimizedStores.cleanup', cleanupError);
      }
    };
  } catch (error) {
    memorySafeErrorHandler('initializeOptimizedStores', error);

    // Return no-op cleanup function if initialization fails
    console.warn('[OPTIMIZED_STORE] Store optimization initialization failed, using fallback mode');
    return () => {
      console.log('[OPTIMIZED_STORE] Fallback cleanup completed');
    };
  }
}

export default {
  // Optimized derived stores
  optimizedPanels,
  optimizedIcons,
  optimizedContextMenu,
  optimizedDefaultConfig,
  optimizedDisplays,
  optimizedActiveDisplay,

  // Optimized actions
  optimizedDisplayActions,

  // Utilities
  subscribeToDisplaysOptimized,
  subscribeToActiveDisplayOptimized,
  subscribeToPanelsOptimized,

  // Monitoring
  getOptimizedStoreMetrics,

  // Initialization
  initializeOptimizedStores
};