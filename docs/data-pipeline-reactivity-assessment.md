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

### Work Item 2: Audit Implicit Contracts in Reactive Patterns ✅ DONE

**Status:** Completed 2026-03-26
**Complexity:** Medium
**Addresses:** Issue 2
**Deliverable:** `src/lib/dataContracts.js`

Formalize the implicit contracts in both `useDataCallback` and inline callback patterns. Document expected data shapes and add runtime validation for development mode.

**Implementation Summary:**

1. **Created `src/lib/dataContracts.js`** - New module with comprehensive type definitions:
   - `WebSocketMessage` - Base message structure
   - `SymbolDataPackage` - Initial subscription data with 25+ fields
   - `TickData` - Real-time tick updates
   - `ProfileLevel` - Market profile level structure
   - `M1Bar` - M1 candle for   - `DisplayData` - Normalized output format (15+ fields)
   - `ProcessResult` - Function return type

2. **Runtime Validation Functions:**
   - `validateWebSocketMessage()` - Validates base structure
   - `validateSymbolDataPackage()` - Validates data packages
   - `validateTickData()` - Validates tick messages
   - `validateDisplayData()` - Validates output data
   - `logValidationResult()` - Logs in dev mode only
   - `withValidation()` - Higher-order wrapper

3. **Updated `src/lib/displayDataProcessor.js`:**
   - Added imports for validation functions
   - Added input validation at `processSymbolData()` entry
   - Added output validation before return
   - Added logging for unhandled message types

4. **Updated `src/composables/useDataCallback.js`:**
   - Added imports for validation module
   - Added JSDoc type annotations
   - Added input validation in callback
   - Added logging for unhandled types
   - Made debug logging conditional on `import.meta.env.DEV`

**Key Data Contracts Documented:**

| Contract | Input Shape | Output Shape | Validation |
|----------|-------------|--------------|------------|
| symbolDataPackage | Multiple price/range fields | DisplayData (15 fields) | validateSymbolDataPackage |
| tick | price, symbol required | DisplayData with running high/low | validateTickData |
| profileUpdate | profile.levels | ProfileLevel[] | (pass-through) |
| twapUpdate | data.twapValue | DisplayData (merged) | (preserved) |

**Verification:**
```bash
# Check that validation module exists
test -f src/lib/dataContracts.js && echo "OK"

# Run app in dev mode - validation warnings appear in console for malformed data
npm run dev 2>&1 | grep -i "validation" &
# Or:
```

**Files Modified:**
- `src/lib/dataContracts.js` (new) - 200 lines
- `src/lib/displayDataProcessor.js` - Added validation
- `src/composables/useDataCallback.js` - Added validation

---

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

Work Item 2 is complete. The data pipeline now has:

1. ✅ **Documented** - Full data flow in `data-pipeline-architecture.md`
2. ✅ **Formalized** - Implicit contracts with types and validation in `src/lib/dataContracts.js`
3. ✅ **Monitored** - Contract violations logged in development mode

### Implementation Summary

| Deliverable | File | Status |
|------------|------|--------|
| JSDoc Type Definitions | `src/lib/dataContracts.js` | 200+ lines of typedefs |
| Input Validation | `src/lib/displayDataProcessor.js` | Guards + type-specific validation |
| Callback Validation | `src/composables/useDataCallback.js` | Input validation + logging |
| Runtime Checks | All files | Dev mode only (`import.meta.env.DEV`) |

### Key Data Contracts

| Contract | Input Shape | Output Shape | Validator |
|----------|-------------|--------------|----------|
| `symbolDataPackage` | 25+ optional fields | `DisplayData` (15 required) | `validateSymbolDataPackage()` |
| `tick` | `symbol` + price fields | `DisplayData` with running high/low | `validateTickData()` |
| `twapUpdate` | `data.twapValue` | Merged with `lastData` | Data field check |
| `profileUpdate` | `profile.levels` | `ProfileLevel[]` | (pass-through) |

### Build Status

✅ All builds passing
✅ No runtime errors in development mode
✅ Validation warnings appear in console for malformed data
