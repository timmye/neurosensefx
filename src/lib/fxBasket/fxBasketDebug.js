// FX Basket Debug API - Crystal Clarity Compliant (<50 lines)
// Exposes internal state for testing and debugging

/**
 * Create debug API object with getters for state access
 * @param {Function} getState - Function returning current state object
 * @returns {Object} Debug API with properties and methods
 */
export function createDebugAPI(getState) {
  return {
    // State access (reactive getters)
    get basketState() {
      try { return getState().basketState; } catch { return null; }
    },
    get fxPairs() {
      try { return getState().fxPairs; } catch { return []; }
    },
    get connectionStatus() {
      try { return getState().connectionStatus; } catch { return 'unknown'; }
    },
    get subscriptionsReady() {
      try { return getState().subscriptionsReady; } catch { return false; }
    },
    get lastTickTimes() {
      try { return new Map(getState().lastTickTimes); } catch { return new Map(); }
    },
    get tickCount() {
      try { return getState().tickCount; } catch { return 0; }
    },
    get dataPackageCount() {
      try { return getState().dataPackageCount; } catch { return 0; }
    },
    get prices() {
      try { return new Map(getState().basketState?.prices || []); } catch { return new Map(); }
    },
    get baskets() {
      try {
        // Return the actual baskets object (reactive), not a snapshot
        const state = getState();
        return state?.basketState?.baskets || {};
      } catch { return {}; }
    },

    // Convenience methods (need to call getState fresh each time)
    getLastTickTime: (pair) => {
      try { return getState().lastTickTimes?.get(pair); } catch { return undefined; }
    },
    getPairPrice: (pair) => {
      try { return getState().basketState?.prices?.get(pair); } catch { return undefined; }
    },
    getBasketValue: (currency) => {
      try { return getState().basketState?.baskets[currency]?.normalized; } catch { return undefined; }
    },

    // Summary method
    getSubscriptionInfo: () => {
      try {
        const state = getState();
        return {
          totalPairs: state.fxPairs?.length || 0,
          subscribedPairs: state.fxPairs || [],
          tickCount: state.tickCount || 0,
          dataPackageCount: state.dataPackageCount || 0,
          lastUpdate: state.basketState?.lastUpdate
        };
      } catch {
        return { totalPairs: 0, subscribedPairs: [], tickCount: 0, dataPackageCount: 0 };
      }
    }
  };
}

/**
 * Expose debug API to window object
 * @param {Object} debugAPI - Debug API object
 * @param {Window} window - Browser window object
 * @returns {Function} Cleanup function to remove debug API
 */
export function exposeDebugAPI(debugAPI, window) {
  if (window) {
    window.fxBasketDebug = debugAPI;
  }
  return () => {
    try {
      if (window && window.fxBasketDebug === debugAPI) {
        delete window.fxBasketDebug;
      }
    } catch {
      // Ignore cleanup errors
    }
  };
}
