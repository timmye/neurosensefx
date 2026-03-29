# NeuroSense FX — Refactoring Evaluation Report

**Date:** 2026-03-29
**Scope:** Full codebase (frontend `src/` + backend `services/`)
**Method:** 25 parallel code quality agents across 38 categories (16 successful, 9 rate-limited)
**Total Findings:** 80+ across 25 code quality dimensions

---

## Executive Summary

The codebase is in **reasonable shape** following the recent housekeeping (530 files removed) and frontend debt remediation (57 findings). The analysis found **no architectural emergencies**, but identified **7 distinct issue clusters** ranging from a real memory leak bug to pervasive naming inconsistencies. The FX basket module is the most concentrated source of technical debt.

**Overall Code Health Rating: B-**

| Area | Rating | Key Issue |
|------|--------|-----------|
| Frontend Core (rendering, connection) | B | String-as-type patterns, renderer interface inconsistencies |
| FX Basket Module | C+ | Heavy duplication (state machine, constants, validation) |
| Backend Services | B- | Error handling gaps, inconsistent error properties |
| Data Pipeline | A- | Recent updates show clean structure |
| Test Coverage | C | Singleton/DI issues block isolated unit testing |

**Verdict: Refactoring IS worth the effort, but should be targeted.** The FX basket module consolidation and the 2 real bugs are high-ROI. The string-as-type and DI refactors are valuable but can be deferred.

---

## Work Item 0: Delete Dead Files
**Complexity:** trivial | **Priority:** CRITICAL | **Addresses:** 6 dead modules, ~400 lines

The Zombie Code agent found **6 entire files that are never imported anywhere**:

| File | Lines | What |
|------|-------|------|
| `src/lib/percentageMarkers.js` | 53 | Superseded by `percentageMarkerRenderer.js` |
| `src/lib/priceScale.js` | 20 | Duplicate of `dayRangeRenderingUtils.js` version |
| `src/lib/fxBasket/basketAdrCalculations.js` | 187 | Entire unused ADR calculation module |
| `src/lib/fxBasket/fxBasketValidation.js` | 48 | Dead validation layer (validation is NOT running!) |
| `src/lib/fxBasket/fxBasketSubscription.js` | 27 | Batch subscribe never wired up |
| `src/lib/websocket/messageCoordinator.js` | 52 | Referenced in a comment but never used |
| `src/lib/dayRangeMarkers.js` | 19 | Dead re-export barrel file |

Additional dead exports found:
- 3 of 4 functions in `fxBasketManager.js` are unused (`initializeBaskets`, `getBasketData`, `getAllBaskets`)
- 2 dead exports in `fxBasketStore.js` (`hasPairData`, `createStore`)
- 56 lines of commented-out `calculateAdaptiveScaleAsymmetric` in `dayRangeCalculations.js`
- 5 unused imports in `priceMarkerInteraction.js` and `displayCanvasRenderer.js`
- `getSymbolDataWithDefaults` in `priceMarkerBase.js` — self-deprecated, 0 call sites
- `updateMaxPercentage` in `dayRangeCalculations.js` — defined but never called
- `formatPercentage` in `dayRangeCore.js` — exported, never imported
- `scaleForDPR` in `priceMarkerBase.js` — identity function (no-op)

**Critical note:** `fxBasketValidation.js` being dead means **basket data validation is NOT running** — the file exists but no code imports it.

**Also found:** `formatPriceWithPipPosition` is marked DEPRECATED in comments but has 9 call sites and is the primary function in use.

**Approach:**
1. Delete the 7 dead files
2. Remove dead exports from `fxBasketManager.js` (3 functions), `fxBasketStore.js` (2 functions), `dayRangeCore.js` (1 function)
3. Remove the 56-line commented-out `calculateAdaptiveScaleAsymmetric` block
4. Clean up 5 unused imports in `priceMarkerInteraction.js` and `displayCanvasRenderer.js`
5. Fix the DEPRECATED comment on `formatPriceWithPipPosition` since it's the primary API

**Verification:**
```bash
for f in src/lib/percentageMarkers.js src/lib/priceScale.js src/lib/fxBasket/basketAdrCalculations.js src/lib/fxBasket/fxBasketValidation.js src/lib/fxBasket/fxBasketSubscription.js src/lib/websocket/messageCoordinator.js src/lib/dayRangeMarkers.js; do test -f "$f" && echo "EXISTS: $f"; done
npm test
```

---

## Work Item 1: Fix Real Bugs
**Complexity:** low | **Priority:** CRITICAL | **Addresses:** 2 bugs

### Bug A: `removeEventListener` Memory Leak
**File:** `src/lib/priceMarkerInteraction.js:35,174`

```js
// Line 35 — anonymous arrow registered
document.addEventListener('keydown', e => e.key === 'Escape' && this.hideDropdown());
// Line 174 — DIFFERENT anonymous arrow, removeEventListener fails
document.removeEventListener('keydown', e => e.key === 'Escape' && this.hideDropdown());
```

**Impact:** The keydown listener is never removed — every time the component mounts/unmounts, another listener accumulates.

Verify: `grep -n "e.key === 'Escape'" src/lib/priceMarkerInteraction.js`

### Bug B: `formatPriceWithPipPosition` Silently Discards Argument
**File:** `src/lib/displayCanvasRenderer.js:160-161`

```js
// priceFormat.js:14 — defined with 2 params
export function formatPriceWithPipPosition(price, pipPosition) {
// displayCanvasRenderer.js:160 — called with 3, pipSize silently ignored
const formattedStartPrice = formatPriceWithPipPosition(deltaInfo.startPrice, pipPosition, pipSize);
```

**Impact:** `pipSize` is discarded — likely a copy-paste from `formatPriceToPipLevel` which does accept it.

Verify: `grep -rn 'formatPriceWithPipPosition(' src/ --include='*.js'`

**Approach:**
1. Store the keydown handler as `this._escapeHandler` in `priceMarkerInteraction.js`
2. Use the same reference for both `addEventListener` and `removeEventListener`
3. Fix `displayCanvasRenderer.js:160-161` to call `formatPriceToPipLevel` if pipSize is needed, or remove the 3rd arg

**Verification:** `npm test`

---

## Work Item 2: Consolidate FX Basket Duplication
**Complexity:** high | **Priority:** HIGH | **Addresses:** 6 issues, ~130 occurrences

The FX basket module has the densest technical debt. The state machine, constants, validation, and calculation pipelines are all duplicated between `marketDataStore.js` and the `fxBasket*` modules.

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
**Complexity:** low | **Priority:** LOW | **Addresses:** 10 surface issues

| Issue | File | Fix |
|-------|------|-----|
| Boolean trap `connect(true/false)` | `connectionManager.js:87,93,104` | Use `connect({fromReconnect: true})` |
| Magic number `14` (ADR lookback) | 7 locations | Extract `ADR_LOOKBACK_DAYS = 14` |
| Magic value `60000` (reconnect cap) | 4 locations | Extract `MAX_RECONNECT_DELAY_MS = 60000` |
| `scaleForDPR` is identity function | `priceMarkerBase.js:121` | Remove or rename to `logicalPixels()` |
| `getConnectionStatus` has side effects | `marketDataStore.js:349` | Rename to `getOrCreateConnectionStatusStore` |
| Single-letter params `ctx, d, s` | `visualizers.js:6,10` | Use `ctx, marketData, config` |
| Redundant `=== null \|\| === undefined` | `priceFormat.js:7,37,48` | Use `== null` |
| Dead `typeof import.meta.env` guard | `reconnectionHandler.js:24` | Remove the typeof check |
| `getSymbolDataWithDefaults` self-deprecated | `priceMarkerBase.js:101` | Remove (0 external call sites) |
| Dense formula `Math.ceil((x+0.15)*4)/4` | `dayRangeCalculations.js:41,95,143,154` | Extract `roundToNearestQuarter()` |

---

## Work Item 7: Fix Stale Documentation
**Complexity:** low | **Priority:** MEDIUM | **Addresses:** 8 stale doc claims + 4 vendored code provenance issues

### Stale Crystal Clarity Size Claims

| File | Claim | Reality |
|------|-------|---------|
| `reconnectionHandler.js:1-11` | "1000ms * 2^attempt, max 10, cap 30s" | Actual: baseDelay=500, maxAttempts=Infinity, maxDelay=10000 |
| `connectionHandler.js:1-4` | "<60 lines" | 201 lines |
| `fxBasketDebug.js:1` | "<50 lines" | 147 lines |
| `fxBasketManager.js:1-5` | "All functions <15 lines" | 3 functions are 28-39 lines |
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
// marketDataStore.js:7-11
const marketDataStores = new Map();
const activeSubscriptions = new Map();
const basketStateMachines = new Map();
const basketStores = new Map();
let _connectionStatusStore = null;
// 5 mutable globals — no injection, no reset between tests
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

**Suggested order:** Work 0 → Work 1 → Work 2 → Work 4 → Work 3 → Work 7 → Work 5 → Work 6

**Reasoning:**
- **Work 0** (dead files) is zero-risk, immediate cleanup — removes confusion
- **Work 1** (bugs) is zero-risk, immediate value — fixes real issues
- **Work 2** (FX basket) has the highest structural impact and eliminates the most duplication
- **Work 4** (error handling) prevents future debugging pain
- **Work 3** (string enums) is prerequisite-clean but broad — can be done incrementally
- **Work 7** (docs) is low-risk comment updates
- **Work 5-6** are low-priority polish

**Estimated total effort:** ~3-4 focused sessions for Work 0-4, remainder as time permits.

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
