# Plan: marketDataStore.js Decomposition

## Context

`marketDataStore.js` (361 LOC) is the last god store in the frontend. It manages per-symbol market data state, WebSocket subscription lifecycle, message normalization, market profile handling, TWAP integration, daily resets, and latency tracking — all in one file. Every new data feature touches it.

The workspace.js decomposition and orchestrator compute/render splits established a pattern: **extract pure logic into testable modules, keep the store as the wiring hub.** This plan follows that pattern.

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

1. **Extract `normalizeData`** → `marketDataNormalizer.js` + tests
2. **Extract profile merge** → `marketProfileHandler.js` + tests
3. **Extract daily reset** → `dailyResetHandler.js` + tests
4. **Slim the store** — import extracted modules, remove inline logic
5. **Build + full test suite** — verify no regressions
6. **UI smoke test** — open app, verify ticks flow, profile renders, daily reset works

Steps 1-3 are independent and can be done in any order. Step 4 depends on 1-3.

## Verification

- `npx vite build` — build passes
- `npx vitest run` — all 365+ existing tests pass
- New test files: ~40 tests across 3 files covering normalization edge cases, profile source precedence, delta merging, daily reset field clearing
- UI: open app → verify price ticks, market profile renders, day range/ADR boundaries display
