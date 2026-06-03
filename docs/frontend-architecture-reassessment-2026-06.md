# Frontend Architecture — Current State & Targets (June 2026)

**Purpose:** Forward-looking guide for LLM-assisted development. Describes the current frontend architecture, actionable targets, and explicitly deferred items so you don't waste time on things that have already been considered and rejected.
**Scope:** Frontend only (`src/`). Backend services are out of scope.
**Prior assessment history:** See `docs/frontend-architecture-assessment-2026-06.md` for the original assessment and its execution record (all P0/P1 items resolved).

---

## 1. Architecture Overview

Svelte 4 SPA. Single WebSocket to backend. Workspace of floating chart displays with overlays. klinecharts for charting, three.js for background shader, Dexie for IndexedDB persistence.

### Key architectural patterns

- **Store decomposition** — Workspace state split across `displayStore` (display CRUD, focus, z-index), `markerStore` (marker actions), `workspace.js` (persistence, import/export, headlines). Components import directly from the store they need.
- **Compute/render split** — All feature domain orchestrators follow: `data → compute(data) → result → draw(ctx, result) → canvas`. Compute functions are pure, testable with synthetic data.
- **Connection facade + modular layer** — `connectionManager.js` orchestrates `connection/connectionHandler.js` (WS lifecycle), `connection/subscriptionManager.js` (tracking/dispatch), `connection/reconnectionHandler.js` (exponential backoff). Reconnect sequence: WS close → backoff → connect → wait for `ready` (15s timeout) → flush pending → subscribe.
- **Command-pattern drawing** — `drawingCoordinator.js` + `drawingStore.js` with undo/redo, IndexedDB persistence, server sync.

### Test infrastructure

476 unit tests across 19 files. All test pure-logic modules with synthetic inputs — no DOM/WebSocket mocks. Vitest for unit tests, Playwright for E2E (requires running backend + PG + Redis).

### Bundle

1.1MB, eagerly loaded. No code splitting. `three.js` used only in `BackgroundShader.svelte`.

---

## 2. Domain Map — Current State

### 2.1 Charting (`src/lib/chart/`)

~30 files. Well-structured. Drawing coordinator, command-pattern undo/redo, proper resource cleanup, no polling. 10 test files.

| Area | State | Notes |
|------|-------|-------|
| Core config | 8 config/theme files | `chartConstants.js`, `chartConfig.js`, `chartTimeWindows.js`, `chartThemeLight.js` (443 LOC), `chartThemeDark.js` (438 LOC), `themeColors.js`, `fadedStyleDefaults.js`, `resolutionMapping.js` |
| Drawing system | Clean | `drawingCoordinator.js` (382 LOC), `drawingStore.js` (350 LOC), `drawingCommands.js` (143 LOC). Command pattern. Proper cleanup on symbol switch. |
| Overlays | 5 modules, duplicated boilerplate | `overlaysAnnotations.js`, `overlaysChannels.js`, `overlaysIndicators.js`, `overlaysPriceLines.js`, `overlaysShapes.js`. All ~120 LOC each. Identical `registerOverlay()` structure. |
| Data pipeline | Clean | `barCache.js` (IndexedDB), `barMerge.js`, `cacheFreshness.js`. Per-resolution caps, automatic eviction. |
| X-axis | Clean | Custom tick generator, tested. |

**Known risks:** None active. `formatterCache` was capped at 50 entries.

### 2.2 Feature Domains

All three main feature domains have clean compute/render splits with tests. Price-scale unified via shared `dayRangeRenderingUtils.js`.

| Domain | Location | Compute function | Tests | Notes |
|--------|----------|-----------------|-------|-------|
| Day Range / ADR | `src/lib/dayRange/` | `computeDayRange()` | 22 | Well-organized subfolder |
| Market Profile | `src/lib/marketProfile/` | `computeMarketProfile()` + `computeMiniMarketProfile()` | 14 | Well-organized subfolder |
| FX Basket | `src/lib/fxBasket/` | `computeFxBasketLayout()` | 15 | Module-level Maps (`basketStateMachines`, `basketStores`) in `fxBasketSubscription.js` — manual cleanup |
| Price Markers | `src/lib/priceMarkers/` | `computeCurrentPrice` + 6 others | 32 | Compute/render split done. All 4 feature domains now follow the pattern. |

### 2.3 Workspace & UI Shell

| File | LOC | Role |
|------|-----|------|
| `src/stores/displayStore.js` | 254 | Display CRUD, selection/focus, z-index, chart ghosting |
| `src/stores/markerStore.js` | 173 | Marker actions (operates on displayStore) |
| `src/stores/workspace.js` | 389 | Persistence (localStorage + server), import/export, headlines |
| `src/components/Workspace.svelte` | ~220 | Shell component. Keyboard shortcuts extracted to `workspaceKeyboardShortcuts.js`. Connection wiring, focus restoration. |

**Backward-compat derived store:** Removed. Both consumers now import directly from `displayStore` and `headlinesStore`. `window.workspaceStore.getState()` preserved for E2E tests as a plain object.

**Modal patterns:** 3 distinct implementations with no shared base — `WorkspaceModal.svelte` (focus trap, keyboard nav), `KeyboardShortcutsHelp.svelte` (basic overlay), `OverlayContextMenu.svelte` (positioned menu).

**Persistence:** Clean. `sendBeacon` on `beforeunload` coordinates across the 3 stores. Import/export routes through proper persistence layer.

### 2.4 Connection & Data Layer

| File | LOC | Role |
|------|-----|------|
| `src/lib/connectionManager.js` | Facade | Orchestrates reconnect ↔ ready ↔ flush ↔ subscribe flow |
| `src/lib/connection/connectionHandler.js` | WS lifecycle | Heartbeat (30s), stale detection, pre-warm |
| `src/lib/connection/subscriptionManager.js` | Tracking | O(1) lookup, batched resubscription (10/batch, 200ms delay) |
| `src/lib/connection/reconnectionHandler.js` | Backoff | Exponential with jitter, 15s cap, 60s reset |
| `src/stores/marketDataStore.js` | 205 | Subscription lifecycle, message routing. Normalization, profile merge, daily reset extracted to pure modules. |
| `src/stores/marketDataNormalizer.js` | 69 | `normalizeSymbolDataPackage()` + `normalizeTick()` — pure functions |
| `src/stores/marketProfileHandler.js` | 40 | `mergeProfileUpdate()` — source precedence, delta merging |
| `src/stores/dailyResetHandler.js` | 33 | `createResetFields()` + `setupDailyResetHandler()` |

**Reconnect path (verified working):**
```
WS close → onClose → tryScheduleReconnect() → backoff → connect()
→ onOpen → start 15s ready-timeout → [wait]
→ ready arrives → flush pending messages → flush pending subscriptions
→ resubscribeAll() (or skip if flush already sent them)
```

**`marketDataStore.js` decomposition complete (commit `5ce5c4d`).** Store reduced from 361→205 LOC. 79 new tests across 3 extracted modules.

**Untested critical modules:** `subscriptionManager`, `ConnectionHandler` heartbeat, ready-signal timeout. These are the highest-value test targets remaining.

### 2.5 Cross-cutting

| Concern | State |
|---------|-------|
| Dead dependency | None active. `eventemitter3` already removed. |
| Code splitting | None. 1.1MB eager. `three.js` (BackgroundShader only) is lowest-effort lazy-load target. |
| Error handling | Console-only. No toast, no error boundary, no user-facing error display. |
| API secrets in `.env` | `CTRADER_CLIENT_ID` and `CTRADER_CLIENT_SECRET` committed. Move to `.env.local` for shared hosting. |
| Theme system | `themeStore.js` with localStorage persistence. CSS custom properties. Dark/light. Mix of inline styles and classes. No design tokens. |
| `ws` dependency | Required by vendored cTrader layer (`libs/cTrader-Layer/.../RealTimeClient.js`). Cannot remove. |

---

## 3. Active Targets

### Tier 1 — Quick wins — DONE

All five items executed. Build clean, 365/365 tests passing, UI verified.

| # | What | Status |
|---|------|--------|
| 1 | Remove `eventemitter3` from `package.json` | Already removed (no-op) |
| 2 | Cap `formatterCache` in `dateFormatter.js` (LRU limit ~50) | Done |
| 3 | Remove backward-compat derived store, migrate `Workspace.svelte` + `HeadlinesWidget.svelte` to direct store imports | Done |
| 4 | Move dayRange/ADR files into `src/lib/dayRange/` subfolder, update all imports | Done — 8 files, 16 import files updated |
| 5 | Move priceMarker files into `src/lib/priceMarkers/` subfolder, update all imports | Done — 6 files, 6 import files updated |

### Tier 2 — Structural (plan each as a mini-project)

| # | What | Why | Effort | Status |
|---|------|-----|--------|--------|
| 6 | **`marketDataStore.js` decomposition** — extract subscription management, message normalization, market profile logic, TWAP, daily reset into focused modules | 361 LOC god store. Blocks future feature work. Every new data feature touches it. | **Done** — commit `5ce5c4d`. 361→205 LOC, 79 new tests. |
| 7 | **Price marker compute/render split** — extract computation from `priceMarkerRenderer.js`, add tests | Only feature domain without the split. No tests. Pattern proven in 3 other domains. | **Done** — 7 compute functions extracted, 32 tests. Renderer reduced to thin draw calls. |
| 8 | **Extract keyboard service** from `Workspace.svelte` onMount | 15+ shortcut registrations in one onMount. Extracting reduces complexity. Clean deps (only `displayStore`). | **Done** — `workspaceKeyboardShortcuts.js`. Workspace onMount reduced ~110→40 LOC. |
| 9 | ~~**Overlay registration factory**~~ — extract shared `registerOverlay()` boilerplate from 5 overlay modules | **Rejected after investigation.** The "boilerplate" is the klinecharts API config shape, not duplicated logic. Each overlay's `createPointFigures` is entirely unique. A factory would add more LOC than it saves. The indicators file uses a different API (`registerIndicator`). | N/A |

### Recommended sequencing

1. ~~**Tier 1** (half day) — do all five, no planning needed~~ **Done.**
2. ~~**Tier 2 #6** (1-2 days) — `marketDataStore` decomposition~~ **Done.**
3. ~~**Tier 2 #7, #8, #9** (1 day each, independent)~~ **#7 done, #8 done, #9 rejected.**

---

## 4. Deferred Items — Do Not Touch Unless Triggered

These were explicitly considered. They are not forgotten — they are **deferred** because the cost/benefit doesn't justify them at current scale (small userbase, single deployment, no multi-tenant).

| Item | Why deferred | What would trigger it |
|------|-------------|----------------------|
| Svelte 4→5 migration | Works fine. Runes migration touches every component. No concrete pain. | Component complexity becomes unmanageable; Svelte 4 security EOL |
| TypeScript migration | JSDoc + `dataContracts.js` validators get most of the value at none of the migration cost. | Team grows; onboarding new developers who expect types |
| three.js removal | BackgroundShader is the only consumer. Visibility handler already solves GPU drain on hidden tabs. | GPU performance incident; desire to remove WebGL dependency entirely |
| Chart config consolidation (8 files) | Low benefit. Each file exists for a reason (lazy loading, runtime swap). | Adding new themes or chart types makes the sprawl actively confusing |
| Theme file splits (443/438 LOC) | No user-facing benefit. Mechanical but noisy refactor. | Theme files need significant modification for a new feature |
| Code splitting / lazy loading | 1.1MB loads fast on broadband. No user complaint about load time. | Mobile users; measurable load-time regression; bundle exceeds 2MB |
| Centralized error handling / toast | Console-only is fine when the developer *is* the primary user. | Userbase grows beyond the core team; non-technical users need feedback |
| Broad test coverage expansion | 444 tests cover all pure-logic modules. Higher-value targets are in Tier 2 #7–#9. | Regression incident that tests would have caught; team grows |
| Full E2E suite | No userbase pressure. Playwright config exists and is ready when needed. | Multiple users reporting UI bugs; CI/CD pipeline requires it |
| Composables pattern resurrection | Was a completed migration *away* from composables to stores. The pattern didn't stick. | Never. Svelte stores are the right idiom here. |
| Shared modal base component | 3 modal patterns is annoying but not actively harmful. | Adding a 4th modal type; modal accessibility requirements |
| FX Basket Map cleanup | `basketStateMachines`/`basketStores` Maps have manual cleanup. Works. | Memory profiling shows actual leak; adding many more basket currencies |

---

## 5. Confidence & Verification Notes

Findings from static analysis. Verify at runtime before committing to structural work.

| Finding | Confidence | Verify by |
|---------|------------|-----------|
| `eventemitter3` is dead | **High** | `npm ls eventemitter3` + remove and build |
| `formatterCache` grows | **High** | Open app 48hr, snapshot Map size |
| Backward-compat store has 2 consumers | **High** | `grep -r workspaceStore src/` |
| `marketDataStore` is decomposable | ~~Medium~~ **Proven** | Completed. 361→205 LOC, 79 tests, no coupling surprises |
| Overlay factory is extractable | **Medium** | Read all 5 registration blocks side-by-side for subtle differences |
| Price marker split is mechanical | **Medium-High** | Follow `dayRangeOrchestrator.js` as template |

**Rule of thumb:** structural findings (god stores, scattered files, missing patterns) are reliable from static analysis. Operational/lifecycle findings (caches, timers, growth) should be verified at runtime.
