import Dexie from 'dexie';
// Drawing persistence: IndexedDB (local cache) + server API when authenticated (ref: DL-007).
// overlayId is the primary key — it's a client-generated UUID, immutable, and shared
// between the chart layer and persistence layer, eliminating stale-ID bugs.
import { authStore } from '../../stores/authStore.js';
import { get } from 'svelte/store';

const db = new Dexie('NeuroSenseDrawings');
db.version(1).stores({
  drawings: '++id, [symbol+resolution], overlayType, createdAt',
});
db.version(2).stores({
  drawings: '++id, [symbol+resolution], symbol, overlayType, createdAt',
});
db.version(3).stores({
  drawings: 'overlayId, [symbol+resolution], symbol, overlayType, createdAt',
}).upgrade(tx => {
  // Migrate v2 auto-increment records to v3 overlayId-keyed records.
  // Records without overlayId are dropped (already broken).
  return tx.table('drawings').toCollection().modify(drawing => {
    if (!drawing.overlayId) {
      return "delete"; // Dexie: return "delete" string to remove the record
    }
  });
});

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const saveDebounceTimers = new Map();

// Synchronous snapshot of the last synced data per symbol/resolution.
// Updated on every save/update/remove so flushPending can read it without async IndexedDB.
const _lastSyncData = new Map();
const _versionCache = new Map();

export const drawingStore = {
  async save(symbol, resolution, drawing) {
    const now = Date.now();
    const record = {
      ...drawing,
      symbol,
      resolution,
      schemaVersion: 1,
      createdAt: drawing.createdAt || now,
      updatedAt: now,
    };
    // put() upserts — clears any tombstone (deletedAt) from undo or re-sync
    await db.drawings.put(record);
    await this._updateSyncCache(symbol, resolution);
    // Trigger debounced server sync after local IndexedDB write (ref: DL-007)
    this._debouncedServerSync(symbol, resolution);
    return drawing.overlayId;
  },

  async load(symbol, resolution) {
    // When authenticated, merge server and local IndexedDB data by updatedAt
    // to preserve local changes that haven't synced yet (ref: DL-007).
    if (get(authStore).isAuthenticated) {
      try {
        const resp = await fetch(API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution), { credentials: 'include' });
        if (resp.ok) {
          const { data, version } = await resp.json();
          if (data && Array.isArray(data) && data.length > 0) {
            _versionCache.set(symbol + '/' + resolution, version ?? 0);
            const local = await db.drawings.where({ symbol, resolution }).toArray();
            // Merge: keep the newest version of each drawing by updatedAt
            const merged = this._mergeByTimestamp(data, local);
            // Reconcile IndexedDB with merged result using put (upsert by overlayId)
            await db.transaction('rw', db.drawings, async () => {
              for (const d of merged) {
                if (!d.overlayId) continue;
                const { id, ...record } = d;
                await db.drawings.put({ ...record, symbol, resolution });
              }
            });
            // Purge tombstoned records after successful merge
            await this._purgeTombstones(symbol, resolution);
            // Always re-sync merged result to server (idempotent PUT guarantees convergence)
            this._debouncedServerSync(symbol, resolution);
            return merged.filter(d => d.overlayId && !d.deletedAt);
          }
        }
      } catch (err) {
        console.warn('[DrawingStore] Server load failed for ' + symbol + '/' + resolution + ':', err);
      }
    }
    return db.drawings.where({ symbol, resolution }).toArray().filter(d => !d.deletedAt);
  },

  async loadPinned(symbol) {
    return db.drawings.where('symbol').equals(symbol).and(d => d.pinned === true && !d.deletedAt).toArray();
  },

  async update(overlayId, changes) {
    const drawing = await db.drawings.get(overlayId);
    if (!drawing || drawing.deletedAt) {
      console.warn('[DrawingStore] update() called with non-existent or deleted overlayId:', overlayId);
      return;
    }
    await db.drawings.update(overlayId, { ...changes, updatedAt: Date.now() });
    await this._updateSyncCache(drawing.symbol, drawing.resolution);
    // Sync updated drawing to server after local IndexedDB write
    this._debouncedServerSync(drawing.symbol, drawing.resolution);
  },

  /**
   * Tombstone deletion: sets deletedAt instead of hard-deleting from IndexedDB.
   * This allows _mergeByTimestamp to distinguish "locally deleted" from
   * "server-only" drawings, preventing deleted drawings from being restored
   * by 409 conflict resolution or load() merge (ref: tombstone-delete).
   */
  async remove(overlayId) {
    const drawing = await db.drawings.get(overlayId);
    if (!drawing) {
      console.warn('[DrawingStore] remove() called with non-existent overlayId:', overlayId);
      return;
    }
    await db.drawings.update(overlayId, { deletedAt: Date.now() });
    await this._updateSyncCache(drawing.symbol, drawing.resolution);
    // Sync removal to server after local IndexedDB tombstone
    this._debouncedServerSync(drawing.symbol, drawing.resolution);
  },

  async clearAll(symbol, resolution) {
    await db.drawings.where({ symbol, resolution }).delete();
    this.cancelPendingSync(symbol, resolution);
    const key = symbol + '/' + resolution;
    _lastSyncData.set(key, []);
    const cachedVersion = _versionCache.get(key) || 0;
    // Immediate sync for clearAll — user expects instant server state (ref: DL-007)
    if (get(authStore).isAuthenticated) {
      fetch(API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-drawings-version': String(cachedVersion) },
        credentials: 'include',
        body: JSON.stringify([])
      }).then(resp => {
        if (resp.ok) {
          _versionCache.delete(key);
        }
      }).catch(err => console.warn('[DrawingStore] Failed to clear drawings on server:', err));
    }
  },

  /**
   * Merge server and local drawing arrays. The server stores the entire
   * array as a single JSONB blob (no per-drawing IDs), so we match by
   * overlayId (client-generated UUID). For each drawing, keep the version
   * with the newest updatedAt. Drawings unique to either source are included.
   *
   * Tombstone-aware: local records with deletedAt suppress matching server
   * records (ref: tombstone-delete).
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
    // Remove server-only drawings that are tombstoned locally
    const tombstonedIds = new Set();
    for (const d of localData) {
      if (d.deletedAt && d.overlayId) tombstonedIds.add(d.overlayId);
    }
    return result.filter(d => !tombstonedIds.has(d.overlayId));
  },

  /**
   * Purge tombstoned records from IndexedDB after a successful merge or sync.
   */
  async _purgeTombstones(symbol, resolution) {
    const tombstones = await db.drawings
      .where({ symbol, resolution })
      .and(d => d.deletedAt != null)
      .toArray();
    if (tombstones.length > 0) {
      const ids = tombstones.map(d => d.overlayId);
      await db.drawings.bulkDelete(ids);
    }
  },

  /**
   * Build the upload body for server sync: excludes tombstoned records.
   */
  _buildSyncBody(all) {
    return all.filter(d => !d.deletedAt);
  },

  /**
   * Debounced server sync: 500ms delay batches rapid drawing operations.
   * Reads the full set of drawings for the symbol/resolution from IndexedDB
   * and uploads as a complete unit (ref: DL-003).
   */
  _debouncedServerSync(symbol, resolution, _retryCount = 0) {
    if (!get(authStore).isAuthenticated) return;
    const key = symbol + '/' + resolution;
    const existing = saveDebounceTimers.get(key);
    if (existing) clearTimeout(existing);
    saveDebounceTimers.set(key, setTimeout(async () => {
      saveDebounceTimers.delete(key);
      try {
        const all = await db.drawings.where({ symbol, resolution }).toArray();
        _lastSyncData.set(key, all);
        const version = _versionCache.get(key) || 0;
        const resp = await fetch(
          API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution),
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-drawings-version': String(version),
            },
            credentials: 'include',
            body: JSON.stringify(this._buildSyncBody(all)),
          }
        );
        if (resp.status === 409) {
          const { data: serverData, version: serverVersion } = await resp.json();
          const local = await db.drawings.where({ symbol, resolution }).toArray();
          const merged = this._mergeByTimestamp(serverData, local);
          await db.transaction('rw', db.drawings, async () => {
            for (const d of merged) {
              if (!d.overlayId) continue;
              const { id, ...record } = d;
              await db.drawings.put({ ...record, symbol, resolution });
            }
          });
          await this._purgeTombstones(symbol, resolution);
          const freshData = await db.drawings.where({ symbol, resolution }).toArray();
          _lastSyncData.set(key, freshData);
          _versionCache.set(key, serverVersion);
          if (_retryCount >= 3) {
            console.warn('[DrawingStore] Max version conflict retries reached for ' + key);
            return;
          }
          this._debouncedServerSync(symbol, resolution, _retryCount + 1);
          return;
        }
        const result = await resp.json();
        if (result.version) {
          _versionCache.set(key, result.version);
        }
        // Purge tombstones after successful sync
        await this._purgeTombstones(symbol, resolution);
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
  cancelPendingSync(symbol, resolution) {
    const key = symbol + '/' + resolution;
    const existing = saveDebounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      saveDebounceTimers.delete(key);
    }
  },

  async _updateSyncCache(symbol, resolution) {
    const key = symbol + '/' + resolution;
    const all = await db.drawings.where({ symbol, resolution }).toArray();
    _lastSyncData.set(key, all);
  },

  flushPending() {
    if (!get(authStore).isAuthenticated) return;
    for (const [key, timer] of saveDebounceTimers) {
      clearTimeout(timer);
      saveDebounceTimers.delete(key);
      const data = _lastSyncData.get(key);
      // data may be undefined if the 500ms debounce hasn't fired yet —
      // drawing is safe in IndexedDB and will sync on next load.
      if (data) {
        const lastSlash = key.lastIndexOf('/');
        const symbol = key.slice(0, lastSlash);
        const resolution = key.slice(lastSlash + 1);
        // Use fetch+keepalive instead of sendBeacon: sendBeacon always sends POST
        // but the server only handles PUT for this endpoint.
        fetch(
          API_BASE + '/api/drawings/' + encodeURIComponent(symbol) + '/' + encodeURIComponent(resolution),
          { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-drawings-version': String(_versionCache.get(key) || 0) }, credentials: 'include', body: JSON.stringify(this._buildSyncBody(data)), keepalive: true }
        ).catch(err => console.warn('[DrawingStore] flushPending failed for ' + key + ':', err));
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
