/**
 * Overlay metadata tracking: maps overlay IDs to pinned state.
 * overlayId is the IndexedDB primary key, so no dbId mapping is needed.
 */

export function createOverlayMeta() {
  const meta = new Map(); // overlayId → { pinned }

  return {
    get(overlayId) { return meta.get(overlayId); },
    setPinned(overlayId, pinned) {
      const entry = meta.get(overlayId) || {};
      meta.set(overlayId, { ...entry, pinned });
    },
    getPinned(overlayId) { return meta.get(overlayId)?.pinned ?? false; },
    delete(overlayId) { meta.delete(overlayId); },
    clear() { meta.clear(); },
    entries() { return meta.entries(); },
  };
}
