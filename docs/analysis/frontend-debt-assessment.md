# Frontend Debt & Quality Assessment

> Date: 2026-03-28
> Scope: Full frontend — connection layer, market data store, UI components, market profile module, visualization pipeline, day range module
> Verified: 2026-03-28 — all 50 findings independently confirmed by 5 parallel debugger agents

## Executive Summary

Six parallel codebase analyses identified **50 findings** across the frontend: 1 functional bug, 6 legacy debug artifacts, 14 dead code/unused exports, 11 design debt issues, and 10 performance inefficiencies. All 50 findings were independently verified. 43 were confirmed as-is, 3 needed nuance corrections, and 0 were refuted. Verification also uncovered 7 additional surrounding issues. The most impactful issues are: a reconnection attempt double-counting bug, ~35 debug console.log statements in production hot paths, an entire unused visualization registry, and a mini market profile renderer that duplicates all sibling module logic with different colors.

---

## High Priority

### 1. Reconnection attempt double-counting (BUG)

**File:** `src/lib/connectionManager.js:44-71`

When a WebSocket connection drops, the browser fires both `onerror` and `onclose` in sequence. Both handlers independently increment the reconnection attempt counter and schedule reconnects. The second `scheduleReconnect` overwrites the first timeout via `this.reconnectTimeout = setTimeout(...)`, so only one reconnect fires — but with an attempt counter that has been double-incremented. This causes the backoff to grow 2x faster than intended and reconnect to give up prematurely when `maxAttempts` is reached.

> **Verification note:** Confirmed as a real bug. Invisible with default `Infinity` maxAttempts — only manifests when `VITE_MAX_RECONNECT_ATTEMPTS` is set to a finite value. The `onStale` path does NOT double-count with `onClose` (stale nullifies handlers before closing), but CAN double-count with `onError`.

### 2. Debug logging in production hot paths (LEGACY)

~35 `[DEBUGGER:...]` console.log statements remain across the application:

| File | Lines | Context |
|------|-------|---------|
| `src/lib/connection/connectionHandler.js` | 47,51,52,54,59,63,65,67,82,98,104,148,152 | 14 statements, including on `onmessage` (fires hundreds of times/sec) |
| `src/components/Workspace.svelte` | 2,4,6,8,10,12,14,16,22,104 | 10 statements across imports and onMount |
| `src/App.svelte` | 2,4,6 | 3 import-step logs |
| `src/main.js` | 3,7 | 2 bootstrap logs |
| `src/lib/dayRangeOrchestrator.js` | 11-36 | 6 logs on every render frame (60fps) |

These fire synchronously on every WebSocket message, every render cycle, and during module initialization. The `onmessage` logger at `connectionHandler.js:82` is the worst offender — it runs string concatenation and Date arithmetic on every incoming tick.

> **Verification note:** Workspace line count corrected to 10 (line 129 is a regular console.log, not `[DEBUGGER:]`). All other counts confirmed.

### 3. Derived store factories are dead code (DEBT)

**File:** `src/stores/marketDataStore.js:264-315`

Five derived store factory functions are exported but never imported by any component or module:

- `createCurrentPriceStore` (line 264)
- `createRangePercentStore` (line 269)
- `createDailyChangeStore` (line 281)
- `createLatencyStore` (line 292)
- `createProfileMetricsStore` (line 297)

Components access data directly via `getMarketDataStore(symbol)` and derive values inline with `$:` reactive statements. These factories are an unused abstraction from the pre-centralized-store architecture.

> **Verification note:** Confirmed. All five exist only on the `window.marketDataStore` debug bridge (line 566-590). Zero production consumers.

### 4. All 8 FX baskets recomputed on every tick (INEFFICIENCY)

**File:** `src/stores/marketDataStore.js:103-137`

When the basket state machine is `READY`, every tick for any pair triggers `updateBasketsLocal`, which iterates all 8 currencies, calling `calculateBasketValue` (twice), `validateCalculationResult` (twice), and `normalizeToBaseline` (once) per currency — 40 function calls per tick. With 28+ pairs ticking multiple times per second, only the basket containing the changed pair actually needs recalculation.

> **Verification note:** Confirmed. 8 currencies x 5 calls = 40 per tick. Both call sites verified at lines 521 and 530.

### 5. Basket state machine uses FAILED as initial state (DEBT)

**File:** `src/stores/marketDataStore.js:29,51,70`

`createBasketStateMachine` initializes in `BasketState.FAILED` state. The `trackPair` and `trackFailedPair` functions both check for `FAILED` and transition to `WAITING`. A proper `IDLE` or `PENDING` state would make the state machine self-documenting.

> **Verification note:** Confirmed. No `IDLE` or `PENDING` state exists in the enum (line 18-23). The pattern is intentional but semantically misleading.

---

## Medium Priority

### Connection Layer

| # | File:Line | Category | Description |
|---|-----------|----------|-------------|
| 6 | `Workspace.svelte:125` | DEBT | `__SYSTEM__` subscription bypasses ConnectionManager facade, directly mutates `SubscriptionManager.subscriptions` Map. Never cleaned up in onDestroy. Pollutes `resubscribeAll()` — would send `symbol='__SYSTEM__'` to backend. |
| 7 | `Workspace.svelte:69` | DEBT | Reaches through facade to `connectionHandler.getWebSocket().send()` — defeats abstraction layer. ConnectionManager needs `sendRaw()` method. |
| 8 | `connectionManager.js:155-158` | DEBT | `statusCallbacks` Set grows without bound. `addStatusCallback()` returns unsubscribe function but consumers never call it. |
| 9 | `subscriptionManager.js:44-57` | DEBT | `pendingSubscriptions` loses items if connection drops mid-flush. `flushPending` unconditionally clears the array after iteration, wiping items re-queued by `sendSubscription` during the loop. |
| 10 | `connectionManager.js:126-143` | DEAD | `subscribeCoordinated()` and `resubscribeSymbol()` never called in production. |
| 11 | `reconnectionHandler.js:57-59` | DEBT | `permanentDisconnect()` sets `maxAttempts=0` with no reset path — irreversible if reconnect ever needed. |
| 12 | `connectionManager.js:17-20` | DEBT | `visibilitychange` listener never removed. Anonymous arrow function makes removal structurally impossible without refactoring. |

> **Verification notes:**
> - Finding 6: Confirmed. onDestroy (lines 132-135) only cleans keyboardHandler and unsubscribePersistence.
> - Finding 7: Confirmed. Only Workspace does this — no other component bypasses the facade.
> - Finding 8: Confirmed. `addStatusCallback` returns unsubscribe fn but FxBasketDisplay (line 109) and marketDataStore (line 412) never call it.
> - Finding 9: Corrected — only item LOSS occurs, not duplication. Re-queued items are wiped by `this.pendingSubscriptions = []` at line 56.
> - Finding 10: Confirmed. Zero callers across all `src/**/*.{js,svelte}` files.
> - Finding 11: Confirmed. `resetAttempts()` resets `attempts` and `lastFailureTime` but NOT `maxAttempts`. No reset method exists.
> - Finding 12: Confirmed. Zero `removeEventListener('visibilitychange')` calls anywhere in `src/`.

### Market Data Store

| # | File:Line | Category | Description |
|---|-----------|----------|-------------|
| 13 | `marketDataStore.js:1,5` | DEAD | `BASKET_DEFINITIONS` and `getPairPrice` imported but never used. |
| 14 | `marketDataStore.js:424-457` | DEAD | Latency stats collected on every tick but never consumed by any component. Entire pipeline (circular buffer + percentile computation) is wasted computation. |
| 15 | `marketDataStore.js:486,552` | DEBT | Hard-coded `'fx-basket-main'` key — second `subscribeBasket` call overwrites first entry, leaking the old state machine and its dangling setTimeout. |
| 16 | `marketDataStore.js:174-219` | LEGACY | `normalizeData` supports dual field naming (`todaysHigh`/`high`, `projectedAdrHigh`/`adrHigh`) from a backend format transition. |

> **Verification notes:**
> - Finding 13: Confirmed. Both names only appear on the import line (line 5).
> - Finding 14: Confirmed. `getLatencyStats` only referenced on debug bridge (line 577). No UI component consumes latency data.
> - Finding 15: Confirmed. Cleanup function (lines 544-548) does NOT call `clearTimeout(sm.timeoutId)` before deleting state machine — dangling timeout fires on orphaned state.
> - Finding 16: Confirmed. 5 fields with legacy fallbacks at lines 178-182.

### UI Components

| # | File:Line | Category | Description |
|---|-----------|----------|-------------|
| 17 | `FxBasketDisplay.svelte:73-74` | INEFFICIENCY | `requestAnimationFrame` retry on canvas setup with no limit — infinite loop if canvas never gets dimensions (e.g., hidden display). |
| 18 | `FxBasketDisplay.svelte:53-64` | DEBT | Interact.js config duplicated inline instead of using shared `interactSetup.js`. Third copy exists in dead file `interactionSetup.js`. |
| 19 | `PriceTicker.svelte:146-154` | DEBT | `resizeObserver.disconnect()` called twice — once in onMount return, once in onDestroy. |
| 20 | `FloatingDisplay.svelte:41-65` | INEFFICIENCY | Handler functions (close, focus, refresh, keydown) recreated as new closures on every `$workspaceStore` change. |
| 21 | `FxBasketDisplay.svelte:84` | DEBT | ResizeObserver captures DPR at setup time — stale if user moves window to different DPI monitor. |
| 22 | `FxBasketDisplay.svelte:32,116` | DEBT | Debug API exposed to `window.fxBasketDebug` in production with no DEV guard. |
| 23 | `PriceTicker.svelte:15-17` | DEAD | `flashPriceEnabled` prop permanently `false` — no parent passes it. Dead CSS at line 281-287. |
| 24 | `PriceMarkerManager.svelte:69-75` | INEFFICIENCY | localStorage write on every workspace store change — synchronous blocking operation on the main thread. |

> **Verification notes:**
> - Finding 17: Confirmed. Only `if (!canvas)` guard stops the loop — if canvas element exists but has 0 dimensions, loop runs forever.
> - Finding 18: Confirmed. `src/lib/interactionSetup.js` is dead code — zero imports anywhere in `src/`.
> - Finding 19: Confirmed. Cleanup also split inconsistently: `unsubscribeSymbol` only in onMount return, `interactable.unset()` only in onDestroy.
> - Finding 20: Confirmed. IIFE creates 4 new function references per workspace store change.
> - Finding 23: Confirmed. Workspace.svelte line 151 passes only `ticker={display}` — no flash props.

### Market Profile Module

| # | File:Line | Category | Description |
|---|-----------|----------|-------------|
| 25 | `orchestrator.js:59-177` | DEBT | `renderMiniMarketProfile` is a 119-line god function reimplementing scaling, calculations, and rendering with different logic and different colors than the main renderer. Bug fixes to core modules will not propagate to it. |
| 26 | Multiple files | DEBT | 4 unrelated color palettes for the same visualization: `calculations.js:26-28` (cyan `#0891b2`/`#22d3ee`/`#67e8f9`), `rendering.js:8,18,47` (blue `rgba(74,158,255,0.1)` + orange `#ff8c4a`), `orchestrator.js:127,157` (RGB `rgba(0,210,255,...)` + `#FF6600`), README (gray/purple, never implemented). |
| 27 | `calculations.js:4` | DEAD | `calculateIntensity` exported, never imported. |
| 28 | `calculations.js:17` | DEAD | `getIntensityLevel` exported but shadowed by identical private copy in `rendering.js:35-39`. |
| 29 | `calculations.js:23` | DEBT | `getIntensityColor` accepts unused `intensity` parameter — callers pass it but the function body ignores it entirely. |
| 30 | `rendering.js:7` | DEAD | `drawBackground` exported, never called. |
| 31 | `orchestrator.js:179` | DEAD | `renderMarketProfileError` exported, never imported. |
| 32 | `orchestrator.js:138-147` | DEAD | Commented-out POC rendering block. |
| 33 | `scaling.js:48-57` | DEAD | `priceToY` and `yToPrice` exported, never imported. |
| 34 | `scaling.js:44-46` | DEBT | `createPriceScale` is a trivial pass-through to `createDayRangePriceScale` — adds indirection without value. |

> **Verification notes:**
> - Finding 25: Confirmed exact 119 lines (59-177). Does not delegate to any sibling module — reimplements scaling (lines 80-98), calculations (line 101), and rendering (lines 103-177) inline.
> - Finding 26: Confirmed with exact color values. Four distinct palettes with no shared color system.
> - Finding 28: Confirmed character-for-character identical functions. rendering.js imports getIntensityColor from calculations.js but defines its own private getIntensityLevel instead of importing it.
> - Additional: `createDayRangeConfig` is called redundantly — once at orchestrator.js:32 and again inside `calculateDimensions` at scaling.js:61.
> - Additional: `calculateDimensions` returns 5 fields but callers only use 2 (`marketProfileWidth`, `marketProfileStartX`). Three fields (`adrAxisX`, `padding`, `profileHeight`) are dead returns.

### Visualization Pipeline

| # | File:Line | Category | Description |
|---|-----------|----------|-------------|
| 35 | `visualizationRegistry.js` | DEAD | Entire registry pattern never queried. `displayCanvasRenderer.js` uses switch statement for dispatch instead. `list()` and `getDefault()` are dead exports. |
| 36 | `dayRange.js` | LEGACY | Entire 105-line file is superseded dead code — replaced by orchestrator pattern modules. Zero imports. |
| 37 | `displayCanvasRenderer.js:91-94,162-165` | INEFFICIENCY | Copy-pasted axisX resolution block in two functions. Same pattern also duplicated in `dayRangeOrchestrator.js:55-58,82-87` — 4+ instances total. |
| 38 | `visualizers.js:17-19,46` | DEAD | `renderMarketProfileVisualization` and re-exports of `renderStatusMessage`/`renderErrorMessage` are never consumed. All consumers import directly from `canvasStatusRenderer.js`. |
| 39 | `visualizers.js:24,27-28` | INEFFICIENCY | Redundant `clearRect` before opaque `fillRect` background draw. |

> **Verification notes:**
> - Finding 35: Confirmed. `get()`, `list()`, `getDefault()` have zero external consumers. Registry also has a `console.log` at line 17 that fires on module init.
> - Finding 36: Confirmed. File exists with zero imports across all of `src/`.
> - Finding 37: Line numbers corrected (91-94 and 162-165, not 86-94 and 161-165). 4+ instances confirmed across 2 files.
> - Finding 38: Confirmed. Grep shows all consumers import directly from `canvasStatusRenderer.js`.
> - Finding 39: Confirmed. `clearRect` at line 24 fully masked by opaque `fillRect` at line 28.
> - Additional: `canvasStatusRenderer.js` has `console.log` at lines 14 and 25 on every status/error render.
> - Additional: `src/lib/fxBasket/test-basket-adr.js` and `test-fxBasket.js` — test files in production source tree.
> - Additional: `src/lib/interactionSetup.js` — dead file (zero imports), distinct from live `interactSetup.js`.

---

## Low Priority

| # | File:Line | Category | Description |
|---|-----------|----------|-------------|
| 40 | `marketDataStore.js:431` | INEFFICIENCY | `Array.shift()` in latency buffer is O(n) — minor for 100 elements. |
| 41 | `marketDataStore.js:254-257` | INEFFICIENCY | `getState()` creates temporary subscription — Svelte `get()` available but unused. |
| 42 | `marketDataStore.js:164` | DEBT | `schemaVersion` field set to `'1.0.0'` but never checked or used. |
| 43 | `calculations.js:51,79` | DEAD | `finalTpo` computed and returned by `expandArea` but never consumed by the caller at line 51. |
| 44 | `scaling.js:27-28,54,64` | DEBT | Magic numbers (0.5, 0.75, 5px padding) not configurable. |
| 45 | `orchestrator.js:3` | LEGACY | Backward-compatibility comment references deleted modules. |
| 46 | `dataContracts.js:235-421` | DEAD | 4 validation functions never imported externally. `withValidation` wraps the other three, but the entire module has zero external consumers. |
| 47 | `displayCanvasRenderer.js:167,176,177,201` | DEBT | Hardcoded `#FFD700` not from shared color config. |
| 48 | `displayCanvasRenderer.js:180` | DEBT | Hardcoded font string instead of using `SYSTEM_FONT_FAMILY` constant. |
| 49 | Multiple files | DEBT | `SYSTEM_FONT_FAMILY` defined separately in `colors.js:15` and `canvasStatusRenderer.js:4`. |
| 50 | Multiple files | DEBT | `#0a0a0a` background color hardcoded in 4 files, `0.75` axis ratio in 4+ files. |

> **Verification notes:**
> - Finding 46: Confirmed with nuance — `withValidation` internally chains the other 3 functions, so the effective dead surface is `withValidation` as the single unused entry point.
> - Finding 50: Precise count confirmed: `#0a0a0a` in 4 files, axis `0.75` in 4+ locations (dayRangeConfig.js:42, scaling.js:64, displayCanvasRenderer.js:86,161).

---

## Surrounding Issues Discovered During Verification

These issues were found while verifying the original 50 findings but were not part of the initial assessment.

| # | Severity | File:Line | Category | Description |
|---|----------|-----------|----------|-------------|
| S1 | HIGH | `connectionHandler.js:70-75` | DEBT | `onerror` does NOT call `stopHeartbeatCheck()` — heartbeat interval leaks if `onclose` never follows `onerror`. `onclose` and `handleStaleConnection` do call it, but the error-only path misses it. |
| S2 | HIGH | `marketDataStore.js:544-548` | BUG | `subscribeBasket` cleanup deletes entries from Maps but does NOT call `clearTimeout(sm.timeoutId)` — dangling timeout fires on orphaned state machine, writing to deleted objects. |
| S3 | MEDIUM | `marketDataStore.js:565-591` | DEBT | `window.marketDataStore` debug bridge checks `typeof window !== 'undefined'` but does NOT check `import.meta.env.DEV` — exposes all internal state (stores, subscriptions, latency data, basket machines) in production builds. |
| S4 | MEDIUM | `connectionHandler.js:70-75` | DEBT | `onerror` does NOT set `ws = null` — `getWebSocket()` returns stale dead socket reference between error and next `connect()` call. |
| S5 | MEDIUM | `src/lib/interactionSetup.js` | DEAD | Entire file is dead code — superseded by `interactSetup.js` (different filename). Zero imports in any `.js` or `.svelte` file. |
| S6 | MEDIUM | `marketProfile/scaling.js`, `orchestrator.js` | DEBT | `calculateDimensions` returns 5 fields but callers only use 2 (`marketProfileWidth`, `marketProfileStartX`). Three fields (`adrAxisX`, `padding`, `profileHeight`) are dead returns. |
| S7 | MEDIUM | `calculations.js`, `scaling.js`, `orchestrator.js` | INEFFICIENCY | 8 instances of `Math.min(...array)` / `Math.max(...array)` spread pattern across the module. Can throw `RangeError: Maximum call stack size exceeded` on profiles with thousands of price levels. |

---

## Cross-Cutting Themes

### 1. Debug Logging in Production
~35 `[DEBUGGER:...]` console.log statements across `main.js`, `App.svelte`, `Workspace.svelte`, `connectionHandler.js`. The `onmessage` logger in `connectionHandler.js:82` fires on every incoming WebSocket message. The dayRangeOrchestrator logs fire on every render frame. Additional `console.log` in `canvasStatusRenderer.js:14,25` fires on every status render. These should be removed or gated behind `import.meta.env.DEV`.

### 2. Dead Code / Unused Exports
20+ exported functions and 3 entire files (`visualizationRegistry.js`, `dayRange.js`, `interactionSetup.js`) are never consumed. Nearly half of the market profile module's exports are dead. The visualization registry is populated but never queried. Test files (`test-basket-adr.js`, `test-fxBasket.js`) are in the production source tree. This adds maintenance burden and confuses new developers about which APIs are current.

### 3. ConnectionManager Facade is Incomplete
Workspace reaches through to internals (findings 6-7), forcing encapsulation breaches. The facade needs `sendRaw()` and `registerSystemCallback()` methods to avoid consumers reaching into `connectionHandler` and `subscriptionManager` directly.

### 4. Color / Font / Theme Values Scattered
No centralized theming. 4 color palettes for market profile (cyan, blue/orange, RGB, gray/purple). `#0a0a0a` background in 4 files. `0.75` axis ratio in 4+ files. `SYSTEM_FONT_FAMILY` defined in 2 separate files. `#FFD700` hardcoded inline. Any theme change requires edits across 10+ files.

### 5. Mini Profile Renderer is a Parallel Implementation
`renderMiniMarketProfile` (`orchestrator.js:59-177`) duplicates all sibling module logic (scaling, calculations, rendering) with different code and different colors. It does not delegate to `rendering.js`, `scaling.js`, or `calculations.js`. Any bug fix or feature in core modules must be manually replicated. This is the largest source of future maintenance cost in the market profile module.

### 6. Resource Cleanup Gaps
Multiple components and modules register callbacks, intervals, and listeners without corresponding cleanup: `statusCallbacks` Set grows without bound (finding 8), `__SYSTEM__` subscription never cleaned (finding 6), basket state machine timeouts leak (finding 15, surrounding S2), `visibilitychange` listener never removed (finding 12), and `window` debug bridges are ungated (surrounding S3).

---

## Summary Statistics

| Category | Count |
|----------|-------|
| BUG (functional) | 1 + 1 (surrounding) |
| LEGACY (debug artifacts, old code) | 8 |
| DEAD (unused exports, files) | 14 + 3 (surrounding) |
| DEBT (design issues, coupling) | 11 + 4 (surrounding) |
| INEFFICIENCY (performance) | 10 + 1 (surrounding) |
| **Total** | **50 + 7 surrounding = 57** |

### By Module

| Module | Findings |
|--------|----------|
| Connection layer | 12 + 2 surrounding |
| Market data store | 10 + 2 surrounding |
| UI components | 10 |
| Market profile module | 10 + 2 surrounding |
| Visualization pipeline | 6 + 1 surrounding |
| Cross-cutting themes | 6 |

### Verification Summary

| Verdict | Count |
|---------|-------|
| Confirmed as-is | 43 |
| Needed nuance/correction | 3 |
| Refuted | 0 |
| New surrounding issues | 7 |
