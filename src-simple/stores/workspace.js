import { writable } from 'svelte/store';

const initialState = {
  displays: new Map(),
  nextZIndex: 1,
  config: {
    defaultSize: { width: 220, height: 120 },
    defaultPosition: { x: 100, y: 100 }
  }
};

export const workspaceStore = writable(initialState);

// Add getState method for non-reactive access (needed by priceMarkerInteraction)
workspaceStore.getState = () => {
  let currentValue;
  const unsubscribe = workspaceStore.subscribe(value => {
    currentValue = value;
  });
  unsubscribe();
  return currentValue;
};

const actions = {
  addDisplay: (symbol, position = null) => {
    workspaceStore.update(state => {
      const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const display = {
        id,
        symbol,
        position: position || state.config.defaultPosition,
        size: { ...state.config.defaultSize },
        zIndex: state.nextZIndex,
        showMarketProfile: false, // Simple boolean - market profile off by default
        priceMarkers: [], // Array of price markers for this display
        created: Date.now()
      };

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, display);

      return {
        ...state,
        displays: newDisplays,
        nextZIndex: state.nextZIndex + 1
      };
    });
  },

  removeDisplay: (id) => {
    workspaceStore.update(state => {
      const newDisplays = new Map(state.displays);
      newDisplays.delete(id);
      return { ...state, displays: newDisplays };
    });
  },

  updatePosition: (id, position) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      if (!display) return state;

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, { ...display, position });

      return { ...state, displays: newDisplays };
    });
  },

  updateSize: (id, size) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      if (!display) return state;

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, { ...display, size });

      return { ...state, displays: newDisplays };
    });
  },

  bringToFront: (id) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      if (!display) return state;

      const newDisplays = new Map(state.displays);
      newDisplays.set(id, { ...display, zIndex: state.nextZIndex });

      return {
        ...state,
        displays: newDisplays,
        nextZIndex: state.nextZIndex + 1
      };
    });
  },

  toggleMarketProfile: (id) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      if (!display) return state;

      // Simple boolean toggle
      const newDisplays = new Map(state.displays);
      newDisplays.set(id, { ...display, showMarketProfile: !display.showMarketProfile });

      return { ...state, displays: newDisplays };
    });
  },

  // Price marker actions
  addPriceMarker: (displayId, marker) => {
    workspaceStore.update(state => {
      const d = state.displays.get(displayId);
      return d ? {
        ...state,
        displays: new Map(state.displays).set(displayId, {
          ...d,
          priceMarkers: [...d.priceMarkers, { ...marker, id: Date.now().toString() }]
        })
      } : state;
    });
  },

  removePriceMarker: (displayId, markerId) => {
    workspaceStore.update(state => {
      const d = state.displays.get(displayId);
      return d ? {
        ...state,
        displays: new Map(state.displays).set(displayId, {
          ...d,
          priceMarkers: d.priceMarkers.filter(m => m.id !== markerId)
        })
      } : state;
    });
  },

  updatePriceMarker: (displayId, markerId, updates) => {
    workspaceStore.update(state => {
      const d = state.displays.get(displayId);
      return d ? {
        ...state,
        displays: new Map(state.displays).set(displayId, {
          ...d,
          priceMarkers: d.priceMarkers.map(m => m.id === markerId ? { ...m, ...updates } : m)
        })
      } : state;
    });
  },

  selectPriceMarker: (displayId, markerId) => {
    workspaceStore.update(state => {
      const d = state.displays.get(displayId);
      return d ? {
        ...state,
        displays: new Map(state.displays).set(displayId, {
          ...d,
          priceMarkers: d.priceMarkers.map(m => ({ ...m, selected: m.id === markerId }))
        })
      } : state;
    });
  },

  clearPriceMarkerSelection: () => {
    workspaceStore.update(state => {
      const newDisplays = new Map();
      for (const [id, display] of state.displays) {
        newDisplays.set(id, {
          ...display,
          priceMarkers: display.priceMarkers.map(m => ({ ...m, selected: false }))
        });
      }
      return { ...state, displays: newDisplays };
    });
  },

  setDisplayPriceMarkers: (displayId, markers) => {
    workspaceStore.update(state => {
      const display = state.displays.get(displayId);
      if (!display) return state;

      const newDisplays = new Map(state.displays);
      newDisplays.set(displayId, { ...display, priceMarkers: markers });

      return { ...state, displays: newDisplays };
    });
  },

  getDisplay: (displayId) => {
    return workspaceStore.getState().displays.get(displayId);
  }
};

const persistence = {
  loadFromStorage: () => {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      const stored = localStorage.getItem('workspace-state');
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored);
      workspaceStore.update(state => ({
        ...state,
        displays: new Map(data.displays || []),
        nextZIndex: data.nextZIndex || 1
      }));
    } catch (error) {
      console.warn('Failed to load workspace from storage:', error);
    }
  },

  saveToStorage: () => {
    try {
      workspaceStore.subscribe(state => {
        const data = {
          displays: Array.from(state.displays.entries()),
          nextZIndex: state.nextZIndex
        };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('workspace-state', JSON.stringify(data));
        }
      });
    } catch (error) {
      console.warn('Failed to save workspace to storage:', error);
    }
  }
};

export const workspaceActions = actions;
export const workspacePersistence = persistence;

// Expose to window for testing purposes
if (typeof window !== 'undefined') {
  window.workspaceStore = workspaceStore;
  window.workspaceActions = actions;
  window.workspacePersistence = persistence;
}