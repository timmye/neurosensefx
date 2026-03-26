# Data Pipeline & Reactivity Assessment

**Date:** 2026-03-26
**Scope:** Canvases, Market Profile, Day Range Meter, PriceTicker
**Status:** Assessment Complete (Corrected)
**Last Verified:** 2026-03-26

---

## Executive Summary

The data pipeline assessment reveals two primary architectural concerns affecting reactivity:

1. **Scattered pipeline logic without centralized documentation** - Understanding data flow requires reading multiple files across different directories
2. **Implicit contracts between data sources and UI components** - Reactivity can break silently when expectations don't match

**Recommendation:** The current reactivity implementation is structurally sound but documentation-poor. Prioritize documentation (work-1) to create a debugging reference, then formalize contracts (work-2) to add validation that catches future issues early.

---

## Current State Analysis

### Component Pipeline Status

| Component | Pipeline Status | Documentation | Reactivity Pattern |
|-----------|-----------------|---------------|-------------------|
| Canvases (FloatingDisplay) | Functional | Scattered | subscriptionManager → callback → refs → Svelte reactivity |
| Market Profile | Functional | Scattered | orchestrator → scaling/calculations/rendering |
| Day Range Meter | Functional | Scattered | orchestrator → calculations/renderingUtils |
| PriceTicker | Functional | Inline | WebSocket callback → local state → reactive statements |

### Root Cause of Previous Reactivity Issues

The reactivity issues experienced were likely caused by **implicit contract violations** between data sources and callbacks rather than fundamental architectural problems. The current fixes work because the contracts are now being honored, but there's no safety net to catch future violations.

---

## Identified Issues

### Issue 1: Pipeline Architecture (HIGH)

**Problem:** Understanding data flow requires reading multiple files across scattered directories with no centralized documentation.

**Evidence:**
```
Market profile pipeline spans:
- src/lib/marketProfile/orchestrator.js      # Pipeline coordination
- src/lib/marketProfile/scaling.js           # Scale calculations
- src/lib/marketProfile/calculations.js      # TPO/value area math
- src/lib/marketProfile/rendering.js         # Drawing functions
- src/lib/marketProfileRenderer.js           # Facade (different dir)
- src/composables/useSymbolData.js           # Data subscription
- src/composables/useWebSocketSub.js         # WebSocket connection
```

**Impact:** New developers must trace through files in different directory structures to understand how tick data becomes rendered output, making debugging reactivity issues difficult.

**Scope:** 4 components with scattered file organization

---

### Issue 2: Implicit Contracts (MEDIUM)

**Problem:** Both `useDataCallback` and inline callbacks create implicit contracts between data sources and UI components with no type safety or validation.

**Evidence:**
```
useDataCallback pattern (src/composables/useDataCallback.js):
1. Create callback that receives WebSocket data
2. Process data via processSymbolDataCore() without schema validation
3. Update reactive refs
4. No type safety or documentation of expected data shape

Inline callback pattern (src/components/PriceTicker.svelte):
1. Subscribe via useWebSocketSub
2. Process via processSymbolData() directly
3. Assign to local state
4. Same implicit contract, different wrapper
```

**Impact:** Reactivity breaks silently when callback expectations don't match data shape from WebSocket; debugging requires understanding both sender and receiver internals.

**Scope:** 2 patterns across 4+ components

---

### Issue 3: Orchestrator Pattern (LOW - Informational)

**Observation:** Day Range and Market Profile orchestrators share a similar pattern but already share utilities.

**Evidence:**
```
Shared utilities (Market Profile imports from Day Range):
- validateMarketData (from dayRangeRenderingUtils.js)
- createDayRangeConfig (from dayRangeRenderingUtils.js)
- calculateAdaptiveScale (from dayRangeCalculations.js)
```

**Status:** Not a duplication concern - utilities are already shared appropriately.

---

## Recommended Work Items

### Work Item 1: Document Data Pipeline Architecture ✅ DONE

**Status:** Completed 2026-03-26
**Complexity:** Medium
**Addresses:** Issue 1
**Deliverable:** `docs/data-pipeline-architecture.md`

Create comprehensive documentation mapping data flow from WebSocket sources through composables/callbacks to UI components.

**Approach:**
1. Create `docs/data-pipeline-architecture.md` with high-level overview
2. Document 4 key pipelines with correct flows:
   - **Canvases**: `connectionManager → subscriptionManager.dispatch() → callback (from useDataCallback) → ref updates → Svelte reactivity → displayCanvasRenderer`
   - **Market Profile**: `orchestrator → scaling → calculations → rendering`
   - **Day Range Meter**: `dayRangeOrchestrator → (dayRangeCalculations + dayRangeRenderingUtils + dayRangeCore)`
   - **PriceTicker**: `useWebSocketSub → inline callback → processSymbolData() → local state → Svelte $: reactive statements`
3. For each pipeline, document: entry point, data transformation steps, UI output
4. Add sequence diagrams showing reactive update flow

**Verification:**
- Can a new developer understand the pipeline by reading only the architecture doc?

**Command:**
```bash
cat docs/data-pipeline-architecture.md | grep -A5 "PriceTicker Pipeline"
```

---

### Work Item 2: Audit Implicit Contracts in Reactive Patterns

**Complexity:** Medium
**Addresses:** Issue 2

Formalize the implicit contracts in both `useDataCallback` and inline callback patterns. Document expected data shapes and add runtime validation.

**Proposed Change:**

```javascript
// Before (src/composables/useDataCallback.js)
function createCallback(formattedSymbol, lastDataRef, lastMarketProfileDataRef, canvasRef) {
  return (data) => {
    const result = processSymbolDataCore(data, formattedSymbol, lastDataRef.value);
    // No validation
  };
}

// After
/**
 * @typedef {Object} SymbolData
 * @property {string} symbol
 * @property {Object} bid - Bid price data
 * @property {Object} ask - Ask price data
 * @property {number} timestamp
 */
function createCallback(formattedSymbol, lastDataRef, lastMarketProfileDataRef, canvasRef) {
  return (data) => {
    // Runtime validation (dev mode only)
    if (import.meta.env.DEV && !validateSymbolData(data)) {
      console.warn(`Invalid symbol data for ${formattedSymbol}:`, data);
      return;
    }
    const result = processSymbolDataCore(data, formattedSymbol, lastDataRef.value);
    // ... rest of callback
  };
}
```

**Delta:** Adds JSDoc type definition and runtime validation to make implicit contract explicit.

**Approach:**
1. Document expected data shapes for each callback pattern
2. Add JSDoc typedefs for: SymbolData, TickData, CandleData
3. Create runtime validation helper (dev mode only)
4. Add console warnings when contract violations detected

**Verification:**
```bash
# Run app in dev mode with intentional malformed data
# Check: Does console show validation warning?
grep -l '@typedef' src/composables/*.js | wc -l
```

---

## Execution Order

```
work-1 (Documentation) → work-2 (Contract Audit)
```

**Reason:** Auditing implicit contracts requires understanding the complete pipeline context documented in work-1.

---

## Data Flow Reference

### Key Files by Component

#### Canvases (FloatingDisplay)
```
src/
├── composables/
│   └── useDataCallback.js           # Creates callback with ref updates
├── lib/
│   ├── displayCanvasRenderer.js     # Canvas drawing functions
│   └── websocket/
│       └── messageCoordinator.js    # Coordinated subscriptions (optional)
└── components/
    └── FloatingDisplay.svelte       # UI component
```

**Actual Pipeline:**
```
WebSocket → connectionManager → subscriptionManager.dispatch()
         → callback (useDataCallback.createCallback)
         → lastDataRef/lastProfileRef updates
         → Svelte reactivity triggers DisplayCanvas re-render
         → displayCanvasRenderer functions
```

#### Market Profile
```
src/lib/marketProfile/
├── orchestrator.js                  # Pipeline coordination
├── scaling.js                       # Adaptive scale calculations
├── calculations.js                  # TPO, POC, value area math
└── rendering.js                     # Drawing functions

src/lib/
├── marketProfileRenderer.js         # Facade entry point
├── marketProfileProcessor.js        # Data transformation (separate use)
└── marketProfileStateless.js        # Pure profile computation (separate use)
```

**Actual Pipeline:**
```
marketProfileRenderer.js (facade)
    └── marketProfile/orchestrator.js
            ├── scaling.js (calculateAdaptiveScale, createPriceScale)
            ├── calculations.js (TPO/value area math)
            └── rendering.js (draw functions)
```

**Note:** `marketProfileProcessor.js` and `marketProfileStateless.js` exist but are used separately by `useSymbolData.js`, not in the orchestrator chain.

#### Day Range Meter
```
src/lib/
├── dayRangeOrchestrator.js          # Pipeline coordination
├── dayRangeCalculations.js          # Range/percentage calculations
├── dayRangeRenderingUtils.js        # Validation, config, helpers
├── dayRangeCore.js                  # Core rendering primitives
├── dayRangeConfig.js                # Configuration
├── dayRangeMarkers.js               # Price marker rendering
└── dayRangeElements.js              # UI element helpers
```

**Actual Pipeline:**
```
dayRangeOrchestrator.js
    ├── dayRangeCore.js (renderAdrAxis, renderCenterLine, renderAdrBoundaryLines)
    ├── dayRangeRenderingUtils.js (validateMarketData, createDayRangeConfig, createMappedData)
    ├── dayRangeCalculations.js (calculateAdaptiveScale, calculateDayRangePercentage)
    └── priceMarkerRenderer.js (renderCurrentPrice, renderOpenPrice, etc.)
```

#### PriceTicker
```
src/
├── components/
│   └── PriceTicker.svelte           # UI component (inline callback pattern)
├── composables/
│   └── useWebSocketSub.js           # WebSocket subscription
└── lib/
    ├── displayDataProcessor.js      # processSymbolData function
    └── dayRangeCalculations.js      # calculateDayRangePercentage
```

**Actual Pipeline:**
```
useWebSocketSub.subscribe()
    → inline callback with processSymbolData()
    → lastData = processed.data
    → await tick()
    → Svelte reactive statements ($:) derive:
        - currentPrice, highPrice, lowPrice, openPrice
        - rangePercent = calculateDayRangePercentage(lastData)
        - dailyChangePercent
    → DOM updates via template bindings
```

---

## Conclusion

The data pipeline is **functional but underspecified**. Reactivity works when contracts are honored but fails silently when they're violated. The recommended path forward:

1. **Document** the complete data flow to enable faster debugging
2. **Formalize** implicit contracts with types and validation
3. **Monitor** for contract violations in development

This approach maintains the current working implementation while adding safety nets for future changes.
