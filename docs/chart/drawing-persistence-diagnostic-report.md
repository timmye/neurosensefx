# Drawing Persistence Diagnostic Report

**Date**: 2026-04-20
**Status**: ACTIVE — systemic issues remain

---

## Executive Summary

The drawing persistence system has undergone 6 weeks of iteration (2026-03-20 → 2026-04-17), including a full Crystal Clarity decomposition and 5 critical bug fixes. Despite this, **2 data-loss vectors remain open** and **3 reliability bugs** affect user experience. The system's dual-persistence architecture (IndexedDB local + PostgreSQL server) is sound, but edge cases in the sync layer continue to cause silent data loss.

---

## Active Bugs

### BUG-1: `sendBeacon` crashes for forex pairs [CRITICAL]

**File**: `src/lib/chart/drawingStore.js:140,174`
**Impact**: Silent data loss on tab close for all symbols containing `/`

The debounce key is built as `symbol + '/' + resolution` (line 140). In `flushPending`, this key is split back with `key.split('/')` (line 174). For forex pairs like `EUR/USD`, the key becomes `EUR/USD/4h`, which splits into `['EUR', 'USD', '4h']` — destructuring assigns `symbol = 'EUR'` and `resolution = 'USD'`. The `sendBeacon` sends to `/api/drawings/EUR/USD` (wrong endpoint), and the actual drawings for that symbol are never synced.

**Fix**: Use `key.lastIndexOf('/')` to split, or use a delimiter that cannot appear in symbol names (`|`).

### BUG-2: Toolbar redo loses IndexedDB record [CRITICAL]

**File**: `src/lib/chart/drawingCommands.js:52-65,89-100`
**Impact**: Drawing appears on chart after redo but has no database record — lost on reload

When `CreateDrawingCommand` is undone then redone via the toolbar button, `command.execute()` creates a fresh overlay with a new `overlayId`, but `this.dbId` remains null. The `redoCreateCommand` callback (which calls `persist()`) is only wired in `ChartDisplay.svelte`, not in the toolbar's direct call to `commandStack.redo()`.

**Fix**: Call `this.persist()` inside `CreateDrawingCommand.execute()` after overlay creation, or make the post-execute callback part of the command lifecycle.

### BUG-3: `DeleteDrawingCommand.undo()` drops interaction callbacks [HIGH]

**File**: `src/lib/chart/DeleteDrawingCommand.js:28-55`
**Impact**: After undo-delete, drawing cannot be selected, moved, or right-clicked

`undo()` re-creates the overlay via `chart.createOverlay()` but does not attach `onSelected`, `onDeselected`, or `onRightClick` callbacks. The overlay is visually present but interaction-dead until page reload.

**Fix**: Pass callbacks to `DeleteDrawingCommand` constructor, attach them in `undo()`.

### BUG-4: `restoreDrawings()` errors silently swallowed [HIGH]

**Files**: `src/lib/chart/reloadChart.js:32`, `src/components/ChartDisplay.svelte:261,273,404,444`
**Impact**: Drawings silently fail to appear after symbol/timeframe switch with no diagnostic output

All call sites use `.then()` without `.catch()`. If IndexedDB fails (Dexie upgrade, storage quota, corruption), the promise rejection is unhandled.

**Fix**: Add `.catch(err => console.error('[restoreDrawings] Failed:', err))` to all chains.

### BUG-5: `handleClearDrawings` orphans foreign pinned overlayMeta [MEDIUM]

**File**: `src/lib/chart/chartDrawingHandlers.js:90-95`
**Impact**: After clearing drawings, foreign pinned drawings reappear but cannot be unpin/deleted

`clearAll` deletes current-resolution drawings from IndexedDB and calls `overlayMeta.clear()`, but pinned drawings from other resolutions survive. On next restore, they re-render but their `overlayMeta` entries are gone, so `getDbIdForOverlay` returns null for all interactions.

**Fix**: Preserve `overlayMeta` entries for foreign overlays during clear, or also delete foreign pinned drawings.

---

## Previously Fixed Issues

| Date | Issue | Root Cause | Fix |
|------|-------|-----------|-----|
| 2026-04-07 | All drawings disappear on TF change | Booleans not valid IndexedDB keys | Plain symbol index + filter |
| 2026-04-07 | Pinned state lost after toggle | Server sync overwrote `pinned: true` | Skip restoreDrawings on pin toggle |
| 2026-04-07 | Pin doesn't work on first use | `persist()` missing return statement | Added `return` |
| 2026-04-16 | Drawing data loss on reload | Server returned stale data in debounce window | Merge by overlayId + updatedAt |
| 2026-04-16 | Tab close data loss | Pending syncs lost on beforeunload | sendBeacon flush |
| 2026-04-16 | Position corruption on window change | Missing overlay cleanup in handleWindowChange | Added removeOverlay/clearData |
| 2026-04-16 | Candle handlers not registered | Dropped during decomposition | Re-added setupCandleMessageHandler() |

---

## Architecture Assessment

### What works
- Dual-persistence model (IndexedDB + PostgreSQL) provides offline resilience
- Command pattern for undo/redo is well-structured
- Merge-by-timestamp prevents most stale-data overwrites
- Crystal Clarity decomposition achieved 94.4% compliance

### Systemic weakness
The **sync layer between local and server** is the primary failure domain. Every critical bug traces back to the boundary between IndexedDB and the server sync mechanism:

1. **Key encoding** — symbol/resolution composite key uses `/` which appears in forex symbols
2. **Callback wiring** — post-execute callbacks are externally managed rather than part of command lifecycle
3. **Error propagation** — sync failures are logged but never surfaced to the user or retried
4. **Concurrent writes** — server uses last-write-wins with no optimistic locking

### Backend gaps
- No input validation on drawing payloads
- No query timeouts (queries can hang indefinitely)
- No retry logic on database failures
- No WebSocket sync (HTTP only, no real-time collaboration)
- Concurrent saves use last-write-wins (no version checking)

---

## Known Open Issues (Lower Priority)

1. **Ray rendering on foreign timeframes** — Pinned ray lines appear as short segments. Root cause unknown, likely internal to KLineChart.
2. **IndexedDB tick write frequency** — `putCachedBars` fires on every tick instead of batching.

---

## Recommended Fix Priority

1. **BUG-1** (forex sendBeacon) — 1-line fix, affects all forex users
2. **BUG-2** (toolbar redo) — Small fix, silent data loss vector
3. **BUG-3** (undo-delete callbacks) — Medium fix, interaction reliability
4. **BUG-4** (error swallowing) — Trivial fix, diagnostic improvement
5. **BUG-5** (clear orphans) — Small fix, edge case reliability

---

## Files Investigated

| File | Lines | Role |
|------|-------|------|
| `src/lib/chart/drawingStore.js` | ~183 | IndexedDB CRUD + server sync + merge |
| `src/lib/chart/chartOverlayRestore.js` | ~118 | Load + merge + render drawings |
| `src/lib/chart/chartDrawingHandlers.js` | ~116 | Event handlers for CRUD operations |
| `src/lib/chart/drawingCommands.js` | ~116 | Undo/redo command pattern |
| `src/lib/chart/DeleteDrawingCommand.js` | ~55 | Delete command with async undo |
| `src/lib/chart/reloadChart.js` | ~40 | Chart teardown/reload/restore |
| `services/tick-backend/persistenceRoutes.js` | ~157 | REST endpoints for drawings |
| `services/tick-backend/db.js` | ~30 | PostgreSQL connection pool |
| `docker/postgres/init/02-auth-tables.sql` | — | Drawings table DDL |
