import Dexie from 'dexie';
// Drawing persistence: IndexedDB (local cache) + server API when authenticated (ref: DL-007).
import { authStore } from '../../stores/authStore.js';
import { get } from 'svelte/store';

const db = new Dexie('NeuroSenseDrawings');
db.version(1).stores({
  drawings: '++id, [symbol+resolution], overlayType, createdAt',
});
db.version(2).stores({
  drawings: '++id, [symbol+resolution], symbol, overlayType, createdAt',
});

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const saveDebounceTimers = new Map();

// Synchronous snapshot of the last synced data per symbol/resolution.
// Updated on every save/update/remove so flushPending can read it without async IndexedDB.
const _lastSyncData = new Map();

export const drawingStore = {
  async save(symbol, resolution, drawing) {
    const stored = await db.drawings.add({
      ...drawing,
      symbol,
      resolution,
      schemaVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Trigger debounced server sync after local IndexedDB write (ref: DL-007)
    this._debouncedServerSync(symbol, resolution);
    return stored;
  },

  async load(symbol, resolution) {
    // When authenticated, merge server and local IndexedDB data by updatedAt
    // to preserve local changes that haven't synced yet (ref: DL-007).
    if (get(authStore).isAuthenticated) {
      try {
        const resp = await fetch(API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution), { credentials: 'include' });
        if (resp.ok) {
          const { data } = await resp.json();
          if (data && Array.isArray(data) && data.length > 0) {
            const local = await db.drawings.where({ symbol, resolution }).toArray();
            // Merge: keep the newest version of each drawing by updatedAt
            const merged = this._mergeByTimestamp(data, local);
            // Reconcile IndexedDB with merged result
            await db.drawings.where({ symbol, resolution }).delete();
            for (const d of merged) {
              await db.drawings.add({ ...d, symbol, resolution });
            }
            // Sync merged result back to server if local had newer data
            if (merged.length !== data.length) {
              this._debouncedServerSync(symbol, resolution);
            }
            return merged;
          }
        }
      } catch (err) {
        console.warn('[DrawingStore] Server load failed for ' + symbol + '/' + resolution + ':', err);
      }
    }
    return db.drawings.where({ symbol, resolution }).toArray();
  },

  async loadPinned(symbol) {
    return db.drawings.where('symbol').equals(symbol).and(d => d.pinned === true).toArray();
  },

  async update(id, changes) {
    await db.drawings.update(id, { ...changes, updatedAt: Date.now() });
    const drawing = await db.drawings.get(id);
    if (drawing) {
      // Sync updated drawing to server after local IndexedDB write
      this._debouncedServerSync(drawing.symbol, drawing.resolution);
    }
  },

  async remove(id) {
    const drawing = await db.drawings.get(id);
    await db.drawings.delete(id);
    if (drawing) {
      // Sync removal to server after local IndexedDB delete
      this._debouncedServerSync(drawing.symbol, drawing.resolution);
    }
  },

  async clearAll(symbol, resolution) {
    await db.drawings.where({ symbol, resolution }).delete();
    _lastSyncData.set(symbol + '/' + resolution, []);
    // Immediate sync for clearAll — user expects instant server state (ref: DL-007)
    if (get(authStore).isAuthenticated) {
      fetch(API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify([])
      }).catch(err => console.warn('[DrawingStore] Failed to clear drawings on server:', err));
    }
  },

  /**
   * Merge server and local drawing arrays. The server stores the entire
   * array as a single JSONB blob (no per-drawing IDs), so we match by
   * overlayId (client-generated UUID). For each drawing, keep the version
   * with the newest updatedAt. Drawings unique to either source are included.
   */
  _mergeByTimestamp(serverData, localData) {
    // Index local drawings by overlayId for O(1) lookup
    const localById = new Map();
    for (const d of localData) {
      if (d.overlayId) localById.set(d.overlayId, d);
    }
    const result = [...serverData];
    for (const local of localData) {
      if (!local.overlayId) { result.push(local); continue; }
      const serverIdx = result.findIndex(d => d.overlayId === local.overlayId);
      if (serverIdx === -1) {
        // Local-only drawing (not yet synced to server)
        result.push(local);
      } else {
        // Both exist — keep whichever is newer
        const server = result[serverIdx];
        if (local.updatedAt > (server.updatedAt || 0)) {
          result[serverIdx] = local;
        }
      }
    }
    return result;
  },

  /**
   * Debounced server sync: 500ms delay batches rapid drawing operations.
   * Reads the full set of drawings for the symbol/resolution from IndexedDB
   * and uploads as a complete unit (ref: DL-003).
   */
  _debouncedServerSync(symbol, resolution) {
    if (!get(authStore).isAuthenticated) return;
    const key = symbol + '/' + resolution;
    const existing = saveDebounceTimers.get(key);
    if (existing) clearTimeout(existing);
    saveDebounceTimers.set(key, setTimeout(async () => {
      saveDebounceTimers.delete(key);
      try {
        const all = await db.drawings.where({ symbol, resolution }).toArray();
        _lastSyncData.set(key, all);
        await fetch(API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(all)
        });
      } catch (err) {
        console.warn('[DrawingStore] Server sync failed for ' + key + ':', err);
      }
    }, 500));
  },

  /**
   * Flush all pending debounced server syncs synchronously.
   * Called on beforeunload — must not use async operations since the browser
   * will terminate the page before any promise resolves.
   */
  flushPending() {
    if (!get(authStore).isAuthenticated) return;
    for (const [key, timer] of saveDebounceTimers) {
      clearTimeout(timer);
      saveDebounceTimers.delete(key);
      const data = _lastSyncData.get(key);
      // data may be undefined if the 500ms debounce hasn't fired yet —
      // drawing is safe in IndexedDB and will sync on next load.
      if (data) {
        const [symbol, resolution] = key.split('/');
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(
          API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution),
          blob
        );
      }
    }
  }
};

// Expose to window for E2E test access (seed/verify drawings)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.drawingStore = drawingStore;
}

// Flush pending drawing syncs before the tab closes to prevent data loss
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => drawingStore.flushPending());
}
