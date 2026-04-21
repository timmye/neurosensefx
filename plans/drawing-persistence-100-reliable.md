# Drawing Persistence: 100% Reliability Fix Plan

**Date**: 2026-04-20
**Status**: IMPLEMENTED — quality review PASS
**Reviewed by**: quality-reviewer (NEEDS_CHANGES → amendments applied), architect (APPROVED with 4 amendments)
**Implemented**: 2026-04-21
**Goal**: Eliminate all drawing data loss and position corruption vectors

---

## Problem Summary

Two user-facing symptoms persist despite 6 weeks of iteration:
1. **"Not saving reliably"** — drawings lost on reload across multiple paths
2. **"Wrong positions on load"** — drawings render at stale positions after drag

Root cause analysis identified 7 bugs. One false positive removed after review.

---

## Fix 1: Wire `onPressedMoveEnd` to persist position changes [CRITICAL]

**Symptoms fixed**: "Not saving" (drag changes) + "Wrong positions on load" (#1 cause)

**Root cause**: KLineChart provides `onPressedMoveEnd` overlay event (confirmed at `node_modules/klinecharts/types/index.d.ts:800`) but the app never hooks it. Every overlay drag updates the chart's in-memory state only — the new position is never written to IndexedDB or server.

**Files changed**:
- `src/components/ChartDisplay.svelte` — add `onPressedMoveEnd` to `getOverlayCallbacks()`

**Change**:

```javascript
// In getOverlayCallbacks() (ChartDisplay.svelte:104), add:
onPressedMoveEnd: (e) => {
  const o = e.overlay;
  const dbId = getDbIdForOverlay(o.id);
  if (dbId) {
    drawingStore.update(dbId, { points: o.points });
  }
},
```

**Why this works**: `drawingStore.update()` writes to IndexedDB immediately and triggers the 500ms debounced server sync. The `points` array from `o.points` contains the updated position data.

**Edge case — foreign pinned drawings**: Foreign pinned drawings use a compound ID (`${overlayId}_pinned_${resolution}`). `getDbIdForOverlay` looks up by this compound ID, so it will find the dbId. However, foreign pinned drawings are locked (`lock: true`), so KLineChart won't fire move events for them. No special handling needed.

**Edge case — drawings without dbId**: If a drawing was just restored and overlayMeta hasn't been populated yet, `dbId` will be null and the update is skipped. This is safe — the drawing was just loaded from IndexedDB with correct positions.

**Review note**: Both reviewers confirmed this fix is correct. KLineChart type definitions confirm `onPressedMoveEnd` exists with `overlay` property containing `id` and `points`.

---

## Fix 2: Always re-sync to server after merge [HIGH]

**Symptoms fixed**: "Not saving" — content-only changes never reach server

**Root cause**: `drawingStore.js:54` only re-syncs when `merged.length !== data.length`. Modifying an existing drawing (same count, different content) never triggers re-sync. Server retains stale data.

**Files changed**:
- `src/lib/chart/drawingStore.js`

**Change**:

```javascript
// Replace line 54:
//   if (merged.length !== data.length) {
// With:
this._debouncedServerSync(symbol, resolution);
```

**Why this works**: After merge, the merged result is the canonical state. Re-uploading it is idempotent — one PUT per symbol/resolution load. This guarantees server convergence without conditional logic. Simpler and more correct than checking `localNewer`.

**Review note**: Architect recommended always re-syncing over the conditional gate. The PUT is idempotent and happens once per load per symbol/resolution — negligible cost for guaranteed convergence.

---

## ~~Fix 3: Toolbar redo dispatch~~ [REMOVED — false positive]

**Verified**: `ChartToolbar.svelte:123` dispatches `dispatch('redo', cmd)`. Svelte's `createEventDispatcher` wraps the second arg as `{ detail: cmd }`. `ChartDisplay.svelte:495` handles `on:redo={e => drawingHandlers.redoCreateCommand(e.detail)}`. The dispatch format is correct. No change needed.

---

## Fix 4: Fix forex sendBeacon key split [HIGH]

**Symptoms fixed**: "Not saving" — tab close silently fails for forex pairs

**Root cause**: `drawingStore.js:174` uses `key.split('/')` to recover symbol and resolution. Forex symbols like `EUR/USD` produce `['EUR', 'USD', '4h']` — destructuring assigns wrong values.

**Files changed**:
- `src/lib/chart/drawingStore.js`

**Change**:

```javascript
// Replace line 174:
//   const [symbol, resolution] = key.split('/');
// With:
const lastSlash = key.lastIndexOf('/');
const symbol = key.slice(0, lastSlash);
const resolution = key.slice(lastSlash + 1);
```

**Why this works**: `lastIndexOf('/')` finds the separator between symbol and resolution, not the one within the symbol. For `EUR/USD/4h`, `lastSlash = 7` → `symbol = 'EUR/USD'`, `resolution = '4h'`.

---

## Fix 5: Cancel pending debounce timers on chart context change [MEDIUM]

**Symptoms fixed**: Avoids unnecessary network requests after chart context switches

**Root cause**: When the user switches symbol, timeframe, or window, a pending 500ms debounce timer for the previous context may still fire. The timer reads correct data from IndexedDB (switches don't modify IndexedDB for other symbols), but fires an unnecessary network request. Cancelling is clean and avoids any edge cases.

**Files changed**:
- `src/lib/chart/drawingStore.js` — add `cancelPendingSync(symbol, resolution)` method
- `src/components/ChartDisplay.svelte` — call before `handleSymbolChange`, `handleResolutionChange`, and `handleWindowChange`

**Change in drawingStore.js**:

```javascript
cancelPendingSync(symbol, resolution) {
  const key = symbol + '/' + resolution;
  const existing = saveDebounceTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    saveDebounceTimers.delete(key);
  }
},
```

**Change in ChartDisplay.svelte** — in `handleSymbolChange`, `handleResolutionChange`, and `handleWindowChange`, before their respective teardown paths:

```javascript
drawingStore.cancelPendingSync(currentSymbol, currentResolution);
```

**Review note**: Quality reviewer confirmed IndexedDB is NOT modified during switches — the fix is defensive rather than correctness-critical. Architect noted `handleWindowChange` must also be covered (same inline teardown pattern).

---

## Fix 6: Fix undo-delete — attach callbacks + re-register overlayMeta [MEDIUM]

**Symptoms fixed**: Undo-delete produces interaction-dead overlay; subsequent drag/delete/pin silently fail

**Root cause**: `DeleteDrawingCommand.undo()` re-creates the overlay via `chart.createOverlay()` but doesn't attach callbacks. Additionally, `handleOverlayDelete` calls `overlayMeta.delete(overlayId)` at `chartDrawingHandlers.js:68`, and the undo path never re-registers the overlay in overlayMeta. Without the dbId mapping, Fix 1's `onPressedMoveEnd` won't persist position changes, and context-menu pin/delete won't work.

**Files changed**:
- `src/lib/chart/DeleteDrawingCommand.js` — accept callbacks, attach via `overrideOverlay`, re-register overlayMeta
- `src/lib/chart/chartDrawingHandlers.js` — pass callbacks to DeleteDrawingCommand constructor

**Approach**: Use `overrideOverlay` (not constructor threading) — avoids modifying the command pattern's serialization interface.

**Change in DeleteDrawingCommand.js**:

```javascript
// Add callbacks to constructor:
constructor(chart, store, symbol, resolution, overlayId, dbId, serializedOverlay, callbacks) {
  // ...existing...
  this.callbacks = callbacks;
}

// Replace undo() body:
async undo() {
  const opts = {
    name: this.serializedOverlay.overlayType,
    id: this.serializedOverlay.overlayId,
    points: this.serializedOverlay.points,
    styles: this.serializedOverlay.styles,
  };
  if (this.serializedOverlay.extendData != null) opts.extendData = this.serializedOverlay.extendData;
  this.chart.createOverlay(opts);

  // Attach interaction callbacks (includes onPressedMoveEnd from Fix 1)
  if (this.callbacks) {
    this.chart.overrideOverlay({
      id: this.serializedOverlay.overlayId,
      ...this.callbacks,
    });
  }

  // Re-persist to IndexedDB and re-register in overlayMeta
  if (this.symbol && this.resolution) {
    const newDbId = await this.store.save(
      this.symbol,
      this.resolution,
      {
        overlayId: this.serializedOverlay.overlayId,
        overlayType: this.serializedOverlay.overlayType,
        points: this.serializedOverlay.points,
        styles: this.serializedOverlay.styles,
        extendData: this.serializedOverlay.extendData,
        pinned: this.serializedOverlay.pinned,
        locked: this.serializedOverlay.locked,
      }
    );
    this.dbId = newDbId;
    // Re-register in overlayMeta so future operations (move, pin, delete) work
    if (this.callbacks?._setDbId) {
      this.callbacks._setDbId(this.serializedOverlay.overlayId, newDbId);
    }
  }
}
```

**Change in chartDrawingHandlers.js**:

```javascript
async function handleOverlayDelete(overlayId) {
  const overlay = deps.chart.getOverlayById(overlayId);
  if (!overlay) return;
  const dbId = deps.getDbIdForOverlay(overlayId);
  const serialized = {
    overlayId: overlay.id, overlayType: overlay.name,
    points: overlay.points, styles: overlay.styles, extendData: overlay.extendData,
  };
  const callbacks = {
    ...deps.getOverlayCallbacks(),
    _setDbId: (id, dbId) => deps.overlayMeta.setDbId(id, dbId),
  };
  const command = new DeleteDrawingCommand(
    deps.chart, drawingStore, deps.currentSymbol, deps.currentResolution,
    overlayId, dbId, serialized, callbacks
  );
  deps.commandStack.execute(command);
  deps.overlayMeta.delete(overlayId);
}
```

**Review note**: Quality reviewer caught the missing overlayMeta re-registration — without it, Fix 1's `onPressedMoveEnd` would silently skip updates for undo-deleted overlays. Architect confirmed `overrideOverlay` approach is lower risk than constructor threading.

---

## Fix 7: Selective overlayMeta clear — preserve foreign pinned entries [MEDIUM]

**Symptoms fixed**: Foreign pinned drawings become un-interactable after clear

**Root cause**: `handleClearDrawings` calls `overlayMeta.clear()` which removes ALL metadata, including entries for foreign-resolution pinned drawings that were not cleared from IndexedDB.

**Files changed**:
- `src/lib/chart/overlayMeta.js` — add `entries()` method
- `src/lib/chart/chartDrawingHandlers.js` — selective clear instead of full clear

**Change in overlayMeta.js**:

```javascript
// Add to the returned object:
entries() { return meta.entries(); },
```

**Change in chartDrawingHandlers.js**:

```javascript
async function handleClearDrawings() {
  if (deps.chart) deps.chart.removeOverlay();
  await drawingStore.clearAll(deps.currentSymbol, deps.currentResolution);
  deps.commandStack.clear();
  // Selective clear: only remove overlayMeta entries for current-resolution overlays.
  // Foreign pinned drawings use compound IDs: "${overlayId}_pinned_${resolution}"
  for (const [id] of deps.overlayMeta.entries()) {
    if (!id.includes('_pinned_')) {
      deps.overlayMeta.delete(id);
    }
  }
}
```

**Review note**: Architect recommended this approach over re-registration (avoids timing gap). Quality reviewer confirmed `overlayMeta` needs an `entries()` method.

---

## Deferred: Workspace import dbId remapping

**Deferred to separate plan**. Import path (`workspace.js:importWorkspace`) is a different user flow from the core draw/save/load/reload cycle. The fix requires capturing `drawingStore.save()` return values in the import loop and returning an overlayId→newDbId mapping. Not mixing into this plan to keep review scope tight.

---

## Implementation Order

| Step | Fix | Risk | LOC |
|------|-----|------|-----|
| 1 | Fix 1: `onPressedMoveEnd` | Low | ~5 |
| 2 | Fix 4: Forex key split | Low | ~3 |
| 3 | Fix 5: Cancel debounce on context change | Low | ~8 |
| 4 | Fix 2: Always re-sync after merge | Low | ~1 |
| 5 | Fix 6: Undo-delete callbacks + overlayMeta | Medium | ~25 |
| 6 | Fix 7: Selective overlayMeta clear | Low | ~10 |

**Total estimated**: ~52 lines changed across 5 files.

---

## Testing Checklist

After all fixes, verify each user flow:

- [ ] Draw line → reload → line appears at same position
- [ ] Draw line → drag to new position → reload → line at new position
- [ ] Draw line → undo → redo (keyboard) → reload → line persists
- [ ] Draw line → undo → redo (toolbar) → reload → line persists
- [ ] Draw line → delete → undo → line reappears with full interaction (select, drag, right-click)
- [ ] Draw line → delete → undo → drag to new position → reload → line at new position
- [ ] Draw 3 lines → switch TF → switch back → all 3 return at correct positions
- [ ] Draw line on EUR/USD → close tab → reopen → line persists
- [ ] Draw line → switch TF within 500ms → switch back → line persists
- [ ] Pin drawing → switch TF → drawing visible faded → switch back → full opacity + interactable
- [ ] Clear all → foreign pinned drawings still interactable on same TF
- [ ] Export workspace → clear → import → drawings interactable (deferred fix)

---

## Accepted Trade-offs (documented, not in scope)

1. **No retry logic on server sync failure**: `_debouncedServerSync` catches errors with `console.warn`. Drawing is safe in IndexedDB and will sync on next load. Acceptable for single-user desktop app.
2. **No conflict resolution for concurrent edits**: Server stores drawings as single JSONB blob (last-write-wins). Merge-on-load handles local vs server only. Multi-tab concurrent edits may lose changes.
3. **Command stack cleared on symbol/TF switch**: Undone drawings are not preserved across context switches. This is a design choice — the undo stack is scoped to the current chart session.
