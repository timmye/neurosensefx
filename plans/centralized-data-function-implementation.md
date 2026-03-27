# Implementation Plan: Centralized Data Function

**Created:** 2026-03-27
**Updated:** 2026-03-27 (Quality Review Fixes)
**Based on:** `/workspaces/neurosensefx/docs/data-pipeline-centralized-function-assessment.md`
**Target:** ~310 net new lines, positive tech debt reduction

---

## Architectural Notes

### Relationship to workspace.js

| Store | Responsibility | Why Separate |
|-------|---------------|--------------|
| `workspace.js` | UI layout (positions, sizes, z-index, markers) | Persists to localStorage, manages display configuration |
| `marketDataStore.js` | Market data (prices, profile, latency) | Real-time WebSocket data, per-symbol lifecycle |

**Rationale:** workspace.js manages *where* displays are; marketDataStore manages *what data* they show. These are orthogonal concerns with different persistence and lifecycle requirements.

### Module Organization (Avoiding God Object)

If marketDataStore.js grows beyond 300 lines, consider splitting:

```
src/stores/
├── marketDataStore.js       # Public API, re-exports
├── marketData/
│   ├── core.js              # Store creation, getState()
│   ├── subscriptions.js     # Reference counting, deduplication
│   ├── derived.js           # createCurrentPriceStore, etc.
│   └── latency.js           # Latency calculation, stats
```

---

## Decision Log

| Decision | Chosen Approach | Alternatives Considered | Rationale |
|----------|-----------------|------------------------|-----------|
| **Migration Strategy** | Incremental phase-based with per-phase rollback | Big-bang, feature flags, parallel implementation | Per-component rollback allows safe recovery; no dual-maintenance overhead from feature flags |
| **Store Architecture** | Per-symbol writable stores with centralized subscription manager | Single giant store, component-scoped stores | Per-symbol stores allow independent lifecycle; centralized subscriptions enable deduplication |
| **FX Basket Integration** | Integrate state machine into store (not separate) | Keep as separate module | State machine needs access to all 30 symbol stores; keeping separate would require circular imports |

---

## Overview

Implement a centralized market data store that provides:
1. Single source of truth for price data per symbol
2. Svelte derived stores for computed values
3. Latency tracking instrumentation
4. Schema versioning for WebSocket messages
5. Incremental migration path for existing components

---

## Phase 1: Foundation (marketDataStore.js)

**File:** `/workspaces/neurosensefx/src/stores/marketDataStore.js`
**Lines:** ~250-300

### 1.1 Store Structure

```javascript
// Core writable stores per symbol
const marketDataStores = new Map(); // symbol -> writable store
const activeSubscriptions = new Map(); // symbol -> { count, unsubscribe }

// Schema version constant
const SCHEMA_VERSION = '1.0.0';
```

### 1.2 Exports

```javascript
// Store access (follows workspace.js pattern)
export function getMarketDataStore(symbol);
// Each store has .getState() method for non-reactive access

// Derived stores
export function createCurrentPriceStore(symbol);
export function createRangePercentStore(symbol);
export function createDailyChangeStore(symbol);
export function createLatencyStore(symbol);

// Subscription management
export function subscribeToSymbol(symbol, source, options);
export function unsubscribeFromSymbol(symbol);

// Connection status (replaces useDisplayState)
export function getConnectionStatus();

// Latency tracking
export function recordLatency(symbol, latencyMs);
export function getLatencyStats(symbol);
```

### 1.3 Store Data Shape

```javascript
{
  symbol: 'EURUSD',
  source: 'ctrader',

  // Price data
  current: 1.0850,
  high: 1.0875,
  low: 1.0825,
  open: 1.0840,
  adrHigh: 1.0890,
  adrLow: 1.0810,

  // Pip configuration
  pipPosition: 4,
  pipSize: 0.0001,
  pipetteSize: 0.00001,

  // State
  previousPrice: 1.0849,
  direction: 'up',

  // Market profile
  marketProfile: null,

  // Latency tracking (NEW)
  receivedAt: null,      // Backend timestamp
  sentAt: null,          // WebSocket send timestamp
  clientReceivedAt: null, // Frontend receive timestamp
  latency: {
    backend: null,       // sentAt - receivedAt
    network: null,       // clientReceivedAt - sentAt
    e2e: null            // clientReceivedAt - receivedAt
  },

  // Error handling (NEW)
  error: null,           // Error object if subscription failed
  status: 'pending' | 'connected' | 'error' | 'stale',

  // Metadata
  lastUpdate: null,
  schemaVersion: '1.0.0'
}
```

### 1.4 Error Handling Strategy

```javascript
// Store creation always succeeds - returns store even for invalid symbols
function getMarketDataStore(symbol) {
  if (!marketDataStores.has(symbol)) {
    const store = writable(createInitialData(symbol));
    // Add getState() method following workspace.js pattern
    store.getState = () => {
      let value;
      store.subscribe(v => value = v)();
      return value;
    };
    marketDataStores.set(symbol, store);
  }
  return marketDataStores.get(symbol);
}

// Subscription returns unsubscribe function, errors propagate via store status
function subscribeToSymbol(symbol, source, options) {
  const store = getMarketDataStore(symbol);

  // Update status on subscription start
  store.update(data => ({ ...data, status: 'pending' }));

  const unsubscribe = connectionManager.subscribeAndRequest(
    symbol,
    (data) => handleStoreUpdate(symbol, data),
    options?.adr ?? 14,
    source
  );

  // Track subscription for deduplication
  // ... reference counting logic

  return () => {
    unsubscribe();
    store.update(data => ({ ...data, status: 'pending' }));
  };
}

// Validation integrated from dataContracts.js
function handleStoreUpdate(symbol, data) {
  const store = getMarketDataStore(symbol);

  // Dev mode validation (preserves useDataCallback pattern)
  if (import.meta.env.DEV) {
    const validation = validateWebSocketMessage(data, 'marketDataStore');
    logValidationResult('marketDataStore', validation, data);
  }

  // Calculate latency
  const clientReceivedAt = Date.now();
  const latency = calculateLatency(data, clientReceivedAt);

  store.update(current => ({
    ...current,
    ...normalizeData(data),
    clientReceivedAt,
    latency,
    status: 'connected',
    error: null,
    lastUpdate: clientReceivedAt
  }));
}
```

---

## Phase 2: Backend Latency Instrumentation

**Files Modified:** 3
**Lines Added:** ~25

### 2.1 DataRouter.js

**File:** `/workspaces/neurosensefx/services/tick-backend/DataRouter.js`

```javascript
// In routeFromCTrader() - add at method entry (line ~17)
routeFromCTrader(tick) {
    tick._receivedAt = Date.now();  // ADD
    const message = buildCTraderMessage(tick);
    // ...
}

// In routeFromTradingView() - add at method entry (line ~26)
routeFromTradingView(candle) {
    candle._receivedAt = Date.now();  // ADD
    const message = buildTradingViewMessage(candle);
    // ...
}

// In broadcastToClients() - add before JSON.stringify (line ~90)
broadcastToClients(message, symbol, source) {
    message.sentAt = Date.now();  // ADD
    const jsonMessage = JSON.stringify(message);
    // ...
}
```

### 2.2 MessageBuilder.js

**File:** `/workspaces/neurosensefx/services/tick-backend/utils/MessageBuilder.js`

```javascript
const SCHEMA_VERSION = '1.0.0';

// In buildCTraderMessage() - add to message object
function buildCTraderMessage(tick) {
    return {
        v: SCHEMA_VERSION,           // ADD
        receivedAt: tick._receivedAt, // ADD
        // ... existing fields
    };
}

// In buildTradingViewMessage() - add to message object
function buildTradingViewMessage(candle) {
    return {
        v: SCHEMA_VERSION,           // ADD
        receivedAt: candle._receivedAt, // ADD
        // ... existing fields
    };
}
```

### 2.3 HealthMonitor.js (Optional Enhancement)

**File:** `/workspaces/neurosensefx/services/tick-backend/HealthMonitor.js`

```javascript
// Add latency tracking methods (~15 lines)
constructor(...) {
    // ... existing
    this.latencySamples = [];
    this.maxSamples = 100;
}

recordLatency(latencyMs) {
    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > this.maxSamples) {
        this.latencySamples.shift();
    }
}

getLatencyStats() {
    if (this.latencySamples.length === 0) return null;
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    return {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        avg: sorted.reduce((a, b) => a + b, 0) / sorted.length
    };
}
```

---

## Phase 3: Migrate PriceTicker (Pilot)

**File:** `/workspaces/neurosensefx/src/components/PriceTicker.svelte`
**Lines Removed:** ~25-30
**Lines Added:** ~10-15
**Net Change:** -15 lines

### 3.1 Remove

```javascript
// Remove imports
import { useWebSocketSub } from '../composables/useWebSocketSub';

// Remove state
let webSocketSub;
let lastData = null;
let lastMarketProfileData = null;

// Remove subscription in onMount (lines 128-141)
webSocketSub.subscribe(formattedSymbol, ...);

// Remove symbol change reactive block (lines 169-176)
$: if (formattedSymbol !== previousSymbol && ...);
```

### 3.2 Add

```javascript
// Add imports
import { getMarketDataStore, subscribeToSymbol } from '../stores/marketDataStore.js';

// CRITICAL: Reactive store assignment - store reference changes when symbol changes
// Option A: Reactive assignment (recommended for simple cases)
$: marketData = getMarketDataStore(formattedSymbol);
$: lastData = $marketData;

// Option B: Manual subscription with cleanup (more control)
let unsubscribe;
let previousSymbol = null;

$: if (formattedSymbol !== previousSymbol) {
    unsubscribe?.();
    unsubscribe = subscribeToSymbol(formattedSymbol, source);
    previousSymbol = formattedSymbol;
}

onDestroy(() => unsubscribe?.());

// For this migration, use Option B for consistency with existing symbol change handling
```

### 3.3 Symbol Change Handling (Critical Fix)

```javascript
// Symbol change handling MUST be preserved from existing pattern
// Existing PriceTicker lines 169-176:
//   $: if (formattedSymbol !== previousSymbol && webSocketSub) { ... }

// New pattern with store:
let unsubscribe;
let previousSymbol = null;

$: if (formattedSymbol !== previousSymbol && previousSymbol !== null) {
    // Unsubscribe from old symbol
    unsubscribe?.();

    // Subscribe to new symbol
    unsubscribe = subscribeToSymbol(formattedSymbol, source);

    // Clear stale data
    lastData = null;
    lastMarketProfileData = null;

    previousSymbol = formattedSymbol;
}

// Initial subscription in onMount
onMount(() => {
    previousSymbol = formattedSymbol;
    unsubscribe = subscribeToSymbol(formattedSymbol, source);
    return () => unsubscribe?.();
});

// Reactive store access
$: marketData = getMarketDataStore(formattedSymbol);
$: lastData = $marketData;
```

---

## Phase 4: Migrate FloatingDisplay

**File:** `/workspaces/neurosensefx/src/components/FloatingDisplay.svelte`
**Lines Removed:** ~35-40
**Lines Added:** ~10-15
**Net Change:** -25 lines

### 4.1 Remove

```javascript
// Remove imports
import { useWebSocketSub } from '../composables/useWebSocketSub';
import { useDisplayState } from '../composables/useDisplayState';
import { useDataCallback } from '../composables/useDataCallback';

// Remove state
let lastData = null;
let lastMarketProfileData = null;
let webSocketSub, displayState, handlers;

// Remove callback creation
const { createCallback } = useDataCallback();

// Remove subscription logic in onMount (lines 86-105)
```

### 4.2 Add

```javascript
// Add imports
import { getMarketDataStore, subscribeToSymbol, getConnectionStatus } from '../stores/marketDataStore.js';

// CRITICAL: Symbol change handling with proper cleanup
let unsubscribe;
let previousSymbol = null;

$: if (formattedSymbol !== previousSymbol && formattedSymbol) {
    // Unsubscribe from old symbol
    unsubscribe?.();

    // Subscribe to new symbol
    unsubscribe = subscribeToSymbol(formattedSymbol, source);

    // Clear stale data
    lastData = null;
    lastMarketProfileData = null;

    previousSymbol = formattedSymbol;
}

// Initial subscription in onMount
onMount(() => {
    previousSymbol = formattedSymbol;
    unsubscribe = subscribeToSymbol(formattedSymbol, source);
    return () => unsubscribe?.();
});

// Reactive store access
$: marketData = getMarketDataStore(formattedSymbol);
$: connectionStatus = getConnectionStatus();
$: lastData = $marketData;
$: status = $connectionStatus;
```

---

## Phase 5: Migrate FxBasketDisplay (Most Complex)

**File:** `/workspaces/neurosensefx/src/components/FxBasketDisplay.svelte`
**Lines Removed:** ~90
**Lines Added:** ~16
**Net Change:** -74 lines

### 5.1 Move to Store

Move from component to `marketDataStore.js`:
- `fxBasketStore.js` (38 lines) → integrate into marketDataStore
- `fxBasketStateMachine.js` (**129 lines**) → integrate into marketDataStore
- `fxBasketProcessor.js` (**95 lines**) → integrate into marketDataStore

**Note:** Original plan underestimated line counts. Actual files are larger than initially stated.

### 5.2 Create Derived Stores

```javascript
// In marketDataStore.js - FX Basket specific
export const basketProgress = derived(
    [basketStateMachine],
    ([$sm]) => ({
        received: $sm.receivedPairs.size,
        total: $sm.expectedPairs.length,
        state: $sm.state,
        partialData: $sm.partialData
    })
);

export const basketValues = derived(
    [symbolData, basketStateMachine],
    ([$symbolData, $sm]) => {
        if ($sm.state !== 'ready') return null;
        return calculateAllBaskets($symbolData);
    }
);
```

### 5.3 Simplified Component

```javascript
// FxBasketDisplay.svelte - simplified
import { basketValues, basketProgress, subscribeBasket } from '../stores/marketDataStore.js';

$: ($basketValues, $basketProgress);

onMount(() => {
    const unsubscribe = subscribeBasket(getAllPairs());
    return unsubscribe;
});
```

---

## Phase 6: Update dataContracts.js

**File:** `/workspaces/neurosensefx/src/lib/dataContracts.js`
**Lines Added:** ~30

### 6.1 Add Version Field

```javascript
/**
 * Base WebSocket message structure
 * @typedef {Object} WebSocketMessage
 * @property {string} v - Schema version (e.g., '1.0.0')
 * @property {MessageType} type - Message type discriminator
 * @property {string} [symbol] - Symbol identifier
 * @property {string} [source] - Data source ('ctrader' | 'tradingview')
 * @property {number} [receivedAt] - Backend receive timestamp
 * @property {number} [sentAt] - WebSocket send timestamp
 */
```

### 6.2 Add Latency Types

```javascript
/**
 * Latency metrics
 * @typedef {Object} LatencyMetrics
 * @property {number} [backend] - Backend processing time (ms)
 * @property {number} [network] - Network transit time (ms)
 * @property {number} [e2e] - End-to-end latency (ms)
 */
```

---

## Migration Order (Risk-Managed)

| Phase | Component | Risk | Dependencies | Duration |
|-------|-----------|------|--------------|----------|
| 1 | marketDataStore.js (create) | Low | None | 2-3 hours |
| 2 | Backend instrumentation | Low | None | 1 hour |
| 3 | PriceTicker migration | Low | Phase 1 | 1-2 hours |
| 4 | FloatingDisplay migration | Medium | Phase 3 | 2-3 hours |
| 5 | FxBasketDisplay migration | High | Phase 4 | 3-4 hours |
| 6 | dataContracts update | Low | Phase 2 | 30 min |

**Total Estimated Duration:** 10-14 hours

---

## Testing Strategy

### Per-Phase Testing

1. **Phase 1:** Integration tests with real WebSocket connection. Property-based tests for derived store calculations.
2. **Phase 2:** Verify latency timestamps appear in WebSocket messages
3. **Phase 3:** Compare PriceTicker behavior before/after migration using E2E tests
4. **Phase 4:** Compare FloatingDisplay behavior before/after migration using E2E tests
5. **Phase 5:** Verify FX Basket state machine works with store - full 30-symbol integration test
6. **Phase 6:** Verify schema version validation

### Integration Testing

```bash
# Run E2E tests after each phase
npm test

# Specific tests for data pipeline
npx playwright test --grep "data"

# Visual comparison for migrated components
npx playwright test --ui
```

### Test Scenarios

| Scenario | Test Type | Phase |
|----------|-----------|-------|
| Symbol change triggers resubscription | E2E | 3, 4 |
| Multiple displays share same symbol data | Integration | 1 |
| Latency metrics calculated correctly | Integration | 2 |
| Error status propagates on connection failure | Integration | 1 |
| FX Basket state machine timeout | Integration | 5 |
| Derived stores update reactively | Property-based | 1 |

---

## Rollback Plan

Each phase is independently deployable:

1. **Phase 1:** marketDataStore.js is new file - no impact if not used
2. **Phase 2:** Backend timestamps are additive - frontend ignores if not present
3. **Phase 3-5:** Components can revert to old pattern by:
   - Removing store import
   - Restoring useWebSocketSub/useDataCallback imports
   - Restoring local state variables

---

## Files Summary

| Action | File | Lines Changed (Delta) |
|--------|------|-----------------------|
| CREATE | `src/stores/marketDataStore.js` | +320 |
| MODIFY | `services/tick-backend/DataRouter.js` | +4 |
| MODIFY | `services/tick-backend/utils/MessageBuilder.js` | +6 |
| MODIFY | `services/tick-backend/HealthMonitor.js` | +15 |
| MODIFY | `src/lib/dataContracts.js` | +30 |
| MODIFY | `src/components/PriceTicker.svelte` | +20 / -28 |
| MODIFY | `src/components/FloatingDisplay.svelte` | +20 / -38 |
| MODIFY | `src/components/FxBasketDisplay.svelte` | +20 / -90 |
| DEPRECATE | `src/lib/fxBasket/fxBasketStore.js` | -38 |
| DEPRECATE | `src/lib/fxBasket/fxBasketStateMachine.js` | **-129** |
| DEPRECATE | `src/lib/fxBasket/fxBasketProcessor.js` | **-95** |

**Net Total: +435 lines added, -416 lines removed = +19 net lines**

**Note:** Lines Changed represents delta (additions/removals), not file sizes. Actual files are larger than delta values shown.

---

## Success Criteria

- [ ] Single source of truth for each symbol's market data
- [ ] Latency metrics visible in frontend (backend, network, e2e)
- [ ] Schema version in all WebSocket messages
- [ ] PriceTicker works identically after migration
- [ ] FloatingDisplay works identically after migration
- [ ] FxBasketDisplay works identically after migration
- [ ] Symbol changes trigger proper resubscription (no stale data)
- [ ] Error status propagates when connection fails
- [ ] Dev mode validation logs appear for malformed data
- [ ] All E2E tests pass
- [ ] No console errors in development mode
- [ ] `store.getState()` pattern works (matches workspace.js)

---

## Next Steps

1. Review and approve this plan
2. Create feature branch: `feat/centralized-data-function`
3. Execute Phase 1 (marketDataStore.js creation)
4. Run tests, verify no regressions
5. Continue with Phase 2-6 in order
