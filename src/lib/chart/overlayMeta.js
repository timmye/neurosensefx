/**
 * Overlay metadata tracking: maps overlay IDs to IndexedDB IDs and pinned state.
 * Replaces overlayDbIdMap + overlayPinnedMap with a unified structure.
 */

export function createOverlayMeta() {
  const meta = new Map(); // overlayId → { dbId, pinned }

  return {
    get(overlayId) { return meta.get(overlayId); },
    setDbId(overlayId, dbId) {
      const entry = meta.get(overlayId) || {};
      meta.set(overlayId, { ...entry, dbId });
    },
    setPinned(overlayId, pinned) {
      const entry = meta.get(overlayId) || {};
      meta.set(overlayId, { ...entry, pinned });
    },
    getDbId(overlayId) { return meta.get(overlayId)?.dbId ?? null; },
    getPinned(overlayId) { return meta.get(overlayId)?.pinned ?? false; },
    delete(overlayId) { meta.delete(overlayId); },
    clear() { meta.clear(); },
    entries() { return meta.entries(); },
  };
}
