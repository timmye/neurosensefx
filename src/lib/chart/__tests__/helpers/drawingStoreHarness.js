/**
 * Mock drawingStore for coordinator unit tests.
 * Decouples from IndexedDB/Dexie — all data in-memory.
 */
export function createMockDrawingStore(initialData = []) {
  const records = new Map();
  for (const record of initialData) {
    if (record.overlayId) records.set(record.overlayId, { ...record });
  }

  const calls = {
    save: [], remove: [], clearAll: [], load: [],
    loadPinned: [], update: [], cancelPendingSync: [], evictStaleEntries: [],
  };

  return {
    calls,
    _data: records,

    async save(symbol, resolution, drawing) {
      calls.save.push({ symbol, resolution, drawing });
      const existing = records.get(drawing.overlayId) || {};
      records.set(drawing.overlayId, {
        ...existing,
        ...drawing,
        symbol,
        resolution,
        schemaVersion: 1,
        createdAt: drawing.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
      return drawing.overlayId;
    },

    async load(symbol, resolution) {
      calls.load.push({ symbol, resolution });
      return [...records.values()].filter(
        d => d.symbol === symbol && d.resolution === resolution && !d.deletedAt
      );
    },

    async loadPinned(symbol) {
      calls.loadPinned.push({ symbol });
      return [...records.values()].filter(
        d => d.symbol === symbol && d.pinned === true && !d.deletedAt
      );
    },

    async update(overlayId, changes) {
      calls.update.push({ overlayId, changes });
      const record = records.get(overlayId);
      if (record && !record.deletedAt) {
        records.set(overlayId, { ...record, ...changes, updatedAt: Date.now() });
      }
    },

    async remove(overlayId) {
      calls.remove.push({ overlayId });
      const record = records.get(overlayId);
      if (record) {
        records.set(overlayId, { ...record, deletedAt: Date.now() });
      }
    },

    async clearAll(symbol, resolution) {
      calls.clearAll.push({ symbol, resolution });
      for (const [id, record] of records) {
        if (record.symbol === symbol && record.resolution === resolution) {
          records.set(id, { ...record, deletedAt: Date.now() });
        }
      }
    },

    cancelPendingSync() {
      calls.cancelPendingSync.push([]);
    },

    evictStaleEntries(symbol) {
      calls.evictStaleEntries.push({ symbol });
    },
  };
}
