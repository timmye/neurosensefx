// Workspace persistence, import/export, and headlines state.
// Dual-targets localStorage and server API when authenticated (ref: DL-007).
// Server is the source of truth; localStorage is fallback if server load fails.
//
// Display state and actions: displayStore.js
// Marker actions and persistence: markerActions.js
// This file: headlines state, workspace persistence, import/export.
import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { authStore } from './authStore.js';
import { drawingStore } from '../lib/chart/drawingStore.js';
import { displayStore, displayActions } from './displayStore.js';
import { markerActions, saveMarkers } from './markerActions.js';

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

// --- Headlines state (stays here) ---
export const headlinesStore = writable({
  headlinesVisible: false,
  headlinesPosition: { x: 20, y: 20 },
  headlinesSize: { width: 500, height: 600 }
});

// --- Marker actions imported from markerActions.js ---

// --- Headlines actions ---
const headlinesActions = {
  toggleHeadlines: () => {
    headlinesStore.update(state => ({
      ...state,
      headlinesVisible: !state.headlinesVisible
    }));
  },

  updateHeadlinesPosition: (position) => {
    headlinesStore.update(state => ({ ...state, headlinesPosition: position }));
  },

  updateHeadlinesSize: (size) => {
    headlinesStore.update(state => ({ ...state, headlinesSize: size }));
  },
};

// --- Combined actions ---
const actions = {
  // Display actions delegated to displayStore
  ...displayActions,
  // Marker actions
  ...markerActions,
  // Headlines actions
  ...headlinesActions,

  // Import/export (operates across stores)
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
      displayStore.update(state => ({
        ...state,
        displays: new Map(),
        nextZIndex: data.workspace.nextZIndex || 1
      }));

      // Restore price markers via markerActions persistence (routes through
      // proper persistence layer instead of raw localStorage manipulation).
      if (data.priceMarkers) {
        for (const [key, markers] of Object.entries(data.priceMarkers)) {
          const symbol = key.replace('price-markers-', '');
          saveMarkers(symbol, markers);
        }
      }

      // Also restore markers embedded in display objects
      for (const [id, display] of displays) {
        if (display.priceMarkers && display.priceMarkers.length > 0) {
          saveMarkers(display.symbol, display.priceMarkers);
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
                  if (!drawing.overlayId) continue; // Skip pre-migration drawings without overlayId
                  const { id, createdAt, updatedAt, ...rest } = drawing;
                  await drawingStore.save(symbol, resolution, rest);
                } catch (saveErr) {
                  console.warn(`Failed to save drawing for ${symbol}/${resolution}:`, saveErr);
                  // Abort remaining saves for this pair, attempt rollback
                  try {
                    for (const s of snapshot) {
                      // Preserve original ids during rollback for exact state restoration
                      await drawingStore.save(symbol, resolution, s);
                    }
                  } catch (rollbackErr) {
                    console.warn(`Rollback failed for ${symbol}/${resolution}:`, rollbackErr);
                  }
                  break;
                }
              }
            } catch (clearErr) {
              console.warn(`Failed to clear drawings for ${symbol}/${resolution}:`, clearErr);
              continue;
            }
          }
        }
      } catch (drawingErr) {
        // Drawing restore failures do not block display restoration
        console.warn('Drawing restoration error (non-fatal):', drawingErr);
      }

      // Add displays in batches to avoid rate limiting
      for (let i = 0; i < displays.length; i += batchSize) {
        const batch = displays.slice(i, i + batchSize);

        displayStore.update(state => {
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

      if (import.meta.env.DEV) console.log(`✅ Workspace imported successfully (${displays.length} displays)`);
    } catch (error) {
      console.error('❌ Failed to import workspace:', error);
    }
  },

  exportWorkspace: async () => {
    try {
      const state = displayStore.getState();
      const priceMarkers = {};

      // Collect all price-markers from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('price-markers-')) {
          let markers = null;
          try { const raw = localStorage.getItem(key); markers = raw ? JSON.parse(raw) : null; } catch { /* corrupt entry — treat as missing */ }
          if (markers) priceMarkers[key] = markers;
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

      const headlinesState = get(headlinesStore);

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

      if (import.meta.env.DEV) console.log('Workspace exported successfully');
    } catch (error) {
      console.error('Failed to export workspace:', error);
      throw error;
    }
  },
};

// Tracks last workspace data for beforeunload flush (module-scoped)
let _lastWorkspaceData = null;

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
              displayStore.update(state => ({
                ...state,
                displays: new Map(layout.displays || []),
                nextZIndex: layout.nextZIndex || 1,
                chartGhost: layout.chartGhost || null,
              }));
              headlinesStore.update(state => ({
                ...state,
                headlinesVisible: 'headlinesVisible' in layout ? layout.headlinesVisible : state.headlinesVisible,
                headlinesPosition: layout.headlinesPosition || state.headlinesPosition,
                headlinesSize: layout.headlinesSize || state.headlinesSize
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
    let lsTimer = null;

    const syncToStorage = () => {
      const displayState = displayStore.getState();
      const headlinesState = get(headlinesStore);
      const data = {
        displays: Array.from(displayState.displays.entries()),
        nextZIndex: displayState.nextZIndex,
        chartGhost: displayState.chartGhost || null,
        headlinesVisible: headlinesState.headlinesVisible,
        headlinesPosition: headlinesState.headlinesPosition,
        headlinesSize: headlinesState.headlinesSize
      };
      // Kept immediate: beforeunload beacon (flushPending) reads _lastWorkspaceData.
      _lastWorkspaceData = data;
      // Debounced localStorage write: batches rapid displayStore changes (e.g. drag frames).
      clearTimeout(lsTimer);
      lsTimer = setTimeout(() => {
        lsTimer = null;
        try {
          localStorage.setItem('workspace-state', JSON.stringify(_lastWorkspaceData));
        } catch (error) {
          console.warn('Failed to save workspace to storage:', error);
        }
      }, 300);
      // Debounced server sync: 2-second delay to batch rapid workspace changes (ref: DL-007).
      if (get(authStore).isAuthenticated) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
          }).catch(err => console.warn('Failed to sync workspace to server:', err));
        }, 2000);
      }
    };

    const unsub1 = displayStore.subscribe(syncToStorage);
    const unsub2 = headlinesStore.subscribe(syncToStorage);
    return () => { unsub1(); unsub2(); };
  },

  /**
   * Flush pending workspace server sync immediately.
   * Called on beforeunload to prevent workspace state loss when the tab closes.
   */
  flushPending: () => {
    if (_lastWorkspaceData && get(authStore).isAuthenticated) {
      const blob = new Blob([JSON.stringify(_lastWorkspaceData)], { type: 'application/json' });
      navigator.sendBeacon(
        (import.meta.env.VITE_API_BASE_URL || '') + '/api/workspace',
        blob
      );
    }
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
      displayStore.update(state => ({
        ...state,
        displays: new Map(data.displays || []),
        nextZIndex: data.nextZIndex || 1,
        chartGhost: data.chartGhost || null,
      }));
      headlinesStore.update(state => ({
        ...state,
        headlinesVisible: 'headlinesVisible' in data ? data.headlinesVisible : state.headlinesVisible,
        headlinesPosition: data.headlinesPosition || state.headlinesPosition,
        headlinesSize: data.headlinesSize || state.headlinesSize
      }));
  } catch (error) {
    console.warn('Failed to load workspace from localStorage:', error);
  }
}

export { persistence as workspacePersistence };
export const workspaceActions = actions;

// Flush pending workspace sync before tab closes to prevent state loss
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => persistence.flushPending());
}

// Expose to window for testing purposes
if (typeof window !== 'undefined') {
  // Non-reactive combined state access for E2E tests
  window.workspaceStore = {
    getState: () => ({
      ...displayStore.getState(),
      ...get(headlinesStore)
    })
  };
  window.displayStore = displayStore;
  window.workspaceActions = actions;
  window.workspacePersistence = persistence;
}
