# Plan: marketDataStore.js Decomposition

**Status:** DONE. Commit `5ce5c4d`. Store reduced from 361→205 LOC. 79 new tests. Public API unchanged.

## Context

Determined by /workspaces/neurosensefx/docs/frontend-architecture-assessment-2026-06.md

`marketDataStore.js` (361 LOC) was the last god store in the frontend. It managed per-symbol market data state, WebSocket subscription lifecycle, message normalization, market profile handling, TWAP integration, daily resets, and latency tracking — all in one file. Every new data feature touched it.

The workspace.js decomposition and orchestrator compute/render splits established a pattern: **extract pure logic into testable modules, keep the store as the wiring hub.** This plan followed that pattern.

## Key Insight

Unlike `workspace.js` (which had separate state domains), `marketDataStore` has a single per-symbol state object where all concerns mix into one flat shape. Splitting into separate Svelte stores would mean each component subscribes to multiple stores for one symbol — adding complexity with no benefit.

The right approach: **extract pure functions, keep the store as orchestrator.** Same pattern as the compute/render splits.

## Decomposition

### New file: `src/stores/marketDataNormalizer.js` (~80 LOC)

Extract the `normalizeData()` function (lines 82-153) as two named pure functions:

```js
export function normalizeSymbolDataPackage(data, currentState) { ... }  // lines 83-121
export function normalizeTick(data, currentState) { ... }               // lines 123-151
```

**Why:** This is the messiest logic in the store — legacy field fallbacks, mid-price calculation, running high/low, direction inference. Pure function, easily testable with synthetic messages. The store's `handleStoreUpdate()` just delegates to these.

### New file: `src/stores/marketProfileHandler.js` (~55 LOC)

Extract the profile update logic (currently inline in the subscribeToSymbol callback, lines 207-248):

```js
export function mergeProfileUpdate(current, data) { ... }
```

**Why:** Source precedence (TradingView > cTrader), delta merging, and profile-derived high/low updates are complex and currently untested. As a pure function, trivial to test with synthetic profile data.

### New file: `src/stores/dailyResetHandler.js` (~35 LOC)

Extract daily reset logic (lines 11-44):

```js
export function createResetFields(current) { ... }
export function setupDailyResetHandler(connectionManager, getStore) { ... }
```

**Why:** The reset field list is a maintenance burden — every new state field must be remembered here. Extracting makes it self-documenting and testable. The setup function takes a callback to avoid coupling to the Map.

### Inline in store: `calculateLatency()` (lines 74-80)

**Keep in the store.** It's 7 lines, pure, and only called once. Not worth its own file. But move it to the top as a clearly labeled pure helper.

### What stays in `marketDataStore.js` (~200 LOC)

- `marketDataStores` Map + `getMarketDataStore()`
- `activeSubscriptions` Map + `subscribeToSymbol()` / `unsubscribeFromSymbol()`
- `handleStoreUpdate()` — now delegates to `normalizeSymbolDataPackage` / `normalizeTick`
- Subscription callback — profile branch delegates to `mergeProfileUpdate`, TWAP branch stays inline (10 lines)
- `getConnectionStatus()`
- `clearStore()` / `clearAllStores()`
- Window devtools exposure

## File Changes

| File | Action | LOC change |
|------|--------|-----------|
| `src/stores/marketDataNormalizer.js` | **Create** | ~80 |
| `src/stores/marketProfileHandler.js` | **Create** | ~55 |
| `src/stores/dailyResetHandler.js` | **Create** | ~35 |
| `src/stores/marketDataStore.js` | **Edit** — remove extracted logic, import from new modules | 361 → ~200 |
| `src/stores/__tests__/marketDataNormalizer.test.js` | **Create** | ~120 |
| `src/stores/__tests__/marketProfileHandler.test.js` | **Create** | ~80 |
| `src/stores/__tests__/dailyResetHandler.test.js` | **Create** | ~40 |

No component changes. No consumer changes. The store's public API is identical — same 6 exports, same signatures.

## Execution Order

1. **Extract `normalizeData`** → `marketDataNormalizer.js` + tests — **DONE** (46 tests)
2. **Extract profile merge** → `marketProfileHandler.js` + tests — **DONE** (20 tests)
3. **Extract daily reset** → `dailyResetHandler.js` + tests — **DONE** (13 tests)
4. **Slim the store** — import extracted modules, remove inline logic — **DONE** (361→205 LOC)
5. **Build + full test suite** — verify no regressions — **DONE** (444 tests pass, build passes)

## Verification

- `npx vite build` — build passes
- `npx vitest run` — 444 tests pass (365 existing + 79 new)
- UI: confirmed working by project owner
