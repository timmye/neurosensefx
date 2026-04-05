// Workspace persistence dual-targets localStorage and server API when authenticated (ref: DL-007).
// Server is the source of truth; localStorage is fallback if server load fails.
import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { authStore } from './authStore.js';
import { drawingStore } from '../lib/chart/drawingStore.js';

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

const initialState = {
  displays: new Map(),
  nextZIndex: 1,
  selectedDisplayId: null,
  chartGhost: null,
  config: {
    defaultSize: { width: 2000, height: 680 },
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
  setSelectedDisplay: (id) => {
    workspaceStore.update(state => ({ ...state, selectedDisplayId: id }));
  },

  clearSelectedDisplay: () => {
    workspaceStore.update(state => ({ ...state, selectedDisplayId: null }));
  },

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

  addPriceTicker: (symbol, position = null, source = 'ctrader') => {
    workspaceStore.update(state => {
      const id = `ticker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ticker = {
        id, symbol, source, created: Date.now(), type: 'priceTicker',
        position: position || state.config.defaultPosition,
        size: { width: 240, height: 80 },
        zIndex: state.nextZIndex
      };

      return {
        ...state,
        displays: new Map(state.displays).set(id, ticker),
        nextZIndex: state.nextZIndex + 1
      };
    });
  },

  removeDisplay: (id) => {
    workspaceStore.update(state => {
      const display = state.displays.get(id);
      const newDisplays = new Map(state.displays);

      // Save chart position/size/resolution/window for restore on reopen
      if (display?.type === 'chart') {
        newDisplays.delete(id);
        return {
          ...state,
          displays: newDisplays,
          chartGhost: {
            position: display.position,
            size: display.size,
            resolution: display.resolution,
            window: display.window
          }
        };
      }

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
      const displays = Array.from(data.workspace.displays || []);
      const batchSize = 5;
      const batchDelay = 200; // ms

      // Clear existing displays first
      workspaceStore.update(state => ({
        ...state,
        displays: new Map(),
        nextZIndex: data.workspace.nextZIndex || 1
      }));

      // IMPORTANT: Restore price markers to localStorage BEFORE adding displays
      // This ensures PriceMarkerManager.onMount() can load them when displays mount
      if (data.priceMarkers) {
        for (const [key, value] of Object.entries(data.priceMarkers)) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }

      // Also restore price markers from display objects to localStorage
      // This ensures markers embedded in displays are properly persisted
      for (const [id, display] of displays) {
        if (display.priceMarkers && display.priceMarkers.length > 0) {
          const symbolKey = `price-markers-${display.symbol}`;
          localStorage.setItem(symbolKey, JSON.stringify(display.priceMarkers));
        }
      }

      // Restore drawings from export data (v1.1.0+)
      try {
        const version = data.version || '1.0.0';
        if (compareSemver(version, '1.1.0') >= 0 && data.drawings) {
          for (const [key, drawings] of Object.entries(data.drawings)) {
            const [symbol, resolution] = key.split('|');
            if (!symbol || !resolution) continue;

            try {
              // Snapshot existing drawings for rollback on save failure
              const snapshot = await drawingStore.load(symbol, resolution);

              await drawingStore.clearAll(symbol, resolution);

              for (const drawing of drawings) {
                try {
                  // Omit id/createdAt/updatedAt so Dexie auto-generates fresh values
                  const { id, createdAt, updatedAt, ...rest } = drawing;
                  await drawingStore.save(symbol, resolution, rest);
                } catch (saveErr) {
                  console.error(`Failed to save drawing for ${symbol}/${resolution}:`, saveErr);
                  // Abort remaining saves for this pair, attempt rollback
                  try {
                    for (const s of snapshot) {
                      // Preserve original ids during rollback for exact state restoration
                      await drawingStore.save(symbol, resolution, s);
                    }
                  } catch (rollbackErr) {
                    console.error(`Rollback failed for ${symbol}/${resolution}:`, rollbackErr);
                  }
                  break;
                }
              }
            } catch (clearErr) {
              console.error(`Failed to clear drawings for ${symbol}/${resolution}:`, clearErr);
              continue;
            }
          }
        }
      } catch (drawingErr) {
        // Drawing restore failures do not block display restoration
        console.error('Drawing restoration error (non-fatal):', drawingErr);
      }

      // Add displays in batches to avoid rate limiting
      for (let i = 0; i < displays.length; i += batchSize) {
        const batch = displays.slice(i, i + batchSize);

        workspaceStore.update(state => {
          const newDisplays = new Map(state.displays);
          for (const [id, display] of batch) {
            newDisplays.set(id, display);
          }
          return { ...state, displays: newDisplays };
        });

        // Wait before next batch (but not after the last batch)
        if (i + batchSize < displays.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      console.log(`✅ Workspace imported successfully (${displays.length} displays)`);
    } catch (error) {
      console.error('❌ Failed to import workspace:', error);
    }
  },

  exportWorkspace: async () => {
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

      // Collect drawings from IndexedDB for each chart display
      const drawings = {};
      for (const display of state.displays.values()) {
        if (display.symbol && display.resolution) {
          try {
            const displayDrawings = await drawingStore.load(display.symbol, display.resolution);
            if (displayDrawings.length > 0) {
              drawings[`${display.symbol}|${display.resolution}`] = displayDrawings;
            }
          } catch (err) {
            // Partial export is better than total failure
            console.warn(`Failed to load drawings for ${display.symbol}/${display.resolution}:`, err);
          }
        }
      }

      const exportData = {
        version: '1.1.0',
        timestamp: new Date().toISOString(),
        workspace: {
          displays: Array.from(state.displays.entries()),
          nextZIndex: state.nextZIndex
        },
        priceMarkers,
        drawings
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      console.log('Workspace exported successfully');
    } catch (error) {
      console.error('Failed to export workspace:', error);
      throw error;
    }
  },

  addChartDisplay: (symbol, position = null, source = 'ctrader') => {
    workspaceStore.update(state => {
      const id = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const ghost = state.chartGhost;
      const chart = {
        id,
        type: 'chart',
        symbol,
        source,
        created: Date.now(),
        position: position || ghost?.position || { x: 100, y: 100 },
        size: ghost?.size || { ...state.config.defaultSize },
        zIndex: state.nextZIndex,
        resolution: ghost?.resolution || '4h',
        window: ghost?.window || '3M',
        isMinimized: false,
        showHeader: true
      };

      return {
        ...state,
        displays: new Map(state.displays).set(id, chart),
        nextZIndex: state.nextZIndex + 1,
        chartGhost: null
      };
    });
  },

  updateChartDisplay: (id, updates) => updateDisplay(id, updates),

  getChartDisplay: () => {
    const state = workspaceStore.getState();
    for (const display of state.displays.values()) {
      if (display.type === 'chart') {
        return display;
      }
    }
    return null;
  },

};

const persistence = {
  loadFromStorage: async () => {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }
      // When authenticated, try server first. Fall back to localStorage on failure (ref: DL-007).
      if (get(authStore).isAuthenticated) {
        try {
          const resp = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace', { credentials: 'include' });
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.layout) {
              const layout = typeof data.layout === 'string' ? JSON.parse(data.layout) : data.layout;
              workspaceStore.update(state => ({
                ...state,
                displays: new Map(layout.displays || []),
                nextZIndex: layout.nextZIndex || 1,
                chartGhost: layout.chartGhost || null
              }));
              // Cache server data in localStorage for offline fallback
              localStorage.setItem('workspace-state', JSON.stringify(layout));
              return;
            }
          }
        } catch (err) {
          console.warn('[Workspace] Server load failed, falling back to localStorage:', err);
        }
      }
      loadFromLocalStorage();
    } catch (error) {
      console.warn('Failed to load workspace from storage:', error);
    }
  },

  initPersistence: () => {
    if (typeof localStorage === 'undefined') {
      return () => {};
    }
    let debounceTimer = null;
    return workspaceStore.subscribe(state => {
      const data = {
        displays: Array.from(state.displays.entries()),
        nextZIndex: state.nextZIndex,
        chartGhost: state.chartGhost || null
      };
      try {
        localStorage.setItem('workspace-state', JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to save workspace to storage:', error);
      }
      // Debounced server sync: 2-second delay to batch rapid workspace changes (ref: DL-007).
      if (get(authStore).isAuthenticated) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
          }).catch(err => console.warn('Failed to sync workspace to server:', err));
        }, 2000);
      }
    });
  }
};

/** Load workspace state from localStorage only. Used as fallback when server is unavailable. */
function loadFromLocalStorage() {
  try {
      const stored = localStorage.getItem('workspace-state');
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored);
      workspaceStore.update(state => ({
        ...state,
        displays: new Map(data.displays || []),
        nextZIndex: data.nextZIndex || 1,
        chartGhost: data.chartGhost || null
      }));
  } catch (error) {
    console.warn('Failed to load workspace from localStorage:', error);
  }
}

export const workspaceActions = actions;
export const workspacePersistence = persistence;

// Expose to window for testing purposes
if (typeof window !== 'undefined') {
  window.workspaceStore = workspaceStore;
  window.workspaceActions = actions;
  window.workspacePersistence = persistence;
}