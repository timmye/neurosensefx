# Market Profile Solution Design: Alternative Architectural Approaches

**Date:** 2026-02-02
**Status:** Solution Design Phase
**Design By:** Crystal Clarity Architecture Analysis
**Based On:** /workspaces/neurosensefx/docs/market-profile-refactor-assessment.md

---

## Executive Summary

This document presents **FOUR distinct architectural approaches** for resolving the Market Profile accuracy issues, each with different trade-offs regarding Crystal Clarity principles (Simple, Performant, Maintainable) and implementation complexity.

**Primary Goal:** Fix accuracy issues by addressing the 5 root causes identified in the refactor assessment:
1. Missing Domain Model (primitives everywhere)
2. Code Duplication (3+ implementations of core logic)
3. Scattered Message Dispatch (5+ locations with `data.type` branching)
4. Tight Coupling to Day Range
5. Silent Failures (no error signaling)

---

## Design Context

### Current Architecture Issues

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE (Problematic)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WebSocket Messages                                                 │
│       │                                                             │
│       ├──> displayDataProcessor.js ──┐                             │
│       │                               │                             │
│       ├──> useSymbolData.js ─────────┤                             │
│       │                               │                             │
│       ├──> fxBasketProcessor.js ────┤  [data.type === 'symbolDataPackage'] │
│       │                               │  [data.type === 'tick']    │
│       ├──> subscriptionManager.js ──┤  scattered across 5+ files  │
│       │                               │                             │
│       └──> marketProfileStateless.js ┘                             │
│                                      │                              │
│                                      ▼                              │
│                         ┌─────────────────────┐                     │
│                         │ marketProfileProcessor│ <── DUPLICATED    │
│                         │ marketProfileStateless│    LOGIC          │
│                         │ MarketProfileService  │                   │
│                         └─────────────────────┘                     │
│                                      │                              │
│         ┌────────────────────────────┼────────────────────────────┐ │
│         ▼                            ▼                            ▼ │
│  marketProfileRenderer      marketProfile/orchestrator        Rendering │
│         │                            │                            │ │
│         └────────> calculations.js <┘                            │ │
│                    (PointOfControl.js, valueArea.js - DEPRECATED) │ │
│                                                                      │
│  ISSUES:                                                             │
│  - Primitives (no domain types)                                      │
│  - Same calculations in 3+ places                                   │
│  - Message dispatch in 5+ places                                    │
│  - Tightly coupled to Day Range scaling                             │
│  - Silent failures (console.warn only)                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Crystal Clarity Constraints

| Principle | Requirement | Current Violations |
|-----------|-------------|-------------------|
| **Simple** | Files <120 lines, Functions <15 lines | 300+ line files, nested 20+ line functions |
| **Performant** | Framework-first (Svelte, Canvas, WebSocket) | Custom reimplementations |
| **Maintainable** | No abstraction layers, direct framework usage | Handler interfaces, domain classes proposed |
| **Framework-First** | Use Svelte, interact.js, Canvas 2D, WebSocket | Message handler polymorphism proposed |

---

## Approach 1: Minimalist Refactor

**Philosophy:** "Fix what's broken, leave what works"

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    APPROACH 1: Minimalist Refactor                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WebSocket Messages                                                 │
│       │                                                             │
│       │ [Keep existing dispatch - it works]                         │
│       │                                                             │
│       ├──> displayDataProcessor.js                                  │
│       │
│       └──> marketProfileStateless.js ──────────┐
│                                                │
│                                      [CONSOLIDATE]
│                                                │
│                              DELETE: pointOfControl.js
│                              DELETE: valueArea.js
│                              DELETE: calculations.js (duplicates)
│                              KEEP: marketProfileProcessor.js (core)
│                                                │
│                                                ▼
│                              Single calculation module:
│                              marketProfile/calculations.js
│                                                │
│                                      [ADD VALIDATION]
│                                                │
│                              Add runtime checks:
│                              - Price >= 0 && isFinite(price)
│                              - TPO >= 0 && isInteger(tpo)
│                              - Throw on truncation (not warn)
│                                                │
│                                                ▼
│                                      marketProfileRenderer.js
│                                                                      │
│  CHANGES:                                                            │
│  - Delete 200 lines of dead code                                    │
│  - Add 15 lines of validation                                       │
│  - Modify error handling (warn -> throw)                            │
│  - Keep existing data flow                                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Consolidated Calculations** (NEW - single source of truth)
   - File: `src/lib/marketProfile/calculations.js`
   - Lines: ~80 (keep existing)
   - Functions: `computePOC()`, `calculateValueArea()`, `generatePriceLevels()`
   - Delete: `pointOfControl.js`, `valueArea.js`, `marketProfileStateless.js`

2. **Runtime Validation** (NEW - lightweight guards)
   - Add to existing functions, no new files
   - Example:
   ```javascript
   function validatePriceLevel(price, tpo) {
     if (price < 0 || !Number.isFinite(price)) {
       throw new Error(`Invalid price: ${price}`);
     }
     if (tpo < 0 || !Number.isInteger(tpo)) {
       throw new Error(`Invalid TPO count: ${tpo}`);
     }
   }
   ```

3. **Explicit Error Signaling** (MODIFY existing)
   - Change: `console.warn` → `throw Error`
   - Add: Error event to WebSocket messages
   - UI: Show error indicator in canvas (reuse `canvasStatusRenderer.js`)

### Data Flow (Unchanged)

```
WebSocket Message → displayDataProcessor.js → marketProfileProcessor.js
                                                           │
                                                           ▼
                                                    calculations.js
                                                           │
                                                           ▼
                                                    marketProfileRenderer.js
```

### Migration Strategy

1. **Phase 1** (Day 1): Delete dead code
   - Remove `pointOfControl.js`, `valueArea.js`
   - Update imports (use `calculations.js`)

2. **Phase 2** (Day 1): Add validation
   - Add `validatePriceLevel()` to processor
   - Add validation to backend `MarketProfileService.js`

3. **Phase 3** (Day 2): Fix error handling
   - Replace `console.warn` with `throw`
   - Add error event to WebSocket protocol
   - Update UI to show errors

### Pros vs Crystal Clarity

| Principle | Rating | Rationale |
|-----------|--------|-----------|
| **Simple** | ⭐⭐⭐⭐⭐ | Minimal changes, no new abstractions, keep existing flow |
| **Performant** | ⭐⭐⭐⭐⭐ | No performance impact, just cleanup |
| **Maintainable** | ⭐⭐⭐ | Still has scattered dispatch, but single calculation source |
| **Framework-First** | ⭐⭐⭐⭐⭐ | 100% compliant - uses existing stack |

### Cons vs Crystal Clarity

- **Does NOT address:** Scattered message dispatch (5 locations)
- **Does NOT address:** Tight coupling to Day Range
- **Risk:** May not fully fix accuracy if architecture is root cause

### Estimated Complexity

**LOW** - ~3 days implementation
- Day 1: Delete code, add validation
- Day 2: Fix error handling
- Day 3: Testing and validation

### Files Modified

| Action | Files |
|--------|-------|
| **Delete** | `src/lib/marketProfile/pointOfControl.js` |
| **Delete** | `src/lib/marketProfile/valueArea.js` |
| **Delete** | `src/lib/marketProfileStateless.js` |
| **Modify** | `src/lib/marketProfileProcessor.js` (add validation) |
| **Modify** | `src/lib/marketProfile/calculations.js` (keep as-is) |
| **Modify** | `services/tick-backend/MarketProfileService.js` (add validation) |
| **Modify** | `src/lib/connection/connectionHandler.js` (error events) |

---

## Approach 2: Domain Model Approach

**Philosophy:** "Rich domain types with validation at boundaries"

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    APPROACH 2: Domain Model Architecture             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WebSocket Messages                                                 │
│       │                                                             │
│       │ [Keep existing dispatch]                                    │
│       │                                                             │
│       └──> marketProfileProcessor.js                                │
│                                      │                              │
│                                      │ [PARSE TO DOMAIN TYPES]       │
│                                      ▼                              │
│                         ┌─────────────────────────┐                 │
│                         │   domain/MarketProfile  │                 │
│                         │   - levels: PriceLevel[]│                 │
│                         │   - bucketSize: BucketSize│               │
│                         │   - addLevel(price, tpo) │                │
│                         │   - getPOC()            │                 │
│                         │   - getValueArea()      │                 │
│                         └─────────────────────────┘                 │
│                                      │                              │
│                         ┌────────────┴────────────┐                │
│                         ▼                          ▼                │
│              ┌──────────────────┐      ┌──────────────────┐        │
│              │  domain/Price    │      │   domain/TPO     │        │
│              │  - value: number │      │   - count: number│        │
│              │  - validate()    │      │   - validate()   │        │
│              └──────────────────┘      └──────────────────┘        │
│                                                                      │
│  NEW FILES:                                                          │
│  - src/lib/marketProfile/domain/Price.js (~30 lines)                │
│  - src/lib/marketProfile/domain/TpoCount.js (~30 lines)             │
│  - src/lib/marketProfile/domain/BucketSize.js (~30 lines)           │
│  - src/lib/marketProfile/domain/MarketProfile.js (~100 lines)       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Price Value Object** (NEW)
   ```javascript
   // src/lib/marketProfile/domain/Price.js
   export function Price(value) {
     if (value < 0 || !Number.isFinite(value)) {
       throw new Error(`Invalid price: ${value}`);
     }
     return Object.freeze({ value, type: 'Price' });
   }
   ```

2. **TPO Count Value Object** (NEW)
   ```javascript
   // src/lib/marketProfile/domain/TpoCount.js
   export function TpoCount(count) {
     if (!Number.isInteger(count) || count < 0) {
       throw new Error(`Invalid TPO count: ${count}`);
     }
     return Object.freeze({ count, type: 'TpoCount' });
   }
   ```

3. **Market Profile Aggregate** (NEW)
   ```javascript
   // src/lib/marketProfile/domain/MarketProfile.js
   export function MarketProfile(bucketSize, initialLevels = []) {
     const levels = new Map();

     return {
       addLevel(price, tpo) {
         const priceKey = price.toFixed(8);
         levels.set(priceKey, { price, tpo: TpoCount(tpo) });
       },
       getPOC() { /* computed from levels */ },
       getValueArea() { /* computed from levels */ },
       toPlain() { /* return plain array for rendering */ }
     };
   }
   ```

### Data Flow

```
WebSocket Message → displayDataProcessor.js → marketProfileProcessor.js
                                                           │
                                                           │ [Create domain objects]
                                                           ▼
                                                    MarketProfile.create()
                                                           │
                                                           │ [Domain validates]
                                                           ▼
                                                    calculations.js (uses domain)
                                                           │
                                                           ▼
                                                    marketProfileRenderer.js
```

### Migration Strategy

1. **Phase 1** (Week 1): Create domain types
   - Implement Price, TPO, BucketSize
   - Unit tests for each domain type

2. **Phase 2** (Week 2): Create Market Profile aggregate
   - Implement with domain types
   - Migrate processor to use domain

3. **Phase 3** (Week 2): Update backend
   - Modify `MarketProfileService.js` to use domain types
   - Ensure WebSocket protocol sends plain data (domain on frontend only)

### Pros vs Crystal Clarity

| Principle | Rating | Rationale |
|-----------|--------|-----------|
| **Simple** | ⭐⭐⭐ | Adds abstraction layer (violates "no abstraction layers") |
| **Performant** | ⭐⭐⭐⭐ | Small overhead from object creation |
| **Maintainable** | ⭐⭐⭐⭐⭐ | Clear domain boundaries, validation at type level |
| **Framework-First** | ⭐⭐⭐ | Custom domain types (not from framework) |

### Cons vs Crystal Clarity

- **VIOLATES:** "No abstraction layers" principle
- **VIOLATES:** Framework-first (creates custom types)
- **Complexity:** Higher cognitive load for simple data structures
- **May over-engineer:** Primitives with validation might suffice

### Estimated Complexity

**HIGH** - ~2 weeks implementation
- Week 1: Domain types + tests
- Week 2: Integration + migration

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/marketProfile/domain/Price.js` | ~30 | Price value object |
| `src/lib/marketProfile/domain/TpoCount.js` | ~30 | TPO count value object |
| `src/lib/marketProfile/domain/BucketSize.js` | ~30 | Bucket size value object |
| `src/lib/marketProfile/domain/MarketProfile.js` | ~100 | Aggregate root |
| `src/lib/marketProfile/domain/__tests__/` | ~200 | Unit tests |

---

## Approach 3: Functional/Data-Flow Approach

**Philosophy:** "Pure functions, immutable data, explicit data pipeline"

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                  APPROACH 3: Functional Data Pipeline                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WebSocket Messages (Raw)                                           │
│       │                                                             │
│       │ [Central message router - SINGLE FILE]                      │
│       ▼                                                             │
│  ┌───────────────────────────────────────────────────────────┐     │
│  │           messageHandlers/MessageRouter.js                 │     │
│  │  - route(message) -> handler.process(message)             │     │
│  └───────────────────────────────────────────────────────────┘     │
│       │                                                             │
│       ├──> SymbolDataPackageHandler ─┐                             │
│       ├──> TickHandler ──────────────┤                             │
│       ├──> TwapUpdateHandler ───────┤ [Message handlers - pure]    │
│       └──> ErrorHandler ────────────┘                             │
│                                       │                             │
│                                       ▼                             │
│                         ┌─────────────────────────┐                │
│                         │  marketProfile/flow.js  │                │
│                         │  (PURE DATA PIPELINE)   │                │
│                         └─────────────────────────┘                │
│                                       │                             │
│         ┌─────────────────────────────┼─────────────────────────┐  │
│         ▼                             ▼                         ▼  │
│   [parseRaw]                    [aggregate]                [format] │
│         │                             │                         │  │
│         └─────────────────────────────┴─────────────────────────┘  │
│                                       │                             │
│                                       ▼                             │
│                                 Immutable Profile                  │
│                                       │                             │
│                                       ▼                             │
│                                 marketProfileRenderer.js            │
│                                                                      │
│  NEW FILES:                                                          │
│  - src/lib/messageHandlers/MessageRouter.js (~50 lines)             │
│  - src/lib/messageHandlers/SymbolDataPackageHandler.js (~40 lines)  │
│  - src/lib/messageHandlers/TickHandler.js (~30 lines)               │
│  - src/lib/marketProfile/flow.js (~100 lines)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Message Router** (NEW - single dispatch point)
   ```javascript
   // src/lib/messageHandlers/MessageRouter.js
   const handlers = {
     symbolDataPackage: SymbolDataPackageHandler,
     tick: TickHandler,
     twapUpdate: TwapUpdateHandler,
     error: ErrorHandler
   };

   export function route(message) {
     const Handler = handlers[message.type];
     if (!Handler) throw new Error(`Unknown message type: ${message.type}`);
     return Handler.process(message);
   }
   ```

2. **Market Profile Data Flow** (NEW - explicit pipeline)
   ```javascript
   // src/lib/marketProfile/flow.js
   export function createMarketProfileFlow(rawData) {
     return pipe(
       validateRawData,      // throws if invalid
       parseM1Bars,          // extract bars
       aggregateByPrice,     // build price map
       calculateProfile,     // compute POC, value area
       formatForRender       // plain array for renderer
     )(rawData);
   }
   ```

3. **Pure Message Handlers** (NEW - one per type)
   ```javascript
   // src/lib/messageHandlers/TickHandler.js
   export function process(message) {
     return {
       type: 'tick',
       symbol: message.symbol,
       price: validatePrice(message.price),  // throws if invalid
       timestamp: message.timestamp
     };
   }
   ```

### Data Flow (Explicit Pipeline)

```
Raw WebSocket Message
        │
        ▼
MessageRouter.route()
        │
        ├──> SymbolDataPackageHandler.process()
        │       │
        │       ▼
        │   Validated Message
        │
        └──> TickHandler.process()
                │
                ▼
            Validated Message
                │
                ▼
        createMarketProfileFlow()
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
    validate  aggregate  calculate
        │       │        │
        └───────┴────────┘
                │
                ▼
        Immutable Profile
                │
                ▼
        marketProfileRenderer.js
```

### Migration Strategy

1. **Phase 1** (Week 1): Create message router
   - Implement `MessageRouter.js`
   - Implement handlers for each message type
   - Update all dispatch points to use router

2. **Phase 2** (Week 1): Create data flow
   - Implement `flow.js` with pure pipeline
   - Migrate processor to use flow

3. **Phase 3** (Week 2): Remove old dispatch
   - Delete scattered `data.type ===` branches
   - Consolidate to single router call

### Pros vs Crystal Clarity

| Principle | Rating | Rationale |
|-----------|--------|-----------|
| **Simple** | ⭐⭐⭐⭐ | Pure functions are simple, but adds routing layer |
| **Performant** | ⭐⭐⭐⭐⭐ | Pure functions enable optimizations (no side effects) |
| **Maintainable** | ⭐⭐⭐⭐⭐ | Explicit data flow, easy to trace |
| **Framework-First** | ⭐⭐⭐⭐ | Custom router, but uses vanilla JS patterns |

### Cons vs Crystal Clarity

- **Adds:** Message router abstraction (could be seen as abstraction layer)
- **Learning curve:** Functional pipeline pattern
- **May be overkill:** For simple message types

### Estimated Complexity

**MEDIUM** - ~1.5 weeks implementation
- Week 1: Message router + handlers
- Week 2: Data flow + migration

### Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/messageHandlers/MessageRouter.js` | ~50 | Single dispatch point |
| `src/lib/messageHandlers/SymbolDataPackageHandler.js` | ~40 | Symbol data processing |
| `src/lib/messageHandlers/TickHandler.js` | ~30 | Tick processing |
| `src/lib/messageHandlers/TwapUpdateHandler.js` | ~30 | TWAP processing |
| `src/lib/marketProfile/flow.js` | ~100 | Data pipeline |

### Files Modified

| Action | Files |
|--------|-------|
| **Modify** | `src/lib/displayDataProcessor.js` (use router) |
| **Modify** | `src/composables/useSymbolData.js` (use router) |
| **Modify** | `src/lib/fxBasket/fxBasketProcessor.js` (use router) |
| **Modify** | `src/lib/connection/subscriptionManager.js` (use router) |
| **Delete** | All scattered `data.type ===` branches |

---

## Approach 4: Progressive Enhancement

**Philosophy:** "Incremental fixes with validation at each step"

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                   APPROACH 4: Progressive Enhancement                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase 1: Validation Layer (Week 1)                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Add validation to EXISTING code (no new architecture)      │    │
│  │  - marketProfileProcessor.js: add validatePriceLevel()      │    │
│  │  - MarketProfileService.js: add validatePriceLevel()        │    │
│  │  - Add error events to WebSocket protocol                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                           │                                          │
│                           ▼                                          │
│  Phase 2: Consolidate Calculations (Week 2)                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Delete dead code, single source of truth                   │    │
│  │  - Delete pointOfControl.js, valueArea.js                   │    │
│  │  - Keep calculations.js only                                │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                           │                                          │
│                           ▼                                          │
│  Phase 3: Extract Utilities (Week 3)                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Break Day Range coupling, shared utilities                 │    │
│  │  - Create utils/canvasUtils.js                              │    │
│  │  - Create utils/priceScaling.js                             │    │
│  │  - Remove Day Range imports from Market Profile             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                           │                                          │
│                           ▼                                          │
│  Phase 4: Message Dispatcher (Week 4) - OPTIONAL                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Only if validation + consolidation don't fix accuracy       │    │
│  │  - Add message router (see Approach 3)                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Components (Added Incrementally)

#### Phase 1: Validation (Week 1)
```javascript
// Add to existing files, no new architecture

function validatePriceLevel(price, tpo) {
  if (price < 0 || !Number.isFinite(price)) {
    throw new Error(`Invalid price: ${price}`);
  }
  if (tpo < 0 || !Number.isInteger(tpo)) {
    throw new Error(`Invalid TPO count: ${tpo}`);
  }
}

// Use in existing functions
export function buildInitialProfile(m1Bars, bucketSize, symbolData) {
  // ... existing code ...
  range.forEach(price => {
    validatePriceLevel(price, 1);  // ADD THIS
    priceMap.set(price, (priceMap.get(price) || 0) + 1);
  });
}
```

#### Phase 2: Consolidation (Week 2)
```javascript
// Delete dead code
rm src/lib/marketProfile/pointOfControl.js
rm src/lib/marketProfile/valueArea.js
rm src/lib/marketProfileStateless.js

// Update imports
// Before: import { computePOC } from './pointOfControl.js'
// After:  import { computePOC } from './calculations.js'
```

#### Phase 3: Extract Utilities (Week 3)
```javascript
// Create shared utilities
// src/lib/utils/canvasUtils.js
export function formatPrice(price, pipPosition) { /* extracted */ }
export function createLinearScale(domain, range) { /* extracted */ }

// src/lib/utils/priceScaling.js
export function calculateAdaptiveScale(data, marketData) { /* extracted */ }
export function priceToY(price, scale, height) { /* extracted */ }

// Update imports
// Before: import { formatPrice } from '../dayRangeRenderingUtils.js'
// After:  import { formatPrice } from '../../utils/canvasUtils.js'
```

### Data Flow (Unchanged Until Phase 4)

```
WebSocket Message → displayDataProcessor.js → marketProfileProcessor.js
                                                           │
                                                           ▼
                                                    calculations.js
                                                           │
                                                           ▼
                                                    marketProfileRenderer.js
```

### Migration Strategy

**Week 1:** Add validation
- Add `validatePriceLevel()` to processor and backend
- Change `console.warn` to `throw`
- Test with E2E suite

**Week 2:** Consolidate calculations
- Delete dead code
- Update imports
- Run E2E tests to verify

**Week 3:** Extract utilities
- Create shared utility modules
- Remove Day Range imports
- Test independence

**Week 4:** Evaluate and optionally add message router
- Only if accuracy issues persist
- Use Approach 3's message router

### Pros vs Crystal Clarity

| Principle | Rating | Rationale |
|-----------|--------|-----------|
| **Simple** | ⭐⭐⭐⭐⭐ | Incremental changes, minimal risk |
| **Performant** | ⭐⭐⭐⭐⭐ | No performance impact |
| **Maintainable** | ⭐⭐⭐⭐ | Improves with each phase |
| **Framework-First** | ⭐⭐⭐⭐⭐ | Uses existing stack, no new abstractions |

### Cons vs Crystal Clarity

- **Slower:** Takes 3-4 weeks to fully implement
- **May stop early:** If accuracy fixed in Phase 1 or 2, remaining phases skipped

### Estimated Complexity

**MEDIUM** (but incremental)
- Phase 1: LOW (~3 days)
- Phase 2: LOW (~2 days)
- Phase 3: MEDIUM (~5 days)
- Phase 4: OPTIONAL (MEDIUM, ~1 week)

### Files Modified (Per Phase)

| Phase | Files | Complexity |
|-------|-------|------------|
| **1** | `marketProfileProcessor.js`, `MarketProfileService.js`, `connectionHandler.js` | LOW |
| **2** | Delete 3 files, update imports | LOW |
| **3** | Create `utils/canvasUtils.js`, `utils/priceScaling.js`, update imports | MEDIUM |
| **4** | (Optional) Add message router | MEDIUM |

---

## Comparison Matrix

### Trade-off Analysis

| Criteria | Approach 1: Minimalist | Approach 2: Domain Model | Approach 3: Functional | Approach 4: Progressive |
|----------|----------------------|-------------------------|----------------------|------------------------|
| **Implementation Time** | 3 days | 2 weeks | 1.5 weeks | 3-4 weeks (incremental) |
| **Code Changes** | ~200 lines | ~400 lines | ~500 lines | ~300 lines (Phase 1-3) |
| **Risk Level** | LOW | HIGH | MEDIUM | VERY LOW |
| **Crystal Clarity Compliance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Maintainability** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Testability** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Performance Impact** | None | Minor (object creation) | None | None |
| **Addresses Root Causes** | 2/5 | 4/5 | 5/5 | 4/5 (after Phase 3) |
| **Learning Curve** | None | Medium | Medium | Low |
| **Scalability** | Limited | High | High | Medium |

### Root Cause Coverage

| Root Cause | Approach 1 | Approach 2 | Approach 3 | Approach 4 |
|------------|-----------|-----------|-----------|-----------|
| **1. Missing Domain Model** | Partial (validation only) | ✅ FULL | ✅ FULL | ✅ FULL (validation) |
| **2. Code Duplication** | ✅ FULL | ✅ FULL | ✅ FULL | ✅ FULL (Phase 2) |
| **3. Scattered Dispatch** | ❌ NONE | ❌ NONE | ✅ FULL | ⚠️ OPTIONAL (Phase 4) |
| **4. Tight Coupling** | ❌ NONE | Partial | Partial | ✅ FULL (Phase 3) |
| **5. Silent Failures** | ✅ FULL | ✅ FULL | ✅ FULL | ✅ FULL (Phase 1) |

### Risk Assessment

| Approach | Risk | Mitigation |
|----------|------|------------|
| **Minimalist** | May not fix accuracy if architecture is root cause | Quick validation with E2E tests |
| **Domain Model** | Over-engineering, violates "no abstractions" principle | Start with validation, escalate if needed |
| **Functional** | Adds complexity, learning curve | Incremental rollout, measure impact |
| **Progressive** | Takes longer, may need all phases | Stop early if accuracy fixed |

---

## Recommendation

### Primary Recommendation: Approach 4 (Progressive Enhancement)

**Rationale:**

1. **Aligns with Crystal Clarity Principles**
   - Minimal changes, no new abstractions
   - Framework-first (uses existing stack)
   - Simple, performant, maintainable

2. **Lowest Risk**
   - Incremental changes, each phase independently valuable
   - Can stop early if accuracy is fixed
   - Easy to rollback any phase

3. **Addresses Root Causes Systematically**
   - Phase 1: Silent failures (validation)
   - Phase 2: Code duplication (consolidation)
   - Phase 3: Tight coupling (extract utilities)
   - Phase 4: Scattered dispatch (only if needed)

4. **Realistic Timeline**
   - Phase 1-2 can be done in 1 week
   - Likely to fix accuracy issues
   - Phase 4 (message router) is optional

### Secondary Recommendation: Approach 1 (Minimalist)

**Use if:**
- Time is critical (< 1 week available)
- Want to validate that consolidation fixes accuracy
- Willing to accept remaining architectural debt

**Trade-off:**
- Faster (3 days)
- Lower risk
- But leaves 3/5 root causes unfixed

### NOT Recommended: Approach 2 (Domain Model)

**Reasons:**
1. **Violates Crystal Clarity principle:** "No abstraction layers"
2. **Over-engineering:** Value objects for simple primitives
3. **Higher complexity:** 2 weeks vs 3 days for Minimalist
4. **Unclear benefit:** Validation can be achieved with simple functions

### Conditionally Recommended: Approach 3 (Functional)

**Use if:**
- Progressive enhancement fails to fix accuracy
- Need explicit data flow for debugging
- Team comfortable with functional patterns

**When to consider:**
- After Phase 3 of Approach 4, if accuracy issues persist
- If adding more message types in future

---

## Implementation Roadmap (Recommended: Approach 4)

### Week 1: Phase 1 - Validation Layer

**Goal:** Add validation, fix silent failures

**Tasks:**
1. Add `validatePriceLevel(price, tpo)` to `marketProfileProcessor.js`
2. Add validation to `MarketProfileService.js` (backend)
3. Replace `console.warn` with `throw Error`
4. Add error events to WebSocket protocol
5. Update UI to show errors (`canvasStatusRenderer.js`)
6. Run E2E tests

**Success Criteria:**
- Invalid prices throw errors
- Truncation shows error UI
- E2E tests pass with invalid data

### Week 1: Phase 2 - Consolidate Calculations

**Goal:** Single source of truth for calculations

**Tasks:**
1. Delete `pointOfControl.js`, `valueArea.js`, `marketProfileStateless.js`
2. Update all imports to use `calculations.js`
3. Grep to verify no duplicate functions
4. Run E2E tests

**Success Criteria:**
- Grep for `computePOC` returns single file
- Grep for `calculateValueArea` returns single file
- All tests pass

### Week 2: Phase 3 - Extract Utilities

**Goal:** Break Day Range coupling

**Tasks:**
1. Create `utils/canvasUtils.js` (formatPrice, etc.)
2. Create `utils/priceScaling.js` (adaptive scale, etc.)
3. Update Market Profile to use shared utilities
4. Remove Day Range imports from Market Profile
5. Run E2E tests independently

**Success Criteria:**
- Grep for Day Range imports in Market Profile returns empty
- Market Profile tests run without Day Range
- All tests pass

### Week 3-4: Phase 4 - Message Dispatcher (OPTIONAL)

**Only if:** Accuracy issues persist after Phases 1-3

**Tasks:** (See Approach 3 for details)

**Success Criteria:**
- Grep for `data.type ===` shows only router
- New message type requires one handler file
- All tests pass

---

## Conclusion

The Market Profile accuracy issues can be resolved through **Progressive Enhancement** (Approach 4), which:

1. **Minimizes risk** through incremental changes
2. **Maintains Crystal Clarity** principles (simple, performant, maintainable)
3. **Addresses root causes** systematically
4. **Allows early exit** if accuracy is fixed sooner

**Next Steps:**
1. Review this design with team
2. Validate approach with E2E test suite
3. Begin Phase 1 implementation (validation layer)
4. Evaluate after each phase before proceeding

**Estimated Timeline:**
- **Best case:** 1 week (Phases 1-2 fix accuracy)
- **Expected case:** 2 weeks (Phases 1-3 required)
- **Worst case:** 4 weeks (all phases including message router)

---

## Appendix: Architecture Diagrams

### Current State (Problematic)

```
┌─────────────────────────────────────────────────────────────┐
│                 CURRENT MARKET PROFILE ARCHITECTURE          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WebSocket                                                   │
│     │                                                        │
│     ├──> displayDataProcessor.js (data.type === 'symbolDataPackage') │
│     │                                                        │
│     ├──> useSymbolData.js (data.type === 'symbolDataPackage')       │
│     │                                                        │
│     ├──> fxBasketProcessor.js (data.type === 'symbolDataPackage')   │
│     │                                                        │
│     ├──> subscriptionManager.js (data.type === 'tick')      │
│     │                                                        │
│     └──> marketProfileStateless.js (data.type === 'tick')   │
│                                    │                         │
│                                    ▼                         │
│                        ┌──────────────────────┐             │
│                        │ marketProfileProcessor│             │
│                        │ marketProfileStateless│             │
│                        │ MarketProfileService  │             │
│                        └──────────────────────┘             │
│                                    │                         │
│         ┌──────────────────────────┼──────────────────┐     │
│         ▼                          ▼                  ▼     │
│  calculations.js          pointOfControl.js      valueArea.js│
│  (ACTIVE)                  (DEPRECATED)           (DEPRECATED)│
│         │                          │                  │     │
│         └──────────────────────────┴──────────────────┘     │
│                                    │                         │
│                                    ▼                         │
│                        marketProfileRenderer.js              │
│                                    │                         │
│                                    ▼                         │
│                              Canvas Display                   │
│                                                              │
│  ISSUES:                                                     │
│  - Primitives (no domain validation)                         │
│  - Calculations in 3+ places                                 │
│  - Message dispatch in 5+ places                             │
│  - Tight coupling to Day Range                               │
│  - Silent failures (console.warn only)                       │
└─────────────────────────────────────────────────────────────┘
```

### Target State (After Approach 4)

```
┌─────────────────────────────────────────────────────────────┐
│              TARGET MARKET PROFILE ARCHITECTURE               │
│                   (After Progressive Enhancement)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WebSocket                                                   │
│     │                                                        │
│     ├──> displayDataProcessor.js (unchanged, working)       │
│     │                                                        │
│     └──> marketProfileProcessor.js (WITH VALIDATION)        │
│                                    │                         │
│                                    ▼                         │
│                        ┌──────────────────────┐             │
│                        │ validatePriceLevel() │ ← NEW       │
│                        └──────────────────────┘             │
│                                    │                         │
│                                    ▼                         │
│                        ┌──────────────────────┐             │
│                        │ calculations.js      │ ← SINGLE     │
│                        │ (ONLY IMPLEMENTATION)│   SOURCE     │
│                        └──────────────────────┘             │
│                                    │                         │
│                                    ▼                         │
│                        ┌──────────────────────┐             │
│                        │ marketProfileRenderer│ ← USES      │
│                        │                      │   SHARED     │
│                        └──────────────────────┘   UTILS     │
│                                    │                         │
│        ┌───────────────────────────┴───────────┐             │
│        ▼                                   ▼               │
│  utils/canvasUtils.js              utils/priceScaling.js   │
│  (formatPrice, etc.)               (adaptiveScale, etc.)   │
│        │                                   │               │
│        └───────────────────┬───────────────┘               │
│                            ▼                               │
│                      NO DAY RANGE IMPORTS                  │
│                            │                               │
│                            ▼                               │
│                      Canvas Display                         │
│                     (WITH ERROR UI)                         │
│                                                              │
│  IMPROVEMENTS:                                               │
│  - Validation at boundaries (throw, don't warn)             │
│  - Single calculation source (deleted 3 files)              │
│  - Shared utilities (no Day Range coupling)                 │
│  - Explicit error UI (visible to users)                     │
│                                                              │
│  OPTIONAL (Phase 4):                                         │
│  - Message router (single dispatch point)                   │
└─────────────────────────────────────────────────────────────┘
```

---

**Document Status:** Ready for Review
**Next Action:** Team review and approval to proceed with Phase 1
