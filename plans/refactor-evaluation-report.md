# NeuroSense FX — Refactoring Evaluation Report

**Date:** 2026-03-29 (updated post-execution)
**Scope:** Full codebase (frontend `src/` + backend `services/`)
**Method:** 25 parallel code quality agents across 38 categories (16 successful, 9 rate-limited)
**Total Findings:** 80+ across 25 code quality dimensions

---

## Executive Summary

The codebase is in **reasonable shape** following the recent housekeeping (530 files removed) and frontend debt remediation (57 findings). The analysis found **no architectural emergencies**, but identified **7 distinct issue clusters** ranging from a real memory leak bug to pervasive naming inconsistencies. The FX basket module is the most concentrated source of technical debt.

**Overall Code Health Rating: B- → B** (upgraded after Work 0 + Work 1)

| Area | Rating | Key Issue |
|------|--------|-----------|
| Frontend Core (rendering, connection) | B | String-as-type patterns, renderer interface inconsistencies |
| FX Basket Module | A- | Clean module ownership, no duplication (Work 2 complete) |
| Backend Services | B- | Error handling gaps, inconsistent error properties |
| Data Pipeline | A- | Recent updates show clean structure |
| Test Coverage | C | Singleton/DI issues block isolated unit testing |
| Zombie/Dead Code | A | Cleaned — 7 files + 14 exports removed |

**Verdict: Refactoring IS worth the effort, but should be targeted.** Work 0 and Work 1 are complete. The FX basket consolidation (Work 2) is the highest-ROI remaining item.

---

## Progress Tracker

| Work | Title | Status | Commit |
|------|-------|--------|--------|
| 0 | Delete Dead Files | **DONE** | `afe6715` |
| 1 | Fix Real Bugs | **DONE** | `e08c894`, `5fc1dd9` |
| 2 | Consolidate FX Basket | **DONE** | revised approach — extract to fxBasket/ |
| 3 | String-as-Type Enums | Pending | — |
| 4 | Unify Error Handling | Pending | — |
| 5 | Normalize symbol/pair Naming | Pending | — |
| 6 | Surface-Level Cleanups | **Partial** | `afe6715` removed `scaleForDPR`, `getSymbolDataWithDefaults` |
| 7 | Fix Stale Documentation | Pending | — |

---

## Work Item 0: Delete Dead Files — DONE
**Complexity:** trivial | **Status:** COMPLETE | **Commit:** `afe6715`

Deleted 7 files (~406 lines), removed 14 dead exports, cleaned 5 unused imports, removed 56-line commented-out code block. Also removed `scaleForDPR` no-op function and `getSymbolDataWithDefaults` self-deprecated function (partially covers Work 6).

**Key discovery:** `fxBasketValidation.js` was completely dead — basket data validation was NOT running despite the file existing. This gap is now visible and will be addressed in Work 2.

**Quality verified:** `vite build` passes, zero broken imports, zero dangling references.

---

## Work Item 1: Fix Real Bugs — DONE
**Complexity:** low | **Status:** COMPLETE | **Commit:** `e08c894`, cleanup `5fc1dd9`

### Bug A: Event Listener Memory Leaks — FIXED

All 5 `addEventListener`/`removeEventListener` pairs in `PriceMarkerInteraction` were broken:
- 4 canvas listeners registered anonymous wrappers (`e => this.handleMouseDown(e)`) but tried to remove with direct method references
- 1 document listener registered an anonymous arrow but tried to remove with a different anonymous arrow

**Fix:** Stored all 5 handler references as instance properties (`this._handleMouseDown`, etc.) in `init()`, referenced the same properties in `destroy()`.

### Bug B: `formatPriceWithPipPosition` Silent Arg Discard — FIXED

Two calls in `displayCanvasRenderer.js` passed 3 args to a 2-param function, silently discarding `pipSize`.

**Fix:** Chained `formatPriceToPipLevel(price, pipPosition, pipSize)` → `formatPriceWithPipPosition(roundedPrice, pipPosition)` to round to pip level then format.

**Quality verified:** All 5 listener pairs symmetric, zero 3-arg calls to `formatPriceWithPipPosition`, `vite build` passes.

---

## Work Item 2: Consolidate FX Basket Duplication — DONE
**Complexity:** high | **Priority:** HIGH | **Status:** COMPLETE (revised approach)

**Revised approach:** Instead of consolidating imports while leaving basket ownership in the god store, basket code was extracted out to `src/lib/fxBasket/` where it belongs, then dead Path B files were deleted.

**Changes:**
1. Deleted 3 dead Path B files: `fxBasketProcessor.js`, `fxBasketStore.js`, `fxBasketManager.js` (173 lines)
2. Added `IDLE` state to canonical `fxBasketStateMachine.js` BasketState enum
3. Centralized `CURRENCIES` in `fxBasketConfig.js` (was triplicated)
4. Added `updateBaskets` pipeline to `fxBasketCalculations.js`
5. Created `fxBasketSubscription.js` — extracted from `marketDataStore.js`
6. Updated `fxBasketDebug.js` to import `CURRENCIES` from config
7. Updated `FxBasketDisplay.svelte` import path
8. Updated CLAUDE.md docs to reflect new structure

**Result:** `marketDataStore.js` dropped from 507 to ~330 lines. All basket logic lives in `src/lib/fxBasket/`. Zero dead Path B code remains.

### BasketState Enum Divergence

```js
// marketDataStore.js:13-19 — BasketState with IDLE
const BasketState = {
  IDLE: 'idle', FAILED: 'failed', WAITING: 'waiting',
  READY: 'ready', ERROR: 'error'
};

// fxBasketStateMachine.js:7-12 — BasketState WITHOUT IDLE
export const BasketState = {
  FAILED: 'failed', WAITING: 'waiting',
  READY: 'ready', ERROR: 'error'
};
```

### CURRENCIES Array Triplication

```js
// marketDataStore.js:21, fxBasketManager.js:11, fxBasketDebug.js:73
const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'NZD'];
```

### Validation Pipeline Copy-Paste

```js
// fxBasketManager.js:54-57, fxBasketManager.js:90-93, marketDataStore.js:114-117
const baselineValidation = validateCalculationResult(baselineResult);
const currentValidation = validateCalculationResult(currentResult);
if (!baselineValidation.valid || !currentValidation.valid) { ... }
```

### Full Basket Calculation Pipeline Duplicated

The entire "calculate-both-baseline-current, validate-both, normalize, construct-basket-object" pipeline is copy-pasted across:
- `fxBasketManager.js` lines 41-78 (`updateBaskets`)
- `fxBasketManager.js` lines 80-111 (`getBasketData`)
- `marketDataStore.js` lines 99-135 (`updateBasketsLocal`)

**Why this matters:** The two BasketState definitions have **divergent values** (IDLE vs no IDLE), meaning state transitions behave differently depending on which code path executes. Adding a currency requires editing 3+ files.

Verify:
- `grep -rn 'const CURRENCIES = ' src/ --include='*.js'` (should show 1 after fix)
- `grep -rn 'BasketState' src/ --include='*.js'` (should show 1 definition after fix)

**Approach:**
1. Designate `fxBasketStateMachine.js` as the single source of truth for BasketState (add IDLE)
2. Extract CURRENCIES to `fxBasketConfig.js` (which already has BASKET_ZONES)
3. Extract the validate-both-results pattern to a shared function in `fxBasketValidation.js`
4. Extract the full calculate-validate-normalize-construct pipeline from `fxBasketManager.js`
5. Update `marketDataStore.js` to import from the canonical modules
6. Remove the duplicated code from `marketDataStore.js`

**Verification:**
```bash
grep -rn 'const CURRENCIES = ' src/ --include='*.js'  # 1 occurrence
grep -rn 'BasketState\s*=' src/ --include='*.js'       # 1 definition
npm test
```

---

## Work Item 3: Introduce Shared Constants for String-as-Type Patterns
**Complexity:** medium | **Priority:** MEDIUM | **Addresses:** 3 issues, ~58 occurrences

Connection status, WebSocket message types, and display/source identifiers are raw string literals scattered across 15+ files.

### Connection Status as Bare Strings (20+ comparisons, 8 files)

```js
this.status = 'connecting';   // connectionHandler.js:43
if (s === 'connected') return ...  // connectionManager.js:180
class:connected={connectionStatus === 'connected'} // DisplayHeader.svelte:57
```

### WebSocket Message Types (21+ raw strings, 7 files)

```js
if (data.type === 'symbolDataPackage') { ... }  // marketDataStore.js:172
if (data.type === 'tick') { ... }               // marketDataStore.js:207
const isSystem = message.type === 'status' || message.type === 'ready' || ...
                                                  // subscriptionManager.js:63-64
```

### Data Source / Display Type Identifiers (6+ comparisons)

```js
$: sourceLabel = source === 'tradingview' ? 'TV' : 'cT';  // DisplayHeader.svelte:32
{#if display.type === 'priceTicker'}   // Workspace.svelte:145
if (symbol === 'FX_BASKET') {          // displayCanvasRenderer.js:27
```

**Why this matters:** Adding a new message type or connection state requires auditing 7-8 files. No compiler catches missed cases.

Verify: `grep -rn "=== 'connected'" src/ --include='*.js' --include='*.svelte' | wc -l`

**Approach:**
1. Create `src/lib/constants/connectionStates.js` with `ConnectionStatus` enum
2. Create `src/lib/constants/messageTypes.js` with `MessageType` enum
3. Update `dataContracts.js` to export display type constants
4. Incrementally replace string literals (can be done file-by-file)

**Verification:**
```bash
grep -rn "=== 'connected'" src/ --include='*.js' | grep -v test | wc -l  # trending toward 0
npm test  # after each file conversion
```

---

## Work Item 4: Unify Error Handling Patterns
**Complexity:** medium | **Priority:** MEDIUM | **Addresses:** 5 issues, ~80 occurrences

### Three Incompatible Validation Patterns

```js
// Pattern 1: {valid, reason} — fxBasketValidation.js:9
return { valid: false, reason: 'Price is not a number' };
// Pattern 2: {valid, errors[]} — dataContracts.js:211
return { valid: false, errors };
// Pattern 3: throw — priceFormat.js:8
throw new Error('[formatPrice] pipPosition is required');
```

### 14 Silent Catch Blocks in fxBasketDebug.js

```js
try { return getState().fxPairs; } catch { return []; }
try { return getState().connectionStatus; } catch { return 'unknown'; }
// ... 12 more identical patterns — all silently swallow errors
```

### Backend Error Logging Missing Stack Traces

```js
// 9 catch blocks log only error.message, discarding stack trace:
console.error('[CTraderSession] Connection failed:', error.message);
```

### Backend Error Property Inconsistency

```js
// CTraderSession.js uses error.code
error.code = 'SYMBOL_NOT_FOUND';
// RequestCoordinator.js checks error.errorCode
const isRateLimit = error.errorCode === 'REQUEST_FREQUENCY_EXCEEDED';
// Retry logic misses .code-tagged errors
```

### Unprotected sendToClient

`StatusBroadcaster.sendToClient` performs `JSON.stringify` and `client.send` without try-catch, while the same operation in other methods is safely caught.

**Why this matters:** Callers cannot predict whether invalid input throws or returns an error object. The debug module silently hides all state corruption. Backend retry logic misses errors tagged with `.code` instead of `.errorCode`.

Verify:
- `grep -rn 'catch { return' src/lib/fxBasket/fxBasketDebug.js | wc -l`
- `grep -rn 'console.error(.*error\.message' services/ --include='*.js' | wc -l`

**Approach:**
1. Standardize validation to return `{valid, reason}` pattern (most common, 15/20 occurrences)
2. Add `console.warn` to the 14 silent catches in `fxBasketDebug.js`
3. Standardize backend error logging to include stack traces: `console.error('[Module] msg:', error)` not `console.error('[Module] msg:', error.message)`
4. Add try-catch to `StatusBroadcaster.sendToClient`
5. Normalize error properties in `RequestCoordinator` to check both `.code` and `.errorCode`

**Verification:**
```bash
grep -rn 'catch { return' src/lib/fxBasket/fxBasketDebug.js | wc -l  # should be 0
grep -rn 'console.error(.*error\.message' services/ --include='*.js' | wc -l  # should be 0
npm test
```

---

## Work Item 5: Normalize `symbol` vs `pair` Naming
**Complexity:** low | **Priority:** LOW | **Addresses:** 4 issues, ~110 occurrences

The same concept (currency pair identifier) is called `symbol` in single-pair functions and `pair` in basket functions, with `todaysOpen` vs `dailyOpen` for the same field.

```js
// marketDataStore.js — symbol in single-pair, pair in basket
export function subscribeToSymbol(symbol, ...) {
export function subscribeBasket(pairs, ...) {
    const pair = data.symbol;  // explicit alias bridging the two
```

```js
// fxBasketProcessor.js:89 — two names for same concept
const dailyOpen = message.todaysOpen || message.dailyOpen;
```

```js
// fxBasketValidation.js:30-36 — error mentions only todaysOpen
if (!message.todaysOpen && !message.dailyOpen) {
    return { valid: false, reason: 'Missing todaysOpen price' };  // misleading
}
```

Verify:
- `grep -c '\bpair\b' src/stores/marketDataStore.js` (18 occurrences)
- `grep -c '\bsymbol\b' src/stores/marketDataStore.js` (26 occurrences)

**Approach:**
1. Adopt `pair` as the canonical name within `fxBasket*` modules
2. Adopt `symbol` as the canonical name in data pipeline / store modules
3. Add explicit type alias or JSDoc: `/** @type {SymbolId} pair */`
4. Standardize `dailyOpen` as the canonical field name, keep `todaysOpen` as backward-compat in data contracts only

**Verification:** `grep -rn 'todaysOpen\|dailyOpen' src/lib/fxBasket/ --include='*.js'` — should show consistent usage

---

## Work Item 6: Surface-Level Cleanups (Batch)
**Complexity:** low | **Priority:** LOW | **Addresses:** 10 surface issues (2 already done)

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| Boolean trap `connect(true/false)` | `connectionManager.js:87,93,104` | Use `connect({fromReconnect: true})` | Pending |
| Magic number `14` (ADR lookback) | 7 locations | Extract `ADR_LOOKBACK_DAYS = 14` | Pending |
| Magic value `60000` (reconnect cap) | 4 locations | Extract `MAX_RECONNECT_DELAY_MS = 60000` | Pending |
| `scaleForDPR` identity function | `priceMarkerBase.js` | Remove or rename | **Done** (afe6715) |
| `getConnectionStatus` has side effects | `marketDataStore.js:349` | Rename to `getOrCreateConnectionStatusStore` | Pending |
| Single-letter params `ctx, d, s` | `visualizers.js:6,10` | Use `ctx, marketData, config` | Pending |
| Redundant `=== null \|\| === undefined` | `priceFormat.js:7,37,48` | Use `== null` | Pending |
| Dead `typeof import.meta.env` guard | `reconnectionHandler.js:24` | Remove the typeof check | Pending |
| `getSymbolDataWithDefaults` self-deprecated | `priceMarkerBase.js` | Remove (0 call sites) | **Done** (afe6715) |
| Dense formula `Math.ceil((x+0.15)*4)/4` | `dayRangeCalculations.js` | Extract `roundToNearestQuarter()` | Pending |

---

## Work Item 7: Fix Stale Documentation
**Complexity:** low | **Priority:** MEDIUM | **Addresses:** 8 stale doc claims + 4 vendored code provenance issues

### Stale Crystal Clarity Size Claims

| File | Claim | Reality |
|------|-------|---------|
| `reconnectionHandler.js:1-11` | "1000ms * 2^attempt, max 10, cap 30s" | Actual: baseDelay=500, maxAttempts=Infinity, maxDelay=10000 |
| `connectionHandler.js:1-4` | "<60 lines" | 201 lines |
| `fxBasketDebug.js:1` | "<50 lines" | 147 lines |
| `dayRangeElements.js:2` | "<15 lines each" | drawPriceMarker is 59 lines |
| `priceFormat.js:13` | "DEPRECATED" | Primary function with 9 call sites |
| `marketProfile/orchestrator.js:57` | JSDoc missing `openPrice` param | Required field omitted |
| `CLAUDE.md:67-69` | `skills/` and `tests/` directories | Actual: `.claude/skills/` and `src/tests/` |

### Vendored Code Provenance Gaps

| Issue | File | Fix |
|-------|------|-----|
| cTrader-Layer fork undocumented | `libs/CLAUDE.md` | Document as forked from `@reiryoku/ctrader-layer` with local patches |
| 37 tracked build files | `libs/cTrader-Layer/build/` | Add "do not edit" warning + regeneration command |
| Protobuf schemas undocumented | `libs/cTrader-Layer/protobuf/` | Document upstream source and update process |
| Skills vendored from solatis | `.claude/skills/CLAUDE.md` | Document upstream repo and sync process |

### Test Naming Issues (Low Priority)

- 4 tests in `backend-reinit.spec.js` use redundant "test" suffix (e.g., "Alt+R keyboard shortcut test")
- 13 tests across 5 files use "should verify" prefix describing actions not behavior
- 5 tests in `fx-basket.spec.js` describe generic capabilities not acceptance criteria
- 11 tests in `comprehensive-llm-workflow.spec.js` use `PHASE N` ordering prefix instead of behavioral names

---

## Interface Inconsistency Findings (Reference)

These findings from the Interface Consistency agents detail the specific API mismatches:

### `connect()` Signature Mismatch
```js
// CTraderSession.js:49 — no args
async connect() {
// TradingViewSession.js:51 — requires sessionId
async connect(sessionId) {
```

### Renderer Signatures Incompatible
```js
// visualizers.js:6 — (ctx, d, s) 3-arg
export function renderDayRange(ctx, d, s) {
// dayRangeOrchestrator.js:11 — (ctx, d, s, getConfig, options) 4+1-arg
export function renderDayRange(ctx, d, s, getConfig, options = {}) {
```

### `getConfig()` Same Name, Different Shapes
```js
// dayRangeConfig.js — returns {features, scaling, emphasis}
// fxBasketConfig.js — returns {verticalPadding, markerWidth}
// Same function name, incompatible return types
```

### `createPriceScale()` Same Name, Different Computation
```js
// dayRangeRenderingUtils.js — hardcoded labelPadding = 5
// priceScale.js — reads config.positioning.padding
// Same signature, different Y-coordinate mapping
```

### `calculateAdaptiveScale()` Dual Signature
```js
// dayRangeCalculations.js:64 — (data, config) 2-arg
export function calculateAdaptiveScale(d, config) {
// marketProfile/scaling.js:9 — (profile, marketData, width, height) 4-arg
export function calculateAdaptiveScale(profile, marketData, width, height) {
```

### SubscriptionManager API Mismatch (Frontend vs Backend)
```js
// Frontend: subscribe(key, callback, adr) → unsubscribe function
// Backend: addClientSubscription(symbol, source, client) → boolean
// Same class name, completely different APIs
```

---

## Dependency Injection / Testability Issues (Reference)

### ConnectionManager Hard-Coded Singleton
```js
// connectionManager.js — all sub-dependencies created in constructor
let sharedInstance = null;
static getInstance(url) {
  if (!sharedInstance) sharedInstance = new ConnectionManager(url);
  return sharedInstance;
}
// Used in 7 locations — all untestable without real WebSocket
```

### Module-Level Mutable Maps as Global State
```js
// marketDataStore.js:7-8 (basket Maps extracted to fxBasketSubscription.js)
const marketDataStores = new Map();
const activeSubscriptions = new Map();
let _connectionStatusStore = null;
// 3 mutable globals — no injection, no reset between tests
```

### WebSocket URL Hard-Coded
```js
// displayDataProcessor.js:9-16
export function getWebSocketUrl() {
  const wsUrl = import.meta.env.VITE_BACKEND_URL ||
    (window.location.port === '5174' || window.location.port === '4173' ? ... : ...);
  return wsUrl;
}
// 7 consumers coupled to browser-specific globals
```

### Date.now()/setTimeout in State Machine
```js
// fxBasketStateMachine.js:34-35
sm.startTime = Date.now();
sm.timeoutId = setTimeout(() => finalizeState(sm), sm.timeoutMs);
// Cannot test time-based transitions without real time passing
```

### ReconnectionHandler Non-Determinism
```js
// reconnectionHandler.js:23-29,44
getMaxAttemptsFromEnv() { ... import.meta.env.VITE_MAX_RECONNECT_ATTEMPTS ... }
const jitter = Math.random() * 0.3 * baseDelay;
// Non-reproducible in tests; cannot override without env var
```

### localStorage Direct Access
```js
// workspace.js:284-314
const stored = localStorage.getItem('workspace-state');
localStorage.setItem('workspace-state', JSON.stringify(data));
// Tests must mock global localStorage instead of injecting storage adapter
```

---

## Superseded Items

| Originally Identified | Superseded By | Reason |
|-----------------------|---------------|--------|
| BasketState enum duplication | Work 2 | Canonical source of truth eliminates divergence |
| CURRENCIES array triplication | Work 2 | Single exported constant replaces all copies |
| Validation pipeline repetition | Work 2 | Shared validation function replaces copy-paste |
| Connection status bare strings | Work 3 | Shared enum replaces raw literals |
| Message type bare strings | Work 3 | Shared enum replaces raw literals |
| SubscriptionManager API mismatch | Deferred | External repo boundary — coordinate separately |
| Backend error property inconsistency | Deferred | External repo (ctrader layer) — coordinate separately |

---

## Execution Notes

**Completed:** Work 0 (dead files) + Work 1 (bug fixes) + Work 2 (FX basket extraction) + partial Work 6

**Suggested next steps:**

| Order | Work | Why | Effort |
|-------|------|-----|--------|
| 1 | **Work 4** (error handling) | Prevents future debugging pain — 14 silent catches, inconsistent patterns | Medium (1 session) |
| 2 | **Work 3** (string enums) | Broad but can be done file-by-file — ~58 bare string comparisons | Medium (1 session) |
| 3 | **Work 7** (stale docs) | Low-risk comment updates — 8 incorrect claims | Low (30 min) |
| 4 | **Work 5** (naming) | Symbol/pair convention — ~110 occurrences | Low (30 min) |
| 5 | **Work 6** (remaining surface) | 8 remaining items from the batch | Low (30 min) |

**External repos** (ctrader layer, tradingview-ws) have their own error handling and API inconsistencies — those should be addressed in their respective repos, not here.

---

## Analysis Metadata

| Metric | Value |
|--------|-------|
| Agents launched | 25 |
| Agents successful | 16 |
| Agents rate-limited | 9 |
| Total findings | 80+ |
| High severity | 28 |
| Medium severity | 35 |
| Low severity | 17+ |
| Categories covered | Interface Consistency, State/Flags, Type Design, Type-Based Branching, Missing Domain Modeling, Naming Consistency, Conditional Anti-Patterns, Error Pattern Consistency, Condition Repetition, Control Flow, Readability, Error Handling, Boolean Complexity, Test Quality, Naming Precision, Documentation Staleness, Zombie Code, Generated/Vendored Code, Dependency Injection |
| Categories missed (rate-limited) | State and Flags, Type Design, Dependency Injection (code), Business Rule Scattering, Type-Based Branching (design), Control Flow Smells (design), Boolean Expression Complexity, Control Flow Smells (code), Type Design (design) |
