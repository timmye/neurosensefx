# Market Profile Architectural Analysis

**Date:** 2026-01-22
**Status:** Complete - Fundamental Issues Identified
**Analysis Type:** Root Cause Architectural Review

---

## Executive Summary

This document analyzes the Market Profile implementation from first principles to answer: **Are we patching symptoms or fixing root causes?**

**Answer:** We are patching symptoms. The implementation has fundamental architectural issues that need to be addressed at the design level, not through incremental patches.

---

## Table of Contents

1. [Domain Concept: What IS a Market Profile?](#1-domain-concept-what-is-a-market-profile)
2. [Current Implementation Analysis](#2-current-implementation-analysis)
3. [Fundamental Architectural Issues](#3-fundamental-architectural-issues)
4. [Why The Proposed "Fix" Is Wrong](#4-why-the-proposed-fix-is-wrong)
5. [Proper Architecture](#5-proper-architecture)
6. [Implementation Path](#6-implementation-path)

---

## 1. Domain Concept: What IS a Market Profile?

### Definition

A Market Profile is:
- A **histogram** showing price distribution over a time period (typically one trading day)
- TPO = "Time Price Opportunity" = measure of **time spent at each price level**
- An **aggregation** of trading activity, not a stream

### Key Characteristics

| Characteristic | Description |
|----------------|-------------|
| **Aggregate** | Built from multiple data points (M1 bars, ticks) |
| **Static** | Traditionally analyzed after session close |
| **Discrete** | Price levels are quantized into buckets |
| **Histogram** | Shows distribution, not time series |

### Domain Implications

1. **TPO is an aggregation metric** - requires summing over time
2. **Bucket size is fundamental** - determines granularity
3. **Profile grows throughout the day** - new bars add to existing levels

---

## 2. Current Implementation Analysis

### File: `src/lib/marketProfileProcessor.js` (210 lines)

```javascript
// Lines 16-42: Only function available
export function buildInitialProfile(m1Bars, bucketSize = 0.00001, symbolData = null) {
  // 1. Calculate adaptive bucket size (lines 21-24)
  // 2. Create Map for aggregation (line 26)
  // 3. Process ALL M1 bars (lines 28-33)
  // 4. Convert to sorted array (lines 35-37)

  return { profile, actualBucketSize };
}
```

### Key Observations

| Aspect | Current State | Implication |
|--------|---------------|-------------|
| **Function name** | `buildInitialProfile` | Designed for one-time initialization |
| **Processing model** | Batch (all bars at once) | Not designed for streaming |
| **Bucket size** | Adaptive (recalculated each time) | Requires full dataset |
| **Update mechanism** | None - only rebuild from scratch | No incremental updates |
| **Location** | Frontend | Data processing in view layer |

### Data Flow (Current - Broken)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT DATA FLOW (BROKEN)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  BACKEND                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  getSymbolDataPackage() → Returns raw M1 bars array                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    │ WebSocket: { M1 bars[] }                 │
│                                    ▼                                           │
│  FRONTEND                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  FloatingDisplay.svelte                                                │   │
│  │    │                                                                     │   │
│  │    ▼                                                                     │   │
│  │  buildInitialProfile(M1 bars) ← COMPUTES TPO AGGREGATION                │   │
│  │    │                                                                     │   │
│  │    ▼                                                                     │   │
│  │  profile[] [{price, tpo}, ...]                                           │   │
│  │    │                                                                     │   │
│  │    ▼                                                                     │   │
│  │  Render to Canvas                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  PROBLEM: No live updates → Profile is stale until manual refresh             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fundamental Architectural Issues

### Issue #1: Wrong Layer for Computation

**Problem:** Frontend is doing backend work.

```
CURRENT (WRONG):
  Backend sends raw M1 bars → Frontend computes TPO aggregation

IDEAL (CORRECT):
  Backend computes TPO aggregation → Frontend receives profile → Frontend renders
```

**Why it matters:**
- TPO aggregation is **data processing**, not rendering
- Frontend should be **pure view layer** (Crystal Clarity principle)
- Different clients could compute **different profiles** from same data
- Inefficient: every client rebuilds the same profile

**Evidence:** `marketProfileProcessor.js` lines 16-42 are in frontend, doing data transformation.

---

### Issue #2: Incremental Update Model Exists But Is Fundamentally Flawed

**Problem:** An incremental update function exists (`updateProfileWithTick`) but is **intentionally disabled** due to architectural issues.

```javascript
// EXISTS: updateProfileWithTick() at lines 99-122
export function updateProfileWithTick(lastProfile, tickData, bucketSize, symbolData) {
  // ... does incremental tick update
}

// DISABLED in FloatingDisplay.svelte (lines 65-72):
// DISABLED: M1-only mode for consistency
// else if (data.type === 'tick' && lastMarketProfileData && marketProfileBucketSize) {
//   lastMarketProfileData = updateProfileWithTick(lastMarketProfileData, data, marketProfileBucketSize, lastData);
// }
```

**Why it's disabled:**
- Tick-based updates cause **profile jumps** when discretizing continuous prices
- **Data model mismatch**: Ticks are continuous, Market Profile requires discrete buckets
- Still processes in **frontend** (wrong layer problem remains)
- **Adaptive bucket size** requires full dataset anyway

**Why this matters:**
- The existing function proves incremental updates are **technically possible**
- But the **architectural issues** (wrong layer, adaptive bucket) make it impractical
- Simply re-enabling it would patch symptoms, not fix root causes

---

### Issue #3: Adaptive Bucket Size Incompatibility

**Problem:** Bucket size calculation requires full dataset.

```javascript
// Lines 46-53: Scans ALL bars to determine bucket size
function calculateAdaptiveBucketSize(m1Bars, defaultBucketSize, symbolData) {
  let globalLow = Infinity;
  let globalHigh = -Infinity;

  for (const bar of m1Bars) {  // ← Needs COMPLETE dataset
    if (bar.low < globalLow) globalLow = bar.low;
    if (bar.high < globalHigh) globalHigh = bar.high;
  }

  const priceRange = globalHigh - globalLow;
  const adaptiveBucketSize = priceRange / 1500;  // ← Target 1500 levels
  return Math.max(adaptiveBucketSize, defaultBucketSize);
}
```

**The fundamental conflict:**

| Requirement | Conflict |
|-------------|----------|
| Adaptive bucket size | Needs complete dataset to calculate range |
| Incremental updates | Have incomplete dataset (new bars only) |
| Result | Must either: (a) keep old bucket size, or (b) recalculate from all bars |

**Our patch ignored this** - we'd need to either:
- Keep initial bucket size forever (limits adaptability)
- Recalculate from all accumulated bars (defeats incremental purpose)

---

### Issue #4: Crystal Clarity Violations

| Principle | Requirement | Current State | Violation |
|-----------|-------------|---------------|-----------|
| **Framework-first** | Use primitives directly | Custom aggregation logic | ❌ Reinventing wheel |
| **Simple over clever** | <15 lines per function | `calculateValueArea`: 76 lines | ❌ Too complex |
| **Files <120 lines** | Split large files | `marketProfileProcessor.js`: 210 lines | ❌ Nearly 2x limit |
| **Right layer** | Backend processes, frontend renders | Frontend processes TPOs | ❌ Wrong responsibility |

**Line count analysis:**
- `buildInitialProfile`: 26 lines (16-42)
- `calculateAdaptiveBucketSize`: 25 lines (45-70)
- `calculateValueArea`: 76 lines (134-210) ← **Major violation**
- `updateProfileWithTick`: 23 lines (99-122) ← Exists but disabled due to architectural issues

---

## 4. Why The Proposed "Fix" Is Wrong

### Proposed Fix: Stream M1 Bars, Rebuild Profile

```javascript
// PROPOSED (WRONG):
else if (data.type === 'm1Bar' && lastMarketProfileData) {
  const bars = m1BarCache.get(formattedSymbol) || [];
  bars.push(newBar);
  m1BarCache.set(formattedSymbol, bars);

  // Rebuild ENTIRE profile from ALL bars
  const { profile } = buildInitialProfile(bars, bucketSize, lastData);
  lastMarketProfileData = profile;
}
```

### Why This Is Patching Symptoms

| Aspect | Problem |
|--------|---------|
| **Existing function** | `updateProfileWithTick()` already exists but is disabled for good reasons |
| **Profile jumps** | Tick discretization causes artificial profile fragmentation |
| **Adaptive bucket** | Would need to recalculate on each update OR use stale bucket size |
| **Wrong layer** | Still doing aggregation in frontend instead of backend |
| **Data duplication** | Caching all M1 bars in memory (backend already has them) |
| **Complexity** | Added cache management, deduplication logic |

**Note:** An incremental update function (`updateProfileWithTick`) already exists at lines 99-122 of `marketProfileProcessor.js`, but it is intentionally disabled because tick-based updates cause profile jumps and data inconsistencies. Simply re-enabling it would not address the architectural issues.

### What We're Actually Fixing

```
SYMPTOM: Profile doesn't update with live data
                    ↓
PROPOSED FIX: Stream M1 bars, rebuild profile in frontend
                    ↓
WHAT WE'RE DOING: Automating the "refresh" button
                    ↓
REAL PROBLEM: No incremental update mechanism exists
```

**This is a patch, not a fix.**

---

## 5. Proper Architecture

### Design Principles

1. **Backend owns the state** - TPO aggregation is data processing
2. **Frontend is view layer** - Receives and renders, doesn't compute
3. **Simple data model** - Fixed bucket size, no adaptive recalculation
4. **Delta updates** - Send changes only, not full rebuilds

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PROPOSED ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  BACKEND (Node.js)                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  MarketProfileService (NEW)                                            │   │
│  │  ├── profileState: Map<symbol, {                                        │   │
│  │  │     levels: Map<price, tpo>,                                         │   │
│  │  │     bucketSize: number,                                             │   │
│  │  │     lastUpdate: timestamp                                           │   │
│  │  │   }                                                                  │   │
│  │  ├── subscribeToSymbol(symbol) → Subscribe to M1 bars                  │   │
│  │  ├── onM1Bar(bar) → Update internal state, emit delta                  │   │
│  │  └── emitProfileDelta() → Send only CHANGES to frontend                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    │ WebSocket: {                              │
│                                    │   type: 'profileUpdate',                  │
│                                    │   symbol: 'EURUSD',                       │
│                                    │   delta: {                                │
│                                    │     added: [                              │
│                                    │       { price: 1.0850, tpo: 12 },         │
│                                    │       { price: 1.0851, tpo: 8 }           │
│                                    │     ],                                   │
│                                    │     updated: [                            │
│                                    │       { price: 1.0849, tpo: 15, change: +2 }│
│                                    │     ]                                    │
│                                    │   }                                      │
│                                    │ }                                         │
│                                    ▼                                           │
│  FRONTEND (Svelte)                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  FloatingDisplay.svelte                                                │   │
│  │  ├── lastMarketProfileData: profile[] (local state)                    │   │
│  │  ├── dataCallback(data)                                                │   │
│  │  │   └── if (data.type === 'profileUpdate')                           │   │
│  │  │       └── applyDelta(delta)                                         │   │
│  │  └── Svelte reactivity → Triggers render                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Changes

#### 1. Backend Service (NEW)

**File:** `services/tick-backend/MarketProfileService.js`

```javascript
class MarketProfileService {
  constructor() {
    this.profiles = new Map(); // symbol → profile state
  }

  subscribeToSymbol(symbol, cTraderSession) {
    if (!this.profiles.has(symbol)) {
      this.profiles.set(symbol, {
        levels: new Map(),
        bucketSize: null,
        lastUpdate: null
      });
    }

    // Subscribe to M1 bars
    cTraderSession.on('m1Bar', (bar) => this.onM1Bar(symbol, bar));
  }

  onM1Bar(symbol, bar) {
    const profile = this.profiles.get(symbol);

    // Generate price levels from M1 bar
    const levels = generatePriceLevels(bar.low, bar.high, profile.bucketSize);

    // Track changes for delta
    const delta = { added: [], updated: [] };

    levels.forEach(price => {
      const currentTpo = profile.levels.get(price) || 0;
      const newTpo = currentTpo + 1;

      profile.levels.set(price, newTpo);

      if (currentTpo === 0) {
        delta.added.push({ price, tpo: newTpo });
      } else {
        delta.updated.push({ price, tpo: newTpo, change: +1 });
      }
    });

    // Emit delta to frontend
    this.emit('profileUpdate', { symbol, delta });
  }

  getFullProfile(symbol) {
    const profile = this.profiles.get(symbol);
    if (!profile) return null;

    return {
      levels: Array.from(profile.levels.entries())
        .map(([price, tpo]) => ({ price, tpo }))
        .sort((a, b) => a.price - b.price),
      bucketSize: profile.bucketSize
    };
  }
}
```

**Lines:** ~80 (well under 120 line limit)

---

#### 2. Frontend Delta Application (SIMPLIFIED)

**File:** `src/components/FloatingDisplay.svelte`

```javascript
// NEW: Handle profile updates
else if (data.type === 'profileUpdate' && data.delta) {
  applyProfileDelta(lastMarketProfileData, data.delta);
}

function applyProfileDelta(profile, delta) {
  // Add new levels
  if (delta.added) {
    delta.added.forEach(level => {
      profile.push({ price: level.price, tpo: level.tpo });
    });
  }

  // Update existing levels
  if (delta.updated) {
    delta.updated.forEach(level => {
      const existing = profile.find(p => p.price === level.price);
      if (existing) {
        existing.tpo = level.tpo;
      }
    });
  }

  // Keep sorted
  profile.sort((a, b) => a.price - b.price);
}
```

**Lines:** ~20 (simple, <15 line function)

---

### Architecture Comparison

| Aspect | Current (Broken) | Proposed (Fixed) |
|--------|------------------|------------------|
| **TPO computation** | Frontend | Backend |
| **Data sent** | Raw M1 bars | Profile deltas |
| **Frontend work** | Rebuild from scratch | Apply deltas |
| **Bucket size** | Adaptive (recalculated) | Fixed (set once) |
| **Memory** | Caches all bars | Maintains profile only |
| **Complexity** | High (cache management) | Low (delta application) |

---

## 6. Implementation Path

### Phase 1: Backend Service (2 hours)

**File:** `services/tick-backend/MarketProfileService.js` (NEW)

- [ ] Create `MarketProfileService` class
- [ ] Implement `subscribeToSymbol()`
- [ ] Implement `onM1Bar()` with delta emission
- [ ] Wire up to cTrader M1 bar events

### Phase 2: Frontend Delta Handler (1 hour)

**File:** `src/components/FloatingDisplay.svelte`

- [ ] Add `applyProfileDelta()` function
- [ ] Add `profileUpdate` message handler
- [ ] Remove M1 bar cache (no longer needed)
- [ ] Remove profile rebuild logic

### Phase 3: Integration (1 hour)

**File:** `services/tick-backend/WebSocketServer.js`

- [ ] Create `MarketProfileService` instance
- [ ] Wire `profileUpdate` events to `DataRouter`
- [ ] Add `routeProfileUpdate()` to `DataRouter.js`

### Phase 4: Cleanup (1 hour)

- [ ] Move `buildInitialProfile()` to backend (becomes part of MarketProfileService)
- [ ] Remove or keep `updateProfileWithTick()` - no longer needed with backend delta updates
- [ ] Remove disabled tick processing code from FloatingDisplay.svelte
- [ ] Update `marketProfileProcessor.js` to only contain rendering helpers (value area, POC calculation)

### Phase 5: Testing (2 hours)

- [ ] Unit tests for delta calculation
- [ ] Integration tests for end-to-end flow
- [ ] Manual testing with live data

**Total Estimated Time: 7 hours**

---

## Summary

### The Question

> "Are we patching a symptom or is there a fundamental architectural/design issue?"

### The Answer

**Yes - there are fundamental architectural issues.**

We identified 4 major problems:

1. **Wrong layer for computation** - Frontend doing backend work
2. **Incremental update model is flawed** - `updateProfileWithTick()` exists but is disabled due to data model mismatches
3. **Adaptive bucket size incompatibility** - Requires full dataset
4. **Crystal Clarity violations** - Functions too long, wrong responsibilities

### The Proposed "Fix"

Streaming M1 bars and rebuilding in frontend is **automating a broken architecture**, not fixing it.

**Note:** An incremental update function (`updateProfileWithTick`) already exists but is disabled. Simply re-enabling it would not solve the architectural issues (wrong layer, adaptive bucket incompatibility).

### The Real Fix

**Move TPO aggregation to backend, send profile deltas to frontend.**

This addresses:
- ✅ Correct layer separation (backend processes, frontend renders)
- ✅ Efficient updates (deltas vs full rebuilds)
- ✅ Simple data model (fixed bucket size)
- ✅ Crystal Clarity compliance (short functions, clear responsibilities)

---

**Status:** Ready for implementation decision

**Next Steps:**
1. Review and approve proposed architecture
2. Decide: implement proper fix or accept current limitations
3. If approved: begin Phase 1 implementation
