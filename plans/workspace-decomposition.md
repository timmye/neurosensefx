# workspace.js Decomposition Plan

## 1. Overview & Goals

**Goal**: Split the 657-line `workspace.js` god store into focused modules, each with a clear responsibility boundary, while preserving all existing behavior and keeping the system fully functional at every intermediate commit.

**Why**: `workspace.js` is the single biggest multiplier on future change cost. Every new display feature reaches into it. Decomposing it unlocks independent development of display features, marker features, and persistence concerns.

**Scope**: §9.3 of the frontend architecture assessment — the P1 structural refactor of `src/stores/workspace.js`.

**Constraints**:
- Small userbase, no CI gate — regressions are caught by eye/chat, not by a test suite
- 20 test files depend on `window.workspaceStore` / `window.workspaceActions` (50+ individual calls)
- Persistence dual-targets localStorage and server API when authenticated (DL-007)
- Import/export touches displayStore, markerStore, drawingStore, and localStorage directly

---

## 2. Current State Analysis

### 2.1 workspace.js structure (657 LOC)

| Section | Lines | Contents |
|---|---|---|
| Imports + `compareSemver` | 1–16 | `svelte/store`, `authStore`, `drawingStore` |
| State + store creation | 18–42 | `initialState`, `workspaceStore` writable, `getState()` |
| `updateDisplay` helper | 44–55 | Internal mutation helper |
| Display actions | 57–235 | `addDisplay`, `addPriceTicker`, `removeDisplay`, `updateDisplay`, `updatePosition`, `updateSize`, `bringToFront`, `selectNextDisplay`, `toggleMarketProfile`, `addChartDisplay`, `updateChartDisplay`, `getChartDisplay` |
| Marker actions | 237–303 | `addPriceMarker`, `removePriceMarker`, `updatePriceMarker`, `selectPriceMarker`, `clearPriceMarkerSelection`, `setDisplayPriceMarkers` |
| Import/Export | 307–468 | `importWorkspace`, `exportWorkspace` (includes `compareSemver` usage, drawingStore coordination) |
| Headlines | 501–514 | `toggleHeadlines`, `updateHeadlinesPosition`, `updateHeadlinesSize` |
| Selection helpers | 516–524 | `getDisplay`, `getChartDisplay` |
| Persistence | 528–641 | `loadFromStorage`, `initPersistence`, `flushPending`, `loadFromLocalStorage` |
| Exports + window exposure | 643–657 | Named exports + `window.*` for tests |

### 2.2 Consumers (29 files)

**Components (7)**:

| File | What it imports | What it uses |
|---|---|---|
| `Workspace.svelte` | `workspaceStore`, `workspaceActions`, `workspacePersistence` | Full store sub, all display/headline actions, persistence lifecycle, import/export |
| `ChartDisplay.svelte` | `workspaceActions`, `workspaceStore` | `updateDisplay`, `removeDisplay`, `bringToFront`, `setSelectedDisplay`, reactive `.displays.get()` |
| `PriceTicker.svelte` | `workspaceStore`, `workspaceActions` | `.selectedDisplayId`, `updatePosition`, `bringToFront`, `removeDisplay` |
| `FxBasketDisplay.svelte` | `workspaceActions`, `workspaceStore` | `updatePosition`, `updateSize`, `bringToFront`, `setSelectedDisplay`, `removeDisplay` |
| `FloatingDisplay.svelte` | `workspaceActions`, `workspaceStore` | `removeDisplay`, `setSelectedDisplay`, `bringToFront`, `updatePosition`, `updateSize`, `toggleMarketProfile` |
| `HeadlinesWidget.svelte` | `workspaceActions`, `workspaceStore` | `.headlinesVisible`, `.headlinesPosition`, `.headlinesSize`, headlines actions |
| `PriceMarkerManager.svelte` | `workspaceStore`, `workspaceActions` | `.displays.get()`, `setDisplayPriceMarkers` |

**Libs (3)**:

| File | What it imports | What it uses |
|---|---|---|
| `chartLifecycle.js` | `workspaceActions` (parameter) | `updatePosition`, `updateSize`, `bringToFront` (passed as arg, not direct import) |
| `priceMarkerInteraction.js` | `workspaceActions`, `workspaceStore` | Marker actions: `addPriceMarker`, `removePriceMarker`, `updatePriceMarker`, `selectPriceMarker`, `clearPriceMarkerSelection`. Non-reactive `getState()` |
| `priceMarkerDropdown.js` | `workspaceActions` | `removePriceMarker` only |

**Tests (20)** — all via `window.workspaceStore` / `window.workspaceActions`:

| Directory | Files | Primary patterns |
|---|---|---|
| `src/tests/` | `p0-connection-verification.spec.js`, `p1-connection-verification.spec.js`, `market-profile-comprehensive.spec.js` | `getState().displays` checks, existence checks |
| `src/tests/e2e/` | 14 files (chart-display, comprehensive-llm-workflow, fx-basket, fx-basket-live-data, headlines-workflow, headlines-widget, message-coordination, prevDay-ohlc-simple, price-markers-import, price-ticker, previous-day-ohlc, server-persistence, workspace-drawing-persistence, backend-reinit, batched-import-rate-limit) | `workspaceActions.addDisplay()`, `workspaceActions.addChartDisplay()`, `workspaceActions.exportWorkspace()`, `workspaceActions.importWorkspace()`, `workspaceStore.getState().displays` |
| `tests/e2e/` | `connection-stress.spec.js`, `reconnect-reliability.spec.js` | `window.workspaceActions` existence checks |

### 2.3 Known coupling points

1. **Persistence subscribes to `workspaceStore`** — `initPersistence()` calls `workspaceStore.subscribe(state => ...)` to sync to localStorage + server. After split, it must subscribe to display state changes.
2. **Import/export writes to localStorage directly** — Lines 328–343 write price markers to localStorage, bypassing the persistence layer. Assessment recommends fixing this during the split.
3. **`beforeunload` sendBeacon** reads `_lastWorkspaceData` (module-scoped) to flush. After split, it must read from multiple stores.
4. **`chartLifecycle.js` takes `workspaceActions` as a function parameter** — not a direct import. Easy to update.
5. **Auth coupling** — `loadFromStorage` and `initPersistence` both check `get(authStore).isAuthenticated`.
6. **`priceMarkerPersistence.js`** is a separate file that handles marker localStorage + server sync. Currently imported by `PriceMarkerManager.svelte` and `FloatingDisplay.svelte` indirectly.

---

## 3. Target Architecture

### 3.1 Store responsibilities

```
┌─────────────────────────────────────────────────────┐
│                    workspace.js                      │
│              (facade — re-exports only)               │
│                                                      │
│   window.workspaceStore  →  delegates to stores      │
│   window.workspaceActions → delegates to actions     │
│   window.workspacePersistence → delegates to persist  │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────┐ ┌────────────┐ ┌──────────────────┐
│displayStore │ │markerStore │ │workspaceStore    │
│   .js       │ │   .js      │ │  (slimmed).js    │
│             │ │            │ │                  │
│ State:      │ │ Actions:   │ │ State:           │
│  displays   │ │  marker    │ │  headlines*      │
│  nextZIndex │ │  CRUD      │ │                  │
│  selectedId │ │ + absorbs  │ │ Persistence:     │
│  chartGhost │ │  price     │ │  load/save/flush │
│  config     │ │  Marker    │ │                  │
│             │ │  Persist.  │ │ Import/Export:   │
│ Actions:    │ │            │ │  workspace I/O   │
│  display    │ │ (no own    │ │                  │
│  CRUD +     │ │  state —   │ │ Headlines:       │
│  selection  │ │  operates  │ │  toggle/position │
│  + z-index  │ │  on        │ │  /size           │
│             │ │  display   │ │                  │
│             │ │  Store)    │ │ Imports:         │
│             │ │            │ │  displayStore,   │
│             │ │            │ │  markerStore,    │
│             │ │            │ │  authStore,      │
│             │ │            │ │  drawingStore    │
└─────────────┘ └────────────┘ └──────────────────┘
```

### 3.2 Module specification

#### `displayStore.js` (~230 LOC)

**State shape**:
```js
{
  displays: Map,       // id → display object
  nextZIndex: 1,
  selectedDisplayId: null,
  chartGhost: null,
  config: {
    defaultSize: { width: 2000, height: 680 },
    defaultPosition: { x: 100, y: 100 }
  }
}
```

**Exports**: `displayStore` (writable), `displayActions`

**Actions** (from workspace.js lines 57–235 + 305 + 516–524):
- `setSelectedDisplay(id)`
- `clearSelectedDisplay()`
- `addDisplay(symbol, position, source)`
- `addPriceTicker(symbol, position, source)`
- `removeDisplay(id)` — includes chart ghost logic
- `updateDisplay(id, updates, extra)`
- `updatePosition(id, position)`
- `updateSize(id, size)`
- `bringToFront(id)`
- `selectNextDisplay(direction)`
- `toggleMarketProfile(id)`
- `addChartDisplay(symbol, position, source)` — includes chart ghost restore
- `updateChartDisplay(id, updates)`
- `getChartDisplay()`
- `getDisplay(id)`

**Internal helpers**: `updateDisplay()` (currently at lines 44–55)

**Imports**: `svelte/store` only. Zero dependencies on other stores.

#### `markerStore.js` (~180 LOC, absorbs `priceMarkerPersistence.js`)

**No own writable state** — operates on `displayStore`.

**Exports**: `markerActions`, `loadMarkers`, `saveMarkers`, `mergeWithPersisted`, `getStorageKey`

**Marker actions** (from workspace.js lines 237–303):
- `addPriceMarker(displayId, marker)`
- `removePriceMarker(displayId, markerId)`
- `updatePriceMarker(displayId, markerId, updates)`
- `selectPriceMarker(displayId, markerId)`
- `clearPriceMarkerSelection()`
- `setDisplayPriceMarkers(displayId, markers)`

**Persistence** (absorbed from `priceMarkerPersistence.js`):
- `loadMarkers(symbol)` — server-first with localStorage fallback
- `saveMarkers(symbol, markers)` — localStorage + debounced server sync
- `mergeWithPersisted(symbol, newMarkers)` — merge + save
- `getStorageKey(symbol)` — key format: `price-markers-{SYMBOL}`

**Imports**: `displayStore` (from `./displayStore.js`), `authStore` (from `./authStore.js`), `svelte/store` (for `get()`)

#### `workspaceStore.js` (slimmed, ~200 LOC)

**State shape**:
```js
{
  headlinesVisible: false,
  headlinesPosition: { x: 20, y: 20 },
  headlinesSize: { width: 500, height: 600 }
}
```

**Exports**: `workspaceStore` (writable), `workspaceActions`, `workspacePersistence`

**Headlines actions**:
- `toggleHeadlines()`
- `updateHeadlinesPosition(position)`
- `updateHeadlinesSize(size)`

**Persistence** (from workspace.js lines 528–641):
- `loadFromStorage()` — server-first, falls back to localStorage. Restores display state by calling `displayStore.update()` + restores own headlines state.
- `initPersistence()` — subscribes to `displayStore` for display sync + own store for headlines sync. Debounced server push.
- `flushPending()` — sendBeacon with combined data from displayStore + own headlines state.
- `loadFromLocalStorage()` — internal, localStorage-only fallback.

**Import/Export** (from workspace.js lines 307–468):
- `importWorkspace(file)` — reads file, restores displays to displayStore, restores markers via markerStore, restores drawings via drawingStore.
- `exportWorkspace()` — reads from displayStore + localStorage markers + drawingStore, produces JSON download.
- `compareSemver()` — internal utility, moved here (only used by importWorkspace).

**Imports**: `displayStore`, `displayActions` (from `./displayStore.js`), `markerActions` (from `./markerStore.js`), `authStore` (from `./authStore.js`), `drawingStore` (from `../lib/chart/drawingStore.js`), `svelte/store`

**Module-scoped state**: `_lastWorkspaceData` (for sendBeacon), `loadFromLocalStorage()` helper

#### `workspace.js` (facade, ~30 LOC — temporary)

Re-exports everything and maintains `window.*` exposure for backward compatibility.

```js
// Re-exports
export { displayStore, displayActions } from './displayStore.js';
export { markerActions, loadMarkers, saveMarkers, mergeWithPersisted, getStorageKey } from './markerStore.js';
export { workspaceStore, workspaceActions, workspacePersistence } from './workspaceStore.js';

// Backward-compatible window exposure
if (typeof window !== 'undefined') {
  const { displayStore, displayActions } = await import('./displayStore.js');
  const { markerActions } = await import('./markerStore.js');
  const { workspaceStore, workspaceActions, workspacePersistence } = await import('./workspaceStore.js');

  window.workspaceStore = displayStore;   // Most tests query .displays
  window.displayStore = displayStore;     // New direct access
  window.workspaceActions = {
    ...displayActions,
    ...markerActions,
    ...workspaceActions
  };
  window.workspacePersistence = workspacePersistence;
}
```

Wait — top-level `await` in a non-module context is tricky. The window exposure should be synchronous. Since the facade is imported as a module (Vite handles this), synchronous re-exports work:

```js
import { displayStore, displayActions } from './displayStore.js';
import { markerActions } from './markerStore.js';
import { workspaceStore, workspaceActions, workspacePersistence } from './workspaceStore.js';

export { displayStore, displayActions };
export { markerActions };
export { workspaceStore, workspaceActions, workspacePersistence };

if (typeof window !== 'undefined') {
  window.workspaceStore = displayStore;
  window.displayStore = displayStore;
  window.workspaceActions = { ...displayActions, ...markerActions, ...workspaceActions };
  window.workspacePersistence = workspacePersistence;
}
```

> **Note on `window.workspaceStore`**: Points to `displayStore` because the vast majority of test `getState()` calls access `.displays`. Tests that check headlines state are in `headlines-*.spec.js` and use the UI directly, not `getState().headlinesVisible`. If this assumption is wrong, we use a combined derived store instead (see §8, Risk #3).

---

## 4. Phased Execution Sequence

Each phase is a **single commit** that leaves the system fully functional. No phase requires the next phase to be viable.

### Phase 0: Baseline verification (30 min)

**Goal**: Establish that the current system works before any changes.

1. Run the full test suite (`npx playwright test`) and record results.
2. Start the dev environment (`./run.sh dev`) and verify:
   - Workspace loads from localStorage
   - Displays can be added, moved, resized, removed
   - Price markers can be added, moved, removed
   - Headlines widget toggles and persists position/size
   - Workspace export produces a valid JSON file
   - Workspace import restores displays + markers + drawings
   - Reconnect test: kill backend, restart, verify ticks resume
3. Create a feature branch: `git checkout -b refactor/workspace-decomposition`

### Phase 1: Extract `displayStore.js` (2–3 hours)

**Goal**: Move all display state and display actions to a new file. Zero behavior change.

**Steps**:

1. **Create `src/stores/displayStore.js`**:
   - Move `initialState` (displays, nextZIndex, selectedDisplayId, chartGhost, config)
   - Move `workspaceStore` writable creation (renamed to `displayStore`)
   - Move `getState()` method attachment
   - Move `updateDisplay()` helper
   - Move all display actions: `setSelectedDisplay`, `clearSelectedDisplay`, `addDisplay`, `addPriceTicker`, `removeDisplay`, `updateDisplay`, `updatePosition`, `updateSize`, `bringToFront`, `selectNextDisplay`, `toggleMarketProfile`, `addChartDisplay`, `updateChartDisplay`, `getChartDisplay`, `getDisplay`
   - Export `displayStore` and `displayActions`
   - Self-referential `workspaceActions.bringToFront()` in `selectNextDisplay` → change to `displayActions.bringToFront()` (or use local reference)

2. **Update `workspace.js` to re-export from displayStore**:
   - Remove moved code
   - Import and re-export `displayStore`, `displayActions`
   - Marker actions still in workspace.js temporarily — they call `workspaceStore.update()` which now needs to call `displayStore.update()`
   - Persistence still in workspace.js temporarily — its `subscribe` now needs to subscribe to `displayStore`
   - `window.workspaceStore` points to `displayStore`

3. **Update the self-referential calls**:
   - `selectNextDisplay` (lines 147–222) calls `workspaceActions.setSelectedDisplay` and `workspaceActions.bringToFront` — these become `displayActions.setSelectedDisplay` and `displayActions.bringToFront`

4. **Verify**:
   - `./run.sh dev` → all display CRUD works
   - Chart ghost save/restore works
   - Display navigation (selectNextDisplay) works
   - Persistence still syncs to localStorage

**Commit**: `refactor: extract displayStore from workspace.js`

### Phase 2: Extract `markerStore.js` + absorb `priceMarkerPersistence.js` (2–3 hours)

**Goal**: Move marker actions to a new file and merge with `priceMarkerPersistence.js`.

**Steps**:

1. **Create `src/stores/markerStore.js`**:
   - Move marker actions from workspace.js: `addPriceMarker`, `removePriceMarker`, `updatePriceMarker`, `selectPriceMarker`, `clearPriceMarkerSelection`, `setDisplayPriceMarkers`
   - Import `displayStore` from `./displayStore.js`
   - All marker actions change `workspaceStore.update(...)` → `displayStore.update(...)`
   - Copy contents of `priceMarkerPersistence.js` into this file (loadMarkers, saveMarkers, mergeWithPersisted, getStorageKey)
   - Remove the `authStore` import from the old `priceMarkerPersistence.js` — it's now in markerStore
   - Export `markerActions` object + persistence functions

2. **Update consumers of `priceMarkerPersistence.js`**:
   - `src/components/PriceMarkerManager.svelte` — import from `$lib/stores/markerStore` instead of `$lib/stores/priceMarkerPersistence`
   - `src/components/FloatingDisplay.svelte` — check if it imports priceMarkerPersistence directly
   - Any other files importing from `priceMarkerPersistence.js` — update import paths
   - Alternatively, make `priceMarkerPersistence.js` a thin re-export from markerStore during migration

3. **Update `workspace.js`**:
   - Remove marker actions
   - Import and re-export `markerActions` from markerStore
   - `window.workspaceActions` now includes marker actions from markerStore

4. **Delete `src/stores/priceMarkerPersistence.js`** after all consumers updated.

5. **Verify**:
   - Price markers can be added, moved, removed on displays
   - Marker persistence to localStorage works
   - Marker persistence to server works (when authenticated)
   - Marker import via workspace import works

**Commit**: `refactor: extract markerStore, absorb priceMarkerPersistence`

### Phase 3: Slim `workspaceStore.js` (2–3 hours)

**Goal**: Move persistence, import/export, and headlines to the slimmed workspaceStore. workspace.js becomes a facade.

**Steps**:

1. **Rewrite `workspace.js` as `workspaceStore.js` (new name)** — or just keep `workspace.js` as the slimmed version:

   Actually, the plan calls for `workspaceStore.js` as the slimmed store. But renaming would break all imports. Strategy:
   - Keep `workspace.js` as the facade
   - Create `workspaceStore.js` as the slimmed store
   - `workspace.js` re-exports from `workspaceStore.js`

   OR: since we already extracted displayStore and markerStore, `workspace.js` now only contains persistence, import/export, and headlines. We can keep it named `workspace.js` and just slim it down. The name `workspaceStore.js` in the assessment was descriptive, not prescriptive.

   **Decision**: Keep the file as `workspace.js`. After Phase 1 and 2 extractions, it naturally becomes the slimmed workspace store. No rename needed.

2. **Move headlines state** into the remaining workspace.js:
   - Already there after displayStore extraction — headlines state stays in workspace.js
   - `initialState` for workspace.js is now: `{ headlinesVisible, headlinesPosition, headlinesSize }`

3. **Update persistence** to work across stores:
   - `initPersistence()` subscribes to `displayStore` for display data + `workspaceStore` (self) for headlines
   - The `subscribe` callback reads from both stores to build the combined `_lastWorkspaceData`
   - `loadFromStorage()` calls `displayStore.update()` for display state + `workspaceStore.update()` (self) for headlines
   - `flushPending()` reads `_lastWorkspaceData` (already combined)

4. **Update import/export** to work across stores:
   - `exportWorkspace()` reads displays from `displayStore.getState()` instead of `workspaceStore.getState()`
   - `importWorkspace()` calls `displayStore.update()` to restore displays
   - Fix the direct localStorage manipulation (lines 328–343): replace with `markerStore.saveMarkers()` calls instead of raw `localStorage.setItem`

5. **Update `beforeunload` handler**:
   - Already calls `persistence.flushPending()` which reads `_lastWorkspaceData`
   - `_lastWorkspaceData` is updated by the subscription that now watches both stores
   - No change needed to the handler itself, just ensure the subscription covers both stores

6. **Verify**:
   - Full workspace persistence round-trip: load → modify → unload → reload
   - Import/export round-trip
   - Headlines toggle + position/size persistence
   - Server sync fires correctly (check network tab)
   - sendBeacon fires on tab close

**Commit**: `refactor: slim workspace.js to persistence, import/export, headlines`

### Phase 4: Update component imports (1–2 hours)

**Goal**: Migrate components from importing `workspaceStore` / `workspaceActions` via the facade to importing directly from the new stores.

**Strategy**: Update one component at a time. Each update is independent and can be verified individually.

| Component | Current imports | Target imports |
|---|---|---|
| `Workspace.svelte` | `workspaceStore`, `workspaceActions`, `workspacePersistence` from `$lib/stores/workspace` | `displayStore`, `displayActions` from `$lib/stores/displayStore`; `workspaceStore`, `workspaceActions`, `workspacePersistence` from `$lib/stores/workspace` |
| `ChartDisplay.svelte` | `workspaceActions`, `workspaceStore` from `$lib/stores/workspace` | `displayStore`, `displayActions` from `$lib/stores/displayStore` |
| `PriceTicker.svelte` | `workspaceStore`, `workspaceActions` from `$lib/stores/workspace` | `displayStore`, `displayActions` from `$lib/stores/displayStore` |
| `FxBasketDisplay.svelte` | `workspaceActions`, `workspaceStore` from `$lib/stores/workspace` | `displayStore`, `displayActions` from `$lib/stores/displayStore` |
| `FloatingDisplay.svelte` | `workspaceActions`, `workspaceStore` from `$lib/stores/workspace` | `displayStore`, `displayActions` from `$lib/stores/displayStore` |
| `HeadlinesWidget.svelte` | `workspaceActions`, `workspaceStore` from `$lib/stores/workspace` | Stays on `workspaceStore`, `workspaceActions` from `$lib/stores/workspace` (headlines lives there) |
| `PriceMarkerManager.svelte` | `workspaceStore`, `workspaceActions` from `$lib/stores/workspace` + `priceMarkerPersistence` | `displayStore` from `$lib/stores/displayStore`; `markerActions`, `loadMarkers`, `saveMarkers` from `$lib/stores/markerStore` |

**Lib updates**:

| File | Change |
|---|---|
| `chartLifecycle.js` | No change needed — takes `workspaceActions` as a parameter. The caller passes the right object. |
| `priceMarkerInteraction.js` | Import `markerActions` from `$lib/stores/markerStore` instead of `workspaceActions` from workspace. Import `displayStore` instead of `workspaceStore`. |
| `priceMarkerDropdown.js` | Import `markerActions` from `$lib/stores/markerStore` instead of `workspaceActions` from workspace. |

**Verify after each component update**: Dev server + manual test the specific component's functionality.

**Commit** (per component or batched): `refactor: migrate [component] to direct store imports`

### Phase 5: Remove the facade (30 min)

**Goal**: Once all components import directly from the new stores, `workspace.js` only needs to:
1. Export the slimmed workspace store (persistence, import/export, headlines)
2. Maintain `window.*` exposure for tests

**Steps**:

1. Verify no files import from `workspace.js` for display/marker concerns (only for persistence/headlines).
2. Clean up re-exports in `workspace.js` — remove displayStore and markerStore re-exports if no consumers use them.
3. Keep `window.*` exposure for test backward compatibility (see Phase 6).
4. Update CLAUDE.md files if store descriptions changed.

**Commit**: `refactor: remove workspace.js facade, finalize store boundaries`

---

## 5. Test Migration Strategy

### 5.1 Approach: Zero-change via window facade

**Key insight**: All 20 test files access workspace via `window.workspaceStore` and `window.workspaceActions`. If the facade maintains these globals correctly, **no test file changes are needed during Phases 1–3**.

The facade (workspace.js) handles this:

```js
window.workspaceStore = displayStore;
window.displayStore = displayStore;      // Future direct access
window.workspaceActions = {
  ...displayActions,     // from displayStore.js
  ...markerActions,      // from markerStore.js
  ...workspaceActions    // from slimmed workspace.js (import/export, headlines)
};
window.workspacePersistence = workspacePersistence;
```

This means:
- `window.workspaceStore.getState().displays` → works (displayStore has displays)
- `window.workspaceActions.addDisplay(...)` → works (delegates to displayActions)
- `window.workspaceActions.addChartDisplay(...)` → works (delegates to displayActions)
- `window.workspaceActions.exportWorkspace()` → works (delegates to workspaceActions)
- `window.workspaceActions.importWorkspace(...)` → works (delegates to workspaceActions)
- `window.workspaceActions.addPriceMarker(...)` → works (delegates to markerActions)

### 5.2 Tests that need attention

**Risk: `getState()` returns display-only state, not headlines**

Most tests use `getState().displays` — safe with `displayStore`. But check these:

| Test | Access pattern | Risk |
|---|---|---|
| `headlines-workflow.spec.js` | Likely UI-based, not getState() | Low |
| `headlines-widget.spec.js` | Likely UI-based | Low |
| `server-persistence.spec.js` | `getState().displays` + checks persistence | Low |
| `workspace-drawing-persistence.spec.js` | `workspaceActions.exportWorkspace()` | Low (delegated) |

**Action**: Before Phase 1, grep all test files for `getState()` calls that access anything other than `.displays`, `.nextZIndex`, `.selectedDisplayId`, or `.chartGhost`. If any test accesses `.headlinesVisible` / `.headlinesPosition` / `.headlinesSize` via getState(), the facade needs a combined state approach.

**Mitigation**: If needed, create a lightweight combined getter:
```js
window.workspaceStore = {
  ...displayStore,
  getState: () => ({
    ...displayStore.getState(),
    ...workspaceStore.getState()
  })
};
```

### 5.3 Optional Phase 6: Update tests to use new store names (1–2 hours)

This is **cosmetic, not functional**. Do it only if the team wants clean test code.

- Replace `window.workspaceStore.getState().displays` → `window.displayStore.getState().displays`
- Replace `window.workspaceActions.addDisplay(...)` → `window.displayActions.addDisplay(...)`
- Keep `window.workspaceActions.exportWorkspace()` and `window.workspaceActions.importWorkspace()` as-is (they belong to the slimmed workspace)

**This phase can be deferred indefinitely** without any functional impact.

---

## 6. Rollback Approach

### 6.1 Strategy: Branch-per-phase with revert capability

Each phase is a **single commit** on the feature branch. If a phase introduces a regression:

1. `git revert <phase-commit>` — single commit revert
2. Or: `git reset --soft <previous-phase-commit>` — undo but keep changes for debugging
3. Or: create a fix commit on top — preferred for small issues

### 6.2 Full rollback

If the entire refactor needs to be abandoned:

```bash
git checkout main
git branch -D refactor/workspace-decomposition
```

The feature branch is disposable. No changes to `main` until the full refactor is verified.

### 6.3 Partial rollback (keep some phases, revert others)

Because each phase is independent:
- Phase 1 (displayStore) is self-contained and can stand alone
- Phase 2 (markerStore) depends on Phase 1
- Phase 3 (slim workspace) depends on Phase 1 and 2
- Phase 4 (component updates) depends on Phase 1, 2, 3

Reverting Phase 3 but keeping Phase 1 and 2 is possible but requires fixing the facade to re-absorb the persistence code. **Simpler**: revert everything after the last known-good phase.

### 6.4 Safety net: the facade

The `workspace.js` facade is the primary safety net. As long as it exists and correctly re-exports, all consumers (components + tests) continue working. The facade can be maintained indefinitely if a phase proves too risky.

### 6.5 Pre-merge checklist

Before merging the feature branch to `main`:

1. All test files pass (or explicitly documented as skipped with reason)
2. Manual verification of all workspace features (see Phase 0 checklist)
3. No `console.error` or `console.warn` from the new store modules during normal operation
4. Workspace import/export round-trip with a real workspace file
5. Persistence round-trip: load → modify → close tab → reopen → verify state
6. Reconnect test: kill backend → restart → verify ticks resume
7. Heap snapshot comparison: no new memory leaks (run for 10+ minutes, compare before/after)

---

## 7. Risks & Mitigations

### Risk 1: Reactive subscription breakage

**What**: Svelte's reactive `$workspaceStore` syntax binds at compile time to the imported store. If a component imports `workspaceStore` but we've moved the displays state to `displayStore`, the reactive binding reads stale state.

**Mitigation**: Phase 4 explicitly updates every component's imports. The facade ensures backward compat during Phases 1–3. No component reads from the wrong store at any point.

**Detection**: If a component's UI stops updating (display list doesn't refresh, selection doesn't change), check that the component imports from the correct store.

### Risk 2: Persistence subscription misses state changes

**What**: After the split, `initPersistence()` subscribes to `displayStore` for display changes. If a display update goes through a different code path (e.g., a component directly calling `displayStore.update()` instead of an action), the persistence subscriber might not fire correctly.

**Mitigation**: All display mutations go through `displayStore.update()` or `displayActions.*()`. The persistence subscriber watches the store itself (via `.subscribe()`), not the actions. Any store mutation triggers the subscriber regardless of how it was initiated.

**Detection**: Make a workspace change, close the tab, reopen. If the change is lost, the subscription chain is broken.

### Risk 3: Tests access headlines state via `getState()`

**What**: If any test calls `window.workspaceStore.getState().headlinesVisible`, it would fail because `window.workspaceStore` points to `displayStore` which doesn't have headlines state.

**Mitigation**:
1. **Phase 0**: Grep all test files for `headlinesVisible`, `headlinesPosition`, `headlinesSize` access via `getState()`.
2. If found: use the combined getter approach described in §5.2.
3. If not found (expected): no action needed.

**Detection**: Headlines-related test failures after Phase 1.

### Risk 4: Import/export direct localStorage manipulation

**What**: Lines 328–343 in the current `importWorkspace` write price markers directly to localStorage, bypassing the persistence layer. The assessment recommends fixing this.

**Mitigation**: During Phase 3, replace the raw `localStorage.setItem(key, JSON.stringify(value))` calls with `markerStore.saveMarkers(display.symbol, display.priceMarkers)` (or the appropriate markerStore function). This routes through the proper persistence layer.

**Detection**: After import, check that markers appear on the chart AND persist to localStorage correctly.

### Risk 5: `selectNextDisplay` self-reference

**What**: `selectNextDisplay` calls `workspaceActions.setSelectedDisplay` and `workspaceActions.bringToFront` — self-referential calls that would break if not updated during Phase 1.

**Mitigation**: Phase 1 explicitly changes these to `displayActions.setSelectedDisplay` and `displayActions.bringToFront` (or uses local references).

**Detection**: Arrow-key display navigation breaks. Obvious in manual test.

### Risk 6: `beforeunload` race with split stores

**What**: After the split, `flushPending()` reads from `_lastWorkspaceData` which is updated by subscriptions to both `displayStore` and `workspaceStore`. If the two subscriptions fire at different times, `_lastWorkspaceData` might be partially stale.

**Mitigation**: The subscription handler should be a single function that reads the current state of both stores atomically (or near-atomically — in practice, Svelte's synchronous store updates make this non-issue since both `.getState()` calls happen in the same microtask).

```js
// In initPersistence()
const syncToStorage = () => {
  const displayState = displayStore.getState();
  const headlinesState = workspaceStore.getState();
  const data = {
    displays: Array.from(displayState.displays.entries()),
    nextZIndex: displayState.nextZIndex,
    chartGhost: displayState.chartGhost || null,
    headlinesVisible: headlinesState.headlinesVisible,
    headlinesPosition: headlinesState.headlinesPosition,
    headlinesSize: headlinesState.headlinesSize
  };
  _lastWorkspaceData = data;
  localStorage.setItem('workspace-state', JSON.stringify(data));
  // ... debounced server sync
};

const unsub1 = displayStore.subscribe(syncToStorage);
const unsub2 = workspaceStore.subscribe(syncToStorage);
// Return combined unsubscribe
return () => { unsub1(); unsub2(); };
```

**Detection**: Tab close → reopen → workspace should be identical to before close. If displays or headlines are lost, the flush is incomplete.

---

## 8. Effort Estimate & Sequencing

| Phase | Effort | Dependencies | Verification |
|---|---|---|---|
| Phase 0: Baseline | 30 min | None | Test suite + manual checklist |
| Phase 1: displayStore | 2–3 hr | Phase 0 | Display CRUD + persistence |
| Phase 2: markerStore | 2–3 hr | Phase 1 | Marker CRUD + persistence |
| Phase 3: Slim workspace | 2–3 hr | Phase 1, 2 | Full persistence round-trip |
| Phase 4: Component imports | 1–2 hr | Phase 1, 2, 3 | Each component tested |
| Phase 5: Remove facade | 30 min | Phase 4 | Full test suite |
| **Total** | **8–12 hr** | | |

**Recommended schedule**: 2–3 focused sessions. Phase 0 + 1 in session 1. Phase 2 + 3 in session 2. Phase 4 + 5 in session 3.

---

## 9. Verification Checklist

### After Phase 1 (displayStore extraction)

- [ ] Displays can be added (display, ticker, chart)
- [ ] Displays can be removed (including chart ghost save)
- [ ] Displays can be moved and resized
- [ ] Z-index bring-to-front works
- [ ] Display selection + arrow-key navigation works
- [ ] Chart ghost restores on chart reopen
- [ ] Persistence still syncs to localStorage
- [ ] `window.workspaceStore.getState().displays` works in console
- [ ] `window.workspaceActions.addDisplay()` works in console
- [ ] No console errors from store modules

### After Phase 2 (markerStore extraction)

- [ ] Price markers can be added to displays
- [ ] Price markers can be moved, updated, removed
- [ ] Marker selection works
- [ ] Marker persistence to localStorage works
- [ ] Marker persistence to server works (when authenticated)
- [ ] `priceMarkerPersistence.js` is deleted, no dangling imports
- [ ] Workspace import restores markers correctly

### After Phase 3 (slimmed workspace)

- [ ] Full persistence round-trip: load → modify → close → reopen
- [ ] Workspace export produces valid JSON with displays + markers + drawings
- [ ] Workspace import restores displays + markers + drawings
- [ ] Headlines toggle + position + size persistence works
- [ ] Server sync fires correctly (network tab)
- [ ] `beforeunload` sendBeacon fires with complete data
- [ ] Import no longer writes to localStorage directly (uses markerStore)
- [ ] Reconnect test: kill backend → restart → ticks resume

### After Phase 4 (component imports)

- [ ] Each component imports from the correct store
- [ ] No component imports `displayStore` from `workspace.js` (imports from `displayStore.js` directly)
- [ ] `workspace.js` facade still works (backward compat)
- [ ] All test files pass unchanged

### After Phase 5 (facade removal)

- [ ] `workspace.js` only exports workspace-specific concerns (persistence, import/export, headlines)
- [ ] No dangling re-exports
- [ ] CLAUDE.md files updated
- [ ] Full manual test of all workspace features
- [ ] Test suite passes
