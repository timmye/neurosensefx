import { writable } from 'svelte/store';

const initialState = {
  displays: new Map(),
  nextZIndex: 1,
  config: {
    defaultSize: { width: 220, height: 350 },
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

// Helper to update display properties
const updateDisplay = (id, updates, extra = {}) => {
  workspaceStore.update(state => {
    const display = state.displays.get(id);
    if (!display) return state;

    const newDisplays = new Map(state.displays);
    newDisplays.set(id, { ...display, ...updates });

    return { ...state, displays: newDisplays, ...extra };
  });
};

const actions = {
  addDisplay: (symbol, position = null, source = 'ctrader') => {
    workspaceStore.update(state => {
      const id = `display-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const display = {
        id, symbol, source, created: Date.now(),
        position: position || state.config.defaultPosition,
        size: { ...state.config.defaultSize },
        zIndex: state.nextZIndex,
        showMarketProfile: true,
        showHeader: false,
        priceMarkers: []
      };

      return {
        ...state,
        displays: new Map(state.displays).set(id, display),
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

  updatePosition: (id, position) => updateDisplay(id, { position }),
  updateSize: (id, size) => updateDisplay(id, { size }),

  bringToFront: (id) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      return display ? {
        ...state,
        displays: new Map(state.displays).set(id, { ...display, zIndex: state.nextZIndex }),
        nextZIndex: state.nextZIndex + 1
      } : state;
    });
  },

  toggleMarketProfile: (id) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      return display ? {
        ...state,
        displays: new Map(state.displays).set(id, {
          ...display,
          showMarketProfile: !display.showMarketProfile
        })
      } : state;
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
          priceMarkers: [...d.priceMarkers, marker]
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

  setDisplayPriceMarkers: (displayId, markers) => updateDisplay(displayId, { priceMarkers: markers }),

  getDisplay: (displayId) => workspaceStore.getState().displays.get(displayId),

  importWorkspace: async (file) => {
    try {
      const text = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const data = JSON.parse(text);

      // Restore price markers to localStorage
      if (data.priceMarkers) {
        for (const [key, value] of Object.entries(data.priceMarkers)) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }

      // Update workspace state
      workspaceStore.update(state => ({
        ...state,
        displays: new Map(data.workspace.displays || []),
        nextZIndex: data.workspace.nextZIndex || 1
      }));

      console.log('✅ Workspace imported successfully');
    } catch (error) {
      console.error('❌ Failed to import workspace:', error);
    }
  },

  exportWorkspace: () => {
    try {
      const state = workspaceStore.getState();
      const priceMarkers = {};

      // Collect all price-markers from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('price-markers-')) {
          priceMarkers[key] = JSON.parse(localStorage.getItem(key));
        }
      }

      const exportData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        workspace: {
          displays: Array.from(state.displays.entries()),
          nextZIndex: state.nextZIndex
        },
        priceMarkers
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      console.log('✅ Workspace exported successfully');
    } catch (error) {
      console.error('❌ Failed to export workspace:', error);
    }
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

  initPersistence: () => {
    if (typeof localStorage === 'undefined') {
      return () => {};
    }
    return workspaceStore.subscribe(state => {
      const data = {
        displays: Array.from(state.displays.entries()),
        nextZIndex: state.nextZIndex
      };
      try {
        localStorage.setItem('workspace-state', JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to save workspace to storage:', error);
      }
    });
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