# Drawing System Architecture

## Purpose

Single coordinator per chart instance owns all drawing state. External code never touches drawing internals directly.

## Design Principles

1. **Single ownership** — Only `drawingCoordinator` mutates drawing state. No external module imports from the internal modules it encapsulates.
2. **Race-safe operations** — All methods that clear, restore, or migrate state capture symbol/resolution at call time. Never re-read live closure values mid-operation.
3. **Observable** — Key failures surface through a central `onLog` hook instead of scattered `console.warn`.
4. **Cancellable** — In-flight async operations (restore, sync) can be cancelled when the user switches symbols, preventing stale overlays.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 drawingCoordinator.js                    │
│                                                         │
│  INTERNAL STATE (private, encapsulated):                │
│  ┌───────────────────────────────────────────────────┐  │
│  │ commandStack: DrawingCommandStack                 │  │
│  │ overlayMeta: Map<id, {pinned}>  (sync cache)      │  │
│  │ selectedOverlayId: string | null                  │  │
│  │ selectedOverlayIdStore: Writable<string|null>    │  │
│  │ contextMenuState: Writable<{visible,x,y,overlayId}>│  │
│  │ contextState: Writable<{locked, pinned}>          │  │
│  │ chartInstance: KLineChart | null                  │  │
│  │ abortController: AbortController                  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  PERSISTENCE (delegated, NOT owned):                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ drawingStore.js — IndexedDB + server sync          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  PUBLIC API:                                            │
│    handleDrawingCreated(event)                          │
│    handleOverlayDelete(overlayId)                       │
│    toggleLock(overlayId): Promise<boolean>              │
│    togglePin(overlayId): Promise<boolean>               │
│    undo(): Promise<void>                                │
│    redo(): Promise<Command|void>                        │
│    canUndo / canRedo: DerivedStore<boolean>             │
│    selectedOverlayId: Writable<string|null>            │
│    contextMenuState: Writable<ContextMenuState>         │
│    contextState: Writable<{locked, pinned}>             │
│    setChart(chart): void                                │
│    resetForNewSymbol(): void                            │
│    restoreDrawings(symbol, resolution): Promise<void>   │
│    clearDrawings(symbol, resolution): Promise<void>     │
│    destroy(): void                                      │
│    onLog: (level, message, detail?) => void             │
└─────────────────────────────────────────────────────────┘
```

### Why overlayMeta stays as an internal Map

The original analysis suggested replacing the overlayMeta Map with async IndexedDB reads since the `pinned` field is persisted in every record. This is wrong for two reasons:

1. **Synchronous access required** — Context menu rendering and interaction callbacks need immediate pin state. Making these code paths async would require restructuring callback signatures across KLineChart integration points.
2. **Performance under interaction** — The cache is checked on every overlay interaction event. Even with <100 overlays, adding async round-trips per interaction is unnecessary latency.

The coordinator keeps the Map internally as a private sync cache, populated during `restoreDrawings()` and updated on `togglePin()`. External code never sees it.

### Why abort/cancellation matters

Without cancellation, rapid symbol switches cause interleaved operations:

- User is on EUR/USD, triggers `restoreDrawings('EUR/USD', '1H')`
- Switches to GBP/JPY before restore completes
- `resetForNewSymbol()` fires, then `restoreDrawings('GBP/JPY', '1H')` starts
- First restore completes, overlays appear on the wrong chart

The coordinator holds an `AbortController` that is replaced on every `resetForNewSymbol()`. All async operations check `signal.aborted` before mutating state.

### Why deletion semantics must be uniform

`tombstone` vs `hard delete` inconsistency means:
- Single delete → `remove()` sets `deletedAt` → server merge recognizes it as locally deleted
- Clear all → `clearAll()` hard-deletes from IndexedDB → server merge sees no record → restores the drawing

`clearAll()` must tombstone instead of hard-delete so server merge behavior is consistent. The coordinator enforces this.

### Why DeleteDrawingCommand.undo() needs validation

`CreateDrawingCommand.execute()` validates points (clamps `dataIndex`, drops invalid coordinates). But `DeleteDrawingCommand.undo()` passes `serializedOverlay` fields directly to `chart.createOverlay()` with zero validation. If the serialized data is malformed (e.g., from a corrupted IndexedDB record), the undo crashes.

The coordinator's undo path must validate before recreating overlays.

### Why the coordinator serializes pinned/locked in delete

When a drawing is deleted and then undone, `handleOverlayDelete` serializes `overlayId, overlayType, points, styles, extendData` but NOT `pinned` or `locked`. After undo, the drawing reappears unpinned and unlocked regardless of its prior state. The coordinator must include `pinned` and `locked` in the serialized snapshot so undo is a true reversal.

## Module Responsibilities

### `drawingCoordinator.js` — Single entry point

Factory function. Owns all state listed above. Encapsulates restore/render logic, interaction registration, and undo/redo orchestration.

Internal logic absorbed from:
- **overlayMeta** — 20-line Map cache. Became private helper functions (overlayMetaGet, overlayMetaSetPinned, overlayMetaGetPinned, overlayMetaDelete, overlayMetaClear).
- **chartOverlayRestore** — `mergeDrawings()`, `renderLocalDrawings()`, `renderForeignDrawings()`, `restoreDrawings()` became private methods. Includes retry logic with exponential backoff and faded style rendering for cross-resolution pinned drawings (~170 lines).
- **chartDrawingHandlers** — Handler orchestration became coordinator methods. This includes interaction registration with async promise chaining, redo re-registration, and foreign pinned drawing preservation after clear (~110 lines).

### `drawingCommands.js` — Command stack (imported, unchanged interface)

Exports `DrawingCommandStack`, `CreateDrawingCommand`. Tests import these directly — the coordinator preserves this export path.

### `DeleteDrawingCommand.js` — Delete command (updated)

Added validation in `undo()` for `serializedOverlay` fields (overlayType, overlayId, points must be array). Fail safely (log + no-op) if data is incomplete. Constructor now accepts and stores `pinned` and `locked` from the serialized snapshot. `undo()` restores locked state via `overrideOverlay({ lock: true })`.

### `drawingStore.js` — Persistence layer (targeted changes)

Interface unchanged. Internal changes:
1. `clearAll()` uses tombstoning instead of hard delete — loops records and sets `deletedAt: Date.now()` via `update()`.
2. Added `evictStaleEntries(symbol)` that clears `saveDebounceTimers`, `_lastSyncData`, `_versionCache` entries for the symbol prefix.
3. Added `setOnLog(fn)` — centralized logging hook. All `console.warn('[DrawingStore] ...')` calls replaced with `this._onLog?.('warn', ...)`.

### Overlay registration files (out of scope for coordinator, potential future merge)

These KLineChart overlay type registrations are separate from state management and remain independent:

| File | Lines | Purpose |
|------|-------|---------|
| `overlaysAnnotations.js` | 37 | Annotation overlay registration |
| `overlaysChannels.js` | 42 | Channel overlay registration |
| `overlaysIndicators.js` | 19 | Indicator overlay registration |
| `overlaysPriceLines.js` | 25 | Price line overlay registration |
| `overlaysShapes.js` | 36 | Shape overlay registration |

Each follows the same pattern (<42 lines). A future cleanup could merge into a single `overlayRegistrations.js` but this is independent of the coordinator work.

## ChartDisplay.svelte Integration

Before: 5 drawing module imports, ~140 lines of state declarations and factory wiring.

After:
```svelte
import { createDrawingCoordinator } from '../lib/chart/drawingCoordinator.js';
import { drawingStore } from '../lib/chart/drawingStore.js';

let coordinator;
let canUndo = $state(false);
let canRedo = $state(false);
// ... other reactive state bridged from coordinator stores
```

All handler calls collapse to direct coordinator method calls. The `initializeChart()` helper (shared between onMount and un-minimize) calls `coordinator.restoreDrawings(symbol, resolution)` after chart setup.

**Note**: `drawingStore` import is retained because: (a) it's passed to `createDrawingCoordinator({ drawingStore })` as a constructor dependency, and (b) `drawingStore.cancelPendingSync()` is called directly in symbol/resolution handlers as a store-level operation outside coordinator scope.

**Note**: ChartDisplay uses `setupCoordinationStores()`/`unsubCoordinationStores()` functions to subscribe to coordinator's Svelte stores (canUndo, canRedo, selectedOverlayId, contextMenuState, contextState) and bridge them to component reactive variables. This adds ~10 lines of subscription boilerplate beyond the plan's ~15 estimate.

### Teardown: single call per site

Every chart reset location (resolution change, symbol change, window change) calls exactly one method:
```js
coordinator?.resetForNewSymbol();
```

This replaces the duplicated pattern that was copy-pasted across three locations.

### ChartToolbar decoupling

ChartToolbar no longer receives `commandStack` as a prop. Undo/redo/clear actions dispatch Svelte events (`on:undo`, `on:redo`, `on:clearDrawings`) which ChartDisplay handles via coordinator methods.

### selectedOverlayIdStore

The coordinator exposes `selectedOverlayId` as a writable Svelte store (not just a plain variable). This was needed because ChartDisplay's keyboard Delete/Backspace handlers require reactive access to the currently selected overlay ID. Previously this was a plain `let` variable in ChartDisplay with direct access from `getOverlayCallbacks`; after moving callbacks into the coordinator, the store bridge was necessary.

## Absorbed Modules (deleted)

The following modules were absorbed into `drawingCoordinator.js` and deleted:

| File | Lines absorbed | What moved |
|------|----------------|------------|
| `overlayMeta.js` | ~20 | Map cache → private helper functions |
| `chartOverlayRestore.js` | ~170 | mergeDrawings, renderLocalDrawings, renderForeignDrawings, restoreDrawings with retry |
| `chartDrawingHandlers.js` | ~110 | handleDrawingCreated, handleOverlayDelete, toggleLock, togglePin, registerOverlayForInteraction, handleClearDrawings |

## Test Contract

### Public API — must remain importable

These exports are used by existing tests and must not change signature:

| Export | Source | Used by |
|--------|--------|---------|
| `DrawingCommandStack` | `drawingCommands.js` | `drawingCommands.test.js` (6 tests) |
| `CreateDrawingCommand` | `drawingCommands.js` | future coordinator tests |
| `drawingStore` (via `window.drawingStore`) | `drawingStore.js` | E2E tests |

### Internal to coordinator — no external imports allowed

- overlayMeta Map logic
- restore/render/merge helpers
- interaction registration
- handler orchestration

## Testing Strategy

### Test runner and environment

- **Vitest** in node environment — no DOM, no canvas, no live services
- KLineChart mock at `__tests__/__mocks__/klinecharts.js` resolves imports
- Mock chart factory at `__tests__/helpers/chartHarness.js` provides spy-tracked chart methods
- Mock store factory at `__tests__/helpers/drawingStoreHarness.js` decouples from IndexedDB/Dexie

### Existing tests (118 passing, unaffected by refactor)

| Suite | Tests | Scope | Stability during refactor |
|-------|-------|-------|--------------------------|
| `drawingCommands.test.js` | 6 | Undo/redo stack, eviction, error recovery, clear | **Stable** — coordinator wraps the stack, tests import directly |
| `drawingPersistence.test.js` | 12 | Key splitting, merge-by-timestamp, sync cache, 409 conflict | **Stable** — tests inline `mergeByTimestamp`; coordinator absorbs it but test logic still valid |
| `drawingVersioning.test.js` | 6 | Server-side optimistic locking (HTTP, requires backend) | **Stable** — API contract, unrelated to coordinator |
| `xAxisCustom.test.js` | 54 | X-axis tick generation | **Stable** — unrelated |
| `reconcile.test.js` | 15 | Bar/tick reconciliation | **Stable** — unrelated |
| `styleUtils.test.js` | 6 | Color fade utilities | **Stable** — unrelated |
| `pricePrecision.test.js` | 19 | Price rounding | **Stable** — unrelated |

### New tests

#### `drawingCoordinator.test.js` (13 tests)

Tests the coordinator factory using `createMockChart()` and `createMockDrawingStore()`.

| Test area | Tests | What to verify |
|-----------|-------|----------------|
| **resetForNewSymbol** | 2 | Clears commandStack, overlayMeta, selectedOverlayId, contextMenuState; cancels pending abort controller |
| **handleOverlayDelete serialization** | 1 | Serialized snapshot includes `pinned` and `locked` fields |
| **clearDrawings race safety** | 1 | Captures symbol/resolution at call time; switching symbol mid-operation does not clear wrong target |
| **clearDrawings tombstoning** | 1 | Calls `drawingStore.clearAll()` which tombstones rather than hard-deletes |
| **toggleLock** | 1 | Toggles lock state and updates store |
| **togglePin** | 1 | Toggles pin state and updates store |
| **restoreDrawings** | 3 | Load+render, abort safety, max attempts warning |
| **destroy** | 1 | Clears all internal state and nulls chart |
| **overlayMeta absorbed** | 1 | Pinned state tracking works through coordinator |
| **DeleteDrawingCommand.undo validation** | 1 | Incomplete serializedOverlay logs error and no-ops instead of crashing |

#### `drawingStoreHarness.js` (mock factory)

Mock factory for `drawingStore` interface. Provides tracked spies for `save`, `remove`, `clearAll`, `load`, `loadPinned`, `update`, `cancelPendingSync`, `evictStaleEntries`. Returns in-memory data without IndexedDB. Tombstone-based soft deletes in `remove()` and `clearAll()`.

#### Deleted tests

`overlayMeta.test.js` (6 tests) — behavior covered by coordinator tests (resetForNewSymbol, togglePin, overlayMeta absorbed).

## File Changes Summary

| File | Action |
|------|--------|
| `drawingCoordinator.js` | **Created** — unified factory (382 lines) |
| `overlayMeta.js` | **Deleted** — absorbed into coordinator |
| `chartOverlayRestore.js` | **Deleted** — absorbed into coordinator |
| `chartDrawingHandlers.js` | **Deleted** — absorbed into coordinator |
| `drawingCommands.js` | **Unchanged** — interface preserved |
| `DeleteDrawingCommand.js` | **Updated** — add validation in undo, serialize pinned/locked (76 lines) |
| `drawingStore.js` | **Updated** — tombstoning in clearAll, eviction helper, logging hook (350 lines) |
| `ChartDisplay.svelte` | **Updated** — replace 4 imports with coordinator, unify teardown |
| `ChartToolbar.svelte` | **Updated** — event dispatch instead of direct commandStack calls |
| `reloadChart.js` | **Updated** — accept `resetDrawings` function |
| `drawingCoordinator.test.js` | **Created** — coordinator unit tests (247 lines, 13 tests) |
| `drawingStoreHarness.js` | **Created** — mock drawingStore factory (82 lines) |
| `overlayMeta.test.js` | **Deleted** — assertions migrated to coordinator tests |

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Drawing subsystem files | 6 (commands, delete, store, meta, restore, handlers) | 4 (coordinator, commands, delete, store) |
| Duplicated teardown sites | 3 copy-pasted blocks | 0 (single method, 3 call sites) |
| Cross-module mutation of drawing state | Multiple modules touch overlayMeta/commands | 0 (coordinator owns all) |
| Race conditions in clear/restore | Unguarded | 0 (captured context + abort tokens) |
| Drawing-specific unit tests | 12 (commands 6 + meta 6) | 13 (coordinator absorbs meta + adds coverage) |
| Test runner dependency | Vitest only, no live services | Vitest only, no live services |
| Total test count | 118 | 125 |
