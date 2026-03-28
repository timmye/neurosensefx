# Market Profile Optimization Assessment

**Date:** 2026-03-28
**Scope:** Full pipeline assessment — backend generation, message transport, frontend consumption, and canvas rendering
**Status:** P1-P6, P8-P9 executed; P7 deferred

---

## Architecture (Post-Optimization)

```
Backend                              Transport              Frontend
─────────                            ─────────              ─────────

cTrader M1 bars ─┐
                  ├─► MarketProfileService ─► profileUpdate ─► subscriptionManager
TradingView M1 ──┘    (TPO accumulator)       (DELTA on M1       (DEV-gated logging,
                         │                     bars, ~100-300B;    dispatches to
                         │                     full snapshot       callback)
                         │                     on init/refresh)
                         │
                         └─► getFullProfile()
                              O(n log n) sort
                              (sort required:
                               bars arrive OoO)

symbolDataPackage ───────────────────────────► marketDataStore
  NO initialMarketProfile                       (delta merge for updates,
  (stripped from client                         full snapshot for init)
  messages; backend init
  still uses raw bars)                                │
                                          ┌───────────┴───────────┐
                                          │                       │
                                    PriceTicker              FloatingDisplay
                                    (mini profile,           (full profile,
                                     37.5x80 canvas)         day range overlay)
                                          │                       │
                                    renderMiniMarketProfile   DisplayCanvas
                                    O(n) per update            createProfileMetricsStore
                                    (not per tick)             pre-computes POC, VA,
                                                                maxTpo, min/max price
```

---

## Executed Optimizations

### P1: Delta-Based profileUpdate (50-150x bandwidth reduction)

**Status:** DONE
**Files:** `MarketProfileService.js`, `DataRouter.js`, `WebSocketServer.js`, `marketDataStore.js`

Backend `onM1Bar()` now emits `{ symbol, delta: {added, updated}, seq, source }` instead of the full profile snapshot. Full snapshots are still emitted by `initializeFromHistory()` (initial connect) and `reemitProfile()` (client refresh).

The frontend `marketDataStore` profileUpdate handler distinguishes both message shapes:
- `data.profile?.levels` — full snapshot, replaces entirely
- `data.delta` — incremental merge via Map, sorted by price

Message routing: `WebSocketServer.js` detects `data.delta` vs `data.profile` and passes `isDelta` flag to `DataRouter.routeProfileUpdate()`.

### P2: Remove initialMarketProfile from Client Messages (~40KB savings/symbol)

**Status:** DONE
**Files:** `MessageBuilder.js`, `RequestCoordinator.js`

`symbolDataPackage` sent to clients no longer includes `initialMarketProfile` (raw M1 bars). The backend still uses `data.initialMarketProfile` from the original data parameter for `MarketProfileService.initializeFromHistory()` and `TwapService.initializeFromHistory()`. `MessageBuilder.buildCTraderMessage()` explicitly deletes it from the spread; `buildTradingViewMessage()` no longer includes the field.

### P3: Derived Store for Profile Metrics

**Status:** DONE
**File:** `src/stores/marketDataStore.js`

New `createProfileMetricsStore(symbol)` pre-computes POC, value area, maxTpo, min/max price, and level count. Computation only runs when `marketProfile` changes (profileUpdate cadence, ~once/minute), not on every tick. Import added from `marketProfile/calculations.js`.

### P4: Fix Memory Leak in cleanupSymbol()

**Status:** DONE
**File:** `services/tick-backend/MarketProfileService.js`

`cleanupSymbol()` now deletes entries from `profiles`, `sequenceNumbers`, and `symbolSources` Maps. Previously only `pendingBars`, `lastBarTimestamps`, and guard flags were cleaned, causing unbounded memory growth with symbol subscribe/unsubscribe cycles.

### P5: Pass maxTpo to drawBars

**Status:** DONE
**Files:** `src/lib/marketProfile/rendering.js`, `src/lib/marketProfile/orchestrator.js`

`drawBars()` now accepts `maxTpo` as a 6th parameter instead of recomputing `Math.max(...data.map(d => d.tpo))` internally. The orchestrator passes its already-computed `maxTpo` value.

### P6: Gate Hot-Path Logging Behind DEV/DEBUG Flags

**Status:** DONE
**Files:** `MarketProfileService.js`, `DataRouter.js`, `subscriptionManager.js`

- Backend: `const DEBUG = process.env.DEBUG_PROFILE === '1'` gates `console.log` in hot paths. `console.error`/`console.warn` remain ungated.
- Frontend: `import.meta.env.DEV` gates profileUpdate logging in `subscriptionManager.js`. Logging now also handles delta messages safely (uses `message.profile?.levels?.length` with delta fallback).

### P8: Sorted Levels Analysis

**Status:** VERIFIED — sort retained
**File:** `services/tick-backend/MarketProfileService.js`

Analyzed whether `getFullProfile()` could avoid its O(n log n) sort. Conclusion: sort is required because bars from different time ranges arrive out of order — a later bar can insert a price level that falls between existing Map entries. Map insertion order reflects first-encounter order, not sorted order. Explanatory comment added.

### P9: Frontend Delta Handler

**Status:** DONE (delivered as part of P1)
**File:** `src/stores/marketDataStore.js`

The profileUpdate handler in `subscribeToSymbol()` supports both protocols:
- Full snapshot: `data.profile.levels` → direct store replacement
- Delta: `data.delta.added`/`data.delta.updated` → Map-based merge into existing levels, sorted by price

The merge produces identical output to a full snapshot replacement because `Map.set()` handles both new and updated levels, then sorts.

---

## Deferred Optimization

### P7: Offscreen Canvas for Mini Profile Bars

**Status:** DEFERRED
**Effort:** Medium
**Rationale:** Requires significant refactoring of the PriceTicker rendering pipeline. The mini profile bars are static between profileUpdates but the current architecture re-renders the full canvas on every price tick. An offscreen canvas cache would avoid this, but the implementation risk is higher than the other optimizations. Can be revisited when rendering performance becomes a bottleneck.

---

## Quality Review

**Verdict:** PASS (after fixing MUST issue)

### Findings Fixed

| Finding | Severity | Fix |
|---------|----------|-----|
| Delta message crashes DEV-mode dispatch in subscriptionManager.js | MUST | Changed `message.profile.levels.length` to `message.profile?.levels?.length ?? delta info` |
| `symbolSources` not cleaned up in `cleanupSymbol()` | COULD | Added `this.symbolSources.delete(symbol)` |
| `normalizeData` silently preserves marketProfile — intent invisible | COULD | Added inline comment explaining profileUpdate handles profile separately |

### Verification

| Check | Result |
|-------|--------|
| Frontend build (`vite build`) | 98 modules, 0 errors |
| Backend syntax check (6 files) | All pass |
| 14 structural assertions | All pass |
| Quality review | PASS |
| Playwright E2E | Cannot run — Chromium networking limitation in container environment (all 76 test failures are `page.goto` timeouts, same as pre-change baseline) |

---

## Payload Analysis

| Symbol Type | Bucket Size | Typical Daily Levels | Full Snapshot Size | Delta Size (per bar) | Reduction |
|-------------|-------------|---------------------|--------------------|----------------------|-----------|
| EUR/USD (forex) | 0.0001 | 200-500 | ~15KB | ~100-300B | 50-150x |
| BTC/USD (crypto) | ~$7 | ~286 | ~8.5KB | ~100-300B | 30-85x |
| SOL/USD (volatile crypto) | ~$0.015 | ~1000 | ~30KB | ~100-300B | 100-300x |
| XAU/USD (gold) | ~$0.2 | ~400 | ~12KB | ~100-300B | 40-120x |

Messages sent once per minute per subscribed symbol. P1 changes per-update payload from column 4 to column 5.

---

## Files Changed

| File | Change |
|------|--------|
| `services/tick-backend/MarketProfileService.js` | Delta emission, memory leak fix, debug-gated logging, sort comment |
| `services/tick-backend/DataRouter.js` | `isDelta` parameter, delta vs snapshot message construction, debug-gated logging |
| `services/tick-backend/WebSocketServer.js` | Delta detection in profileUpdate listener |
| `services/tick-backend/utils/MessageBuilder.js` | Removed `initialMarketProfile` from both message builders |
| `services/tick-backend/RequestCoordinator.js` | Removed `initialMarketProfile` from client symbolDataPackage |
| `src/stores/marketDataStore.js` | Delta handler, `createProfileMetricsStore`, calculations import |
| `src/lib/marketProfile/rendering.js` | `drawBars` accepts `maxTpo` parameter |
| `src/lib/marketProfile/orchestrator.js` | Passes `maxTpo` to `drawBars` |
| `src/lib/connection/subscriptionManager.js` | DEV-gated logging, delta-safe message access |
