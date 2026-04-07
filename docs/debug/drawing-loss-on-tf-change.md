# Debug: Cross-Timeframe Pin Issues

**Date:** 2026-04-07
**Status:** ACTIVE — pin doesn't work on first use

## Resolved Issues

### Issue 1: All drawings disappeared on timeframe change
**Root cause:** Booleans not valid IndexedDB keys. `[symbol+pinned]` compound index with `pinned=true` caused `DataError`, silently killing `restoreDrawings()`.
**Fix:** Plain `symbol` index + `.and(d => d.pinned === true)` filter.

### Issue 2: Pinned state lost after toggle
**Root cause:** `handleContextMenuTogglePin` called `restoreDrawings()` which triggered `load()` from server — stale data overwrote `pinned: true` before server sync completed.
**Fix:** Skip `restoreDrawings()` in pin toggle; just update `overlayPinnedMap` directly.

### Issue 3: Faded 50% style not applied
**Root cause:** Most overlays store `{}` as styles. `fadeStyles({}, 0.5)` returned `{}`, so chart defaults applied at full opacity.
**Fix:** `getFadedStyles()` provides pre-faded defaults for all KLineChart nested style keys.

---

## Issue 4 (RESOLVED): Pin doesn't work on first use

**Symptom:** User must switch timeframe and come back before pin works. Pin toggle appears to do nothing on first attempt.

**Root cause:** `CreateDrawingCommand.persist()` is an `async` function that sets `this.dbId` internally but never returns it. The function implicitly resolves to `undefined`. In `handleDrawingCreated`, `command.persist().then(dbId => ...)` receives `undefined` as `dbId`, so `overlayDbIdMap` stores `undefined` as the value. When `handleContextMenuTogglePin` looks up the dbId, it gets `undefined` → aborts silently.

After a TF round-trip, `restoreDrawings` reads `drawing.id` directly from IndexedDB (which has the correct auto-incremented ID), so pin works.

**Fix:** Add `return` to `persist()`:
```javascript
// Before (broken):
this.dbId = await this.store.save(this.symbol, this.resolution, data);

// After (fixed):
return this.dbId = await this.store.save(this.symbol, this.resolution, data);
```

**File:** `src/lib/chart/drawingCommands.js:91`

### Failed fix attempts

| # | Fix | Result | Why it failed |
|---|-----|--------|---------------|
| 1 | `loadPinned` query `[symbol, 1]` → `[symbol, true]` | No change | Wrong problem entirely |
| 2 | `load()` guard for empty server arrays | No change | Wrong problem entirely |
| 3 | Combined load guard | No change | Wrong problem entirely |
| 4 | Removed `[symbol+pinned]` compound index | Fixed drawing loss | Didn't fix pin |
| 5 | `handleContextMenuTogglePin` skip restoreDrawings | Fixed pin state loss | Didn't fix first-use pin |
| 6 | `getFadedStyles()` for empty styles | Fixed fade rendering | Didn't fix pin |
| 7 | Made `handleDrawingCreated` async + await persist | **Made it worse** | Broke Svelte event dispatch |
| 8 | Reverted to `.then()`, moved callbacks before persist | No change | Timing wasn't the issue |
| 9 | Store `_dbId` on overlay extendData as fallback | No change | Fallback also got `undefined` from same broken `persist()` |
| 10 | Diagnostic logging → found `persist()` returns `undefined` | **ROOT CAUSE FOUND** | `persist()` sets `this.dbId` but never `return`s it |

### What we know
- After TF round-trip, pin works. `restoreDrawings` is the key difference.
- `restoreDrawings` populates `overlayDbIdMap` synchronously from IndexedDB.
- `handleDrawingCreated` populates it asynchronously via `.then()`.
- But persist should resolve in milliseconds — user takes seconds to right-click.
- The bug is CONSISTENT, not intermittent — rules out pure timing race.
- Drawings themselves work fine — they persist, render, and survive TF switches.
- Only the PIN operation fails on first use.

### Findings
- **`persist()` missing return** (drawingCommands.js:91): `this.dbId = await this.store.save(...)` sets the instance property but the async function resolves to `undefined` without a `return` statement. The `.then(dbId => ...)` callback receives `undefined`, storing `undefined` in `overlayDbIdMap` and `_dbId` fallback.
- KLineChart `overrideOverlay` correctly handles callbacks (onSelected, onDeselected, onRightClick) — selective merge works.
- KLineChart `createOverlay` with existing ID returns null — handled correctly by `restoreDrawings` which runs after `removeOverlay()`.
- Server persistence preserves ALL drawing fields (pinned, locked, overlayId) via JSONB — no field stripping.
