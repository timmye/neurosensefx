# Plan: Cross-Timeframe Drawing Visibility (Pin Mode)

**Source design:** `docs/chart/cross-timeframe-drawing-visibility.md`
**Date:** 2026-04-06
**Status:** Ready for execution

---

## Scope

Tier 1 (Pin Mode) only. A `pinned` boolean on drawings that makes them visible across all timeframes for the same symbol, rendered at 50% opacity and locked on non-origin timeframes.

**Out of scope:** Auto-propagation (Tier 2), per-drawing visibility checkboxes (Tier 3), multi-select batch pin.

---

## Implementation Steps (ordered by dependency)

### Step 1: Utility module — `src/lib/chart/styleUtils.js` (new file)

Create standalone utilities with zero dependencies on existing code. Other steps import from here.

| Function | Purpose |
|---|---|
| `fadeStyles(styles, factor)` | Recursively reduce opacity on all color properties in a KLineChart styles object |
| `fadeColor(color, factor)` | Convert hex/rgb/rgba to rgba with reduced alpha |
| `withOriginBadge(extendData, resolution)` | Prefix `[W]` / `[4H]` badge on text-based extendData |
| `isPriceOnlyOverlay(overlayType)` | Return true for horizontalRayLine, simpleTag, rulerPriceLine, fibonacciLine |

**Verification:** `fadeStyles({ color: '#FF0000', borderColor: 'rgba(0,128,255,0.8)' }, 0.5)` returns `{ color: 'rgba(255, 0, 0, 0.5)', borderColor: 'rgba(0, 128, 255, 0.5)' }`.

---

### Step 2: DrawingStore schema + query — `src/lib/chart/drawingStore.js`

**Changes:**

1. Bump Dexie schema to v2 with new compound index `[symbol+pinned]`:
   ```javascript
   db.version(2).stores({
     drawings: '++id, [symbol+resolution], [symbol+pinned], overlayType, createdAt'
   });
   ```

2. Add `loadPinned(symbol)` method:
   - Query `[symbol+pinned]` compound index for `[symbol, 1]`
   - Returns all pinned drawings for the symbol regardless of resolution

3. No data migration needed — existing drawings have `pinned = undefined` (falsy).

4. `save()` method already uses spread (`...drawing`), so callers passing `pinned: true` will persist it automatically.

**Verification:** After saving a drawing with `pinned: true`, `loadPinned('EURUSD')` returns it even when queried from a different resolution.

---

### Step 3: CreateDrawingCommand — `src/lib/chart/drawingCommands.js`

**Change:** `CreateDrawingCommand.persist()` passes `pinned` field through to `drawingStore.save()`.

Currently the persist method builds a `data` object with explicit fields. Add:
```javascript
if (this.pinned != null) data.pinned = this.pinned;
```

Add `pinned` to the constructor signature (default `false`).

**Note:** For Tier 1, new drawings are always created with `pinned: false`. The pin toggle happens via context menu (Step 6). But having the field in the command future-proofs the command pattern.

---

### Step 4: ChartDisplay restoreDrawings — `src/components/ChartDisplay.svelte`

This is the core rendering change. Modify `restoreDrawings(symbol, resolution)`:

**Current flow:**
```
load(symbol, resolution) → createOverlay for each → overlayDbIdMap.set()
```

**New flow:**
```
1. load(symbol, resolution)           → local drawings
2. loadPinned(symbol)                 → all pinned for symbol
3. Separate pinnedForeign (res !== current) from pinnedLocal (res === current)
4. Merge local + pinnedLocal (dedup by dbId)
5. Render merged-local at full opacity with callbacks (existing logic)
6. Render pinnedForeign with:
   - compound ID:  "{overlayId}_pinned_{resolution}"
   - fadeStyles(styles, 0.5)
   - withOriginBadge(extendData, resolution)
   - lock: true (no callbacks)
   - For price-only overlays: adjust point.timestamp to visible range
7. Track foreign IDs in new pinnedOverlayMap
```

**Additional changes in ChartDisplay:**

- Add `let pinnedOverlayMap = new Map()` alongside `overlayDbIdMap`
- Clear `pinnedOverlayMap` in `restoreDrawings()` before step 6
- Clear `pinnedOverlayMap` in `handleResolutionChange()` alongside `overlayDbIdMap.clear()`
- Import `fadeStyles`, `withOriginBadge`, `isPriceOnlyOverlay` from styleUtils

**Price-only timestamp fix:** For `isPriceOnlyOverlay()` types where `isForeign`, override the point's timestamp to `chart.getVisibleRange().from` while preserving the price. This ensures horizontal lines always render.

---

### Step 5: OverlayContextMenu — `src/components/OverlayContextMenu.svelte`

**Changes:**

1. Add new prop: `export let isPinned = false`

2. Add new button after Lock/Unlock:
   ```svelte
   <button class="menu-item" on:click={handleTogglePin}>
     {isPinned ? 'Unpin' : 'Pin as Key Level'}
   </button>
   ```

3. Add handler:
   ```javascript
   function handleTogglePin() {
     dispatch('togglePin');
     dispatch('close');
   }
   ```

4. Update ChartDisplay to wire the new event:
   - Pass `isPinned` prop (look up from overlayDbIdMap → drawing record)
   - Handle `on:togglePin` event: call `drawingStore.update(dbId, { pinned: !isPinned })`
   - After toggle, call `restoreDrawings()` to re-render (simplest approach; avoids complex per-overlay fade toggling)

---

### Step 6: ChartDisplay context menu wiring — `src/components/ChartDisplay.svelte`

Wire the new `togglePin` event from OverlayContextMenu:

1. Track `isOverlayPinned` state variable (like existing `isOverlayLocked`)
2. In `getOverlayCallbacks().onRightClick`: look up `pinned` from the drawing record
3. Pass `isPinned={isOverlayPinned}` to OverlayContextMenu
4. `handleContextMenuTogglePin()`: update drawingStore, then call `restoreDrawings()` to refresh

---

## Files Changed Summary

| File | Change Type | Lines Est. |
|---|---|---|
| `src/lib/chart/styleUtils.js` | **New** | ~60 |
| `src/lib/chart/drawingStore.js` | Modify (schema + method) | ~15 |
| `src/lib/chart/drawingCommands.js` | Modify (pass pinned) | ~3 |
| `src/components/ChartDisplay.svelte` | Modify (restoreDrawings, context menu) | ~60 |
| `src/components/OverlayContextMenu.svelte` | Modify (pin button) | ~15 |

**Files NOT changed (confirmed):**
- `customOverlays.js` — overlay registrations unchanged
- `persistenceRoutes.js` — JSONB handles `pinned` field automatically, no new endpoints
- `02-auth-tables.sql` — no schema change
- Server-side — no new endpoints for Tier 1

---

## Execution Order

```
Step 1 (styleUtils.js)         ← no dependencies
Step 2 (drawingStore.js)       ← no dependencies
Step 3 (drawingCommands.js)    ← depends on Step 2 conceptually
Step 4 (ChartDisplay.svelte)   ← depends on Steps 1, 2
Step 5 (OverlayContextMenu)    ← no dependencies
Step 6 (ChartDisplay wiring)   ← depends on Steps 4, 5
```

Steps 1, 2, 5 can be done in parallel. Steps 4 and 6 are sequential.

---

## Testing Strategy

1. **Manual smoke test:** Draw a horizontalRayLine on Weekly, pin it, switch to 4H — it should appear faded and locked.
2. **Pin/Unpin cycle:** Pin a drawing, unpin it, switch TFs — it disappears from non-origin TFs.
3. **Lock enforcement:** Right-click a faded pinned drawing on a non-origin TF — no context menu should appear.
4. **Price-only rendering:** Pinned horizontal lines from Weekly render on 1m chart regardless of timestamp range.
5. **ID collision:** Two drawings with same overlayId on different TFs — compound IDs prevent collision.
6. **Server sync:** After pinning, reload page — pinned state persists through server sync.

---

## Risks / Open Items

- **Dexie v1→v2 migration:** Dexie handles additive schema changes gracefully, but test that existing drawings aren't lost on upgrade.
- **`chart.getVisibleRange()` timing:** When `restoreDrawings` runs during initial load, the chart may not have data yet. Guard with null check on visible range.
- **Compound ID length:** KLineChart overlay IDs — verify no length limit issues with `_pinned_W` suffix.
