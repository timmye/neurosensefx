# Structural Code Fixes: Drawing Persistence

**Date**: 2026-05-20
**Status**: TODO — structural improvements from post-implementation review
**Scope**: Maintenance debt, not correctness bugs. All functional fixes from `drawings-kline-debug-report.md` are already implemented.
**Updated**: 2026-05-20 — verified all fixes against current code; added missed issues from follow-up analysis

---

## Fix Summary

| # | Issue | File | Severity | Effort |
|---|-------|------|----------|--------|
| 1 | Duplicate merge-reconcile logic | `drawingStore.js` | SHOULD | ~10 min |
| 2 | Missing error boundary in `restorePinnedDrawings` | `chartOverlayRestore.js` | SHOULD | ~5 min |
| 3 | Boilerplate duplication in reload paths (2 paths, not 4) | `ChartDisplay.svelte` | SHOULD | ~15 min |
| 4 | God object: `drawingStore.js` | `drawingStore.js` | SHOULD (deferred) | ~30 min |
| 5 | `undo()` re-persists stale `dataIndex` | `DeleteDrawingCommand.js` | COULD | ~10 min |
| 6 | `loadPinned()` full table scan | `drawingStore.js` | COULD | ~10 min |
| 7 | Fire-and-forget `remove()` in commands | `DeleteDrawingCommand.js`, `drawingCommands.js` | SHOULD | ~5 min |
| 8 | Uncancellable `setTimeout` retries in `restoreDrawings` | `chartOverlayRestore.js` | SHOULD | ~10 min |
| 9 | `clearAll()` lacks 409 retry | `drawingStore.js` | SHOULD | ~10 min |
| 10 | No error handling on `drawingStore.update()` in move | `ChartDisplay.svelte` | SHOULD | ~5 min |
| 11 | `onPressedMoveEnd` persists unnormalized points | `ChartDisplay.svelte` | SHOULD | ~5 min |

---

## Fix 1: Extract duplicate merge-reconcile logic (SHOULD)

**Problem**: `load()` and the 409 handler in `_debouncedServerSync()` contain near-identical merge-reconcile sequences (~15 lines duplicated).

**Locations**:
- `drawingStore.js:64-78` — authenticated `load()` path
- `drawingStore.js:237-246` — 409 conflict retry path

**Current code** (both paths do the same sequence):
```
_mergeByTimestamp(serverData, local)
→ db.transaction('rw') + for loop with db.drawings.put()
→ _purgeTombstones(symbol, resolution)
```

**Fix**: Extract `_reconcileAndPersist(merged, symbol, resolution)`:

```js
async _reconcileAndPersist(merged, symbol, resolution) {
  await db.transaction('rw', db.drawings, async () => {
    for (const d of merged) {
      if (!d.overlayId) continue;
      const { id, ...record } = d;
      await db.drawings.put({ ...record, symbol, resolution });
    }
  });
  await this._purgeTombstones(symbol, resolution);
}
```

Call from `load()` (line 66-74) and the 409 handler (line 239-245).

---

## Fix 2: Add error boundary to `restorePinnedDrawings` (SHOULD)

**Problem**: `restorePinnedDrawings()` at `chartOverlayRestore.js:160-167` has no try/catch. If `loadPinned()` throws (Dexie corruption) or `renderForeignDrawings()` crashes, the error becomes an unhandled rejection and the chart is left in a partially cleared state.

**Current code**:
```js
async function restorePinnedDrawings(symbol, resolution) {
  const chart = deps.chart;
  if (!chart) return;

  const pinnedDrawings = await drawingStore.loadPinned(symbol);
  const pinnedForeign = pinnedDrawings.filter(d => d.resolution !== resolution);
  renderForeignDrawings(chart, pinnedForeign, deps.overlayMeta);
}
```

**Fix**: Wrap in try/catch with warning:

```js
async function restorePinnedDrawings(symbol, resolution) {
  try {
    const chart = deps.chart;
    if (!chart) return;

    const pinnedDrawings = await drawingStore.loadPinned(symbol);
    const pinnedForeign = pinnedDrawings.filter(d => d.resolution !== resolution);
    renderForeignDrawings(chart, pinnedForeign, deps.overlayMeta);
  } catch (err) {
    console.warn('[restorePinnedDrawings] Failed for ' + symbol + '/' + resolution + ':', err);
  }
}
```

---

## Fix 3: Extract shared reload pipeline from `ChartDisplay.svelte` (SHOULD)

**Problem**: Two code paths share identical teardown → clear → load → restore boilerplate. The un-minimize and onMount paths share only the tail (load → restore → refresh), not the full teardown pipeline.

| Path | Lines | Shares Full Pipeline? |
|------|-------|------------------------|
| `handleResolutionChange` | 270-283 | Yes — full teardown + reload |
| `reloadChartSetting` | 285-297 | Yes — full teardown + reload |
| Un-minimize (no chart) | 421-441 | No — only tail (load → restore → refresh) |
| `onMount` | 446-480 | No — only tail (initial creation, no teardown) |

**Shared sequence** (appears 2 times in full form):
```
cancelPendingSync → teardownSubscriptions → mutate state →
removeOverlay + clearData + resize → overlayMeta.clear + commandStack.clear →
loadChartData → restoreDrawings → forceCanvasDPRRefresh + .catch()
```

**Fix**: Extract a `reloadWithRestore(preReloadFn, onReadyCallback)` helper in `ChartDisplay.svelte` for the two full-pipeline paths. The `preReloadFn` handles the mutation step, and the helper runs the shared pipeline.

Pseudocode:
```js
function reloadWithRestore(preReloadFn, onReadyCallback) {
  preReloadFn();
  if (chart) { chart.removeOverlay(); chart.clearData(); chart.resize(); }
  overlayMeta.clear(); commandStack.clear();
  loadChartData(currentSymbol, currentResolution, currentWindow, () => {
    onReadyCallback?.();
    overlayRestore.restoreDrawings(currentSymbol, currentResolution)
      .then(() => forceCanvasDPRRefresh(chartContainer))
      .catch(err => console.error('[ChartDisplay] restoreDrawings failed:', err));
  });
}
```

For the un-minimize and onMount paths, consider extracting a separate `loadAndRestore(callback)` for the tail only. This keeps the refactoring focused and avoids over-engineering a single helper that tries to cover all 4 cases.

---

## Fix 4: Split `drawingStore.js` into focused modules (SHOULD, deferred)

**Problem**: `drawingStore.js` (321 lines, 13 methods) mixes 5+ concerns:
1. Dexie schema migration (v1-v3)
2. Drawing CRUD (`save`, `load`, `update`, `remove`, `clearAll`)
3. Server sync with debounce + 409 retry (`_debouncedServerSync`, `_buildSyncBody`, `_updateSyncCache`, `cancelPendingSync`, `flushPending`)
4. Merge logic (`_mergeByTimestamp`, `_purgeTombstones`)
5. Lifecycle (`beforeunload` listener)

**Impact**: Changing sync strategy risks touching merge logic or tombstone handling. Each concern has independent failure modes that become entangled.

**Fix** (deferred, do when adding new features):
- Extract sync into `drawingSync.js`: `_debouncedServerSync`, `_buildSyncBody`, `_updateSyncCache`, `cancelPendingSync`, `flushPending`
- Keep CRUD + schema + merge in `drawingStore.js`
- Re-export a unified `drawingStore` object from a new entry file

---

## Fix 5: `DeleteDrawingCommand.undo()` re-persists stale `dataIndex` (COULD)

**Problem**: `undo()` at `DeleteDrawingCommand.js:46-58` re-persists `this.serializedOverlay.points` with original `dataIndex` values captured at deletion time. If resolution changed between creation and deletion, these indices reference a different data layout.

Read-time stripping in `renderLocalDrawings()` mitigates this at restore time, but the stored record is semantically incorrect — any code path that reads raw points (debug export, server sync) gets stale data.

**Fix**: In `undo()`, normalize points before saving by stripping `dataIndex` when `timestamp` is available:

```js
// In DeleteDrawingCommand.undo(), before calling this.store.save():
const normalizedPoints = this.serializedOverlay.points.map(p => {
  if (p.timestamp != null && typeof p.timestamp === 'number') {
    return { timestamp: p.timestamp, value: p.value };
  }
  return { dataIndex: p.dataIndex, value: p.value };
});
// Use normalizedPoints in the save() call instead of this.serializedOverlay.points
```

---

## Fix 6: Add Dexie compound index for `loadPinned` (COULD)

**Problem**: `loadPinned()` at `drawingStore.js:89-90` uses a runtime `.and()` filter on the `pinned` field, which is not indexed:

```js
return db.drawings.where('symbol').equals(symbol).and(d => d.pinned === true && !d.deletedAt).toArray();
```

This is a full table scan filtered client-side. Degrades linearly with drawing count (>100 per symbol).

**Fix**: Add Dexie v4 migration with compound index:

```js
db.version(4).stores({
  drawings: 'overlayId, [symbol+resolution], [symbol+pinned], symbol, overlayType, createdAt'
});
```

Update `loadPinned()` to use the compound index:
```js
async loadPinned(symbol) {
  const results = await db.drawings.where('[symbol+pinned]').equals([symbol, true]).toArray();
  return results.filter(d => !d.deletedAt);
}
```

---

## Fix 7: Await `remove()` in command `execute()` (SHOULD)

**Problem**: `DeleteDrawingCommand.execute()` at `DeleteDrawingCommand.js:21-24` and `CreateDrawingCommand.undo()` at `drawingCommands.js:136-142` call `this.store.remove(overlayId)` without awaiting it:

```js
execute() {
  this.chart.removeOverlay({ id: this.overlayId });
  this.store.remove(this.overlayId);  // NOT awaited
}
```

`remove()` is async (Dexie `get()` + `update()`). The tombstone write may not complete before a subsequent `load()` reads stale state, or `flushPending()` on `beforeunload` syncs incomplete data to the server.

**Fix**: Await the remove call:

```js
async execute() {
  this.chart.removeOverlay({ id: this.overlayId });
  await this.store.remove(this.overlayId);
}
```

**Severity**: MODERATE — race condition window creates silent data inconsistency.

---

## Fix 8: Add abort token to `restoreDrawings` retry (SHOULD)

**Problem**: `restoreDrawings()` at `chartOverlayRestore.js:142-149` creates uncancellable `setTimeout` retries (up to 10, 300ms apart). If the user switches symbols/resolutions rapidly, stale retries execute against a chart that has already moved on — they can overwrite correct state.

**Current code**:
```js
if (chart.getDataList().length < MIN_BARS) {
  if (attempt >= MAX_RESTORE_ATTEMPTS) { ... }
  setTimeout(() => restoreDrawings(symbol, resolution, attempt + 1), 300);
  return;
}
```

**Fix**: Add a module-level sequence number that the retry checks before proceeding:

```js
let restoreSequence = 0;

// In the caller, bump the sequence before starting:
restoreSequence++;
const seq = restoreSequence;
restoreDrawings(symbol, resolution, 0, seq);

// In the retry, check before proceeding:
if (seq !== restoreSequence) return; // aborted, newer restore in flight
```

**Severity**: MODERATE — stale restores can overwrite correct state on rapid navigation.

---

## Fix 9: Add 409 retry to `clearAll()` (SHOULD)

**Problem**: `clearAll()` at `drawingStore.js:127-146` performs a single-shot server fetch with no 409 handling. If the server returns 409 (version conflict), the local drawings are already deleted from IndexedDB but the server version isn't updated. The next `load()` will re-fetch server drawings and re-populate them, silently undoing the user's clear action.

**Fix**: On 409 response, fetch server data, merge with local (which is now empty), and update local DB — similar to the 409 handler in `_debouncedServerSync()`:

```js
if (resp.status === 409) {
  const serverData = await resp.json();
  const merged = this._mergeByTimestamp(serverData, []); // local is empty
  await this._reconcileAndPersist(merged, symbol, resolution); // (Fix 1)
  return; // clear effectively becomes "sync to server state"
}
```

**Severity**: MODERATE — data integrity issue: clear can be silently reversed by next load.

---

## Fix 10: Add `.catch()` to `drawingStore.update()` in move callback (SHOULD)

**Problem**: `onPressedMoveEnd` at `ChartDisplay.svelte:118-123` calls `drawingStore.update()` without awaiting or catching:

```js
onPressedMoveEnd: (e) => {
  const o = e.overlay;
  const baseId = o.id.replace(/_pinned_.+$/, '');
  drawingStore.update(baseId, { points: o.points });  // fire-and-forget
},
```

Making the callback `async` isn't structurally correct here. But there's no `.catch()` either, so IndexedDB failures (quota, lock, corruption) silently disappear — the user sees the overlay move on screen but the change is lost.

**Fix**: Add `.catch()` with a user-visible warning:

```js
onPressedMoveEnd: (e) => {
  const o = e.overlay;
  const baseId = o.id.replace(/_pinned_.+$/, '');
  drawingStore.update(baseId, { points: o.points }).catch(err => {
    console.warn('[ChartDisplay] Failed to persist overlay move:', err);
  });
},
```

**Severity**: LOW-MODERATE — silent data loss on move, no user feedback.

---

## Fix 11: Normalize points in `onPressedMoveEnd` for foreign overlays (SHOULD)

**Problem**: When the user drags a pinned foreign drawing (cross-resolution overlay), `onPressedMoveEnd` persists points as-is with whatever coordinate format KLineChart returns. These may use `dataIndex` coordinates valid only for the current resolution. Switching resolution and back leaves the foreign drawing with stale indices.

**Fix**: In `onPressedMoveEnd`, strip `dataIndex` when `timestamp` is available (same normalization as Fix 5):

```js
onPressedMoveEnd: (e) => {
  const o = e.overlay;
  const baseId = o.id.replace(/_pinned_.+$/, '');
  const normalizedPoints = o.points.map(p => {
    if (p.timestamp != null && typeof p.timestamp === 'number') {
      return { timestamp: p.timestamp, value: p.value };
    }
    return p;
  });
  drawingStore.update(baseId, { points: normalizedPoints }).catch(err => {
    console.warn('[ChartDisplay] Failed to persist overlay move:', err);
  });
},
```

**Severity**: LOW-MODERATE — modification of foreign pinned overlays corrupts cross-resolution coordinates.

---

## Test Coverage Gaps (reference only)

The following are untested and should be covered when any of the above fixes are implemented:

| Gap | Impact |
|-----|--------|
| `CreateDrawingCommand` — `execute()`, `persist()`, `undo()` | No test coverage for create path |
| `DeleteDrawingCommand` — entire class | No test coverage for delete/undo path |
| `drawingStore.load()` authenticated path | Server fetch + merge + reconcile untested |
| `_debouncedServerSync` | Debounce timing, 409 retry, version cache untested |
| `clearAll()` | Tombstone deletion + server fetch untested |
| `update()` with compound overlay IDs | `_pinned_` suffix stripping untested |
| `flushPending()` | `beforeunload` flush path untested |
| `renderForeignDrawings()` | Timestamp normalization for foreign pinned drawings untested |
| `mergeDrawings()` in `chartOverlayRestore.js` | Local/foreign merge + dedup untested |
| `createDrawingHandlers` | Handler factory untested |

---

## Execution Order

These are mostly independent. Fix 9 depends on Fix 1 (uses `_reconcileAndPersist`). Recommended sequence:

1. **Fix 2** (error boundary) — lowest risk, highest ROI
2. **Fix 7** (await remove) — eliminates race condition, small diff
3. **Fix 1** (extract merge logic) — eliminates duplication, enables Fix 9
4. **Fix 9** (409 retry in clearAll) — data integrity, depends on Fix 1
5. **Fix 8** (abort token for restore retry) — prevents stale overwrites
6. **Fix 10** (`.catch()` on move) — silent failure guard
7. **Fix 6** (Dexie index) — performance improvement, no behavior change
8. **Fix 5** (undo normalization) — consistency improvement
9. **Fix 11** (normalize points in move) — cross-resolution consistency
10. **Fix 3** (extract reload helper) — larger diff, more review needed
11. **Fix 4** (split drawingStore) — deferred until adding new features
