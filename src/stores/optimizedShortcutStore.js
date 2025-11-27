// =============================================================================
// OPTIMIZED SHORTCUT STORE - Phase 2 Store Communication Optimization
// =============================================================================
// Optimized version of shortcutStore.js with subscription batching,
// memoization, and selective reactivity for efficient keyboard handling

import { writable, derived, get } from 'svelte/store';
import {
  subscriptionBatcher,
  storeMemoizer,
  createOptimizedDerived,
  createSelectiveDerived,
  optimizedSubscribe,
  deepEqual
} from '../lib/store/storeOptimizer.js';
import { performanceMonitor } from '../lib/monitoring/performanceMonitor.js';

// Import original shortcut store functionality
import { shortcutStore as originalShortcutStore } from './shortcutStore.js';
import { displayStateStore } from './displayStateStore.js';
import { keyboardEventStore } from '../actions/keyboardAction.js';

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
// OPTIMIZED DERIVED STORES
// =============================================================================

/**
 * Optimized active shortcuts selector - memoized and only updates when necessary
 */
export const optimizedActiveShortcuts = (() => {
  try {
    return createOptimizedDerived(
      [originalShortcutStore, displayStateStore],
      ([$shortcutStore, $displayStateStore]) => {
        try {
          return storeMemoizer.memoize('active_shortcuts', () => {
            try {
              const context = determineActiveContextOptimized($displayStateStore);

              const activeShortcuts = Object.values($shortcutStore.shortcuts || {})
                .filter(shortcut => isShortcutActiveOptimized(shortcut, context))
                .map(shortcut => ({
                  ...shortcut,
                  formattedKey: formatKeyForDisplayOptimized(typeof shortcut.key === 'string' ? shortcut.key : '')
                }));

              console.log('[OPTIMIZED_SHORTCUT_STORE] Active shortcuts computed', {
                context,
                count: activeShortcuts.length
              });

              return activeShortcuts;
            } catch (memoizeError) {
              memorySafeErrorHandler('optimizedActiveShortcuts.memoize', memoizeError);
              return [];
            }
          }, $shortcutStore.shortcuts, $displayStateStore.activeDisplayId);
        } catch (selectorError) {
          memorySafeErrorHandler('optimizedActiveShortcuts.selector', selectorError);
          return [];
        }
      },
      'active_shortcuts_derived'
    );
  } catch (error) {
    memorySafeErrorHandler('optimizedActiveShortcuts.creation', error);

    // Fallback to standard derived store
    console.warn('[OPTIMIZED_SHORTCUT_STORE] Falling back to standard derived store for active shortcuts');
    return derived([originalShortcutStore, displayStateStore], ([$shortcutStore, $displayStateStore]) => {
      try {
        const shortcuts = Object.values($shortcutStore.shortcuts || {});
        return shortcuts.filter(shortcut => shortcut && shortcut.active);
      } catch (fallbackError) {
        memorySafeErrorHandler('optimizedActiveShortcuts.fallback', fallbackError);
        return [];
      }
    });
  }
})();

/**
 * Optimized shortcuts by category - memoized for performance
 */
export const optimizedShortcutsByCategory = createOptimizedDerived(
  originalShortcutStore,
  ($shortcutStore) => {
    return storeMemoizer.memoize('shortcuts_by_category', () => {
      const categories = {};

      Object.values($shortcutStore.shortcuts).forEach(shortcut => {
        if (!categories[shortcut.category]) {
          categories[shortcut.category] = [];
        }
        categories[shortcut.category].push({
          ...shortcut,
          formattedKey: formatKeyForDisplayOptimized(typeof shortcut.key === 'string' ? shortcut.key : '')
        });
      });

      // Sort each category by priority
      Object.keys(categories).forEach(category => {
        categories[category] = sortShortcutsByPriorityOptimized(categories[category]);
      });

      return categories;
    }, Object.keys($shortcutStore.shortcuts).length);
  },
  'shortcuts_by_category_derived'
);

/**
 * Optimized shortcuts by workflow - only updates when shortcuts change
 */
export const optimizedShortcutsByWorkflow = createOptimizedDerived(
  originalShortcutStore,
  ($shortcutStore) => {
    return storeMemoizer.memoize('shortcuts_by_workflow', () => {
      const workflows = {
        core: [],
        'quick-actions': [],
        professional: [],
        system: []
      };

      Object.values($shortcutStore.shortcuts).forEach(shortcut => {
        const workflow = shortcut.workflow || 'system';
        if (workflows[workflow]) {
          workflows[workflow].push({
            ...shortcut,
            formattedKey: formatKeyForDisplayOptimized(typeof shortcut.key === 'string' ? shortcut.key : '')
          });
        }
      });

      // Sort each workflow by priority
      Object.keys(workflows).forEach(workflow => {
        workflows[workflow] = sortShortcutsByPriorityOptimized(workflows[workflow]);
      });

      return workflows;
    }, Object.keys($shortcutStore.shortcuts).length);
  },
  'shortcuts_by_workflow_derived'
);

/**
 * Optimized active context selector - minimal updates
 */
export const optimizedActiveContext = createSelectiveDerived(
  [displayStateStore, originalShortcutStore],
  ([$displayStateStore, $shortcutStore]) => {
    return storeMemoizer.memoize('active_context', () => {
      return determineActiveContextOptimized($displayStateStore);
    }, $displayStateStore.activeDisplayId, $displayStateStore.displays?.size);
  },
  (a, b) => a === b
);

// =============================================================================
// OPTIMIZED UTILITY FUNCTIONS
// =============================================================================

/**
 * Optimized active context determination with memoization
 * @param {Object} displayState - Current display state
 * @returns {string} Active context
 */
function determineActiveContextOptimized(displayState) {
  const activeElement = document.activeElement;

  // Check if we're in an input field - most common case first
  if (activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.contentEditable === 'true'
  )) {
    return 'input';
  }

  // Check if we have a focused display
  if (displayState.activeDisplayId) {
    return 'display-focused';
  }

  // Check if symbol palette is visible
  const $shortcutStore = get(originalShortcutStore);
  const currentPanels = $shortcutStore.panels;
  if (currentPanels && currentPanels.get('symbol-palette')?.isVisible) {
    return 'symbol-palette';
  }

  // Check if context menu is open
  const contextMenuState = $shortcutStore.contextMenu;
  if (contextMenuState && contextMenuState.open) {
    return 'context-menu';
  }

  return 'global';
}

/**
 * Optimized shortcut activity check
 * @param {Object} shortcut - Shortcut configuration
 * @param {string} currentContext - Current context
 * @returns {boolean} Whether shortcut is active
 */
function isShortcutActiveOptimized(shortcut, currentContext) {
  return shortcut.contexts.includes('global') ||
         shortcut.contexts.includes(currentContext);
}

/**
 * Optimized key formatting with memoization
 * @param {string} keyCombo - Key combination string
 * @returns {string} Formatted key combination
 */
function formatKeyForDisplayOptimized(keyCombo) {
  return storeMemoizer.memoize(`formatted_key_${keyCombo}`, () => {
    if (!keyCombo || typeof keyCombo !== 'string') {
      return '';
    }

    return keyCombo
      .split('+')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' + ');
  });
}

/**
 * Optimized priority sorting with memoization
 * @param {Array} shortcuts - Array of shortcuts
 * @returns {Array} Sorted shortcuts
 */
function sortShortcutsByPriorityOptimized(shortcuts) {
  return storeMemoizer.memoize(`sorted_priority_${shortcuts.length}`, () => {
    return [...shortcuts].sort((a, b) => (a.priority || 999) - (b.priority || 999));
  });
}

// =============================================================================
// OPTIMIZED SHORTCUT ACTIONS
// =============================================================================

/**
 * Optimized shortcut actions with batched updates
 */
export const optimizedShortcutActions = {
  /**
   * Batch update multiple shortcuts
   * @param {Array} updates - Array of {id, config} updates
   * @returns {number} Number of shortcuts updated
   */
  batchUpdateShortcuts: (updates) => {
    const startTime = performance.now();
    let updatedCount = 0;

    subscriptionBatcher.batchUpdate('shortcut_updates', () => {
      updates.forEach(({ id, config }) => {
        try {
          // Original update logic would go here
          originalShortcutStore.update(state => ({
            ...state,
            shortcuts: {
              ...state.shortcuts,
              [id]: { ...state.shortcuts[id], ...config }
            }
          }));
          updatedCount++;
        } catch (error) {
          console.error(`Failed to update shortcut ${id}:`, error);
        }
      });
    });

    const batchTime = performance.now() - startTime;
    performanceMonitor.recordMetric('batch_shortcut_update_time', batchTime);

    return updatedCount;
  },

  /**
   * Optimized context switching with minimal updates
   * @param {string} context - New context
   */
  optimizedSetContext: (context) => {
    const $currentStore = get(originalShortcutStore);

    // Skip if context hasn't changed
    if ($currentStore.activeContext === context) {
      return;
    }

    subscriptionBatcher.batchUpdate('context_switch', () => {
      originalShortcutStore.update(state => ({
        ...state,
        activeContext: context
      }));
    });
  },

  /**
   * Optimized shortcut enable/disable with deduplication
   * @param {boolean} enabled - Whether shortcuts should be enabled
   */
  optimizedSetEnabled: (enabled) => {
    const $currentStore = get(originalShortcutStore);

    // Skip if state hasn't changed
    if ($currentStore.isEnabled === enabled) {
      return;
    }

    subscriptionBatcher.batchUpdate('shortcut_enable', () => {
      originalShortcutStore.update(state => ({
        ...state,
        isEnabled: enabled
      }));
    });
  },

  /**
   * Get active shortcuts with performance optimization
   * @param {string} context - Optional context filter
   * @returns {Array} Active shortcuts
   */
  getActiveShortcutsOptimized: (context = null) => {
    const $shortcutStore = get(originalShortcutStore);
    const $displayStateStore = get(displayStateStore);

    const activeContext = context || determineActiveContextOptimized($displayStateStore);

    return Object.values($shortcutStore.shortcuts)
      .filter(shortcut => isShortcutActiveOptimized(shortcut, activeContext))
      .map(shortcut => ({
        ...shortcut,
        formattedKey: formatKeyForDisplayOptimized(typeof shortcut.key === 'string' ? shortcut.key : '')
      }));
  }
};

// =============================================================================
// OPTIMIZED SUBSCRIPTION HELPERS
// =============================================================================

/**
 * Subscribe to active shortcuts with optimization
 * @param {Function} callback - Callback function
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveShortcutsOptimized(callback, options = {}) {
  return optimizedSubscribe(optimizedActiveShortcuts, callback, {
    deduplicate: true,
    batchUpdates: true,
    measurePerformance: true,
    subscriberId: options.subscriberId || 'active_shortcuts_subscriber'
  });
}

/**
 * Subscribe to shortcuts by category with optimization
 * @param {Function} callback - Callback function
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToShortcutsByCategoryOptimized(callback, options = {}) {
  return optimizedSubscribe(optimizedShortcutsByCategory, callback, {
    deduplicate: true,
    batchUpdates: true,
    measurePerformance: true,
    subscriberId: options.subscriberId || 'shortcuts_by_category_subscriber'
  });
}

/**
 * Subscribe to active context with optimization
 * @param {Function} callback - Callback function
 * @param {Object} options - Subscription options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveContextOptimized(callback, options = {}) {
  return optimizedSubscribe(optimizedActiveContext, callback, {
    deduplicate: true,
    batchUpdates: false, // Context changes should be immediate
    measurePerformance: true,
    subscriberId: options.subscriberId || 'active_context_subscriber'
  });
}

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

/**
 * Get optimized shortcut store performance metrics
 * @returns {Object} Performance metrics
 */
export function getOptimizedShortcutStoreMetrics() {
  return {
    derivedStores: {
      activeShortcutsRecomputations: storeMemoizer.cache.has('active_shortcuts'),
      shortcutsByCategoryRecomputations: storeMemoizer.cache.has('shortcuts_by_category'),
      shortcutsByWorkflowRecomputations: storeMemoizer.cache.has('shortcuts_by_workflow'),
      activeContextRecomputations: storeMemoizer.cache.has('active_context')
    },
    memoization: {
      cacheSize: storeMemoizer.cache.size,
      formattedKeysCached: Array.from(storeMemoizer.cache.keys())
        .filter(key => key.startsWith('formatted_key_')).length
    },
    subscriptionBatching: {
      pendingBatches: subscriptionBatcher.pendingUpdates.size,
      activeSubscribers: subscriptionBatcher.subscribers.size
    }
  };
}

// =============================================================================
// INITIALIZATION AND CLEANUP
// =============================================================================

/**
 * Initialize optimized shortcut store
 * @returns {Function} Cleanup function
 */
export function initializeOptimizedShortcutStore() {
  console.log('[OPTIMIZED_SHORTCUT_STORE] Initializing optimized shortcut store');

  // Setup optimized context management
  const unsubscribeDisplayState = displayStateStore.subscribe($displayStateStore => {
    const newContext = determineActiveContextOptimized($displayStateStore);
    optimizedShortcutActions.optimizedSetContext(newContext);
  });

  // Setup keyboard event optimization
  const unsubscribeKeyboardEvents = keyboardEventStore.subscribe((eventData) => {
    if (eventData && eventData.type === 'shortcutExecuted') {
      performanceMonitor.recordMetric('shortcut_execution', eventData.executionTime);
    }
  });

  // Return cleanup function
  return () => {
    console.log('[OPTIMIZED_SHORTCUT_STORE] Cleaning up optimized shortcut store');
    unsubscribeDisplayState();
    unsubscribeKeyboardEvents();
    storeMemoizer.clear();
  };
}

export default {
  // Optimized derived stores
  optimizedActiveShortcuts,
  optimizedShortcutsByCategory,
  optimizedShortcutsByWorkflow,
  optimizedActiveContext,

  // Optimized actions
  optimizedShortcutActions,

  // Utilities
  subscribeToActiveShortcutsOptimized,
  subscribeToShortcutsByCategoryOptimized,
  subscribeToActiveContextOptimized,

  // Monitoring
  getOptimizedShortcutStoreMetrics,

  // Initialization
  initializeOptimizedShortcutStore
};