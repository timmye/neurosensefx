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
    // Try server first when authenticated; replace local IndexedDB with server data (ref: DL-007)
    if (get(authStore).isAuthenticated) {
      try {
        const resp = await fetch(API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution), { credentials: 'include' });
        if (resp.ok) {
          const { data } = await resp.json();
          if (data && Array.isArray(data) && data.length > 0) {
            // Replace local IndexedDB data with server data to keep cache in sync
            await db.drawings.where({ symbol, resolution }).delete();
            for (const d of data) {
              await db.drawings.add({ ...d, symbol, resolution });
            }
            return data;
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
  }
};

// Expose to window for E2E test access (seed/verify drawings)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.drawingStore = drawingStore;
}
