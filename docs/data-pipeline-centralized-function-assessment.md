# NeuroSense FX Data Pipeline Architecture Assessment

**Date:** 2026-03-27
**Scope:** Data pipeline architecture, centralized data function evaluation
**Status:** Assessment Complete

---

## Executive Summary

**Key Finding:** The `data-pipeline-reactivity-assessment.md` implementation is a **proper architectural solution for documentation and contract validation** — not a patch. However, it addresses a *different* problem than what a centralized data function would solve. The assessment document formalized implicit contracts and documented pipelines, but the application still lacks a **single source of truth for market data**.

**Recommendation:** A centralized data function IS warranted for a trading application. The current architecture is acceptable for a visualization platform but has gaps that become critical when accuracy and latency matter for trading decisions.

---

## Structure

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
│  ┌──────────────────┐                      ┌──────────────────┐             │
│  │   cTrader API    │                      │  TradingView WS  │             │
│  │  (Spot ticks,    │                      │  (D1/M1 candles) │             │
│  │   M1 trendbars)  │                      │                  │             │
│  └────────┬─────────┘                      └────────┬─────────┘             │
│           │ emit 'tick', 'm1Bar'                    │ emit 'tick', 'candle' │
│           ▼                                         ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     DataRouter.js                                   │    │
│  │         "Parallel feeds, no aggregation - just routing"            │    │
│  │                 broadcastToClients(symbol:source)                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ WebSocket broadcast
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                   connectionManager.js                              │    │
│  │                          (singleton)                                │    │
│  │              subscriptionManager.dispatch(symbol:source)            │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 │                                           │
│         ┌───────────────────────┼───────────────────────┐                   │
│         ▼                       ▼                       ▼                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐              │
│  │FloatingDisplay│      │ PriceTicker  │      │FxBasketDisplay│             │
│  │  lastDataRef │      │  lastData    │      │  (30 refs)   │              │
│  │  (local)     │      │  (local)     │      │  (local)     │              │
│  └──────────────┘      └──────────────┘      └──────────────┘              │
│         │                       │                       │                   │
│         └───────────────────────┴───────────────────────┘                   │
│                                 │                                           │
│                          NO SHARED STATE                                    │
│                    (Each component has its own copy)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Layer | Component | File | Role |
|-------|-----------|------|------|
| **Backend Sources** | CTraderSession | `services/tick-backend/CTraderSession.js` | cTrader API connection, spot events, M1 bars |
| | TradingViewSession | `services/tick-backend/TradingViewSession.js` | TradingView WebSocket, candle subscriptions |
| **Backend Services** | DataRouter | `services/tick-backend/DataRouter.js:7-108` | Routes data from sources to clients (no aggregation) |
| | MarketProfileService | `services/tick-backend/MarketProfileService.js` | Server-side TPO calculation |
| | TwapService | `services/tick-backend/TwapService.js` | TWAP calculation from M1 bars |
| | HealthMonitor | `services/tick-backend/HealthMonitor.js` | Staleness detection (60s timeout) |
| **Frontend** | connectionManager | `src/lib/connectionManager.js` | Singleton WebSocket facade |
| | subscriptionManager | `src/lib/connection/subscriptionManager.js` | Client-side subscription tracking |
| | displayDataProcessor | `src/lib/displayDataProcessor.js` | Normalizes WebSocket data |
| | dataContracts | `src/lib/dataContracts.js` | JSDoc types + runtime validation |

---

## Patterns

### 1. Callback-Based Reactivity (No Central Store)

**Current Pattern:**
```
WebSocket → subscriptionManager.dispatch() → callback → ref.value = data → Svelte $: reactivity
```

**Evidence:** Each component maintains its own `lastData`:
- `FloatingDisplay.svelte:86-94` - `lastDataRef = { value: null }`
- `PriceTicker.svelte:37-54` - `let lastData = null`
- `FxBasketDisplay.svelte` - 30 separate refs for 30 FX pairs

**Implication:** No single source of truth. If two displays show EURUSD, they have separate subscriptions and potentially different data.

### 2. Implicit Contracts (Recently Formalized)

**What Was Implemented:**
- `dataContracts.js` (378 lines) - JSDoc type definitions + runtime validators
- Dev-mode only validation (`import.meta.env.DEV` guards)
- Input/output validation in `displayDataProcessor.js`

**Evidence:**
```javascript
// dataContracts.js:335
if (!import.meta.env.DEV) return;  // Zero production overhead
```

**Assessment:** This is a **proper solution** for contract validation, not a patch. The implementation:
- Documents all data shapes with 200+ lines of JSDoc
- Provides runtime validators for 4 message types
- Logs violations in dev mode
- Has zero production overhead

### 3. Parallel Data Sources (No Aggregation)

**Evidence:** `DataRouter.js:3-4` explicitly states:
```javascript
/**
 * DataRouter - Routes data from cTrader and TradingView to clients
 * Parallel feeds, no aggregation - just simple routing
 */
```

**Implication:** No cross-source reconciliation. cTrader and TradingView data streams are kept separate.

### 4. Subscription Key Format

**Pattern:** `symbol:source` (e.g., `EURUSD:ctrader`, `BTCUSD:tradingview`)

**Evidence:** `subscriptionManager.js:10-12`
```javascript
const key = `${symbol}:${source}`;
```

**Implication:** Same symbol from different sources = different subscriptions. Enables multi-source but prevents aggregation.

---

## Flows

### Price Data Flow (End-to-End)

```
cTrader API ──PROT_OA_SPOT_EVENT──► CTraderEventHandler
                                            │
                                            ▼ emit 'tick'
                                      CTraderSession
                                            │
                                            ▼
                                      DataRouter.routeFromCTrader()
                                            │
                                            ▼ broadcastToClients(symbol, 'ctrader')
                                      WebSocket
                                            │
                                            ▼ JSON message
                                      Frontend WebSocket
                                            │
                                            ▼ connectionManager.onMessage()
                                      subscriptionManager.dispatch()
                                            │
                                            ▼ lookup by 'EURUSD:ctrader'
                                      Component callback
                                            │
                                            ▼ processSymbolData()
                                      DisplayData normalization
                                            │
                                            ▼ lastDataRef.value = data
                                      Svelte $: reactive statements
                                            │
                                            ▼ Canvas/DOM render
```

### Market Profile Flow

```
M1 bar received ──► MarketProfileService.onM1Bar()
                        │
                        ▼ Deduplication (timestamp|low|high|close signature)
                        │
                        ▼ Price level generation + TPO increment
                        │
                        ▼ emit 'profileUpdate'
                        │
                        ▼ DataRouter.routeProfileUpdate()
                        │
                        ▼ Frontend: useSymbolData.processSymbolData()
                        │
                        ▼ Canvas render via orchestrator
```

### Data Contract Validation Flow

```
WebSocket message ──► processSymbolData()
                          │
                          ▼ if (import.meta.env.DEV)
                          │
                          ├── validateWebSocketMessage()
                          ├── validateSymbolDataPackage() | validateTickData()
                          └── logValidationResult()
                          │
                          ▼ Transform to DisplayData
                          │
                          ▼ if (import.meta.env.DEV)
                          │
                          └── validateDisplayData() + logValidationResult()
```

---

## Decisions

### Assessment Document: Patch vs Proper Solution

| Aspect | Verdict | Evidence |
|--------|---------|----------|
| **Type Definitions** | Proper | 200+ lines of JSDoc typedefs covering all message types |
| **Validation** | Proper | 4 validators with dev-mode guards, zero production overhead |
| **Documentation** | Proper | `data-pipeline-architecture.md` with flow diagrams |
| **Integration** | Proper | Integrated into `displayDataProcessor.js` and `useDataCallback.js` |

**Conclusion:** The reactivity assessment document describes a **proper architectural solution** for contract validation. It is NOT a patch. The work items (documentation + contract audit) were completed correctly.

**However:** This addresses a *different* problem than a centralized data function would solve. The assessment formalized data contracts but did not create a single source of truth.

---

## Gaps (What a Centralized Data Function Would Address)

### Gap 1: No Single Source of Truth for Market Data

**Current State:** Each component maintains its own `lastData` ref.

**Evidence:**
- `FloatingDisplay.svelte:86` - `lastDataRef = { value: null }`
- `PriceTicker.svelte:125` - `let lastData = null`
- `FxBasketDisplay.svelte` - 30 separate refs

**Risk:** Same symbol displayed in multiple components may show different data due to timing differences.

**Trading Concern:** No canonical price for decision-making.

### Gap 2: No Latency Tracking

**Current State:** HealthMonitor tracks staleness (60s timeout) but not tick-to-render latency.

**Evidence:** `HealthMonitor.js` emits `stale`/`tick_resumed` events but doesn't measure:
- Tick timestamp → WebSocket send time
- WebSocket receive → Canvas render time
- End-to-end latency percentiles

**Trading Concern:** No visibility into data freshness for time-sensitive decisions.

### Gap 3: No Cross-Source Reconciliation

**Current State:** cTrader and TradingView data streams are kept separate.

**Evidence:** `DataRouter.js:3-4` - "Parallel feeds, no aggregation"

**Trading Concern:** No way to detect feed discrepancies or choose best price.

### Gap 4: Duplicated Processing Logic

**Current State:** Same calculations performed in multiple places.

**Evidence:**
- `MarketProfileService.js` - deduplication via `timestamp|low|high|close` signature
- `TwapService.js` - deduplication via timestamp-only check
- Both process same M1 bars independently

**Implication:** Inconsistent deduplication logic, wasted CPU cycles.

### Gap 5: No Data Caching/Memoization

**Current State:** Every symbol switch re-fetches data from backend.

**Evidence:** No caching layer found in `connectionManager.js` or `subscriptionManager.js`

**Implication:** Unnecessary network traffic, slower symbol switching.

### Gap 6: Inconsistent Data Handling Patterns

| Component | How it receives data | How it processes |
|-----------|---------------------|------------------|
| FloatingDisplay | `useDataCallback` composable | `processSymbolData` + `processMarketProfileData` |
| PriceTicker | Direct callback in `webSocketSub.subscribe()` | Calls `processSymbolData` directly |
| FxBasketDisplay | `createProcessorCallback` | Custom handling via state machine |

**Implication:** Three different patterns for the same fundamental operation.

### Gap 7: No Schema Versioning

**Current State:** `dataContracts.js` defines types but no version field.

**Trading Concern:** Breaking changes could silently corrupt data without detection.

---

## Comparison to Trading Application Best Practices

| Best Practice | Current State | Gap Level |
|---------------|---------------|-----------|
| **Single Source of Truth** | Component-local refs | **HIGH** |
| **Latency Monitoring** | Staleness only (60s) | **HIGH** |
| **Data Validation** | Dev mode only | **MEDIUM** |
| **Event Sourcing** | Not implemented | **MEDIUM** |
| **CQRS** | Not implemented | **MEDIUM** |
| **Schema Versioning** | Not implemented | **MEDIUM** |
| **Cross-Source Reconciliation** | Not implemented | **LOW** |
| **Circuit Breaker** | Not implemented | **LOW** |

---

## What a Centralized Data Function Should Provide

Based on this analysis, a centralized data function for NeuroSense FX should provide:

### 1. Price Cache with TTL
```javascript
// Single source of truth for latest prices
const priceCache = new Map<string, { price: number, timestamp: number, ttl: number }>();
```

### 2. Latency Metrics
```javascript
// Track tick-to-render latency
const latencyMetrics = {
  tickToWs: number,      // Backend: tick received → WebSocket sent
  wsToCallback: number,  // Frontend: WebSocket received → callback invoked
  callbackToRender: number, // Frontend: callback → canvas render
  e2e: number            // Total latency
};
```

### 3. Derived Store Pattern
```javascript
// Svelte derived stores for computed values
export const currentPrice = derived(priceStore, $price => $price.current);
export const rangePercent = derived(priceStore, $price => calculateRangePercent($price));
```

### 4. Data Quality Metrics
- Gap detection on tick streams
- Stale data warnings (< 1s, < 5s, < 30s)
- Cross-source comparison (when both available)

### 5. Schema Versioning
```javascript
// Version field in all WebSocket messages
type WebSocketMessage = {
  v: 1,  // Schema version
  type: MessageType,
  // ...
}
```

---

## Recommendations

### Priority 1: Centralized Market Data Store
Create a `marketDataStore.js` that provides:
- Single source of truth for price data per symbol
- Svelte `derived()` stores for computed values
- Automatic deduplication of subscriptions
- Caching with TTL

### Priority 2: Latency Instrumentation
Add latency tracking:
- Backend: `tick.timestamp` → `Date.now()` at WebSocket send
- Frontend: WebSocket receive → callback → canvas render
- Expose metrics for monitoring

### Priority 3: Unify Data Handling Patterns
Standardize on one pattern:
- All components use `useDataCallback` composable
- Or all components use centralized store subscriptions

### Priority 4: Schema Versioning
Add version field to all WebSocket messages for backward compatibility.

---

## Files Referenced

| File | Lines Referenced | Purpose |
|------|------------------|---------|
| `docs/data-pipeline-reactivity-assessment.md` | 1-342 | Assessment document |
| `src/lib/dataContracts.js` | 1-378 | Type definitions + validation |
| `src/lib/displayDataProcessor.js` | 70-178 | Data transformation |
| `src/lib/connectionManager.js` | - | WebSocket lifecycle |
| `src/lib/connection/subscriptionManager.js` | 10-12, 44-57, 101 | Subscription tracking |
| `src/components/FloatingDisplay.svelte` | 29-49, 70-79, 86-94 | Canvas display |
| `src/components/PriceTicker.svelte` | 37-54, 128-141, 169-176 | Price ticker |
| `services/tick-backend/DataRouter.js` | 1-110 | Data routing |
| `services/tick-backend/MarketProfileService.js` | 287-311, 321-322 | Profile calculation |
| `services/tick-backend/TwapService.js` | - | TWAP calculation |
| `services/tick-backend/HealthMonitor.js` | - | Staleness detection |

---

## Conclusion

| Question | Answer |
|----------|--------|
| Is the reactivity assessment a patch? | **No.** It's a proper solution for documentation and contract validation. |
| Is a centralized data function needed? | **Yes, for a trading application.** The current architecture lacks single source of truth, latency tracking, and data quality metrics that are critical for trading decisions. |
| What's the priority? | **Medium-High.** The application works for visualization, but as trading requirements increase (accuracy, latency sensitivity), the gaps will become blockers. |

---

## Next Steps

1. Review this assessment with the team
2. Decide on centralized data function scope (full vs incremental)
3. If proceeding, use planner skill to create implementation plan
4. Consider starting with Priority 1 (market data store) as foundation
