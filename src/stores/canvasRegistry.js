import { writable, derived } from 'svelte/store';
import { workspaceState } from './workspaceState.js';

/**
 * Canvas registry store
 * Tracks canvas metadata, provides unique IDs, and manages canvas lifecycle
 */

// Initial registry state
const initialRegistryState = {
  canvasCounter: 0,
  canvasMetadata: new Map(), // canvasId -> metadata
  symbolCanvases: new Map(), // symbol -> Set of canvasIds
  activeCanvases: new Set(), // Set of active canvasIds
  canvasTypes: new Map(), // canvasId -> type ('floating', 'grid', etc.)
  canvasZIndex: new Map() // canvasId -> z-index for layering
};

export const canvasRegistry = writable(initialRegistryState);

// Derived stores
export const totalCanvasesCreated = derived(
  canvasRegistry,
  $registry => $registry.canvasCounter
);

export const activeCanvasesCount = derived(
  canvasRegistry,
  $registry => $registry.activeCanvases.size
);

export const canvasesBySymbol = derived(
  canvasRegistry,
  $registry => {
    const result = {};
    $registry.symbolCanvases.forEach((canvasIds, symbol) => {
      result[symbol] = Array.from(canvasIds);
    });
    return result;
  }
);

// Registry actions
export const registryActions = {
  /**
   * Generate a unique canvas ID
   */
  generateCanvasId(prefix = 'canvas') {
    let newId;
    let counter;
    
    canvasRegistry.update(state => {
      counter = state.canvasCounter + 1;
      newId = `${prefix}-${counter}-${Date.now().toString(36)}`;
      
      return {
        ...state,
        canvasCounter: counter
      };
    });
    
    return newId;
  },

  /**
   * Register a new canvas
   */
  registerCanvas(canvasId, metadata = {}) {
    canvasRegistry.update(state => {
      const newMetadata = new Map(state.canvasMetadata);
      const newSymbolCanvases = new Map(state.symbolCanvases);
      const newActiveCanvases = new Set(state.activeCanvases);
      const newCanvasTypes = new Map(state.canvasTypes);
      const newCanvasZIndex = new Map(state.canvasZIndex);

      // Store canvas metadata
      newMetadata.set(canvasId, {
        ...metadata,
        registeredAt: Date.now(),
        lastActive: Date.now()
      });

      // Track by symbol
      if (metadata.symbol) {
        if (!newSymbolCanvases.has(metadata.symbol)) {
          newSymbolCanvases.set(metadata.symbol, new Set());
        }
        newSymbolCanvases.get(metadata.symbol).add(canvasId);
      }

      // Add to active canvases
      newActiveCanvases.add(canvasId);

      // Set canvas type
      newCanvasTypes.set(canvasId, metadata.type || 'floating');

      // Set initial z-index (higher for newer canvases)
      const maxZIndex = Math.max(0, ...Array.from(newCanvasZIndex.values()));
      newCanvasZIndex.set(canvasId, maxZIndex + 1);

      return {
        ...state,
        canvasMetadata: newMetadata,
        symbolCanvases: newSymbolCanvases,
        activeCanvases: newActiveCanvases,
        canvasTypes: newCanvasTypes,
        canvasZIndex: newCanvasZIndex
      };
    });
  },

  /**
   * Unregister a canvas
   */
  unregisterCanvas(canvasId) {
    canvasRegistry.update(state => {
      const newMetadata = new Map(state.canvasMetadata);
      const newSymbolCanvases = new Map(state.symbolCanvases);
      const newActiveCanvases = new Set(state.activeCanvases);
      const newCanvasTypes = new Map(state.canvasTypes);
      const newCanvasZIndex = new Map(state.canvasZIndex);

      const metadata = newMetadata.get(canvasId);
      
      // Remove from symbol tracking
      if (metadata?.symbol) {
        const symbolCanvasSet = newSymbolCanvases.get(metadata.symbol);
        if (symbolCanvasSet) {
          symbolCanvasSet.delete(canvasId);
          if (symbolCanvasSet.size === 0) {
            newSymbolCanvases.delete(metadata.symbol);
          }
        }
      }

      // Remove from all tracking
      newMetadata.delete(canvasId);
      newActiveCanvases.delete(canvasId);
      newCanvasTypes.delete(canvasId);
      newCanvasZIndex.delete(canvasId);

      return {
        ...state,
        canvasMetadata: newMetadata,
        symbolCanvases: newSymbolCanvases,
        activeCanvases: newActiveCanvases,
        canvasTypes: newCanvasTypes,
        canvasZIndex: newCanvasZIndex
      };
    });
  },

  /**
   * Update canvas metadata
   */
  updateCanvasMetadata(canvasId, updates) {
    canvasRegistry.update(state => {
      const newMetadata = new Map(state.canvasMetadata);
      const existing = newMetadata.get(canvasId);
      
      if (existing) {
        newMetadata.set(canvasId, {
          ...existing,
          ...updates,
          lastActive: Date.now()
        });
      }
      
      return {
        ...state,
        canvasMetadata: newMetadata
      };
    });
  },

  /**
   * Mark canvas as active (update lastActive timestamp)
   */
  markCanvasActive(canvasId) {
    canvasRegistry.update(state => {
      const newMetadata = new Map(state.canvasMetadata);
      const newActiveCanvases = new Set(state.activeCanvases);
      const newCanvasZIndex = new Map(state.canvasZIndex);

      // Update last active time
      const metadata = newMetadata.get(canvasId);
      if (metadata) {
        newMetadata.set(canvasId, {
          ...metadata,
          lastActive: Date.now()
        });
      }

      // Add to active set
      newActiveCanvases.add(canvasId);

      // Bring to front (highest z-index)
      const maxZIndex = Math.max(0, ...Array.from(newCanvasZIndex.values()));
      newCanvasZIndex.set(canvasId, maxZIndex + 1);

      return {
        ...state,
        canvasMetadata: newMetadata,
        activeCanvases: newActiveCanvases,
        canvasZIndex: newCanvasZIndex
      };
    });
  },

  /**
   * Deactivate a canvas
   */
  deactivateCanvas(canvasId) {
    canvasRegistry.update(state => ({
      ...state,
      activeCanvases: new Set([...state.activeCanvases].filter(id => id !== canvasId))
    }));
  },

  /**
   * Change canvas symbol
   */
  changeCanvasSymbol(canvasId, newSymbol) {
    canvasRegistry.update(state => {
      const newMetadata = new Map(state.canvasMetadata);
      const newSymbolCanvases = new Map(state.symbolCanvases);
      
      const metadata = newMetadata.get(canvasId);
      if (!metadata) return state;

      // Remove from old symbol tracking
      if (metadata.symbol) {
        const oldSymbolSet = newSymbolCanvases.get(metadata.symbol);
        if (oldSymbolSet) {
          oldSymbolSet.delete(canvasId);
          if (oldSymbolSet.size === 0) {
            newSymbolCanvases.delete(metadata.symbol);
          }
        }
      }

      // Add to new symbol tracking
      if (newSymbol) {
        if (!newSymbolCanvases.has(newSymbol)) {
          newSymbolCanvases.set(newSymbol, new Set());
        }
        newSymbolCanvases.get(newSymbol).add(canvasId);
      }

      // Update metadata
      newMetadata.set(canvasId, {
        ...metadata,
        symbol: newSymbol,
        lastActive: Date.now()
      });

      return {
        ...state,
        canvasMetadata: newMetadata,
        symbolCanvases: newSymbolCanvases
      };
    });
  },

  /**
   * Get canvas z-index
   */
  getCanvasZIndex(canvasId) {
    let zIndex = 0;
    canvasRegistry.subscribe(state => {
      zIndex = state.canvasZIndex.get(canvasId) || 0;
    })();
    return zIndex;
  },

  /**
   * Bring canvas to front
   */
  bringCanvasToFront(canvasId) {
    canvasRegistry.update(state => {
      const newCanvasZIndex = new Map(state.canvasZIndex);
      const maxZIndex = Math.max(0, ...Array.from(newCanvasZIndex.values()));
      newCanvasZIndex.set(canvasId, maxZIndex + 1);
      
      return {
        ...state,
        canvasZIndex: newCanvasZIndex
      };
    });
  },

  /**
   * Send canvas to back
   */
  sendCanvasToBack(canvasId) {
    canvasRegistry.update(state => {
      const newCanvasZIndex = new Map(state.canvasZIndex);
      newCanvasZIndex.set(canvasId, 1);
      
      return {
        ...state,
        canvasZIndex: newCanvasZIndex
      };
    });
  },

  /**
   * Clear all registry data
   */
  clearRegistry() {
    canvasRegistry.set(initialRegistryState);
  }
};

// Utility functions
export function getCanvasMetadata(canvasId) {
  let metadata = null;
  canvasRegistry.subscribe(state => {
    metadata = state.canvasMetadata.get(canvasId);
  })();
  return metadata;
}

export function getCanvasesBySymbol(symbol) {
  let canvasIds = [];
  canvasRegistry.subscribe(state => {
    const canvasSet = state.symbolCanvases.get(symbol);
    if (canvasSet) {
      canvasIds = Array.from(canvasSet);
    }
  })();
  return canvasIds;
}

export function isCanvasActive(canvasId) {
  let isActive = false;
  canvasRegistry.subscribe(state => {
    isActive = state.activeCanvases.has(canvasId);
  })();
  return isActive;
}

export function getCanvasType(canvasId) {
  let type = 'floating';
  canvasRegistry.subscribe(state => {
    type = state.canvasTypes.get(canvasId) || 'floating';
  })();
  return type;
}

// getCanvasZIndex is already exported from registryActions above
